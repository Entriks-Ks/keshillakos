import assert from 'node:assert/strict'
import test from 'node:test'
import { MAX_COMPARE_LAWYERS } from '../src/hooks/useCompareLawyers.ts'
import { analyzeLawyers } from '../src/utils/compareAnalyzer.ts'
import sqLocale from '../src/i18n/locales/sq.ts'
import enLocale from '../src/i18n/locales/en.ts'
import deLocale from '../src/i18n/locales/de.ts'

// Storage simulation for testing store invariants
function createCompareStore() {
  let uids = []
  const meta = {}

  return {
    getUids: () => [...uids],
    addLawyer: (uid, info) => {
      if (uids.includes(uid)) return true
      if (uids.length >= MAX_COMPARE_LAWYERS) return false
      uids.push(uid)
      if (info) meta[uid] = info
      return true
    },
    removeLawyer: (uid) => {
      uids = uids.filter((id) => id !== uid)
      delete meta[uid]
    },
    toggleLawyer: (uid, info) => {
      if (uids.includes(uid)) {
        uids = uids.filter((id) => id !== uid)
        delete meta[uid]
        return false
      }
      if (uids.length >= MAX_COMPARE_LAWYERS) return false
      uids.push(uid)
      if (info) meta[uid] = info
      return true
    },
    clear: () => {
      uids = []
      for (const k of Object.keys(meta)) {
        delete meta[k]
      }
    },
    getMeta: () => ({ ...meta }),
    setComparison: (newUids) => {
      uids = newUids.filter(Boolean).slice(0, MAX_COMPARE_LAWYERS)
    },
    isSelected: (uid) => uids.includes(uid),
    count: () => uids.length,
    isMax: () => uids.length >= MAX_COMPARE_LAWYERS,
  }
}

