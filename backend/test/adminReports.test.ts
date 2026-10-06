import assert from 'node:assert/strict'
import test from 'node:test'
import http from 'node:http'
import express from 'express'
import { Types } from 'mongoose'
import { PlatformFeedback } from '../src/models/PlatformFeedback'
import { Conversation } from '../src/models/Conversation'
import { User } from '../src/models/User'
import { listPlatformFeedback, markPlatformFeedbackRead } from '../src/services/platformFeedbackService'
import { listUserReports, redactReportIds, reportStatus, reportDecision, reportListOptions, reportConversationEvidence, reportRequestEvidence, updateReportStatus } from '../src/services/adminReportService'
import { Message } from '../src/models/Message'
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
  const originals = [PlatformFeedback.countDocuments, PlatformFeedback.aggregate, PlatformFeedback.findOneAndUpdate, User.find, Conversation.find] as const
  const id = new Types.ObjectId(), conversationId = String(new Types.ObjectId())
  const row: any = { _id: id, userUid: 'reporter-firebase-uid', name: 'Reporter', email: '', status: 'new', createdAt: new Date(), message: `Raportim përdoruesi target-firebase-uid · Biseda ${conversationId}`, chatReport: { conversationId, reportedUid: 'target-firebase-uid', reason: `Sjellje e papërshtatshme ${conversationId}` } }
  let captured: any
  PlatformFeedback.countDocuments = (async () => 1) as any
  PlatformFeedback.aggregate = (async (pipeline: any) => { if (pipeline[1].$group) return [{ _id: 'reviewing', count: 1 }]; captured = pipeline[0].$match; return [row] }) as any
  PlatformFeedback.findOneAndUpdate = ((filter: any, update: any) => { captured = filter; for (const [key, value] of Object.entries(update.$set)) { if (key.startsWith('chatReport.')) row.chatReport[key.slice(11)] = value; else row[key] = value }; return chain(row) }) as any
  User.find = (() => chain([{ uid: row.userUid, name: 'Ana', email: 'ana@example.com', roles: ['user'] }, { uid: row.chatReport.reportedUid, name: 'Adonis Hajdaraj', email: '', roles: ['user', 'provider'] }])) as any
  Conversation.find = (() => chain([{ _id: new Types.ObjectId(conversationId), seekerUid: row.userUid, providerUid: row.chatReport.reportedUid, serviceTitle: 'Këshillim juridik' }])) as any
  try {
    const reports = await listUserReports()
    assert.equal(captured.chatReport.$exists, true)
    assert.equal(reports[0].reported.name, 'Adonis Hajdaraj'); assert.equal(reports[0].reporter.name, 'Ana')
    assert.equal(reports[0].serviceTitle, 'Këshillim juridik')
    assert.equal(reports[0].reason.includes(conversationId), false)
    assert.equal('message' in reports[0], false)
    assert.deepEqual(reports.summary, { total: 1, reviewing: 1, resolved: 0, rejected: 0 })
    await assert.rejects(updateReportStatus(String(id), 'invalid', 'admin'), { status: 400 })
    const resolved = await updateReportStatus(String(id), 'resolved', 'admin', 'Veprimi i përshtatshëm është kryer')
    assert.equal(resolved.status, 'resolved')
    assert.equal(resolved.resolution?.note, 'Veprimi i përshtatshëm është kryer')
    assert.ok(resolved.resolution?.at)
    assert.equal(row.chatReport.reviewedBy, 'admin')
    assert.equal(row.status, 'read')
    assert.deepEqual(captured['chatReport.reviewStatus'].$nin, ['resolved', 'dismissed', 'rejected'])
  } finally { [PlatformFeedback.countDocuments, PlatformFeedback.aggregate, PlatformFeedback.findOneAndUpdate, User.find, Conversation.find] = originals }
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
  const originals = [User.findOne, User.find, PlatformFeedback.countDocuments, PlatformFeedback.aggregate, PlatformFeedback.findOneAndUpdate, Conversation.find] as const
  let decisionUpdate: any
  global.fetch = (async (url: any, init: any) => {
    if (String(url).startsWith('http://127.0.0.1')) return originalFetch(url, init)
    return { ok: true, json: async () => ({ users: [{ localId: JSON.parse(init.body).idToken }] }) }
  }) as any
  User.findOne = ((filter: any) => chain({ uid: filter.uid, name: 'Emër', email: 'test@example.com', roles: filter.uid === 'admin' ? ['user', 'admin'] : ['user'], accountStatus: 'active' })) as any
  PlatformFeedback.countDocuments = (async () => 0) as any
  PlatformFeedback.aggregate = (async () => []) as any
  User.find = (() => chain([{ uid: 'admin', name: 'Administratori', roles: ['user', 'admin'] }])) as any
  PlatformFeedback.findOneAndUpdate = ((_filter: any, update: any) => { decisionUpdate = update; return chain({ _id: new Types.ObjectId(), userUid: 'reporter', name: 'Ana', createdAt: new Date(), status: 'read', chatReport: { conversationId: String(new Types.ObjectId()), reportedUid: 'reported', reason: 'Arsyeja e raportimit', reviewStatus: update.$set['chatReport.reviewStatus'], reviewedBy: update.$set['chatReport.reviewedBy'], reviewedAt: update.$set['chatReport.reviewedAt'], adminNote: update.$set['chatReport.adminNote'] } }) }) as any
  Conversation.find = (() => chain([])) as any
  const app = express(); app.use(express.json()); app.use('/api/feedback', feedbackRouter)
  const server = http.createServer(app)
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const base = `http://127.0.0.1:${(server.address() as any).port}/api/feedback/reports`
  const id = String(new Types.ObjectId())
  try {
    for (const path of ['', `/${id}`, `/${id}/status`, `/${id}/conversation`, `/${id}/request`]) {
      const method = path.endsWith('/status') ? 'PATCH' : 'GET'
      assert.equal((await fetch(base + path, { method })).status, 401)
      assert.equal((await fetch(base + path, { method, headers: { Authorization: 'Bearer user' } })).status, 403)
    }
    const result = await fetch(base, { headers: { Authorization: 'Bearer admin' } })
    assert.equal(result.status, 200); assert.deepEqual((await result.json() as any).reports, [])
    const decision = await fetch(`${base}/${id}/status`, { method: 'PATCH', headers: { Authorization: 'Bearer admin', 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'resolved', note: 'Veprimi i përshtatshëm është kryer', reviewedBy: 'attacker' }) })
    assert.equal(decision.status, 200)
    assert.equal(decisionUpdate.$set['chatReport.reviewedBy'], 'admin')
    assert.ok(decisionUpdate.$set['chatReport.reviewedAt'] instanceof Date)
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()))
    global.fetch = originalFetch
    ;[User.findOne, User.find, PlatformFeedback.countDocuments, PlatformFeedback.aggregate, PlatformFeedback.findOneAndUpdate, Conversation.find] = originals
  }
})

