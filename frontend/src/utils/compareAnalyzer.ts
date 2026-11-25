import type { ProviderComparisonItem } from '../api/providers'
import { formatServicePrice } from './serviceDiscovery.ts'
import { humanLabels } from './displayLabels.ts'

export type LawyerBadgeTone = 'gold' | 'emerald' | 'cyan' | 'purple' | 'blue'

/**
 * Translatable text produced by the analyzer. This module stays free of i18n imports (it is
 * imported by node tests), so it returns translation keys + interpolation params and the UI
 * translates them at render time. A param may itself be a nested key (e.g. a fallback label).
 */
export type I18nParam = string | number | I18nText
export type I18nText = { key: string; params?: Record<string, I18nParam> }

const K = 'compareUi.analysis'

function text(key: string, params?: Record<string, I18nParam>): I18nText {
  return params ? { key: `${K}.${key}`, params } : { key: `${K}.${key}` }
}

/** Resolves an analyzer text (and nested key params) with the caller's translator. */
export function translateText(
  t: (key: string, params?: Record<string, string | number>) => string,
  value: I18nText,
): string {
  const params: Record<string, string | number> = {}
  for (const [name, param] of Object.entries(value.params ?? {})) {
    params[name] = typeof param === 'object' ? translateText(t, param) : param
  }
  return t(value.key, params)
}

export type LawyerBadge = {
  iconName: 'award' | 'coins' | 'clock' | 'globe' | 'star' | 'scale'
  label: I18nText
  tone: LawyerBadgeTone
}

export type LawyerVerdict = {
  uid: string
  name: string
  badge: LawyerBadge
  bestForSummary: I18nText
  scenarioDescription: I18nText
  keyStrengths: I18nText[]
  isBudgetWinner?: boolean
  isUrgencyWinner?: boolean
  isExperienceWinner?: boolean
  isDiasporaWinner?: boolean
  isReputationWinner?: boolean
}

export type IntentType = 'all' | 'budget' | 'urgency' | 'experience' | 'diaspora' | 'reputation'

export type ComparisonAnalysisResult = {
  verdicts: Record<string, LawyerVerdict>
  winnerUids: {
    budget?: string
    urgency?: string
    experience?: string
    diaspora?: string
    reputation?: string
  }
}

