import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Types } from 'mongoose'
import { Policy, policySchema } from '../src/models/Policy'
import { DEFAULT_POLICY_RULES } from '../src/services/policyService'

test('Policy has scoped versions and one active version per portal/category/key', () => {
  const indexes = policySchema.indexes()
  assert.ok(indexes.some(([keys, options]) => keys.portal === 1 && keys.key === 1 && keys.category === 1 && keys.version === 1 && options.unique))
  assert.ok(indexes.some(([keys, options]) => keys.portal === 1 && keys.key === 1 && keys.category === 1 && options.unique && options.partialFilterExpression?.status === 'active'))
})

test('Policy validates version, effective range, publication and field references', async () => {
  const policy = new Policy({ portal: 'keshillakos', key: 'platform', version: 1, status: 'draft' })
  await policy.validate()
  assert.equal(policy.rules.privacy.requireConsent, true)
  assert.equal(policy.rules.moderation.reviewRequiresApproval, true)
  policy.status = 'active'
  await assert.rejects(policy.validate(), /publication time/)
  policy.publishedAt = new Date()
  policy.effectiveFrom = new Date('2027-02-01T00:00:00Z')
  policy.effectiveUntil = new Date('2027-01-01T00:00:00Z')
  await assert.rejects(policy.validate(), /end must follow start/)
  policy.effectiveUntil = new Date('2028-01-01T00:00:00Z')
  policy.rules.sensitiveData.publicRedactions = ['licenseNumber', 'private.contact']
  await policy.validate()
  policy.rules.sensitiveData.publicRedactions = ['$unsafe']
  await assert.rejects(policy.validate(), /Invalid policy field reference/)
})

test('category-scoped policy keeps the category ObjectId distinct from portal and version', async () => {
  const category = new Types.ObjectId()
  const policy = new Policy({ portal: 'keshillakos', key: 'category-safety', category, version: 2 })
  await policy.validate()
  assert.ok(policy.category?.equals(category))
  assert.equal(policy.version, 2)
  assert.ok(DEFAULT_POLICY_RULES.sensitiveData.publicRedactions.includes('licenseNumber'))
  assert.equal(DEFAULT_POLICY_RULES.moderation.reviewRequiresApproval, false)
})