test('canonical report semantics, filters and decisions reject ambiguity and require a meaningful authenticated note', () => {
  for (const status of ['new', 'reviewing', undefined]) assert.equal(reportStatus({ status: 'new', chatReport: { reviewStatus: status } }), 'reviewing')
  assert.equal(reportStatus({ status: 'read', chatReport: { reviewStatus: 'dismissed' } }), 'rejected')
  assert.equal(reportStatus({ status: 'read', chatReport: { reviewStatus: 'resolved' } }), 'resolved')
  assert.deepEqual(reportListOptions({}), { status: 'all', sort: 'priority' })
  assert.throws(() => reportListOptions({ status: ['reviewing'] }), { status: 400 })
  assert.throws(() => reportListOptions({ sort: 'random' }), { status: 400 })
  assert.throws(() => reportDecision('resolved', '', 'admin'), { status: 400 })
  assert.throws(() => reportDecision('rejected', 'x'.repeat(1001), 'admin'), { status: 400 })
  assert.throws(() => reportDecision('rejected', 'Një shënim', ''), { status: 403 })
  assert.deepEqual(reportDecision('rejected', '  Nuk ka shkelje  ', 'admin'), { status: 'rejected', note: 'Nuk ka shkelje' })
})

test('closed report decisions cannot be overwritten, including legacy closed cases', async () => {
  const original = PlatformFeedback.findOneAndUpdate
  let filter: any
  PlatformFeedback.findOneAndUpdate = ((value: any) => { filter = value; return chain(null) }) as any
  try {
    await assert.rejects(updateReportStatus(String(new Types.ObjectId()), 'rejected', 'admin', 'Vendim i ri'), { status: 409 })
    assert.deepEqual(filter['chatReport.reviewStatus'].$nin, ['resolved', 'dismissed', 'rejected'])
  } finally { PlatformFeedback.findOneAndUpdate = original }
})

