import assert from 'node:assert/strict'
import test from 'node:test'
import { addDays, effectivePlan } from '../src/plans/catalog'

test('basic is the default public plan', () => {
  assert.equal(effectivePlan(null), 'basic')
  assert.equal(effectivePlan({ plan: 'basic', status: 'active' }), 'basic')
})

test('pro stays public until the paid period ends', () => {
  const now = new Date('2026-10-13T00:00:00Z')
  assert.equal(effectivePlan({ plan: 'pro', status: 'active', periodEndsAt: addDays(now, 1) }, now), 'pro')
  assert.equal(effectivePlan({ plan: 'pro', status: 'active', periodEndsAt: now }, now), 'basic')
  assert.equal(effectivePlan({ plan: 'pro', status: 'expired', periodEndsAt: addDays(now, 10) }, now), 'basic')
})

test('the 14-day trial is public only while it is running', () => {
  const now = new Date('2026-10-13T00:00:00Z')
  assert.equal(effectivePlan({ plan: 'pro', status: 'trialing', trialEndsAt: addDays(now, 14) }, now), 'pro')
  assert.equal(effectivePlan({ plan: 'pro', status: 'trialing', trialEndsAt: now }, now), 'basic')
})
