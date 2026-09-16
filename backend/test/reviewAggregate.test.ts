import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Types } from 'mongoose'
import { Rating } from '../src/models/Rating'
import { RatingAggregate, ratingAggregateSchema } from '../src/models/RatingAggregate'
import { Review, reviewIsAggregateEligible, reviewSchema } from '../src/models/Review'
import { interactionQualifies, isCanonicalReviewSubmission } from '../src/services/ratingService'

function appointmentReview() {
  const subjectId = new Types.ObjectId()
  const appointmentId = new Types.ObjectId()
  return new Review({
    reviewer: new Types.ObjectId(), subjectType: 'provider', subjectId, providerProfile: subjectId,
    portal: 'keshillakos', source: 'web',
    interaction: { kind: 'appointment', ref: appointmentId, eligible: true, verified: true },
    appointment: appointmentId, stars: 5, dimensions: { clarity: 4 },
    moderation: { status: 'pending' }, abuse: { status: 'clear' },
  })
}

test('legacy providerUid plus stars cannot form a canonical review submission', () => {
  assert.equal(isCanonicalReviewSubmission({ providerId: undefined, interactionKind: undefined, interactionId: undefined }), false)
  assert.equal(isCanonicalReviewSubmission({ providerId: String(new Types.ObjectId()), interactionKind: 'appointment', interactionId: String(new Types.ObjectId()) }), true)
  assert.equal(isCanonicalReviewSubmission({ businessId: String(new Types.ObjectId()), interactionKind: 'request_delivery', interactionId: String(new Types.ObjectId()) }), true)
  assert.equal(isCanonicalReviewSubmission({ providerId: 'not-an-id', interactionKind: 'appointment', interactionId: String(new Types.ObjectId()) }), false)
})

test('only a completed interaction belonging to the reviewer qualifies', () => {
  assert.equal(interactionQualifies('completed', 'user-a', 'user-a'), true)
  assert.equal(interactionQualifies('accepted', 'user-a', 'user-a'), false)
  assert.equal(interactionQualifies('completed', 'user-a', 'user-b'), false)
})

test('Review validates canonical subject, interaction, stars and dimensions', async () => {
  const review = appointmentReview()
  await review.validate()
  review.interaction.verified = false
  await assert.rejects(review.validate(), /Verified appointment reference/)
  review.interaction.verified = true
  review.dimensions.set('clarity', 6)
  await assert.rejects(review.validate(), /Invalid review dimension|larger than maximum/)
  assert.ok(reviewSchema.indexes().some(([keys, options]) => keys['interaction.kind'] === 1 && keys['interaction.ref'] === 1 && Object.keys(keys).length === 2 && options.unique))
})

test('delivery reviews are unverified and Business subjects require matching business ID', async () => {
  const requestId = new Types.ObjectId()
  const businessId = new Types.ObjectId()
  const review = new Review({
    reviewer: new Types.ObjectId(), subjectType: 'business', subjectId: businessId, business: businessId,
    portal: 'keshillakos', interaction: { kind: 'request_delivery', ref: new Types.ObjectId(), eligible: true, verified: false },
    userRequest: requestId, stars: 4, moderation: { status: 'pending' }, abuse: { status: 'clear' },
  })
  await review.validate()
  review.interaction.verified = true
  await assert.rejects(review.validate(), /Delivery reviews cannot be verified/)
  review.interaction.verified = false
  review.business = new Types.ObjectId()
  await assert.rejects(review.validate(), /Business subject is inconsistent/)
})

test('aggregate eligibility excludes pending, flagged, and unverified legacy Rating documents', async () => {
  const review = appointmentReview()
  assert.equal(reviewIsAggregateEligible(review), false)
  review.moderation.status = 'published'
  review.publishedAt = new Date()
  assert.equal(reviewIsAggregateEligible(review), true)
  review.abuse.status = 'flagged'
  assert.equal(reviewIsAggregateEligible(review), false)
  const aggregate = new RatingAggregate({ portal: 'keshillakos', scope: 'provider', subjectId: review.subjectId, average: 4, count: 2, verifiedCount: 1 })
  await aggregate.validate()
  assert.ok(ratingAggregateSchema.indexes().some(([keys, options]) => keys.portal === 1 && keys.scope === 1 && keys.subjectId === 1 && options.unique))
  assert.notEqual(Rating.collection.collectionName, Review.collection.collectionName)
})
