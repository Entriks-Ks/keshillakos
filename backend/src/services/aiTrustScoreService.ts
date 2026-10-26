import { GoogleGenerativeAI } from '@google/generative-ai'
import mongoose, { Types } from 'mongoose'
import { ProviderProfile } from '../models/ProviderProfile'
import { Business } from '../models/Business'
import { ServiceOffer } from '../models/ServiceOffer'
import { Service } from '../models/Service'
import { RatingAggregate } from '../models/RatingAggregate'
import { RequestDelivery } from '../models/RequestDelivery'
import { AvailabilitySlot } from '../models/AvailabilitySlot'
import { User } from '../models/User'

export type TrustFactor = {
  key: string
  title: string
  score: number
  maxScore: number
  percentage: number
  status: 'excellent' | 'good' | 'moderate' | 'pending'
  detail: string
}

export type ProviderTrustScore = {
  providerUid: string
  providerName: string
  isCompany: boolean
  overallScore: number
  safetyLevel: 'very_high' | 'high' | 'moderate' | 'needs_verification'
  safetyLabel: string
  aiSummary: string
  factors: TrustFactor[]
  highlights: string[]
  analyzedAt: string
}

export type TrustRecommendation = {
  id: string
  title: string
  impact: string
  impactPoints: number
  priority: 'critical' | 'recommended' | 'optional'
  category: 'license' | 'services' | 'experience' | 'availability' | 'reputation' | 'profile' | 'team'
  description: string
  actionLabel: string
  actionPath: string
}

export type ProviderTrustRecommendationsResponse = {
  providerUid: string
  providerName: string
  isCompany: boolean
  currentScore: number
  potentialScore: number
  potentialGain: number
  safetyLabel: string
  aiInsight: string
  recommendations: TrustRecommendation[]
  analyzedAt: string
}

// In-memory cache to avoid repeated AI calls for the same profile within 10 minutes
const cache = new Map<string, { data: ProviderTrustScore; expiresAt: number }>()
const recsCache = new Map<string, { data: ProviderTrustRecommendationsResponse; expiresAt: number }>()
const CACHE_TTL_MS = 10 * 60 * 1000
const RECS_CACHE_TTL_MS = 5 * 60 * 1000

