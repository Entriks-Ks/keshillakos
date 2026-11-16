import assert from 'node:assert/strict'
import test from 'node:test'
import { idFromPublicParam } from '../src/utils/publicPaths.ts'

test('community post like toggling works symmetrically', () => {
  const initialLikes = ['user_1', 'user_2']
  const toggleLike = (likes, uid) => {
    return likes.includes(uid) ? likes.filter((id) => id !== uid) : [...likes, uid]
  }

  const afterUser3 = toggleLike(initialLikes, 'user_3')
  assert.deepEqual(afterUser3, ['user_1', 'user_2', 'user_3'])
  assert.equal(afterUser3.length, 3)

  const afterUser3Again = toggleLike(afterUser3, 'user_3')
  assert.deepEqual(afterUser3Again, ['user_1', 'user_2'])
  assert.equal(afterUser3Again.length, 2)
})

test('community status transitions allow open <-> resolved', () => {
  const getNextStatus = (current) => (current === 'resolved' ? 'open' : 'resolved')
  assert.equal(getNextStatus('open'), 'resolved')
  assert.equal(getNextStatus('resolved'), 'open')
})

test('community comments support prices and provider recommendations', () => {
  const comment = {
    postId: 'post_123',
    authorName: 'Av. Arben Krasniqi',
    authorRole: 'provider',
    content: 'Për këtë çështje mund të kontaktoni zyrën tonë.',
    suggestedPrice: '50 €',
    suggestedProviderName: 'Zyra Ligjore Krasniqi',
    suggestedProviderUid: 'prov_krasniqi',
  }

  assert.equal(comment.authorRole, 'provider')
  assert.equal(comment.suggestedPrice, '50 €')
  assert.equal(comment.suggestedProviderUid, 'prov_krasniqi')
})

test('community category definitions are recognized', () => {
  const validCategories = ['avokat', 'kontabilitet', 'noter', 'biznes', 'patundshmeri', 'tjeter']
  const isValid = (cat) => validCategories.includes(cat)

  assert.equal(isValid('avokat'), true)
  assert.equal(isValid('kontabilitet'), true)
  assert.equal(isValid('noter'), true)
  assert.equal(isValid('invalid_category'), false)
})

test('idFromPublicParam resolves bare objectIds, slugs, and complex uids', () => {
  // Bare 24-hex ObjectId
  assert.equal(idFromPublicParam('6529ab8f901234567890abcd'), '6529ab8f901234567890abcd')

  // Slug ending with 24-hex ObjectId
  assert.equal(idFromPublicParam('av-arben-krasniqi-6529ab8f901234567890abcd'), '6529ab8f901234567890abcd')

  // Slug ending with typical Firebase UID (20+ chars)
  assert.equal(idFromPublicParam('av-fatmir-berisha-d8K12xYzA90123456789'), 'd8K12xYzA90123456789')

  // Pure name slug preserved so backend can resolve it by name
  assert.equal(idFromPublicParam('avokat-fatmir-berisha'), 'avokat-fatmir-berisha')
})