test('inbox sorting prioritizes reviewing then newest and summary remains independent of filter', async () => {
  const originals = [PlatformFeedback.countDocuments, PlatformFeedback.aggregate] as const
  const pipelines: any[] = []
  PlatformFeedback.countDocuments = (async () => 0) as any
  PlatformFeedback.aggregate = (async (pipeline: any) => { pipelines.push(pipeline); return pipeline[1].$group ? [{ _id: 'reviewing', count: 3 }, { _id: 'resolved', count: 2 }, { _id: 'rejected', count: 1 }] : [] }) as any
  try {
    const reports = await listUserReports({ page: 1, limit: 20 }, reportListOptions({ status: 'resolved' }))
    assert.deepEqual(pipelines[0][2].$sort, { _reviewPriority: 1, createdAt: -1, _id: -1 })
    assert.equal(pipelines[0][0].$match.$expr.$eq[1], 'resolved')
    assert.equal(pipelines[1][0].$match.$expr, undefined)
    assert.deepEqual(reports.summary, { total: 6, reviewing: 3, resolved: 2, rejected: 1 })
  } finally { [PlatformFeedback.countDocuments, PlatformFeedback.aggregate] = originals }
})

test('conversation investigation is report-scoped, bounded, redacted, read-only and uses a timestamp/id cursor', async () => {
  const originals = [PlatformFeedback.findOne, Conversation.findById, Message.find, Message.countDocuments, User.find, Conversation.updateOne] as const
  const reportId = new Types.ObjectId(), conversationId = new Types.ObjectId(), messageId = new Types.ObjectId()
  let valid = true, captured: any, limitSeen = 0, reads = 0, writes = 0
  PlatformFeedback.findOne = (() => chain({ _id: reportId, userUid: 'alice', chatReport: { reportedUid: 'bob', conversationId: String(conversationId), reason: 'Raportim i vlefshëm' } })) as any
  Conversation.findById = (async () => ({ _id: conversationId, seekerUid: valid ? 'alice' : 'unrelated', providerUid: valid ? 'bob' : 'foreign' })) as any
  Message.countDocuments = (async () => 1) as any
  Message.find = ((filter: any) => { reads++; captured = filter; const q: any = chain([{ _id: messageId, senderUid: 'alice', body: `Mesazh ${conversationId}`, createdAt: new Date() }]); q.limit = (limit: number) => { limitSeen = limit; return q }; return q }) as any
  User.find = (() => chain([{ uid: 'alice', name: 'Ana' }, { uid: 'bob', name: 'Adonis' }])) as any
  Conversation.updateOne = (async () => { writes++; throw new Error('No read-state writes permitted') }) as any
  try {
    valid = false
    await assert.rejects(reportConversationEvidence(String(reportId), { page: 1, limit: 100 }), { status: 404 })
    await assert.rejects(reportRequestEvidence(String(reportId)), { status: 404 })
    assert.equal(reads, 0)
    valid = true
    const messages = await reportConversationEvidence(String(reportId), { page: 1, limit: 100 }, '2026-10-06T10:00:00Z', String(messageId))
    assert.equal(limitSeen, 30); assert.equal(writes, 0)
    assert.equal(String(captured.conversation), String(conversationId))
    assert.ok(captured.$or[1]._id.$lt)
    assert.equal(messages[0].author, 'Ana'); assert.equal(messages[0].body.includes(String(conversationId)), false)
    assert.equal('senderUid' in messages[0], false)
  } finally { [PlatformFeedback.findOne, Conversation.findById, Message.find, Message.countDocuments, User.find, Conversation.updateOne] = originals }
})
