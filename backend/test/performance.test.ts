import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Types } from 'mongoose'
import express from 'express'
import compression from 'compression'
import http from 'node:http'
import { gunzipSync, brotliDecompressSync } from 'node:zlib'
import { publicCache } from '../src/middleware/publicCache'
import { Business } from '../src/models/Business'
import { ProviderProfile } from '../src/models/ProviderProfile'
import { RatingAggregate } from '../src/models/RatingAggregate'
import { Review } from '../src/models/Review'
import { User } from '../src/models/User'
import { getStatsForProviders } from '../src/services/ratingService'

test('batched ratings preserve weighted account-wide ratings and manager eligibility', async () => {
  const owner = new Types.ObjectId(), manager = new Types.ObjectId(), member = new Types.ObjectId()
  const businessId = new Types.ObjectId(), personalId = new Types.ObjectId(), companyId = new Types.ObjectId()
  const originals = [User.find, Business.find, ProviderProfile.find, RatingAggregate.find, Review.find] as const
  let reads = 0
  const rows = (value: unknown[]) => { reads++; return { select: () => ({ lean: async () => value }), lean: async () => value } }
  User.find = (() => rows([{ _id: owner, uid: 'owner' }, { _id: manager, uid: 'manager' }, { _id: member, uid: 'member' }])) as unknown as typeof User.find
  Business.find = (() => rows([{ _id: businessId, owners: [owner], members: [{ user: manager, role: 'manager' }, { user: member, role: 'expert' }] }])) as unknown as typeof Business.find
  ProviderProfile.find = (() => rows([{ _id: personalId, ownerUser: owner }, { _id: companyId, ownerUser: owner, business: businessId }])) as unknown as typeof ProviderProfile.find
  RatingAggregate.find = (() => rows([
    { scope: 'provider', subjectId: personalId, average: 5, count: 2, verifiedCount: 1 },
    { scope: 'provider', subjectId: companyId, average: 3, count: 1, verifiedCount: 1 },
    { scope: 'business', subjectId: businessId, average: 4, count: 3, verifiedCount: 2 },
  ])) as unknown as typeof RatingAggregate.find
  Review.find = (() => ({ limit: async () => [] })) as unknown as typeof Review.find
  try {
    const stats = await getStatsForProviders(['owner', 'manager', 'member', 'missing', 'owner'])
    assert.deepEqual(stats.get('owner'), { providerUid: 'owner', average: 4.2, count: 6, verifiedCount: 4 })
    assert.deepEqual(stats.get('manager'), { providerUid: 'manager', average: 3.8, count: 4, verifiedCount: 3 })
    for (const uid of ['member', 'missing']) assert.deepEqual(stats.get(uid), { providerUid: uid, average: 0, count: 0, verifiedCount: 0 })
    assert.equal(reads, 4, 'collection reads must remain bounded across multiple accounts')
  } finally {
    [User.find, Business.find, ProviderProfile.find, RatingAggregate.find, Review.find] = originals
  }
})

test('compression negotiates gzip/Brotli and caching excludes private/error responses', async () => {
  const app = express()
  const payload = { value: 'repeatable public content '.repeat(200) }
  app.use(compression(), publicCache)
  app.get('/api/v1/categories', (_req, res) => res.json(payload))
  app.get('/api/services', (_req, res) => res.json(payload))
  app.get('/api/providers', (_req, res) => res.status(400).json(payload))
  app.get('/api/providers/mine', (_req, res) => res.json(payload))
  const server = app.listen(0, '127.0.0.1')
  await new Promise<void>((resolve) => server.once('listening', resolve))
  const address = server.address() as { port: number }
  const request = (path: string, encoding = 'identity', etag?: string) => new Promise<{ status: number; headers: http.IncomingHttpHeaders; body: Buffer }>((resolve, reject) => {
    http.get({ hostname: '127.0.0.1', port: address.port, path,
      headers: { 'Accept-Encoding': encoding, ...(etag ? { 'If-None-Match': etag } : {}) } }, (response) => {
      const chunks: Buffer[] = []
      response.on('data', (chunk) => chunks.push(chunk))
      response.on('end', () => resolve({ status: response.statusCode!, headers: response.headers, body: Buffer.concat(chunks) }))
    }).on('error', reject)
  })
  try {
    for (const encoding of ['gzip', 'br']) {
      const response = await request('/api/v1/categories', encoding)
      assert.equal(response.headers['content-encoding'], encoding)
      assert.deepEqual(JSON.parse((encoding === 'gzip' ? gunzipSync : brotliDecompressSync)(response.body).toString()), payload)
      assert.ok(response.body.length < JSON.stringify(payload).length / 2)
      assert.equal(response.headers['cache-control'], 'public, max-age=300, must-revalidate')
      assert.match(response.headers.vary!, /Accept-Encoding/)
    }
    const response = await request('/api/services')
    assert.equal(response.headers['cache-control'], 'public, max-age=0, must-revalidate')
    assert.equal((await request('/api/services', 'identity', response.headers.etag)).status, 304)
    assert.equal((await request('/api/providers')).headers['cache-control'], 'no-store')
    assert.equal((await request('/api/providers/mine')).headers['cache-control'], undefined)
  } finally { await new Promise<void>((resolve) => server.close(() => resolve())) }
})
