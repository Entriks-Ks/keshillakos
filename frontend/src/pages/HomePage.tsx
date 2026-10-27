import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { Button, Input, toast } from '@heroui/react'
import {
  ArrowRight,
  BadgeCheck,
  BriefcaseBusiness,
  Building2,
  Calculator,
  Calendar,
  CarFront,
  Clock,
  DraftingCompass,
  Dumbbell,
  Globe,
  GraduationCap,
  HeartHandshake,
  House,
  Languages,
  LayoutGrid,
  Mail,
  Megaphone,
  MessageCircle,
  Monitor,
  PartyPopper,
  Phone,
  Plane,
  Scale,
  Scissors,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Trees,
  TrendingUp,
  User,
  WalletCards,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { fetchCategories, fetchSubcategories, type CatalogCategory, type CatalogSubcategory } from '../api/catalog'
import { locationLabel, type LocationSelection } from '../api/locations'
import { runMatch, type MatchIntake, type MatchedExpert } from '../api/match'
import LocationSelector from '../components/LocationSelector'
import SendRequestButton from '../components/SendRequestButton'
import SiteNav from '../components/SiteNav'
import SiteFooter from '../components/SiteFooter'
import { catalogCardImage } from '../data/catalogImages'
import { catalogLanguage } from '../i18n'
import { getErrorMessage } from '../utils/errors'
import { providerPath, servicePath } from '../utils/publicPaths'
import { useSavedLocation } from '../hooks/useSavedLocation'
import heroPlaceholder from '../assets/hero.png'
import HomeHeroVisual from './HomeHeroVisual'
import HomeArticlesSection from './HomeArticlesSection'
import './HomeCategories.css'

const CATEGORY_LEADS: Record<string, string> = {
  'legal-services': 'home.leadLegal',
  'accounting-and-business': 'home.leadAccounting',
}

const TOTAL_STEPS = 7
const CATEGORY_ICONS: Record<string, LucideIcon> = {
  'home-and-property': House,
  'gardening-and-outdoor': Trees,
  'auto-and-transportation': CarFront,
  'legal-services': Scale,
  'accounting-and-business': Calculator,
  'it-and-technology': Monitor,
  'marketing-and-creative': Megaphone,
  'education-and-tutoring': GraduationCap,
  'translation-and-language': Languages,
  'career-development': TrendingUp,
  'real-estate': Building2,
  'architecture-and-engineering': DraftingCompass,
  'finance-and-insurance': WalletCards,
  'beauty-and-personal-care': Scissors,
  'fitness-and-wellness': Dumbbell,
  'events-and-weddings': PartyPopper,
  'family-and-care': HeartHandshake,
  'diaspora-and-relocation': Plane,
  'personal-and-lifestyle': ShoppingBag,
  'other-services': LayoutGrid,
}

const POPULAR_CATEGORY_COUNT = 6

const HOW_STEPS = [
  { title: 'home.how1', text: 'home.how1Text' },
  { title: 'home.how2', text: 'home.how2Text' },
  { title: 'home.how3', text: 'home.how3Text' },
]

type SearchMode = 'choose' | 'guided' | 'browse'

type IntakeState = {
  need: string
  audience: MatchIntake['audience'] | ''
  location: string
  language: MatchIntake['language'] | ''
  urgency: MatchIntake['urgency'] | ''
  budget: string
  contact: MatchIntake['contact'] | ''
}

const INITIAL: IntakeState = {
  need: '',
  audience: '',
  location: '',
  language: '',
  urgency: '',
  budget: '',
  contact: '',
}

export default function HomePage() {
  const { t, i18n } = useTranslation()
  const namesLang = catalogLanguage(i18n.language)
  const navigate = useNavigate()
  const heroRef = useRef<HTMLElement | null>(null)
  const needInputRef = useRef<HTMLInputElement | null>(null)
  const [step, setStep] = useState(1)
  const [intake, setIntake] = useState<IntakeState>(INITIAL)
  const { selectedLocation, changeLocation, locationLoading, locationSaving, locationError } = useSavedLocation()
  const [loading, setLoading] = useState(false)
  const [matches, setMatches] = useState<MatchedExpert[] | null>(null)
  const [discoveryContext, setDiscoveryContext] = useState<{ categoryId?: string; subcategoryId?: string }>({})
  const [resultMessage, setResultMessage] = useState('')
  const [engine, setEngine] = useState('')
  const [categories, setCategories] = useState<CatalogCategory[]>([])
  const [selectedCategoryId, setSelectedCategoryId] = useState('')
  const [subcategoriesResult, setSubcategoriesResult] = useState<{
    categoryId: string
    items: CatalogSubcategory[]
    error: string
  }>({ categoryId: '', items: [], error: '' })
  const [categoriesLoading, setCategoriesLoading] = useState(true)
  const [catalogError, setCatalogError] = useState('')
  const [searchMode, setSearchMode] = useState<SearchMode>('browse')

  const matching = searchMode === 'guided'
  const selectedCategory = categories.find((item) => item._id === selectedCategoryId)
  const subcategoriesLoading = Boolean(selectedCategoryId && subcategoriesResult.categoryId !== selectedCategoryId)
  const subcategories = subcategoriesLoading ? [] : subcategoriesResult.items
  const subcategoriesError = subcategoriesLoading ? '' : subcategoriesResult.error
  const popularCategories = useMemo(
    () => categories.slice(0, POPULAR_CATEGORY_COUNT),
    [categories],
  )

  useEffect(() => {
    document.title = `KeshillaKos — ${t('home.title')}`
  }, [t, i18n.language])

  useEffect(() => {
    setIntake((previous) => ({
      ...previous,
      location: selectedLocation ? locationLabel(selectedLocation, namesLang) : '',
    }))
  }, [selectedLocation, namesLang])

  useEffect(() => {
    const controller = new AbortController()
    fetchCategories(controller.signal)
      .then((items) => {
        const active = items
          .filter((item) => item.isActive)
          .sort((a, b) => a.order - b.order || a.slug.localeCompare(b.slug))
        setCategories(active)
        setSelectedCategoryId((previous) =>
          active.some((item) => item._id === previous) ? previous : active[0]?._id ?? '',
        )
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted) setCatalogError(getErrorMessage(err))
      })
      .finally(() => {
        if (!controller.signal.aborted) setCategoriesLoading(false)
      })
    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (!selectedCategoryId) return
    const controller = new AbortController()
    fetchSubcategories(selectedCategoryId, controller.signal)
      .then((items) =>
        setSubcategoriesResult({
          categoryId: selectedCategoryId,
          items: items
            .filter((item) => item.isActive)
            .sort((a, b) => a.order - b.order || a.slug.localeCompare(b.slug)),
          error: '',
        }),
      )
      .catch((err: unknown) => {
        if (!controller.signal.aborted)
          setSubcategoriesResult({
            categoryId: selectedCategoryId,
            items: [],
            error: getErrorMessage(err),
          })
      })
    return () => controller.abort()
  }, [selectedCategoryId])

  function update<K extends keyof IntakeState>(key: K, value: IntakeState[K]) {
    setIntake((prev) => ({ ...prev, [key]: value }))
  }

  function selectLocation(value: LocationSelection | null) {
    void changeLocation(value)
  }

  function scrollToHero() {
    requestAnimationFrame(() => {
      heroRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  function canContinue() {
    switch (step) {
      case 1:
        return intake.need.trim().length >= 4
      case 2:
        return Boolean(intake.audience)
      case 3:
        return Boolean(intake.location)
      case 4:
        return Boolean(intake.language)
      case 5:
        return Boolean(intake.urgency)
      case 6:
        return true
      case 7:
        return Boolean(intake.contact)
      default:
        return false
    }
  }

  async function finishMatch() {
    if (!intake.audience || !intake.language || !intake.urgency || !intake.contact) return

    setLoading(true)
    setMatches(null)
    try {
      const payload: MatchIntake = {
        need: intake.need.trim(),
        audience: intake.audience,
        location: selectedLocation ? locationLabel(selectedLocation, namesLang) : intake.location,
        cityId: selectedLocation?.city._id,
        ...discoveryContext,
        language: intake.language,
        urgency: intake.urgency,
        budget: intake.budget.trim() || undefined,
        contact: intake.contact,
      }
      const result = await runMatch(payload)
      if (!result.exact) {
        navigate('/ofertat?approx=1')
        return
      }
      setMatches(result.matches)
      setResultMessage(result.message)
      setEngine(result.engine)
      setStep(8)
    } catch (err) {
      toast.danger(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  function onNext(e?: FormEvent) {
    e?.preventDefault()
    if (!canContinue() || loading) return
    if (step < TOTAL_STEPS) {
      setStep((s) => s + 1)
      return
    }
    void finishMatch()
  }

  function onBack() {
    if (step === 8) {
      setStep(7)
      setMatches(null)
      return
    }
    if (step === 1) {
      setSearchMode('browse')
      return
    }
    setStep((s) => Math.max(1, s - 1))
  }

  function resetAll() {
    setIntake({ ...INITIAL, location: selectedLocation ? locationLabel(selectedLocation, namesLang) : '' })
    setDiscoveryContext({})
    setSearchMode('browse')
    setStep(1)
    setMatches(null)
    setResultMessage('')
    setEngine('')
  }

  function startGuided() {
    setDiscoveryContext({})
    setSearchMode('guided')
    setStep(1)
    setMatches(null)
    setResultMessage('')
    setEngine('')
    scrollToHero()
    requestAnimationFrame(() => needInputRef.current?.focus())
  }

  function startBrowse() {
    setSearchMode('browse')
    setMatches(null)
    setResultMessage('')
    setEngine('')
    scrollToHero()
    requestAnimationFrame(() => needInputRef.current?.focus())
  }

  function browseOffers(need = intake.need, context: { categoryId?: string; subcategoryId?: string } = {}) {
    const params = new URLSearchParams()
    const query = need.trim()
    if (query) params.set('q', query)
    if (context.categoryId) params.set('categoryId', context.categoryId)
    if (context.subcategoryId) params.set('subcategoryId', context.subcategoryId)
    navigate(`/ofertat${params.toString() ? `?${params}` : ''}`)
  }

  function onSearchSubmit(e: FormEvent) {
    e.preventDefault()
    browseOffers(intake.need)
  }

  return (
    <div className="tt-shell tt-home">
      <SiteNav />

      <main>
        {/* HERO SECTION */}
        <section
          ref={heroRef}
          className={`tt-hero${matching ? ' is-matching' : ''}`}
          aria-labelledby="tt-hero-heading"
        >
          <div className="tt-hero-media" aria-hidden>
            <picture>
              <source
                media="(max-width: 640px)"
                type="image/avif"
                srcSet="/images/hero/mobile-480.avif 480w, /images/hero/mobile-768.avif 768w"
                sizes="100vw"
              />
              <source
                media="(max-width: 640px)"
                type="image/webp"
                srcSet="/images/hero/mobile-480.webp 480w, /images/hero/mobile-768.webp 768w"
                sizes="100vw"
              />
              <source
                type="image/avif"
                srcSet="/images/hero/desktop-960.avif 960w, /images/hero/desktop-1440.avif 1440w, /images/hero/desktop-1920.avif 1920w"
                sizes="100vw"
              />
              <img
                src="/images/hero/desktop-1440.webp"
                srcSet="/images/hero/desktop-960.webp 960w, /images/hero/desktop-1440.webp 1440w, /images/hero/desktop-1920.webp 1920w"
                sizes="100vw"
                width={1440}
                height={810}
                alt=""
                fetchPriority="high"
                loading="eager"
              />
            </picture>
          </div>

          <div className="tt-hero-inner">
            <div className="tt-hero-grid">
              <div className="tt-hero-copy">
                <div className="hm-kicker-badge">
                  <Sparkles size={14} className="hm-kicker-icon" aria-hidden />
                  <span>{t('home.kicker')}</span>
                </div>

                <h1 id="tt-hero-heading">
                  {t('home.titleWord1')}
                  {t('home.titleWord2')}
                  <span className="kk-gradient-text">{t('home.titleWord3')}</span>
                </h1>

                <p className="tt-hero-lead">{t('home.lead')}</p>

                {/* Search & Matching Container */}
                <div className="hm-search-container">
                  {/* Mode Switcher Tabs */}
                  <div className="hm-search-modes-tabs" role="tablist" aria-label={t('home.choose')}>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={searchMode === 'browse'}
                      className={`hm-tab-btn ${searchMode === 'browse' ? 'is-active' : ''}`}
                      onClick={startBrowse}
                    >
                      <Search size={15} aria-hidden />
                      <span>{t('home.searchTab')}</span>
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={searchMode === 'guided'}
                      className={`hm-tab-btn ${searchMode === 'guided' ? 'is-active' : ''}`}
                      onClick={startGuided}
                    >
                      <Sparkles size={15} aria-hidden />
                      <span>{t('home.matchTab')}</span>
                    </button>
                  </div>

                  {/* Direct Search Bar */}
                  {searchMode === 'browse' && (
                    <>
                      <form className="hm-search-box" onSubmit={onSearchSubmit}>
                        <div className="hm-search-input-wrap">
                          <Search size={18} className="hm-search-icon" aria-hidden />
                          <input
                            ref={needInputRef}
                            type="text"
                            value={intake.need}
                            onChange={(e) => update('need', e.target.value)}
                            placeholder={t('home.needPlaceholder')}
                            className="hm-search-input"
                            aria-label={t('home.needLabel')}
                          />
                        </div>

                        <div className="hm-search-divider" aria-hidden />

                        <div className="hm-search-location-wrap">
                          <LocationSelector
                            value={selectedLocation}
                            onChange={selectLocation}
                            disabled={locationLoading || locationSaving}
                            className="tt-location-selector--hero"
                          />
                        </div>

                        <button type="submit" className="hm-search-submit">
                          <span>{t('home.seeOffers')}</span>
                          <ArrowRight size={16} aria-hidden />
                        </button>
                      </form>

                      {locationError && (
                        <p className="tt-location-save-error" role="alert">
                          {locationError}
                        </p>
                      )}

                      {popularCategories.length > 0 && (
                        <div className="hm-quick-chips" aria-label={t('home.popular')}>
                          <span className="hm-chip-label">{t('home.popular')}:</span>
                          {popularCategories.map((category) => {
                            const Icon = CATEGORY_ICONS[category.slug] ?? BriefcaseBusiness
                            const label = category.name[namesLang] || category.name.sq
                            return (
                              <button
                                key={category._id}
                                type="button"
                                className="hm-quick-chip"
                                onClick={() => browseOffers('', { categoryId: category._id })}
                              >
                                <Icon size={14} aria-hidden />
                                <span>{label}</span>
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </>
                  )}

                  {/* Guided 7-Step Matching Flow */}
                  {matching && step <= TOTAL_STEPS && (
                    <div className="hm-wizard-card">
                      <div className="hm-wizard-header">
                        <div className="hm-wizard-badge-row">
                          <span className="hm-wizard-badge">
                            <Sparkles size={13} aria-hidden />
                            {t('home.wizardBadge')}
                          </span>
                          <span className="hm-wizard-step-counter">
                            {t('home.stepOf', { step, total: TOTAL_STEPS })}
                          </span>
                        </div>

                        {/* 7-Segment Stepper Track */}
                        <div className="hm-wizard-stepper-track" aria-hidden>
                          {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((s) => (
                            <div
                              key={s}
                              className={`hm-wizard-step-segment ${
                                s < step ? 'is-completed' : s === step ? 'is-active' : ''
                              }`}
                            />
                          ))}
                        </div>
                      </div>

                      <form onSubmit={onNext} className="hm-wizard-body">
                        {/* Step 1: Need Description */}
                        {step === 1 && (
                          <fieldset className="hm-wizard-fieldset">
                            <legend className="hm-wizard-legend">{t('home.what')}</legend>
                            <p className="hm-wizard-hint">{t('home.whatHint')}</p>
                            <Input
                              ref={needInputRef}
                              value={intake.need}
                              onChange={(e) => update('need', e.target.value)}
                              placeholder={t('home.whatPlaceholder')}
                              fullWidth
                              aria-label={t('home.describe')}
                            />
                            <div className="hm-prompt-ideas">
                              {[
                                t('home.promptIdea1'),
                                t('home.promptIdea2'),
                                t('home.promptIdea3'),
                                t('home.promptIdea4'),
                              ].map((idea) => (
                                <button
                                  key={idea}
                                  type="button"
                                  className="hm-prompt-chip"
                                  onClick={() => update('need', idea)}
                                >
                                  + {idea}
                                </button>
                              ))}
                            </div>
                          </fieldset>
                        )}

                        {/* Step 2: Audience */}
                        {step === 2 && (
                          <fieldset className="hm-wizard-fieldset">
                            <legend className="hm-wizard-legend">{t('home.who')}</legend>
                            <p className="hm-wizard-hint">{t('home.whoHint')}</p>
                            <div className="hm-choice-cards-grid">
                              <button
                                type="button"
                                className={`hm-choice-card ${intake.audience === 'individual' ? 'is-selected' : ''}`}
                                onClick={() => update('audience', 'individual')}
                              >
                                <div className="hm-choice-card-icon">
                                  <User size={20} aria-hidden />
                                </div>
                                <div className="hm-choice-card-body">
                                  <span className="hm-choice-card-title">{t('home.individual')}</span>
                                  <span className="hm-choice-card-sub">{t('home.individualDesc')}</span>
                                </div>
                              </button>

                              <button
                                type="button"
                                className={`hm-choice-card ${intake.audience === 'business' ? 'is-selected' : ''}`}
                                onClick={() => update('audience', 'business')}
                              >
                                <div className="hm-choice-card-icon">
                                  <Building2 size={20} aria-hidden />
                                </div>
                                <div className="hm-choice-card-body">
                                  <span className="hm-choice-card-title">{t('home.business')}</span>
                                  <span className="hm-choice-card-sub">{t('home.businessDesc')}</span>
                                </div>
                              </button>
                            </div>
                          </fieldset>
                        )}

                        {/* Step 3: Location */}
                        {step === 3 && (
                          <fieldset className="hm-wizard-fieldset">
                            <legend className="hm-wizard-legend">{t('home.where')}</legend>
                            <p className="hm-wizard-hint">{t('home.whereHint')}</p>
                            <LocationSelector
                              value={selectedLocation}
                              onChange={selectLocation}
                              disabled={locationLoading || locationSaving}
                              className="tt-location-selector--wizard"
                            />
                            {locationError && (
                              <p className="tt-location-save-error" role="alert">
                                {locationError}
                              </p>
                            )}
                          </fieldset>
                        )}

                        {/* Step 4: Language */}
                        {step === 4 && (
                          <fieldset className="hm-wizard-fieldset">
                            <legend className="hm-wizard-legend">{t('home.language')}</legend>
                            <p className="hm-wizard-hint">{t('home.languageHint')}</p>
                            <div className="hm-choice-cards-grid is-3col">
                              {(
                                [
                                  ['Albanian', t('home.albanian'), t('home.langAlbanianDesc'), Languages],
                                  ['German', t('home.german'), t('home.langGermanDesc'), Globe],
                                  ['English', t('home.english'), t('home.langEnglishDesc'), Globe],
                                ] as const
                              ).map(([value, label, sub, Icon]) => (
                                <button
                                  key={value}
                                  type="button"
                                  className={`hm-choice-card ${intake.language === value ? 'is-selected' : ''}`}
                                  onClick={() => update('language', value)}
                                >
                                  <div className="hm-choice-card-icon">
                                    <Icon size={18} aria-hidden />
                                  </div>
                                  <div className="hm-choice-card-body">
                                    <span className="hm-choice-card-title">{label}</span>
                                    <span className="hm-choice-card-sub">{sub}</span>
                                  </div>
                                </button>
                              ))}
                            </div>
                          </fieldset>
                        )}

                        {/* Step 5: Urgency */}
                        {step === 5 && (
                          <fieldset className="hm-wizard-fieldset">
                            <legend className="hm-wizard-legend">{t('home.urgent')}</legend>
                            <p className="hm-wizard-hint">{t('home.urgentHint')}</p>
                            <div className="hm-choice-cards-grid is-3col">
                              {(
                                [
                                  ['today', t('home.today'), t('home.urgentTodayDesc'), Zap],
                                  ['this_week', t('home.week'), t('home.urgentWeekDesc'), Calendar],
                                  ['flexible', t('home.flexible'), t('home.urgentFlexDesc'), Clock],
                                ] as const
                              ).map(([value, label, sub, Icon]) => (
                                <button
                                  key={value}
                                  type="button"
                                  className={`hm-choice-card ${intake.urgency === value ? 'is-selected' : ''}`}
                                  onClick={() => update('urgency', value)}
                                >
                                  <div className="hm-choice-card-icon">
                                    <Icon size={18} aria-hidden />
                                  </div>
                                  <div className="hm-choice-card-body">
                                    <span className="hm-choice-card-title">{label}</span>
                                    <span className="hm-choice-card-sub">{sub}</span>
                                  </div>
                                </button>
                              ))}
                            </div>
                          </fieldset>
                        )}

                        {/* Step 6: Budget (Optional) */}
                        {step === 6 && (
                          <fieldset className="hm-wizard-fieldset">
                            <legend className="hm-wizard-legend">{t('home.budget')}</legend>
                            <p className="hm-wizard-hint">{t('home.budgetHint')}</p>
                            <Input
                              value={intake.budget}
                              onChange={(e) => update('budget', e.target.value)}
                              placeholder={t('home.budgetPlaceholder')}
                              fullWidth
                            />
                            <div className="hm-budget-pills">
                              {(
                                [
                                  ['', t('home.budgetFlexible')],
                                  ['50', t('home.budgetUnder50')],
                                  ['100', t('home.budgetUnder150')],
                                  ['250+', t('home.budgetOver150')],
                                ] as const
                              ).map(([val, label]) => (
                                <button
                                  key={label}
                                  type="button"
                                  className={`hm-budget-pill ${intake.budget === val ? 'is-active' : ''}`}
                                  onClick={() => update('budget', val)}
                                >
                                  {label}
                                </button>
                              ))}
                            </div>
                          </fieldset>
                        )}

                        {/* Step 7: Contact Method */}
                        {step === 7 && (
                          <fieldset className="hm-wizard-fieldset">
                            <legend className="hm-wizard-legend">{t('home.contact')}</legend>
                            <p className="hm-wizard-hint">{t('home.contactHint')}</p>
                            <div className="hm-choice-cards-grid is-3col">
                              {(
                                [
                                  ['chat', 'Chat', t('home.contactChatDesc'), MessageCircle],
                                  ['phone', t('home.phone'), t('home.contactPhoneDesc'), Phone],
                                  ['email', 'Email', t('home.contactEmailDesc'), Mail],
                                ] as const
                              ).map(([value, label, sub, Icon]) => (
                                <button
                                  key={value}
                                  type="button"
                                  className={`hm-choice-card ${intake.contact === value ? 'is-selected' : ''}`}
                                  onClick={() => update('contact', value)}
                                >
                                  <div className="hm-choice-card-icon">
                                    <Icon size={18} aria-hidden />
                                  </div>
                                  <div className="hm-choice-card-body">
                                    <span className="hm-choice-card-title">{label}</span>
                                    <span className="hm-choice-card-sub">{sub}</span>
                                  </div>
                                </button>
                              ))}
                            </div>
                          </fieldset>
                        )}

                        <div className="hm-wizard-actions">
                          <Button type="button" variant="ghost" onPress={onBack} isDisabled={loading}>
                            {step === 1 ? t('home.changeMode') : t('home.back')}
                          </Button>
                          <Button
                            type="submit"
                            variant="primary"
                            isDisabled={!canContinue() || loading}
                            className="wizard-submit"
                          >
                            {loading
                              ? t('home.finding')
                              : step === TOTAL_STEPS
                                ? t('home.find')
                                : t('home.next')}
                            {!loading && <ArrowRight size={18} />}
                          </Button>
                        </div>
                      </form>
                    </div>
                  )}

                  {/* Matching Results Step 8 */}
                  {step === 8 && (
                    <div className="hm-wizard-card hm-results-container">
                      <div className="hm-results-top">
                        <div>
                          <h3 className="hm-results-heading">{resultMessage || t('home.results')}</h3>
                          <p className="hm-wizard-hint" style={{ margin: '4px 0 0' }}>
                            {t('home.based')}
                            {engine === 'gemini' ? ` · ${t('home.ai')}` : null}
                            {engine === 'heuristic' ? ` · ${t('home.basic')}` : null}.
                          </p>
                        </div>

                        <div className="hm-wizard-actions match-toolbar" style={{ margin: 0, padding: 0, border: 'none' }}>
                          <Button type="button" variant="outline" onPress={onBack}>
                            {t('home.edit')}
                          </Button>
                          <Button type="button" variant="ghost" onPress={resetAll}>
                            {t('home.restart')}
                          </Button>
                        </div>
                      </div>

                      {!matches || matches.length === 0 ? (
                        <p className="muted home-services-status">{t('home.none')}</p>
                      ) : (
                        <ol className="match-list">
                          {matches.map((m, index) => (
                            <li key={`${m.source}-${m.id}`}>
                              <span className="match-rank">{index + 1}</span>
                              <div className="match-card-body">
                                <strong>{m.title}</strong>
                                <span className="match-title">
                                  {m.categoryLabel}
                                  {m.specialty ? ` · ${m.specialty}` : ''}
                                </span>
                                <ul className="match-meta">
                                  <li>{m.location}</li>
                                  <li>
                                    {m.languages.length > 0 ? m.languages.join(', ') : intake.language}
                                  </li>
                                  {m.verified && <li className="match-verified">{t('home.verified')}</li>}
                                  <li>{m.respondsWithin}</li>
                                </ul>
                                <p>{m.reason}</p>
                                {m.bio && <p className="match-bio">{m.bio}</p>}

                                <div className="provider-details">
                                  <p className="provider-details-label">{t('home.provider')}</p>
                                  <strong>{m.companyName || m.name}</strong>
                                  <ul className="match-meta">
                                    {m.providerRoleLabel && <li>{m.providerRoleLabel}</li>}
                                    <li>
                                      ★ {m.ratingCount > 0 ? m.rating.toFixed(1) : '—'}
                                      {m.ratingCount > 0
                                        ? ` (${t('home.ratings', { count: m.ratingCount })})`
                                        : ` (${t('home.noRatings')})`}
                                    </li>
                                  </ul>
                                </div>

                                {m.source === 'service' ? (
                                  <Link
                                    to={servicePath({ id: m.id, title: m.title })}
                                    className="ghost match-details-link"
                                  >
                                    {t('home.details')}
                                  </Link>
                                ) : (
                                  <Link
                                    to={providerPath({ uid: m.providerUid, name: m.companyName || m.name })}
                                    className="ghost match-details-link"
                                  >
                                    {t('home.profile')}
                                  </Link>
                                )}

                                <SendRequestButton
                                  providerUid={m.providerUid}
                                  providerId={m.providerId}
                                  providerName={m.companyName || m.name}
                                  categoryId={m.categoryId}
                                  serviceId={m.source === 'service' ? m.id : undefined}
                                  serviceTitle={m.title}
                                  intake={{
                                    need: intake.need,
                                    location: selectedLocation
                                      ? locationLabel(selectedLocation, namesLang)
                                      : intake.location,
                                    language: intake.language as MatchIntake['language'],
                                    urgency: intake.urgency as MatchIntake['urgency'],
                                    contact: intake.contact as MatchIntake['contact'],
                                  }}
                                />
                              </div>
                            </li>
                          ))}
                        </ol>
                      )}
                    </div>
                  )}
                </div>

                {/* Trust Badges under Hero */}
                <div className="hm-hero-pills" aria-label="Karakteristikat e platformës">
                  <div className="hm-hero-pill">
                    <BadgeCheck size={16} className="hm-pill-icon" aria-hidden />
                    <span>{t('home.trustBadge1')}</span>
                  </div>
                  <div className="hm-hero-pill">
                    <Globe size={16} className="hm-pill-icon" aria-hidden />
                    <span>{t('home.trustBadge2')}</span>
                  </div>
                  <div className="hm-hero-pill">
                    <ShieldCheck size={16} className="hm-pill-icon" aria-hidden />
                    <span>{t('home.trustBadge3')}</span>
                  </div>
                </div>
              </div>

              {/* Right Column: Hero Visual */}
              <div className="tt-hero-visual-col">
                <HomeHeroVisual />
              </div>
            </div>
          </div>
        </section>

        {/* CATEGORIES SECTION */}
        {searchMode !== 'guided' && (
          <section id="categories" className="tt-categories" aria-labelledby="categories-heading">
            <div className="tt-section-inner">
              <div className="tt-section-head">
                <h2 id="categories-heading">{t('home.categories')}</h2>
                <p>{t('home.categoriesLead')}</p>
              </div>

              {categoriesLoading && (
                <p className="muted" role="status">
                  {t('home.loadingCategories')}
                </p>
              )}
              {catalogError && (
                <p className="error" role="alert">
                  {catalogError}
                </p>
              )}
              {!categoriesLoading && !catalogError && categories.length === 0 && (
                <p className="muted">{t('home.noCategories')}</p>
              )}

              {/* Modern Primary Domain Selector Cards */}
              {categories.length > 0 && (
                <div className="hm-category-tabs" role="tablist" aria-label={t('home.categoryGroup')}>
                  {[...categories]
                    .sort((a, b) => Number(a.slug !== 'legal-services') - Number(b.slug !== 'legal-services'))
                    .map((category) => {
                      const Icon = CATEGORY_ICONS[category.slug] ?? BriefcaseBusiness
                      const name = category.name[namesLang] || category.name.sq
                      const isSelected = selectedCategoryId === category._id
                      return (
                        <button
                          key={category._id}
                          type="button"
                          role="tab"
                          aria-selected={isSelected}
                          className={`hm-category-card ${isSelected ? 'is-active' : ''}`}
                          onClick={() => setSelectedCategoryId(category._id)}
                        >
                          <div className="hm-category-mark" aria-hidden>
                            <Icon size={26} strokeWidth={1.8} />
                          </div>
                          <div className="hm-category-body">
                            <span className="hm-category-tag">Kategori Kryesore</span>
                            <h3 className="hm-category-title">{name}</h3>
                            <p className="hm-category-lead">
                              {t(CATEGORY_LEADS[category.slug] || 'home.leadFallback')}
                            </p>
                          </div>
                        </button>
                      )
                    })}
                </div>
              )}

              {/* Subcategories Showcase Grid */}
              {categories.length > 0 && (
                <div className="hm-subcategories-wrap">
                  <div className="hm-subcategories-head">
                    <h3>{selectedCategory?.name[namesLang] || selectedCategory?.name.sq}</h3>
                    <p className="muted">{t('home.pickService')}</p>
                  </div>

                  {subcategoriesLoading && (
                    <p className="muted" role="status">
                      {t('home.loadingServices')}
                    </p>
                  )}
                  {subcategoriesError && (
                    <p className="error" role="alert">
                      {subcategoriesError}
                    </p>
                  )}
                  {!subcategoriesLoading && !subcategoriesError && selectedCategoryId && subcategories.length === 0 && (
                    <p className="muted">{t('home.noServices')}</p>
                  )}

                  {!subcategoriesLoading && !subcategoriesError && subcategories.length > 0 && (
                    <div className="hm-subcategories-grid">
                      {subcategories.map((subcategory) => (
                        <button
                          key={subcategory._id}
                          type="button"
                          className="hm-subcategory-card"
                          onClick={() =>
                            browseOffers('', {
                              categoryId: selectedCategoryId,
                              subcategoryId: subcategory._id,
                            })
                          }
                        >
                          <div className="hm-sub-photo-wrap">
                            <img
                              className="hm-sub-photo"
                              src={catalogCardImage(subcategory.slug, selectedCategory?.slug)}
                              alt=""
                              loading="lazy"
                              onError={(event) => {
                                event.currentTarget.src = heroPlaceholder
                              }}
                            />
                            <div className="hm-sub-overlay" aria-hidden />
                            <span className="hm-sub-arrow" aria-hidden>
                              <ArrowRight size={14} />
                            </span>
                          </div>
                          <span className="hm-sub-title">
                            {subcategory.name[namesLang] || subcategory.name.sq}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>
        )}

        {/* FEATURED ARTICLES & OFFICIAL GUIDES SECTION */}
        <HomeArticlesSection />

        {/* HOW IT WORKS SECTION */}
        <section id="how" className="tt-how" aria-labelledby="how-heading">
          <div className="tt-section-inner">
            <div className="tt-how-panel">
              <div className="tt-section-head">
                <h2 id="how-heading">{t('home.howTitle')}</h2>
                <p>{t('home.howLead')}</p>
              </div>
              <div className="tt-how-grid">
                {HOW_STEPS.map((item, index) => (
                  <div key={item.title} className="tt-how-item">
                    <span className="tt-how-num">{String(index + 1).padStart(2, '0')}</span>
                    <h3>{t(item.title)}</h3>
                    <p>{t(item.text)}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* TRUST & WHY US SECTION */}
        <section id="trust" className="tt-trust" aria-labelledby="trust-heading">
          <div className="tt-section-inner">
            <div className="tt-section-head">
              <h2 id="trust-heading">{t('home.trustTitle')}</h2>
              <p>{t('home.trustLead')}</p>
            </div>
            <div className="tt-trust-grid">
              <div className="tt-trust-item">
                <BadgeCheck size={30} aria-hidden />
                <h3>{t('home.trust1')}</h3>
                <p>{t('home.trust1Text')}</p>
              </div>
              <div className="tt-trust-item">
                <MessageCircle size={30} aria-hidden />
                <h3>{t('home.trust2')}</h3>
                <p>{t('home.trust2Text')}</p>
              </div>
              <div className="tt-trust-item">
                <ShieldCheck size={30} aria-hidden />
                <h3>{t('home.trust3')}</h3>
                <p>{t('home.trust3Text')}</p>
              </div>
            </div>
          </div>
        </section>

        {/* FINAL CALL TO ACTION */}
        <section className="tt-cta-band" aria-labelledby="cta-heading">
          <div className="tt-section-inner tt-cta-inner">
            <h2 id="cta-heading">{t('home.ctaTitle')}</h2>
            <p>{t('home.ctaLead')}</p>
            <div className="tt-cta-actions">
              <button
                type="button"
                className="tt-cta-button is-primary"
                onClick={startGuided}
              >
                <span>{t('home.startMatch')}</span>
                <ArrowRight size={18} aria-hidden />
              </button>
              <button
                type="button"
                className="tt-cta-button tt-cta-register"
                onClick={startBrowse}
              >
                {t('home.ctaBrowse')}
              </button>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}
