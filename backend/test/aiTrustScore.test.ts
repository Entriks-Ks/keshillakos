import assert from 'node:assert/strict'
import test from 'node:test'
import {
  calculateProviderTrustScore,
  generateProviderTrustRecommendations,
} from '../src/services/aiTrustScoreService'

test('calculateProviderTrustScore returns valid safety score and factors', async () => {
  const result = await calculateProviderTrustScore('mock-provider-uid-123')
  assert.ok(result, 'Result should not be null')
  assert.ok(typeof result.overallScore === 'number', 'Overall score must be a number')
  assert.ok(result.overallScore >= 0 && result.overallScore <= 100, 'Score should be between 0 and 100')
  assert.ok(result.safetyLabel, 'Safety label must be present')
  assert.ok(result.aiSummary, 'AI summary must be present')
  assert.ok(Array.isArray(result.factors), 'Factors must be an array')
  assert.ok(result.factors.length >= 4, 'Should have at least 4 evaluation factors')

  // Check factor fields
  const licenseFactor = result.factors.find((f) => f.key === 'license')
  assert.ok(licenseFactor, 'Should have license factor')
  assert.ok(licenseFactor.score <= licenseFactor.maxScore, 'Factor score should not exceed maxScore')
})

test('generateProviderTrustRecommendations returns actionable advice with potential score', async () => {
  const recs = await generateProviderTrustRecommendations('mock-provider-uid-123')
  assert.ok(recs, 'Recommendations should not be null')
  assert.ok(typeof recs.currentScore === 'number', 'Current score must be a number')
  assert.ok(typeof recs.potentialScore === 'number', 'Potential score must be a number')
  assert.ok(recs.potentialScore >= recs.currentScore, 'Potential score must be >= current score')
  assert.ok(recs.aiInsight, 'AI insight must be present')
  assert.ok(Array.isArray(recs.recommendations), 'Recommendations must be an array')
  assert.ok(recs.recommendations.length > 0, 'Should have at least 1 recommendation')

  const first = recs.recommendations[0]
  assert.ok(first.title, 'Recommendation must have a title')
  assert.ok(first.impact, 'Recommendation must have an impact label')
  assert.ok(first.actionLabel, 'Recommendation must have an action label')
  assert.ok(first.actionPath, 'Recommendation must have an action path')
})