// Advantages logic simulator
function calculateAdvantages(lawyers) {
  if (lawyers.length < 2) return {}

  let maxRating = 0
  let bestRatingUid = ''
  let maxExp = 0
  let bestExpUid = ''
  let minPrice = Infinity
  let lowestPriceUid = ''
  let earliestTime = Infinity
  let earliestSlotUid = ''

  for (const item of lawyers) {
    const rating = item.provider.ratingAverage || 0
    if (rating > maxRating) {
      maxRating = rating
      bestRatingUid = item.uid
    }

    const exp = item.profile?.yearsOfExperience || 0
    if (exp > maxExp) {
      maxExp = exp
      bestExpUid = item.uid
    }

    const prices = (item.services || [])
      .map((s) => s.priceFrom)
      .filter((p) => typeof p === 'number' && p > 0)
    if (prices.length > 0) {
      const itemMinPrice = Math.min(...prices)
      if (itemMinPrice < minPrice) {
        minPrice = itemMinPrice
        lowestPriceUid = item.uid
      }
    }

    if (item.openSlots && item.openSlots.length > 0) {
      const sortedSlots = [...item.openSlots].sort(
        (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
      )
      const slotTime = new Date(sortedSlots[0].startAt).getTime()
      if (slotTime < earliestTime) {
        earliestTime = slotTime
        earliestSlotUid = item.uid
      }
    }
  }

  return {
    bestRatingUid: maxRating > 0 ? bestRatingUid : '',
    bestExpUid: maxExp > 0 ? bestExpUid : '',
    lowestPriceUid: minPrice < Infinity ? lowestPriceUid : '',
    earliestSlotUid: earliestTime < Infinity ? earliestSlotUid : '',
  }
}

test('compare lawyers: MAX_COMPARE_LAWYERS is exactly 3', () => {
  assert.equal(MAX_COMPARE_LAWYERS, 3)
})

test('compare lawyers: can select up to 3 lawyers, rejecting 4th', () => {
  const store = createCompareStore()
  assert.equal(store.count(), 0)

  assert.equal(store.addLawyer('lawyer-1', { name: 'Av. Fatmir Berisha' }), true)
  assert.equal(store.count(), 1)
  assert.equal(store.isSelected('lawyer-1'), true)

  assert.equal(store.addLawyer('lawyer-2', { name: 'Av. Vjosa Gashi' }), true)
  assert.equal(store.count(), 2)

  assert.equal(store.addLawyer('lawyer-3', { name: 'Av. Dardan Kastrati' }), true)
  assert.equal(store.count(), 3)
  assert.equal(store.isMax(), true)

  // 4th lawyer should be rejected
  assert.equal(store.addLawyer('lawyer-4', { name: 'Av. Linda Morina' }), false)
  assert.equal(store.count(), 3)
  assert.deepEqual(store.getUids(), ['lawyer-1', 'lawyer-2', 'lawyer-3'])
})

test('compare lawyers: toggle adds when absent and removes when present', () => {
  const store = createCompareStore()

  assert.equal(store.toggleLawyer('lawyer-1'), true)
  assert.equal(store.isSelected('lawyer-1'), true)

  assert.equal(store.toggleLawyer('lawyer-1'), false)
  assert.equal(store.isSelected('lawyer-1'), false)
  assert.equal(store.count(), 0)
})

test('compare lawyers: removeLawyer and clear work correctly including metadata', () => {
  const store = createCompareStore()
  store.addLawyer('l1', { name: 'Av. Fatmir' })
  store.addLawyer('l2', { name: 'Av. Teuta' })
  store.addLawyer('l3', { name: 'Av. Besnik' })
  assert.equal(store.count(), 3)
  assert.equal(store.getMeta()['l2'].name, 'Av. Teuta')

  store.removeLawyer('l2')
  assert.deepEqual(store.getUids(), ['l1', 'l3'])
  assert.equal(store.count(), 2)
  assert.equal(store.getMeta()['l2'], undefined)

  store.clear()
  assert.equal(store.count(), 0)
  assert.deepEqual(store.getUids(), [])
  assert.deepEqual(store.getMeta(), {})
})

test('compare lawyers: localization messages include clear and empty state texts', () => {
  assert.ok(sqLocale.compare.clear)
  assert.ok(sqLocale.compare.cleared)
  assert.ok(sqLocale.compare.emptyTitle)
  assert.ok(sqLocale.compare.exploreOffers)

  assert.ok(enLocale.compare.clear)
  assert.ok(enLocale.compare.cleared)
  assert.ok(enLocale.compare.emptyTitle)
  assert.ok(enLocale.compare.exploreOffers)

  assert.ok(deLocale.compare.clear)
  assert.ok(deLocale.compare.cleared)
  assert.ok(deLocale.compare.emptyTitle)
  assert.ok(deLocale.compare.exploreOffers)
})

test('compare lawyers: setComparison enforces slice to maximum 3 items', () => {
  const store = createCompareStore()
  store.setComparison(['l1', 'l2', 'l3', 'l4', 'l5'])
  assert.equal(store.count(), 3)
  assert.deepEqual(store.getUids(), ['l1', 'l2', 'l3'])
})

test('compare lawyers: calculates advantages (rating, experience, fee, earliest slot)', () => {
  const lawyers = [
    {
      uid: 'lawyer-1',
      provider: { name: 'Av. Fatmir', ratingAverage: 4.9, ratingCount: 20 },
      profile: { yearsOfExperience: 14 },
      services: [{ priceFrom: 60 }],
      openSlots: [{ startAt: '2026-10-30T10:00:00Z' }],
    },
    {
      uid: 'lawyer-2',
      provider: { name: 'Av. Vjosa', ratingAverage: 4.7, ratingCount: 15 },
      profile: { yearsOfExperience: 8 },
      services: [{ priceFrom: 30 }], // lowest price
      openSlots: [{ startAt: '2026-10-29T14:00:00Z' }], // earliest slot
    },
    {
      uid: 'lawyer-3',
      provider: { name: 'Av. Dardan', ratingAverage: 4.8, ratingCount: 10 },
      profile: { yearsOfExperience: 20 }, // most experience
      services: [{ priceFrom: 80 }],
      openSlots: [{ startAt: '2026-11-01T09:00:00Z' }],
    },
  ]

  const adv = calculateAdvantages(lawyers)

  assert.equal(adv.bestRatingUid, 'lawyer-1')
  assert.equal(adv.lowestPriceUid, 'lawyer-2')
  assert.equal(adv.earliestSlotUid, 'lawyer-2')
  assert.equal(adv.bestExpUid, 'lawyer-3')
})

test('compare lawyers: analyzeLawyers determines who is best for what (verdict & strengths)', () => {
  const lawyers = [
    {
      uid: 'lawyer-senior',
      provider: { name: 'Av. Senior', ratingAverage: 4.8, ratingCount: 15 },
      profile: {
        yearsOfExperience: 18,
        languages: ['Albanian'],
        modes: ['online', 'on_site'],
        specializations: ['Kontrata Biznesi'],
      },
      services: [{ priceFrom: 90 }],
      openSlots: [{ startAt: '2026-11-05T10:00:00Z' }],
    },
    {
      uid: 'lawyer-budget',
      provider: { name: 'Av. Ekonomik', ratingAverage: 4.6, ratingCount: 10 },
      profile: {
        yearsOfExperience: 5,
        languages: ['Albanian'],
        modes: ['online'],
        specializations: ['E drejta e punës'],
      },
      services: [{ priceFrom: 25 }],
      openSlots: [{ startAt: '2026-11-02T10:00:00Z' }],
    },
    {
      uid: 'lawyer-diaspora',
      provider: { name: 'Av. Diaspora', ratingAverage: 4.9, ratingCount: 22 },
      profile: {
        yearsOfExperience: 9,
        languages: ['Albanian', 'German', 'English'],
        modes: ['online'],
        specializations: ['Pronë & Trashëgimi'],
      },
      services: [{ priceFrom: 50 }],
      openSlots: [{ startAt: '2026-10-29T09:00:00Z' }], // earliest
    },
  ]

  const { verdicts, winnerUids } = analyzeLawyers(lawyers)

  // Winners evaluation
  assert.equal(winnerUids.experience, 'lawyer-senior')
  assert.equal(winnerUids.budget, 'lawyer-budget')
  assert.equal(winnerUids.urgency, 'lawyer-diaspora')
  assert.equal(winnerUids.diaspora, 'lawyer-diaspora')
  assert.equal(winnerUids.reputation, 'lawyer-diaspora')

  // Verdict content verification
  const seniorVerdict = verdicts['lawyer-senior']
  assert.ok(seniorVerdict)
  assert.equal(seniorVerdict.badge.label, 'Përvoja më e Gjatë')
  assert.match(seniorVerdict.bestForSummary, /përvojë/i)
  assert.ok(seniorVerdict.keyStrengths.length > 0)

  const budgetVerdict = verdicts['lawyer-budget']
  assert.ok(budgetVerdict)
  assert.equal(budgetVerdict.badge.label, 'Çmimi më Ekonomik')
  assert.match(budgetVerdict.bestForSummary, /buxhet/i)
  assert.ok(budgetVerdict.keyStrengths.some((s) => s.includes('€25')))

  const diasporaVerdict = verdicts['lawyer-diaspora']
  assert.ok(diasporaVerdict)
  assert.ok(diasporaVerdict.keyStrengths.some((s) => s.includes('German')))
})
