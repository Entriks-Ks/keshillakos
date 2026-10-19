// Explicitly opt in; always uses an isolated localhost database, never .env/MONGODB_URI.
const test = require('node:test'), assert = require('node:assert/strict')
const enabled = process.env.KK_PROFILE_INTEGRATION === '1'
test('profile routes persist descriptions, experience and language skills through real MongoDB', { skip: !enabled }, async t => {
  const path = require('node:path'), mongoose = require('mongoose'), express = require('express')
  const root = process.env.KK_PROFILE_BUILD || path.resolve(__dirname, '../dist')
  const { User } = require(path.join(root, 'models/User'))
  const { ProviderProfile } = require(path.join(root, 'models/ProviderProfile'))
  const { CatalogOption } = require(path.join(root, 'models/CatalogOption'))
  const { Subscription } = require(path.join(root, 'models/Subscription'))
  const firebase = require(path.join(root, 'services/firebaseAuth'))
  const verify = firebase.firebaseVerifyIdToken
  firebase.firebaseVerifyIdToken = async token => {
    if (!['customer', 'provider', 'other'].includes(token)) throw Error('Invalid test token')
    return { localId: token, email: `${token}@example.invalid` }
  }
  const uri = `mongodb://127.0.0.1:27029/kk_profile_details_test_${process.pid}`
  let server
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 })
    const location = { countryId: new mongoose.Types.ObjectId(), cityId: new mongoose.Types.ObjectId() }
    const customer = await User.create({ uid: 'customer', email: 'customer@example.invalid', name: 'Customer', roles: ['user'], bio: 'Existing biography', languages: ['Shqip'], location })
    const owner = await User.create({ uid: 'provider', email: 'provider@example.invalid', name: 'Provider', roles: ['user', 'provider'], activeContext: 'provider', bio: 'Legacy bio', languages: ['Shqip'] })
    await User.create({ uid: 'other', email: 'other@example.invalid', name: 'Other', roles: ['user', 'provider'] })
    await CatalogOption.create([{ group: 'language', slug: 'albanian', name: { sq: 'Shqip', en: 'Albanian' }, order: 1 }, { group: 'language', slug: 'german', name: { sq: 'Gjermanisht', en: 'German' }, order: 2 }])
    const provider = await ProviderProfile.create({ ownerUser: owner._id, providerType: 'individual', categories: ['law'], modes: ['online'], languages: ['Shqip'], publicProfile: { displayName: 'Provider', description: 'Existing professional description', shortDescription: 'Original short description' } })
    await Subscription.create({ ownerUid: 'provider', audience: 'provider', plan: 'pro', status: 'active' })
    const app = express(); app.use(express.json()); app.use('/api/auth', require(path.join(root, 'routes/auth.routes')).default); app.use('/api/providers', require(path.join(root, 'routes/providerProfile.routes')).default)
    server = await new Promise(resolve => { const http = app.listen(0, '127.0.0.1', () => resolve(http)) })
    const url = `http://127.0.0.1:${server.address().port}`
    async function request(route, token = 'customer', body) {
      const response = await fetch(url + route, { method: body === undefined ? 'GET' : 'PATCH', headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
      return { status: response.status, data: await response.json() }
    }
    const work = { position: 'Engineer', organization: 'Studio', from: { month: 2, year: 2020 }, to: { month: 8, year: 2024 }, current: false, description: 'Built useful things' }
    await t.test('authentication is required; body IDs cannot change another user', async () => {
      assert.equal((await request('/api/auth/me', '', { bio: 'unauthorized' })).status, 401)
      const result = await request('/api/auth/me', 'customer', { uid: 'other', bio: 'My real description' })
      assert.equal(result.status, 200); assert.equal(result.data.user.uid, 'customer')
      assert.equal((await User.findOne({ uid: 'other' })).bio, undefined)
    })
    await t.test('description save/reopen preserves location, legacy languages and provider descriptions', async () => {
      const result = await request('/api/auth/me')
      assert.equal(result.data.user.bio, 'My real description')
      assert.deepEqual(result.data.user.savedLocation, { countryId: String(location.countryId), cityId: String(location.cityId) })
      assert.deepEqual(result.data.user.languages, ['Shqip'])
      assert.equal((await ProviderProfile.findById(provider._id)).publicProfile.description, 'Existing professional description')
      assert.equal(result.data.user.profileEditLimits.description, 3000)
      assert.equal((await request('/api/auth/me', 'customer', { bio: 'x'.repeat(3001) })).status, 400)
      assert.equal((await request('/api/auth/me', 'customer', { bio: 7 })).status, 400)
    })
    await t.test('experience supports create, edit, read and delete without touching other fields', async () => {
      assert.equal((await request('/api/auth/me', 'customer', { workExperience: [work] })).status, 200)
      let saved = (await request('/api/auth/me')).data.user
      assert.equal(saved.workExperience[0].position, 'Engineer')
      assert.equal((await request('/api/auth/me', 'customer', { workExperience: [{ ...work, position: 'Lead' }, { ...work, current: true }] })).status, 200)
      saved = (await request('/api/auth/me')).data.user
      assert.equal(saved.workExperience.length, 2); assert.equal(saved.workExperience[0].position, 'Lead'); assert.equal(saved.workExperience[1].to, undefined)
      assert.equal((await request('/api/auth/me', 'customer', { workExperience: [saved.workExperience[1]] })).status, 200)
      assert.equal((await request('/api/auth/me')).data.user.workExperience.length, 1)
      assert.equal((await request('/api/auth/me', 'customer', { workExperience: [] })).status, 200)
      assert.equal((await request('/api/auth/me')).data.user.workExperience.length, 0)
      assert.equal((await User.findById(customer._id)).bio, 'My real description')
    })
    await t.test('invalid titles, lengths, date ranges, current flags and list limits never persist', async () => {
      for (const value of [[{ ...work, position: '' }], [{ ...work, position: 'x'.repeat(161) }], [{ ...work, to: { month: 1, year: 2019 } }], [{ ...work, from: { month: 13, year: 2020 } }], [{ ...work, current: 'yes' }], [{ ...work, to: undefined }], Array(31).fill(work)]) {
        assert.equal((await request('/api/auth/me', 'customer', { workExperience: value })).status, 400)
        assert.equal((await User.findById(customer._id)).workExperience.length, 0)
      }
    })
    await t.test('language CRUD keeps web-compatible names and preserves unspecified legacy levels', async () => {
      let result = await request('/api/auth/me', 'customer', { languageSkills: [{ language: 'Shqip' }, { language: 'Gjermanisht', proficiency: 'advanced' }] })
      assert.equal(result.status, 200); assert.deepEqual(result.data.user.languages, ['Shqip', 'Gjermanisht'])
      result = await request('/api/auth/me', 'customer', { languageSkills: [{ language: 'Shqip', proficiency: 'native' }, { language: 'Gjermanisht', proficiency: 'intermediate' }] })
      assert.equal(result.data.user.languageSkills[1].proficiency, 'intermediate')
      // Existing web payloads must not erase proficiency when changing selected names.
      await request('/api/auth/me', 'customer', { languages: ['Gjermanisht'] })
      result = await request('/api/auth/me'); assert.equal(result.data.user.languageSkills[0].proficiency, 'intermediate')
      await request('/api/auth/me', 'customer', { languageSkills: [] })
      result = await request('/api/auth/me'); assert.deepEqual(result.data.user.languages, []); assert.deepEqual(result.data.user.languageSkills, [])
    })
    await t.test('unsupported/duplicate language names and levels are rejected', async () => {
      for (const languageSkills of [[{ language: 'Shqip', proficiency: 'native' }, { language: 'shqip', proficiency: 'advanced' }], [{ language: 'Invented', proficiency: 'native' }], [{ language: 'Shqip', proficiency: 'expert' }], [{ language: 'Shqip' }]]) {
        assert.equal((await request('/api/auth/me', 'customer', { languageSkills })).status, 400)
      }
    })
    await t.test('provider uses existing ID, own authorization, partial updates and actual plan limits', async () => {
      const route = `/api/providers/${provider._id}`
      assert.equal((await request(route, 'other', { publicProfile: { description: 'Stolen' } })).status, 400)
      const result = await request(route, 'provider', { publicProfile: { description: 'New professional description' }, workExperience: [work], languageSkills: [{ language: 'Shqip', proficiency: 'native' }] })
      assert.equal(result.status, 200); assert.equal(result.data.provider.publicProfile.description, 'New professional description')
      assert.equal(result.data.provider.publicProfile.shortDescription, 'Original short description')
      assert.equal(result.data.provider.workExperience.length, 1); assert.deepEqual(result.data.provider.languages, ['Shqip'])
      let mine = (await request('/api/providers/mine', 'provider')).data.providers[0]
      assert.equal(mine.editLimits.description, 2000); assert.equal(mine.editLimits.career, true)
      assert.equal(mine.languageSkills[0].proficiency, 'native')
      await request(route, 'provider', { workExperience: [{ ...work, position: 'Lead' }], languageSkills: [{ language: 'Shqip', proficiency: 'advanced' }] })
      mine = (await request('/api/providers/mine', 'provider')).data.providers[0]
      assert.equal(mine.workExperience[0].position, 'Lead'); assert.equal(mine.languageSkills[0].proficiency, 'advanced')
      const publicDetails = await require(path.join(root, 'services/providerPublicService')).getPublicProviderProfile('provider')
      assert.equal(publicDetails.bio, 'New professional description'); assert.equal(publicDetails.workExperience[0].position, 'Lead'); assert.equal(publicDetails.languageSkills[0].proficiency, 'advanced')
      await request(route, 'provider', { publicProfile: { description: '' } })
      assert.equal((await require(path.join(root, 'services/providerPublicService')).getPublicProviderProfile('provider')).bio, '')
      assert.equal((await ProviderProfile.findById(provider._id)).publicProfile.shortDescription, 'Original short description')
      await request(route, 'provider', { publicProfile: { description: 'New professional description' } })
      await request(route, 'provider', { workExperience: [], languageSkills: [] })
      mine = (await request('/api/providers/mine', 'provider')).data.providers[0]
      assert.equal(mine.workExperience.length, 0); assert.equal(mine.languageSkills.length, 0); assert.equal(mine.languages.length, 0)
      await request(route, 'provider', { workExperience: [work], languageSkills: [{ language: 'Shqip', proficiency: 'native' }] })
      await Subscription.updateOne({ ownerUid: 'provider' }, { $set: { plan: 'basic' } })
      assert.equal((await request(route, 'provider', { workExperience: [] })).status, 400)
      assert.equal((await request(route, 'provider', { languageSkills: [] })).status, 400)
      assert.equal((await ProviderProfile.findById(provider._id)).workExperience.length, 1)
      mine = (await request('/api/providers/mine', 'provider')).data.providers[0]
      assert.equal(mine.editLimits.description, 250); assert.equal(mine.editLimits.career, false)
      assert.equal((await request(route, 'provider', { publicProfile: { description: 'x'.repeat(251) } })).status, 400)
    })
    await t.test('database reconnect and fresh authenticated reads retain saved fields', async () => {
      await request('/api/auth/me', 'customer', { languageSkills: [{ language: 'Gjermanisht', proficiency: 'advanced' }], workExperience: [work] })
      await mongoose.disconnect(); await mongoose.connect(uri)
      const saved = (await request('/api/auth/me')).data.user
      assert.equal(saved.bio, 'My real description'); assert.equal(saved.workExperience.length, 1)
      assert.equal(saved.languageSkills[0].proficiency, 'advanced'); assert.ok(saved.savedLocation)
      assert.equal((await request('/api/providers/mine', 'provider')).data.providers[0].publicProfile.description, 'New professional description')
    })
  } finally {
    firebase.firebaseVerifyIdToken = verify
    if (server) await new Promise(resolve => server.close(resolve))
    if (mongoose.connection.readyState) await mongoose.connection.dropDatabase()
    await mongoose.disconnect()
  }
})