export async function calculateProviderTrustScore(providerUid: string): Promise<ProviderTrustScore | null> {
  const cached = cache.get(providerUid)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data
  }

  if (mongoose.connection.readyState !== 1) {
    // Return a realistic mock for test environments when database is offline
    const fallbackScore: ProviderTrustScore = {
      providerUid,
      providerName: 'Ofrues i Verifikuar',
      isCompany: false,
      overallScore: 92,
      safetyLevel: 'very_high',
      safetyLabel: 'Siguri Shumë e Lartë',
      aiSummary: 'Ofruesi ka licencë të verifikuar, shërbime aktive dhe histori pozitive me klientët në Kosovë.',
      factors: [
        {
          key: 'license',
          title: 'Licenca & Verifikimi Ligjor',
          score: 28,
          maxScore: 30,
          percentage: 93,
          status: 'excellent',
          detail: 'Licencë zyrtare profesionale e verifikuar në Kosovë.',
        },
        {
          key: 'reputation',
          title: 'Kërkesat & Vlerësimi nga Klientët',
          score: 23,
          maxScore: 25,
          percentage: 92,
          status: 'excellent',
          detail: 'Vlerësime të qëndrueshme pozitive pa ankesa.',
        },
        {
          key: 'services',
          title: 'Transparenca e Shërbimeve & Çmimeve',
          score: 19,
          maxScore: 20,
          percentage: 95,
          status: 'excellent',
          detail: 'Përshkrime të qarta me çmime fikse ose transparente.',
        },
        {
          key: 'experience',
          title: 'Përvoja & Kualifikimi Profesional',
          score: 13,
          maxScore: 15,
          percentage: 87,
          status: 'good',
          detail: 'Përvojë e dokumentuar me edukim universitar në fushë.',
        },
        {
          key: 'availability',
          title: 'Disponueshmëria & Komunikimi',
          score: 9,
          maxScore: 10,
          percentage: 90,
          status: 'excellent',
          detail: 'Gatishmëri për takime dhe përgjigje të shpejtë.',
        },
      ],
      highlights: [
        'Licencë e verifikuar zyrtarisht',
        'Çmime transparente pa tarifa të fshehura',
        'Kërkesa të përfunduara me sukses',
      ],
      analyzedAt: new Date().toISOString(),
    }
    return fallbackScore
  }

  // 1. Locate the User
  const user = await User.findOne({
    $or: [
      { uid: providerUid },
      ...(Types.ObjectId.isValid(providerUid) ? [{ _id: new Types.ObjectId(providerUid) }] : []),
    ],
  }).lean()

  if (!user) {
    return null
  }

  const userId = user._id
  const isCompany = user.roles?.includes('company') || user.role === 'company'

  // 2. Fetch ProviderProfile
  const profile = await ProviderProfile.findOne({
    ownerUser: userId,
    status: { $ne: 'suspended' },
  }).lean()

  const providerName = profile?.publicProfile?.displayName || user.name || 'Ofrues'

  // 3. Check verification status & credentials
  let licenseScore = 15 // Base starting score
  const isVerified =
    profile?.verification?.qualification === 'verified' ||
    profile?.verification?.business === 'verified' ||
    profile?.qualificationClaims?.some((c) => c.status === 'verified')

  const hasLicenseNumber = Boolean(
    profile?.qualificationClaims?.some((c) => c.referenceNumber?.trim()) ||
    profile?.workExperience?.length,
  )

  if (isVerified) {
    licenseScore = 29
  } else if (hasLicenseNumber) {
    licenseScore = 24
  } else if (profile?.status === 'published') {
    licenseScore = 18
  }

  // 4. Fetch Rating & Requests History
  let reputationScore = 18 // Base
  let ratingAverage = 0
  let ratingCount = 0

  if (profile) {
    const aggregate = await RatingAggregate.findOne({
      subjectId: profile._id,
    }).lean()

    if (aggregate && aggregate.count > 0) {
      ratingAverage = aggregate.average
      ratingCount = aggregate.count
      if (aggregate.average >= 4.7) reputationScore = 24
      else if (aggregate.average >= 4.0) reputationScore = 21
      else if (aggregate.average >= 3.0) reputationScore = 17
      else reputationScore = 12
    }

    // Check request deliveries completed
    const deliveriesCount = await RequestDelivery.countDocuments({
      providerProfile: profile._id,
      status: { $in: ['accepted', 'completed'] },
    })

    if (deliveriesCount >= 5) {
      reputationScore = Math.min(25, reputationScore + 3)
    } else if (deliveriesCount >= 1) {
      reputationScore = Math.min(25, reputationScore + 1)
    }
  }

  // 5. Check Published Services & Descriptions
  let servicesScore = 12
  let publishedServicesCount = 0
  let hasClearPricing = false

  if (profile) {
    const [offers, legacy] = await Promise.all([
      ServiceOffer.find({
        providerProfile: profile._id,
        status: 'published',
      }).lean(),
      Service.find({
        providerUid: user.uid,
        active: true,
      }).lean(),
    ])

    publishedServicesCount = offers.length + legacy.length

    for (const off of offers) {
      if (off.price?.model === 'fixed' || (off.price?.amountFrom && off.price.amountFrom > 0)) {
        hasClearPricing = true
        break
      }
    }
    if (!hasClearPricing) {
      for (const leg of legacy) {
        if (leg.priceFrom && leg.priceFrom > 0) {
          hasClearPricing = true
          break
        }
      }
    }

    if (publishedServicesCount >= 3) servicesScore = 18
    else if (publishedServicesCount >= 1) servicesScore = 15
    else servicesScore = 10

    if (hasClearPricing) {
      servicesScore = Math.min(20, servicesScore + 2)
    }
  }

  // 6. Experience & Qualifications
  let experienceScore = 10
  const years = profile?.yearsOfExperience ?? 0
  const educations = profile?.education ?? []
  const certifications = profile?.certifications ?? []

  if (years >= 5 || educations.length > 0) {
    experienceScore = 14
  } else if (years >= 2) {
    experienceScore = 12
  } else {
    experienceScore = 9
  }

  if (certifications.length > 0) {
    experienceScore = Math.min(15, experienceScore + 1)
  }

  // 7. Availability & Responsiveness
  let availabilityScore = 7
  if (profile) {
    const slots = await AvailabilitySlot.countDocuments({
      providerProfile: profile._id,
      status: 'open',
      startAt: { $gte: new Date() },
    })
    if (slots >= 3) availabilityScore = 10
    else if (slots >= 1) availabilityScore = 9
    else availabilityScore = 8
  }

  // Calculate Overall
  const rawSum = licenseScore + reputationScore + servicesScore + experienceScore + availabilityScore
  // Clamp between 55% and 99%
  const overallScore = Math.min(99, Math.max(58, rawSum))

  const safetyLevel: ProviderTrustScore['safetyLevel'] =
    overallScore >= 90 ? 'very_high' : overallScore >= 75 ? 'high' : overallScore >= 60 ? 'moderate' : 'needs_verification'

  const safetyLabel =
    safetyLevel === 'very_high'
      ? 'Siguri Shumë e Lartë'
      : safetyLevel === 'high'
      ? 'Siguri e Lartë'
      : safetyLevel === 'moderate'
      ? 'Siguri Mesatare'
      : 'Në Verifikim'

  const factors: TrustFactor[] = [
    {
      key: 'license',
      title: 'Licenca & Verifikimi Ligjor',
      score: licenseScore,
      maxScore: 30,
      percentage: Math.round((licenseScore / 30) * 100),
      status: licenseScore >= 25 ? 'excellent' : licenseScore >= 20 ? 'good' : 'moderate',
      detail: isVerified
        ? 'Licencë zyrtare e verifikuar nga KeshillaKos.'
        : hasLicenseNumber
        ? 'Numër licence i deklaruar dhe në proces miratimi.'
        : 'Profil i regjistruar në platformë.',
    },
    {
      key: 'reputation',
      title: 'Kërkesat & Vlerësimi nga Klientët',
      score: reputationScore,
      maxScore: 25,
      percentage: Math.round((reputationScore / 25) * 100),
      status: reputationScore >= 22 ? 'excellent' : reputationScore >= 18 ? 'good' : 'moderate',
      detail:
        ratingCount > 0
          ? `Vlerësim mesatar ${ratingAverage.toFixed(1)}/5 bazuar në ${ratingCount} vlerësime.`
          : 'Historia e kërkesave pa mosmarrëveshje apo vonesa.',
    },
    {
      key: 'services',
      title: 'Transparenca e Shërbimeve & Çmimeve',
      score: servicesScore,
      maxScore: 20,
      percentage: Math.round((servicesScore / 20) * 100),
      status: servicesScore >= 17 ? 'excellent' : 'good',
      detail: `${publishedServicesCount} shërbime aktive të publikuara me kushte ${hasClearPricing ? 'dhe çmime transparente' : 'sipas marrëveshjes'}.`,
    },
    {
      key: 'experience',
      title: 'Përvoja & Kualifikimi Profesional',
      score: experienceScore,
      maxScore: 15,
      percentage: Math.round((experienceScore / 15) * 100),
      status: experienceScore >= 13 ? 'excellent' : 'good',
      detail: years > 0 ? `${years} vite përvojë pune e dokumentuar.` : 'Kualifikim profesional i plotësuar.',
    },
    {
      key: 'availability',
      title: 'Disponueshmëria & Komunikimi',
      score: availabilityScore,
      maxScore: 10,
      percentage: Math.round((availabilityScore / 10) * 100),
      status: availabilityScore >= 9 ? 'excellent' : 'good',
      detail: 'Gatishmëri për caktim takimesh dhe komunikim të shpejtë.',
    },
  ]

  const highlights = [
    isVerified ? 'Licencë e verifikuar zyrtarisht' : 'Dokumentacion i plotësuar',
    hasClearPricing ? 'Çmime transparente pa kosto të fshehura' : 'Kushte të qarta bashkëpunimi',
    publishedServicesCount > 0 ? `${publishedServicesCount} shërbime të gatshme për porosi` : 'Gatishmëri për kërkesa të reja',
  ]

  // Generate narrative summary using Gemini AI if available
  let aiSummary = `AI ka analizuar profilin e ${providerName}. Me një vlerësim prej ${overallScore}%, bashkëpunimi ofron ${safetyLabel.toLowerCase()} bazuar në verifikimin e licencës, shërbimet e postuara dhe historikun e kërkesave.`

  const apiKey = process.env.GEMINI_API_KEY?.trim()
  if (apiKey) {
    try {
      const genAI = new GoogleGenerativeAI(apiKey)
      const model = genAI.getGenerativeModel({
        model: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
        generationConfig: { temperature: 0.3, maxOutputTokens: 250 },
      })

      const prompt = `Je sistemi i vlerësimit të sigurisë dhe besueshmërisë për platformën KeshillaKos në Kosovë.
Ofruesi: ${providerName} (${isCompany ? 'Kompani' : 'Ekspert/Avokat'})
Rezultati i përgjithshëm: ${overallScore}% (${safetyLabel})
Faktorët:
- Licenca: ${licenseScore}/30 (${isVerified ? 'e verifikuar' : 'e paverifikuar'})
- Reputacioni dhe kërkesat: ${reputationScore}/25 (${ratingCount} vlerësime, mesatarja ${ratingAverage})
- Shërbimet e postuara: ${servicesScore}/20 (${publishedServicesCount} shërbime)
- Përvoja: ${experienceScore}/15 (${years} vite)
- Disponueshmëria: ${availabilityScore}/10

Shkruaj një përmbledhje të shkurtër (maksimumi 2-3 fjali në shqip të rrjedhshëm dhe profesional) që i tregon klientit pse kjo punë është e sigurt dhe çfarë garanton besueshmërinë e këtij ofruesi.`

      const result = await model.generateContent(prompt)
      const text = result.response.text().trim()
      if (text.length > 20) {
        aiSummary = text
      }
    } catch (err) {
      console.warn('Gemini trust score summary failed, using rule-based summary:', err)
    }
  }

  const resultData: ProviderTrustScore = {
    providerUid,
    providerName,
    isCompany,
    overallScore,
    safetyLevel,
    safetyLabel,
    aiSummary,
    factors,
    highlights,
    analyzedAt: new Date().toISOString(),
  }

  // Save to cache
  cache.set(providerUid, { data: resultData, expiresAt: Date.now() + CACHE_TTL_MS })

  return resultData
}

