// Read-only verification against real records and an actual API. Never creates test services.
// KESHILLAKOS_SERVICE_API_URL=http://localhost:4000 node --test test/serviceVisibility.integration.cjs
const test = require('node:test'), assert = require('node:assert/strict')
const base = process.env.KESHILLAKOS_SERVICE_API_URL

test('real published services are discoverable without Pro, preserve relationships, and open in detail/profile APIs', { skip: !base }, async () => {
  require('dotenv').config({ quiet: true })
  const mongoose = require('mongoose')
  await mongoose.connect(process.env.MONGODB_URI, { autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 10000 })
  try {
    const db = mongoose.connection.db
    const offers = await db.collection('serviceoffers').aggregate([
      { $match: { status: 'published', visibility: 'public', 'moderation.status': 'approved' } },
      { $lookup: { from: 'providerprofiles', localField: 'providerProfile', foreignField: '_id', as: 'profile' } },
      { $unwind: '$profile' },
      { $match: { 'profile.status': 'published', 'profile.moderation.status': 'approved' } },
      { $lookup: { from: 'users', localField: 'profile.ownerUser', foreignField: '_id', as: 'owner' } },
      { $unwind: '$owner' },
      { $match: { 'owner.uid': { $exists: true, $ne: '' }, 'owner.accountStatus': { $nin: ['suspended','closed'] } } },
      { $lookup: { from: 'categories', localField: 'category', foreignField: '_id', as: 'categoryDoc' } },
      { $unwind: '$categoryDoc' }, { $match: { 'categoryDoc.status': 'active' } },
      { $lookup: { from: 'businesses', localField: 'business', foreignField: '_id', as: 'businessDoc' } },
      { $match: { $or: [{ business: { $exists: false } }, { business: null }, { 'businessDoc.status': 'active' }] } },
      { $project: { name: 1, providerProfile: 1, business: 1, staffUser: 1, 'owner.uid': 1, 'categoryDoc.stableId': 1, 'profile.providerType': 1 } },
    ]).toArray()
    assert.ok(offers.length > 0, 'real published records must exist for this test')
    const get = async path => { const response = await fetch(base+path); assert.equal(response.status,200,path); return response.json() }
    const data = await get('/api/services?limit=100')
    const byId = new Map(data.services.map(s => [s.id,s]))
    for (const offer of offers) {
      const id=String(offer._id), card=byId.get(id)
      assert.ok(card, `published offer ${id} is missing`)
      assert.equal(card.title, offer.name)
      assert.equal(card.providerId, String(offer.providerProfile))
      assert.equal(card.providerUid, offer.owner.uid)
      assert.equal(card.categoryId, offer.categoryDoc.stableId)
      assert.equal(card.businessId, offer.business ? String(offer.business) : undefined)
      assert.equal(card.staffUserId, offer.staffUser ? String(offer.staffUser) : undefined)
      const detail=await get('/api/services/'+id)
      assert.equal(detail.service.title,offer.name)
      const owner=await get('/api/providers/'+offer.owner.uid+'?limit=100')
      assert.ok(owner.services.some(s=>s.id===id), 'public owner profile must retain its services on Basic')
    }
    const pages=[]
    for(let p=1;p<=Math.ceil(data.pagination.total/2);p++) pages.push(...(await get('/api/services?limit=2&page='+p)).services)
    assert.equal(new Set(pages.map(s=>s.id)).size,data.pagination.total)
    const category=offers[0].categoryDoc.stableId
    const filtered=await get('/api/services?limit=100&categoryId='+category)
    assert.ok(filtered.services.length>0)
    assert.ok(filtered.services.every(s=>s.categoryId===category))
    const counts=await get('/api/services?countsOnly=true')
    assert.equal(counts.summary.total,data.pagination.total)
    assert.equal(counts.services.length,0)
    const subscriptions=await db.collection('subscriptions').find({ownerUid:{$in:offers.map(o=>o.owner.uid)},plan:'pro',status:{$in:['active','trialing']}}).toArray()
    console.log(JSON.stringify({verifiedRealOffers:offers.length,apiTotal:data.pagination.total,proSubscriptions:subscriptions.length,databaseWrites:0}))
  } finally { await mongoose.disconnect() }
})
