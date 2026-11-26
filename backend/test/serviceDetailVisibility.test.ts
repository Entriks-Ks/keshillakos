import assert from 'node:assert/strict'
import test, { mock } from 'node:test'
import { Types, type PipelineStage } from 'mongoose'
import { ProviderProfile } from '../src/models/ProviderProfile'
import { Subscription } from '../src/models/Subscription'
import { User } from '../src/models/User'
import { publicServicesPipeline } from '../src/services/marketplaceQuery'
import { updateProviderProfile } from '../src/services/providerProfileService'

/*
 * Regression: a published service opened from the dashboard answered "Service not found".
 * Saving the expert profile set it back to `pending`; the public detail query hides services of unpublished profiles,
 * while the dashboard kept calling them active.
 */

const ownerId = new Types.ObjectId()

function stubOwner(profile: InstanceType<typeof ProviderProfile>) {
  mock.method(User, 'findOne', () => ({ select: () => ({ lean: async () => ({ _id: ownerId }) }) }))
  mock.method(ProviderProfile, 'findById', async () => profile)
  mock.method(Subscription, 'findOne', async () => null)
  mock.method(profile, 'save', async () => profile)
}

function makeProfile(status: string, moderation: string) {
  return new ProviderProfile({
    providerType: 'individual', ownerUser: ownerId, categories: ['law'], modes: ['online'],
    publicProfile: { displayName: 'Ada' }, status, moderation: { status: moderation },
  })
}

test('editing a published profile keeps it published, so its services stay viewable', async (t) => {
  t.after(() => mock.restoreAll())
  const profile = makeProfile('published', 'approved')
  stubOwner(profile)

  await updateProviderProfile('owner-uid', String(profile._id), { publicProfile: { displayName: 'Ada Lovelace' } })

  assert.equal(profile.publicProfile.displayName, 'Ada Lovelace')
  assert.equal(profile.status, 'published')
  assert.equal(profile.moderation.status, 'approved')
})

test('editing never lifts a suspension or publishes a draft', async (t) => {
  t.after(() => mock.restoreAll())
  for (const [status, moderation] of [['suspended', 'rejected'], ['draft', 'pending']] as const) {
    const profile = makeProfile(status, moderation)
    stubOwner(profile)
    await updateProviderProfile('owner-uid', String(profile._id), { publicProfile: { displayName: 'Ada' } })
    assert.equal(profile.status, status)
    assert.equal(profile.moderation.status, moderation)
    mock.restoreAll()
  }
})

const unionPipeline = (stages: PipelineStage[]) =>
  (stages.find((stage) => '$unionWith' in stage) as PipelineStage.UnionWith).$unionWith as { pipeline: Record<string, unknown>[] }

test('public service eligibility still requires a published, approved provider profile', () => {
  const stages = publicServicesPipeline({ serviceId: new Types.ObjectId().toString() }) as Record<string, unknown>[]
  const requiresPublishedProfile = stages.some((stage) => {
    const match = stage.$match as Record<string, unknown> | undefined
    return match?.['_profile.status'] === 'published' && match?.['_profile.moderation.status'] === 'approved'
  })
  assert.ok(requiresPublishedProfile, 'detail pages must not expose services of unpublished profiles')
})

test('dashboard visibility check narrows both offer and legacy rows to the given ids', () => {
  const ids = [new Types.ObjectId(), new Types.ObjectId()]
  const stages = publicServicesPipeline({}, ids)
  const offerMatch = (stages[0] as { $match: Record<string, unknown> }).$match
  assert.deepEqual(offerMatch._id, { $in: ids })
  assert.equal(offerMatch.status, 'published')
  const legacyMatch = (unionPipeline(stages).pipeline[0] as { $match: Record<string, unknown> }).$match
  assert.deepEqual(legacyMatch._id, { $in: ids })
  assert.equal(legacyMatch.active, true)

  const unrestricted = publicServicesPipeline({})
  assert.equal(((unrestricted[0] as { $match: Record<string, unknown> }).$match)._id, undefined)
  assert.equal(((unionPipeline(unrestricted).pipeline[0] as { $match: Record<string, unknown> }).$match)._id, undefined)
})
