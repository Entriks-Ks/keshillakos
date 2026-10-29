import type { ProviderComparisonItem } from '../api/providers'
import { formatServicePrice } from './serviceDiscovery.ts'
import { humanLabels } from './displayLabels.ts'

export type LawyerBadgeTone = 'gold' | 'emerald' | 'cyan' | 'purple' | 'blue'

export type LawyerBadge = {
  iconName: 'award' | 'coins' | 'clock' | 'globe' | 'star' | 'scale'
  label: string
  tone: LawyerBadgeTone
}

export type LawyerVerdict = {
  uid: string
  name: string
  badge: LawyerBadge
  bestForSummary: string
  scenarioDescription: string
  keyStrengths: string[]
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
    const primarySpec = specialties[0] || 'Çështje Ligjore'
    const years = item.profile?.yearsOfExperience
    const prices = item.services
      .map((s) => s.priceFrom)
      .filter((p): p is number => typeof p === 'number' && p > 0)
    const itemMinPrice = prices.length ? Math.min(...prices) : null
    const openSlotsCount = item.openSlots?.length || 0
    const hasOnline =
      item.profile?.modes?.includes('online') ||
      item.services.some((s) => s.details?.deliveryModes?.includes('online'))
    const langs = item.profile?.languages?.length ? item.profile.languages : (item.provider.languages || ['Shqip'])

    // Determine primary badge & "best for"
    let badge: LawyerBadge = {
      iconName: 'scale',
      label: `Specialist në ${primarySpec}`,
      tone: 'blue',
    }
    let bestForSummary = `Zgjedhje e sprovuar për ${primarySpec}`
    let scenarioDescription = `Ekspert me njohuri të thella në ${primarySpec} dhe gatishmëri të lartë profesionale.`

    if (isExp && (years || 0) >= 8) {
      badge = {
        iconName: 'award',
        label: 'Përvoja më e Gjatë',
        tone: 'gold',
      }
      bestForSummary = `Çështje komplekse dhe përfaqësim me përvojë të thellë`
      scenarioDescription = `Rekomandohet nëse keni një rast të ndërlikuar gjyqësor, kontratë me peshë të madhe apo nevojë për përvojë ${years}-vjeçare.`
    } else if (isBudget && itemMinPrice != null) {
      badge = {
        iconName: 'coins',
        label: 'Çmimi më Ekonomik',
        tone: 'emerald',
      }
      bestForSummary = `Buxhet të favorshëm dhe transparencë tarifash`
      scenarioDescription = `Rekomandohet nëse dëshironi konsulencë cilësore me koston më të përballueshme (duke filluar nga vetëm €${itemMinPrice}).`
    } else if (isUrgency && openSlotsCount > 0) {
      badge = {
        iconName: 'clock',
        label: 'Takimi më i Shpejtë',
        tone: 'cyan',
      }
      bestForSummary = `Urgjencë dhe takim të menjëhershëm`
      scenarioDescription = `Rekomandohet nëse keni afate të ngutshme dhe ju duhet takim sa më i shpejtë pa pritje.`
    } else if (isDiaspora && langs.length >= 2) {
      badge = {
        iconName: 'globe',
        label: 'Top për Diasporë',
        tone: 'purple',
      }
      bestForSummary = `Diasporë dhe konsultim online me video`
      scenarioDescription = `Rekomandohet nëse jetoni jashtë Kosovës dhe kërkoni konsulencë me video në gjuhët: ${langs.join(', ')}.`
    } else if (isRep && (item.provider.ratingAverage || 0) >= 4.5) {
      badge = {
        iconName: 'star',
        label: 'Reputacioni më i Lartë',
        tone: 'gold',
      }
      bestForSummary = `Kënaqësi maksimale nga klientët e mëparshëm`
      scenarioDescription = `Rekomandohet për ata që vendosin besimin te rekomandimet më të larta (${item.provider.ratingAverage?.toFixed(1)} yje).`
    }

    // Generate list of concrete strengths for this lawyer (prioritizing winning characteristics)
    const keyStrengths: string[] = []

    if (isDiaspora && langs.length > 1) {
      keyStrengths.push(`Konsultim në ${langs.length} gjuhë: ${langs.join(', ')}`)
    }
    if (isBudget && itemMinPrice != null) {
      keyStrengths.push(`Tarifa fillestare më e ulët nga vetëm €${itemMinPrice}`)
    }
    if (isExp && years != null && years > 0) {
      keyStrengths.push(`Përvoja më e gjatë në krahasim me ${years} vite përvojë`)
    }
    if (isUrgency && openSlotsCount > 0) {
      keyStrengths.push(`Termini më i hershëm i lirë (${openSlotsCount} orare të hapura)`)
    }

    if (years != null && years > 0 && !keyStrengths.some((s) => s.includes('përvojë'))) {
      keyStrengths.push(`${years} vite përvojë profesionale në fushën ligjore`)
    }
    if (itemMinPrice != null && !keyStrengths.some((s) => s.includes('Tarifa'))) {
      keyStrengths.push(`Tarifa fillestare e qartë nga €${itemMinPrice}`)
    } else if (item.services.length > 0 && !keyStrengths.some((s) => s.includes('Shërbimi'))) {
      const formatted = formatServicePrice(item.services[0])
      if (formatted) keyStrengths.push(`Shërbimi kryesor: ${formatted}`)
    }
    if (openSlotsCount > 0 && !keyStrengths.some((s) => s.includes('orare'))) {
      keyStrengths.push(`${openSlotsCount} orare të lira të hapura për rezervim`)
    } else if (!keyStrengths.some((s) => s.includes('fleksibil') || s.includes('orare'))) {
      keyStrengths.push('Orar fleksibil sipas marrëveshjes së drejtpërdrejtë')
    }
    if (hasOnline && !keyStrengths.some((s) => s.includes('online'))) {
      keyStrengths.push('Mbështet konsultimin e plotë online me video-thirrje')
    }
    if (langs.length > 1 && !keyStrengths.some((s) => s.includes('gjuhë'))) {
      keyStrengths.push(`Konsultim në ${langs.length} gjuhë: ${langs.join(', ')}`)
    }
    if (item.provider.ratingCount > 0) {
      keyStrengths.push(`Vlerësuar me ★ ${item.provider.ratingAverage?.toFixed(1)} nga ${item.provider.ratingCount} klientë`)
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