export function analyzeLawyers(items: ProviderComparisonItem[]): ComparisonAnalysisResult {
  const verdicts: Record<string, LawyerVerdict> = {}
  const winners: ComparisonAnalysisResult['winnerUids'] = {}

  if (!items || items.length === 0) {
    return { verdicts, winnerUids: winners }
  }

  // 1. Calculate metrics across all compared lawyers
  let minPrice = Infinity
  let minPriceUid: string | undefined

  let earliestSlotTime = Infinity
  let earliestSlotUid: string | undefined

  let maxExpYears = -1
  let maxExpUid: string | undefined

  let maxRating = 0
  let maxRatingCount = 0
  let maxRatingUid: string | undefined

  let maxLanguagesCount = 0
  let diasporaCandidateUid: string | undefined

  for (const item of items) {
    // Price
    const prices = item.services
      .map((s) => s.priceFrom)
      .filter((p): p is number => typeof p === 'number' && p > 0)
    if (prices.length > 0) {
      const itemMin = Math.min(...prices)
      if (itemMin < minPrice) {
        minPrice = itemMin
        minPriceUid = item.uid
      }
    }

    // Earliest open slot
    if (item.openSlots && item.openSlots.length > 0) {
      const sorted = [...item.openSlots].sort(
        (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
      )
      const firstTime = new Date(sorted[0].startAt).getTime()
      if (firstTime < earliestSlotTime) {
        earliestSlotTime = firstTime
        earliestSlotUid = item.uid
      }
    }

    // Experience
    const exp = item.profile?.yearsOfExperience || 0
    if (exp > maxExpYears) {
      maxExpYears = exp
      maxExpUid = item.uid
    }

    // Reputation
    const avg = item.provider.ratingAverage || 0
    const count = item.provider.ratingCount || 0
    if (avg > maxRating || (avg === maxRating && count > maxRatingCount)) {
      maxRating = avg
      maxRatingCount = count
      maxRatingUid = item.uid
    }

    // Diaspora & Online consultation
    const langs = item.profile?.languages?.length ? item.profile.languages : (item.provider.languages || [])
    const hasOnline =
      item.profile?.modes?.includes('online') ||
      item.services.some((s) => s.details?.deliveryModes?.includes('online'))
    const langScore = langs.length + (hasOnline ? 2 : 0)
    if (langScore > maxLanguagesCount && hasOnline) {
      maxLanguagesCount = langScore
      diasporaCandidateUid = item.uid
    }
  }

  if (minPrice < Infinity && minPriceUid) winners.budget = minPriceUid
  if (earliestSlotTime < Infinity && earliestSlotUid) winners.urgency = earliestSlotUid
  if (maxExpYears > 0 && maxExpUid) winners.experience = maxExpUid
  if (maxRating > 0 && maxRatingUid) winners.reputation = maxRatingUid
  if (diasporaCandidateUid) winners.diaspora = diasporaCandidateUid

  // 2. Build personalized verdict for each lawyer
  for (const item of items) {
    const isBudget = winners.budget === item.uid
    const isUrgency = winners.urgency === item.uid
    const isExp = winners.experience === item.uid
    const isRep = winners.reputation === item.uid
    const isDiaspora = winners.diaspora === item.uid

    const specialties = humanLabels(
      [...(item.profile?.specializations || []), ...(item.profile?.categoryLabels || [])],
      item.profile?.categories || [],
    )
    const primarySpec: I18nParam = specialties[0] || { key: `${K}.generalSpec` }
    const years = item.profile?.yearsOfExperience
    const prices = item.services
      .map((s) => s.priceFrom)
      .filter((p): p is number => typeof p === 'number' && p > 0)
    const itemMinPrice = prices.length ? Math.min(...prices) : null
    const openSlotsCount = item.openSlots?.length || 0
    const hasOnline =
      item.profile?.modes?.includes('online') ||
      item.services.some((s) => s.details?.deliveryModes?.includes('online'))
    // Languages come from profile data; the fallback only feeds the count (never rendered here).
    const langs = item.profile?.languages?.length ? item.profile.languages : (item.provider.languages || ['sq'])
    const langList = langs.join(', ')

    // Determine primary badge & "best for"
    let badge: LawyerBadge = {
      iconName: 'scale',
      label: text('badge.specialist', { spec: primarySpec }),
      tone: 'blue',
    }
    let bestForSummary = text('bestFor.specialist', { spec: primarySpec })
    let scenarioDescription = text('scenario.specialist', { spec: primarySpec })

    if (isExp && (years || 0) >= 8) {
      badge = { iconName: 'award', label: text('badge.experience'), tone: 'gold' }
      bestForSummary = text('bestFor.experience')
      scenarioDescription = text('scenario.experience', { count: years || 0 })
    } else if (isBudget && itemMinPrice != null) {
      badge = { iconName: 'coins', label: text('badge.budget'), tone: 'emerald' }
      bestForSummary = text('bestFor.budget')
      scenarioDescription = text('scenario.budget', { price: itemMinPrice })
    } else if (isUrgency && openSlotsCount > 0) {
      badge = { iconName: 'clock', label: text('badge.urgency'), tone: 'cyan' }
      bestForSummary = text('bestFor.urgency')
      scenarioDescription = text('scenario.urgency')
    } else if (isDiaspora && langs.length >= 2) {
      badge = { iconName: 'globe', label: text('badge.diaspora'), tone: 'purple' }
      bestForSummary = text('bestFor.diaspora')
      scenarioDescription = text('scenario.diaspora', { languages: langList })
    } else if (isRep && (item.provider.ratingAverage || 0) >= 4.5) {
      badge = { iconName: 'star', label: text('badge.reputation'), tone: 'gold' }
      bestForSummary = text('bestFor.reputation')
      scenarioDescription = text('scenario.reputation', {
        rating: (item.provider.ratingAverage || 0).toFixed(1),
      })
    }

    // Generate list of concrete strengths for this lawyer (prioritizing winning characteristics).
    // `added` tracks which topics are already covered so generic strengths don't repeat them.
    const keyStrengths: I18nText[] = []
    const added = new Set<'languages' | 'fee' | 'experience' | 'slots'>()

    if (isDiaspora && langs.length > 1) {
      keyStrengths.push(text('strength.languages', { count: langs.length, languages: langList }))
      added.add('languages')
    }
    if (isBudget && itemMinPrice != null) {
      keyStrengths.push(text('strength.lowestFee', { price: itemMinPrice }))
      added.add('fee')
    }
    if (isExp && years != null && years > 0) {
      keyStrengths.push(text('strength.longestExperience', { count: years }))
      added.add('experience')
    }
    if (isUrgency && openSlotsCount > 0) {
      keyStrengths.push(text('strength.earliestSlot', { count: openSlotsCount }))
      added.add('slots')
    }

    if (years != null && years > 0 && !added.has('experience')) {
      keyStrengths.push(text('strength.yearsExperience', { count: years }))
    }
    if (itemMinPrice != null && !added.has('fee')) {
      keyStrengths.push(text('strength.clearFee', { price: itemMinPrice }))
    } else if (item.services.length > 0) {
      const formatted = formatServicePrice(item.services[0])
      if (formatted) keyStrengths.push(text('strength.mainService', { price: formatted }))
    }
    if (openSlotsCount > 0 && !added.has('slots')) {
      keyStrengths.push(text('strength.openSlots', { count: openSlotsCount }))
    } else if (!added.has('slots')) {
      keyStrengths.push(text('strength.flexibleSchedule'))
    }
    if (hasOnline) {
      keyStrengths.push(text('strength.online'))
    }
    if (langs.length > 1 && !added.has('languages')) {
      keyStrengths.push(text('strength.languages', { count: langs.length, languages: langList }))
    }
    if (item.provider.ratingCount > 0) {
      keyStrengths.push(
        text('strength.rated', {
          rating: (item.provider.ratingAverage || 0).toFixed(1),
          count: item.provider.ratingCount,
        }),
      )
    }

    verdicts[item.uid] = {
      uid: item.uid,
      name: item.provider.name,
      badge,
      bestForSummary,
      scenarioDescription,
      keyStrengths: keyStrengths.slice(0, 4),
      isBudgetWinner: isBudget,
      isUrgencyWinner: isUrgency,
      isExperienceWinner: isExp,
      isDiasporaWinner: isDiaspora,
      isReputationWinner: isRep,
    }
  }

  return { verdicts, winnerUids: winners }
}
