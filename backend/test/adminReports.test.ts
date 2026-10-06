import assert from 'node:assert/strict'
import test from 'node:test'
import http from 'node:http'
import express from 'express'
import { Types } from 'mongoose'
import { PlatformFeedback } from '../src/models/PlatformFeedback'
import { Conversation } from '../src/models/Conversation'
import { User } from '../src/models/User'
import { listPlatformFeedback, markPlatformFeedbackRead } from '../src/services/platformFeedbackService'
import { listUserReports, redactReportIds, reportStatus, updateReportStatus } from '../src/services/adminReportService'
import { notificationView } from '../src/services/notificationService'

function chain(value: unknown): any { const q = { sort: () => q, skip: () => q, limit: () => q, select: () => q, lean: async () => value }; return q }
test('feedback list, counts and read action exclude reports at the database query boundary', async () => {
  const originals = [PlatformFeedback.countDocuments, PlatformFeedback.find, PlatformFeedback.findOneAndUpdate] as const
  const filters: any[] = []
  PlatformFeedback.countDocuments = (async (filter: any) => { filters.push(filter); return 0 }) as any
  PlatformFeedback.find = ((filter: any) => { filters.push(filter); return chain([]) }) as any
  PlatformFeedback.findOneAndUpdate = ((filter: any) => { filters.push(filter); return chain(null) }) as any
  try {
    assert.equal((await listPlatformFeedback()).length, 0)
    assert.equal(await markPlatformFeedbackRead(String(new Types.ObjectId())), null)
    assert.ok(filters.every(filter => filter.chatReport.$exists === false))
  } finally { [PlatformFeedback.countDocuments, PlatformFeedback.find, PlatformFeedback.findOneAndUpdate] = originals }
})

test('reports use structured reasons and batch-resolved names, never legacy technical message strings', async () => {
  const originals = [PlatformFeedback.countDocuments, PlatformFeedback.find, PlatformFeedback.findOneAndUpdate, User.find, Conversation.find] as const
  const id = new Types.ObjectId(), conversationId = String(new Types.ObjectId())
  const row: any = { _id: id, userUid: 'reporter-firebase-uid', name: 'Reporter', email: '', status: 'new', createdAt: new Date(), message: `Raportim përdoruesi target-firebase-uid · Biseda ${conversationId}`, chatReport: { conversationId, reportedUid: 'target-firebase-uid', reason: `Sjellje e papërshtatshme ${conversationId}` } }
  let captured: any
  PlatformFeedback.countDocuments = (async () => 1) as any
  PlatformFeedback.find = ((filter: any) => { captured = filter; return chain([row]) }) as any
  PlatformFeedback.findOneAndUpdate = ((filter: any, update: any) => { captured = filter; row.chatReport.reviewStatus = update.$set['chatReport.reviewStatus']; return chain(row) }) as any
  User.find = (() => chain([{ uid: row.userUid, name: 'Ana', email: 'ana@example.com', roles: ['user'] }, { uid: row.chatReport.reportedUid, name: 'Adonis Hajdaraj', email: '', roles: ['user', 'provider'] }])) as any
  Conversation.find = (() => chain([{ _id: new Types.ObjectId(conversationId), seekerUid: row.userUid, providerUid: row.chatReport.reportedUid, serviceTitle: 'Këshillim juridik' }])) as any
  try {
    const reports = await listUserReports()
    assert.equal(captured.chatReport.$exists, true)
    assert.equal(reports[0].reported.name, 'Adonis Hajdaraj'); assert.equal(reports[0].reporter.name, 'Ana')
    assert.equal(reports[0].serviceTitle, 'Këshillim juridik')
    assert.equal(reports[0].reason.includes(conversationId), false)
    assert.equal('message' in reports[0], false)
    await assert.rejects(updateReportStatus(String(id), 'invalid'), { status: 400 })
    assert.equal((await updateReportStatus(String(id), 'resolved')).status, 'resolved')
    assert.deepEqual(captured['chatReport.reviewStatus'].$nin, ['resolved', 'dismissed'])
  } finally { [PlatformFeedback.countDocuments, PlatformFeedback.find, PlatformFeedback.findOneAndUpdate, User.find, Conversation.find] = originals }
})

test('legacy reports retain review status and their old notification opens Raportime', () => {
  assert.equal(reportStatus({ status: 'read', chatReport: {} }), 'reviewing')
  const notification = notificationView({ _id: 'internal', type: 'feedback:new', title: 'Raportim përdoruesi në chat', body: '', href: '/dashboard/admin/feedback', createdAt: new Date() })
  assert.equal(notification.href, '/dashboard/admin/reports')
  assert.equal(notification.type, 'report:new')
  assert.equal(redactReportIds('zsyzy83Mv4avFx37lvUZZIk0pzE2 6abb7c453a75178a22f9cd3c', []).includes('zsyzy'), false)
})

test('report list/detail/status endpoints authenticate and reject non-admins', async () => {
  process.env.FIREBASE_API_KEY = 'test-only-key'
  const { default: feedbackRouter } = await import('../src/routes/feedback.routes')
  const originalFetch = global.fetch
  const originals = [User.findOne, PlatformFeedback.countDocuments, PlatformFeedback.find, Conversation.find] as const
  global.fetch = (async (url: any, init: any) => {
    if (String(url).startsWith('http://127.0.0.1')) return originalFetch(url, init)
    return { ok: true, json: async () => ({ users: [{ localId: JSON.parse(init.body).idToken }] }) }
  }) as any
  User.findOne = ((filter: any) => chain({ uid: filter.uid, name: 'Emër', email: 'test@example.com', roles: filter.uid === 'admin' ? ['user', 'admin'] : ['user'], accountStatus: 'active' })) as any
  PlatformFeedback.countDocuments = (async () => 0) as any
  PlatformFeedback.find = (() => chain([])) as any
  Conversation.find = (() => chain([])) as any
  const app = express(); app.use(express.json()); app.use('/api/feedback', feedbackRouter)
  const server = http.createServer(app)
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const base = `http://127.0.0.1:${(server.address() as any).port}/api/feedback/reports`
  const id = String(new Types.ObjectId())
  try {
    for (const path of ['', `/${id}`, `/${id}/status`]) {
      const method = path.endsWith('/status') ? 'PATCH' : 'GET'
      assert.equal((await fetch(base + path, { method })).status, 401)
      assert.equal((await fetch(base + path, { method, headers: { Authorization: 'Bearer user' } })).status, 403)
    }
    const result = await fetch(base, { headers: { Authorization: 'Bearer admin' } })
    assert.equal(result.status, 200); assert.deepEqual((await result.json() as any).reports, [])
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()))
    global.fetch = originalFetch
    ;[User.findOne, PlatformFeedback.countDocuments, PlatformFeedback.find, Conversation.find] = originals
  }
})
