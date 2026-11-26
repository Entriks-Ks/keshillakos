import assert from 'node:assert/strict'
import test, { mock } from 'node:test'
import { Types } from 'mongoose'
import { ProviderProfile } from '../src/models/ProviderProfile'
import { Subscription } from '../src/models/Subscription'
import { User } from '../src/models/User'
import { Business } from '../src/models/Business'
import { Service } from '../src/models/Service'
import { ServiceOffer } from '../src/models/ServiceOffer'
import { NOT_OWN_UPLOAD_MESSAGE, ownUploadPath, uploadFolder } from '../src/services/mediaService'
import { removeProviderCover, updateProviderCover, updateProviderProfile } from '../src/services/providerProfileService'

/*
 * Covers belong to one account: only its owner can set or remove it, and removing it touches nothing else on the
 * profile. Uploaded files live under the profile's own folder with a unique key (mediaService.storeUploadedFile).
 */

const ownerId = new Types.ObjectId()
const strangerId = new Types.ObjectId()

function profileWithCover() {
  return new ProviderProfile({
    providerType: 'individual', ownerUser: ownerId, categories: ['law'], modes: ['online'], status: 'published',
    moderation: { status: 'approved' },
    publicProfile: { displayName: 'Ada', photoUrl: '/media/providers/p1/photo-1-a.jpg', coverUrl: '/media/providers/p1/cover-1-b.jpg' },
  })
}

/** The unused-file clean-up asks every collection whether a path is still used; answer "yes" so nothing is deleted. */
function stubReferenceLookups() {
  const asked: unknown[] = []
  const answer = async (query: unknown) => { asked.push(query); return { _id: new Types.ObjectId() } }
  for (const model of [User, ProviderProfile, Business, ServiceOffer, Service] as const) mock.method(model, 'exists', answer)
  return asked
}

function signedInAs(userId: Types.ObjectId, profile: InstanceType<typeof ProviderProfile>) {
  mock.method(User, 'findOne', () => ({ select: () => ({ lean: async () => ({ _id: userId }) }) }))
  mock.method(ProviderProfile, 'findById', async () => profile)
  mock.method(Subscription, 'findOne', async () => null)
  mock.method(profile, 'save', async () => profile)
}

test('removing a cover clears only that cover and keeps the profile photo', async (t) => {
  t.after(() => mock.restoreAll())
  const profile = profileWithCover()
  signedInAs(ownerId, profile)
  const asked = stubReferenceLookups()

  await removeProviderCover('owner-uid', String(profile._id))

  assert.equal(profile.publicProfile.coverUrl, '')
  assert.equal(profile.publicProfile.photoUrl, '/media/providers/p1/photo-1-a.jpg')
  assert.equal(profile.status, 'published')
  assert.ok(JSON.stringify(asked).includes('/media/providers/p1/cover-1-b.jpg'), 'the old cover goes to the unused-file clean-up')
})

test('another account cannot remove or replace this cover', async (t) => {
  t.after(() => mock.restoreAll())
  const profile = profileWithCover()
  signedInAs(strangerId, profile)
  stubReferenceLookups()

  await assert.rejects(removeProviderCover('stranger-uid', String(profile._id)), /leje/)
  await assert.rejects(updateProviderCover('stranger-uid', String(profile._id), '/media/providers/x/cover-2-c.jpg'), /leje/)
  assert.equal(profile.publicProfile.coverUrl, '/media/providers/p1/cover-1-b.jpg')
})

test('a cover must be a stored upload path, not an arbitrary URL', async (t) => {
  t.after(() => mock.restoreAll())
  const profile = profileWithCover()
  signedInAs(ownerId, profile)
  await assert.rejects(updateProviderCover('owner-uid', String(profile._id), 'https://example.com/someone-else.jpg'))
  assert.equal(profile.publicProfile.coverUrl, '/media/providers/p1/cover-1-b.jpg')
})

test('an image field only accepts the account\'s own uploads', () => {
  const own = [uploadFolder('providers', 'p1'), uploadFolder('profiles', 'owner-uid')]
  assert.equal(ownUploadPath('/media/providers/p1/photo-1-a.jpg', own), '/media/providers/p1/photo-1-a.jpg')
  assert.equal(ownUploadPath('/media/profiles/owner-uid/1-b.png', own), '/media/profiles/owner-uid/1-b.png')
  assert.equal(ownUploadPath('', own), '', 'empty removes the image')
  assert.equal(ownUploadPath(undefined, own), undefined, 'not sent leaves it alone')
  assert.equal(ownUploadPath('/uploads/profiles/old.jpg', own, '/uploads/profiles/old.jpg'), '/uploads/profiles/old.jpg', 'the stored value may be sent back')

  const refused = [
    '/media/providers/p2/photo-1-a.jpg', // another profile
    '/media/profiles/someone-else/1-b.png', // another account's photo
    '/media/providers/p10/photo-1-a.jpg', // folder name that only starts the same
    '/media/companies/p1/logo-1-c.jpg', // same id, different kind
    '/uploads/profiles/someone.jpg', // legacy path that is not already stored
    'https://example.com/x.jpg',
  ]
  for (const path of refused) assert.throws(() => ownUploadPath(path, own), new RegExp(NOT_OWN_UPLOAD_MESSAGE), path)
})

test('a profile owner cannot point their photo or cover at another account\'s upload', async (t) => {
  t.after(() => mock.restoreAll())
  const profile = profileWithCover()
  signedInAs(ownerId, profile)
  stubReferenceLookups()
  const foreign = '/media/providers/somebody-else/photo-9-z.jpg'

  await assert.rejects(updateProviderProfile('owner-uid', String(profile._id), { publicProfile: { photoUrl: foreign } }), new RegExp(NOT_OWN_UPLOAD_MESSAGE))
  await assert.rejects(updateProviderProfile('owner-uid', String(profile._id), { publicProfile: { coverUrl: foreign } }), new RegExp(NOT_OWN_UPLOAD_MESSAGE))
  assert.equal(profile.publicProfile.photoUrl, '/media/providers/p1/photo-1-a.jpg')
  assert.equal(profile.publicProfile.coverUrl, '/media/providers/p1/cover-1-b.jpg')
})