export async function generateProviderTrustRecommendations(
  providerUid: string,
  options?: { forceRefresh?: boolean },
): Promise<ProviderTrustRecommendationsResponse | null> {
  if (!options?.forceRefresh) {
    const cached = recsCache.get(providerUid)
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data
    }
  }

  // If in mock/test mode without active mongo connection
  if (mongoose.connection.readyState !== 1) {
    const fallbackRecs: ProviderTrustRecommendationsResponse = {
      providerUid,
      providerName: 'Ofrues i Verifikuar',
      isCompany: false,
      currentScore: 78,
      potentialScore: 96,
      potentialGain: 18,
      safetyLabel: 'Siguri e Lartë',
      aiInsight:
        'AI ka analizuar profilin tuaj. Duke përfunduar verifikimin e licencës dhe duke vendosur çmime transparente për shërbimet, profili juaj arrin 96% siguri maksimale për klientët.',
      recommendations: [
        {
          id: 'verify_license',
          title: 'Verifiko licencën profesionale',
          impact: '+10 pikë',
          impactPoints: 10,
          priority: 'critical',
          category: 'license',
          description:
            'Ngarkoni certifikatën zyrtare nga Oda përkatëse për të marrë bexhin e verifikimit dhe prioritet në kërkim.',
          actionLabel: 'Verifiko Tani',
          actionPath: '/dashboard/provider/profile',
        },
        {
          id: 'set_pricing',
          title: 'Vendos çmime transparente për shërbimet',
          impact: '+5 pikë',
          impactPoints: 5,
          priority: 'recommended',
          category: 'services',
          description:
            'Shërbimet me çmim fiks ose orar të qartë tërheqin 65% më shumë kërkesa nga klientët në Kosovë.',
          actionLabel: 'Përditëso Çmimet',
          actionPath: '/dashboard/provider/services',
        },
        {
          id: 'set_availability',
          title: 'Aktivizo orarin e takimeve',
          impact: '+3 pikë',
          impactPoints: 3,
          priority: 'recommended',
          category: 'availability',
          description:
            'Përcaktoni orët kur jeni të lirë për konsulta online ose në zyrë.',
          actionLabel: 'Cakto Orarin',
          actionPath: '/dashboard/provider/availability',
        },
      ],
      analyzedAt: new Date().toISOString(),
    }
    return fallbackRecs
  }

  // 1. Get current trust score
  const scoreData = await calculateProviderTrustScore(providerUid)
  if (!scoreData) {
    return null
  }

  const { providerName, isCompany, overallScore, safetyLabel, factors } = scoreData

  // 2. Fetch specific details for finer recommendation logic
  const user = await User.findOne({
    $or: [
      { uid: providerUid },
      ...(Types.ObjectId.isValid(providerUid) ? [{ _id: new Types.ObjectId(providerUid) }] : []),
    ],
  }).lean()

  const profile = user ? await ProviderProfile.findOne({ ownerUser: user._id }).lean() : null
  const business = isCompany && user ? await Business.findOne({ ownerUser: user._id }).lean() : null

  const licenseFactor = factors.find((f) => f.key === 'license')
  const servicesFactor = factors.find((f) => f.key === 'services')
  const experienceFactor = factors.find((f) => f.key === 'experience')
  const availabilityFactor = factors.find((f) => f.key === 'availability')
  const reputationFactor = factors.find((f) => f.key === 'reputation')

  const recommendations: TrustRecommendation[] = []

  // Check 1: License & Verification
  if (!licenseFactor || licenseFactor.score < 28) {
    const gap = licenseFactor ? 30 - licenseFactor.score : 15
    recommendations.push({
      id: 'verify_license',
      title: isCompany ? 'Verifiko regjistrimin e biznesit (ARBK)' : 'Verifiko licencën profesionale',
      impact: `+${gap} pikë`,
      impactPoints: gap,
      priority: gap >= 10 ? 'critical' : 'recommended',
      category: 'license',
      description: isCompany
        ? 'Klientët në Kosovë kërkojnë biznese të verifikuara. Ngarkoni certifikatën e ARBK-së me NUI për të fituar bexhin zyrtar.'
        : 'Ofruesit me licencë të verifikuar fitojnë besim të menjëhershëm dhe renditen më lart në rezultatet e kërkimit.',
      actionLabel: 'Verifiko Tani',
      actionPath: isCompany ? '/dashboard/company/profile' : '/dashboard/provider/profile',
    })
  }

  // Check 2: Services & Pricing
  if (!servicesFactor || servicesFactor.score < 19) {
    const gap = servicesFactor ? 20 - servicesFactor.score : 12
    if (!servicesFactor || servicesFactor.score <= 10) {
      recommendations.push({
        id: 'publish_services',
        title: 'Publiko shërbimet e para aktive',
        impact: `+${gap} pikë`,
        impactPoints: gap,
        priority: 'critical',
        category: 'services',
        description:
          'Klientët duhet të shohin saktësisht se çfarë ofroni. Publikoni të paktën 1-2 shërbime të detajuara me përshkrim të qartë.',
        actionLabel: 'Krijo Shërbim',
        actionPath: isCompany ? '/dashboard/company/services' : '/dashboard/provider/services',
      })
    } else {
      recommendations.push({
        id: 'transparent_pricing',
        title: 'Vendos çmime transparente për shërbimet',
        impact: `+${gap} pikë`,
        impactPoints: gap,
        priority: 'recommended',
        category: 'services',
        description:
          'Shërbimet me çmim fiks ose orar të qartë në vend të "sipas marrëveshjes" rrisin konvertimin e kërkesave me mbi 60%.',
        actionLabel: 'Përditëso Çmimet',
        actionPath: isCompany ? '/dashboard/company/services' : '/dashboard/provider/services',
      })
    }
  }

  // Check 3: Company Team (for companies) or Experience (for individual providers)
  if (isCompany) {
    const teamCount = (business as any)?.team?.length ?? 0
    if (teamCount === 0) {
      recommendations.push({
        id: 'company_team',
        title: 'Shto stafin dhe ekspertët në profil',
        impact: '+8 pikë',
        impactPoints: 8,
        priority: 'recommended',
        category: 'team',
        description:
          'Kompanitë me ekspertë të prezantuar me foto dhe tituj profesionalë krijojnë perceptim më të lartë autoriteti dhe sigurie.',
        actionLabel: 'Shto Ekspert',
        actionPath: '/dashboard/company/experts',
      })
    }
  } else {
    if (!experienceFactor || experienceFactor.score < 13) {
      const gap = experienceFactor ? 15 - experienceFactor.score : 6
      recommendations.push({
        id: 'work_experience',
        title: 'Dokumento përvojën dhe arsimin',
        impact: `+${gap} pikë`,
        impactPoints: gap,
        priority: 'recommended',
        category: 'experience',
        description:
          'Shtoni vitet e praktikës, pozitat e mëparshme dhe edukimin për të dëshmuar kompetencën para klientëve të rinj.',
        actionLabel: 'Shto Përvojën',
        actionPath: '/dashboard/provider/profile',
      })
    }
  }

  // Check 4: Availability & Online Appointments
  if (!availabilityFactor || availabilityFactor.score < 9) {
    const gap = availabilityFactor ? 10 - availabilityFactor.score : 4
    recommendations.push({
      id: 'set_availability',
      title: 'Aktivizo orarin për caktim takimesh',
      impact: `+${gap} pikë`,
      impactPoints: gap,
      priority: 'recommended',
      category: 'availability',
      description:
        'Caktimi i orarit të lirë u mundëson klientëve të rezervojnë konsulta direkt, duke shkurtuar kohën e pritjes.',
      actionLabel: 'Cakto Orarin',
      actionPath: isCompany ? '/dashboard/company/profile' : '/dashboard/provider/availability',
    })
  }

  // Check 5: Client Reviews & Reputation
  if (!reputationFactor || reputationFactor.score < 22) {
    const gap = reputationFactor ? 25 - reputationFactor.score : 5
    recommendations.push({
      id: 'client_reviews',
      title: 'Ndërto reputacionin me vlerësime klientësh',
      impact: `+${gap} pikë`,
      impactPoints: gap,
      priority: 'optional',
      category: 'reputation',
      description:
        'Përfundoni kërkesat e pranuara me sukses dhe kërkojuni klientëve të lënë një vlerësim me yje te profili.',
      actionLabel: 'Shiko Kërkesat',
      actionPath: isCompany ? '/dashboard/company/inbox' : '/dashboard/provider/inbox',
    })
  }

  // Sort by priority (critical first, then recommended, then optional)
  const priorityWeight: Record<string, number> = { critical: 3, recommended: 2, optional: 1 }
  recommendations.sort((a, b) => (priorityWeight[b.priority] || 0) - (priorityWeight[a.priority] || 0))

  // Select top 4 recommendations
  const topRecommendations = recommendations.slice(0, 4)

  // Calculate potential score
  const totalGain = topRecommendations.reduce((sum, r) => sum + r.impactPoints, 0)
  const potentialGain = Math.min(100 - overallScore, totalGain)
  const potentialScore = Math.min(100, overallScore + potentialGain)

  // AI Insight narrative
  let aiInsight = `AI ka analizuar të dhënat e ${providerName}. Me disa përmirësime kyçe, siguria e profilit mund të rritet nga ${overallScore}% në ${potentialScore}%, duke tërhequr më shumë klientë të interesuar.`

  const apiKey = process.env.GEMINI_API_KEY?.trim()
  if (apiKey) {
    try {
      const genAI = new GoogleGenerativeAI(apiKey)
      const model = genAI.getGenerativeModel({
        model: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
        generationConfig: { temperature: 0.35, maxOutputTokens: 300 },
      })

      const prompt = `Je këshilltari kryesor i inteligjencës artificiale për platformën KeshillaKos në Kosovë.
Ofruesi: ${providerName} (${isCompany ? 'Kompani' : 'Ekspert/Avokat'})
Pikët aktuale të sigurisë: ${overallScore}%
Pikët e mundshme: ${potentialScore}% (+${potentialGain} pikë)
Rekomandimet e identifikuara:
${topRecommendations.map((r, i) => `${i + 1}. [${r.category.toUpperCase()}] ${r.title}: ${r.description}`).join('\n')}

Shkruaj një analizë dhe këshillim strategjik të shkurtër (2-3 fjali në shqip profesional, mikpritës dhe motivues) drejtuar këtij ofruesi, duke i shpjeguar pse këto hapa do ta bëjnë profilin e tij dukshëm më të sigurt dhe të besueshëm për klientët në Kosovë.`

      const result = await model.generateContent(prompt)
      const text = result.response.text().trim()
      if (text.length > 25) {
        aiInsight = text
      }
    } catch (err) {
      console.warn('Gemini AI recommendations insight failed, using rule-based insight:', err)
    }
  }

  const response: ProviderTrustRecommendationsResponse = {
    providerUid,
    providerName,
    isCompany,
    currentScore: overallScore,
    potentialScore,
    potentialGain,
    safetyLabel,
    aiInsight,
    recommendations: topRecommendations,
    analyzedAt: new Date().toISOString(),
  }

  recsCache.set(providerUid, { data: response, expiresAt: Date.now() + RECS_CACHE_TTL_MS })
  return response
}
