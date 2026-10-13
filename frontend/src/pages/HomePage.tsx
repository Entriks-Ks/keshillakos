import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { Button, Input, ProgressBar, toast } from '@heroui/react'
import {
  ArrowRight,
  BadgeCheck,
  BriefcaseBusiness,
  Building2,
  Calculator,
  CarFront,
  DraftingCompass,
  Dumbbell,
  GraduationCap,
  HeartHandshake,
  HelpCircle,
  House,
  Languages,
  LayoutGrid,
  Megaphone,
  MessageCircle,
  Monitor,
  PartyPopper,
  Plane,
  Scale,
  Scissors,
  Search,
  ShieldCheck,
  ShoppingBag,
  Trees,
  TrendingUp,
  WalletCards,
  type LucideIcon,
} from 'lucide-react'
import { fetchCategories, fetchSubcategories, type CatalogCategory, type CatalogSubcategory } from '../api/catalog'
import { locationLabel, type LocationSelection } from '../api/locations'
import { runMatch, type MatchIntake, type MatchedExpert } from '../api/match'
import LocationSelector from '../components/LocationSelector'
import SendRequestButton from '../components/SendRequestButton'
import SiteNav from '../components/SiteNav'
import SiteFooter from '../components/SiteFooter'
import { catalogCardImage, catalogCategoryImage } from '../data/catalogImages'
import { catalogLanguage } from '../i18n'
import { getErrorMessage } from '../utils/errors'
import { providerPath, servicePath } from '../utils/publicPaths'
import { useSavedLocation } from '../hooks/useSavedLocation'
import heroPlaceholder from '../assets/hero.png'
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
  const [searchMode, setSearchMode] = useState<SearchMode>('choose')

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
    setIntake((previous) => ({ ...previous, location: selectedLocation ? locationLabel(selectedLocation, namesLang) : '' }))
  }, [selectedLocation, namesLang])

  useEffect(() => {
    const controller = new AbortController()
    fetchCategories(controller.signal)
      .then((items) => {
        const active = items.filter((item) => item.isActive).sort((a, b) => a.order - b.order || a.slug.localeCompare(b.slug))
        setCategories(active)
        setSelectedCategoryId((previous) => active.some((item) => item._id === previous) ? previous : active[0]?._id ?? '')
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted) setCatalogError(getErrorMessage(err))
      })
      .finally(() => { if (!controller.signal.aborted) setCategoriesLoading(false) })
    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (!selectedCategoryId) return
    const controller = new AbortController()
    fetchSubcategories(selectedCategoryId, controller.signal)
      .then((items) => setSubcategoriesResult({
        categoryId: selectedCategoryId,
        items: items.filter((item) => item.isActive).sort((a, b) => a.order - b.order || a.slug.localeCompare(b.slug)),
        error: '',
      }))
      .catch((err: unknown) => {
        if (!controller.signal.aborted) setSubcategoriesResult({ categoryId: selectedCategoryId, items: [], error: getErrorMessage(err) })
      })
    return () => controller.abort()
  }, [selectedCategoryId])

  function update<K extends keyof IntakeState>(key: K, value: IntakeState[K]) {
    setIntake((prev) => ({ ...prev, [key]: value }))
  }

  function selectLocation(value: LocationSelection | null) { void changeLocation(value) }

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
      setSearchMode('choose')
      return
    }
    setStep((s) => Math.max(1, s - 1))
  }

  function resetAll() {
    setIntake({ ...INITIAL, location: selectedLocation ? locationLabel(selectedLocation, namesLang) : '' })
    setDiscoveryContext({})
    setSearchMode('choose')
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
        <section
          ref={heroRef}
          className={`tt-hero${matching ? ' is-matching' : ''}`}
          aria-labelledby="tt-hero-heading"
        >
          <div className="tt-hero-media" aria-hidden>
            <picture>
              <source media="(max-width: 640px)" type="image/avif" srcSet="/images/hero/mobile-480.avif 480w, /images/hero/mobile-768.avif 768w" sizes="100vw" />
              <source media="(max-width: 640px)" type="image/webp" srcSet="/images/hero/mobile-480.webp 480w, /images/hero/mobile-768.webp 768w" sizes="100vw" />
              <source type="image/avif" srcSet="/images/hero/desktop-960.avif 960w, /images/hero/desktop-1440.avif 1440w, /images/hero/desktop-1920.avif 1920w" sizes="100vw" />
              <img src="/images/hero/desktop-1440.webp" srcSet="/images/hero/desktop-960.webp 960w, /images/hero/desktop-1440.webp 1440w, /images/hero/desktop-1920.webp 1920w" sizes="100vw" width={1440} height={810} alt="" fetchPriority="high" loading="eager" />
            </picture>
          </div>
          <div className="tt-hero-inner">
            <div className="tt-hero-copy">
              <p className="brand tt-hero-brand">KLAW</p>
              <h1 id="tt-hero-heading">{t('home.title')}</h1>
              <p className="tt-hero-lead">{t('home.lead')}</p>

              <div className={`tt-search${matching ? ' is-matching' : ''}`}>
                {searchMode === 'choose' ? (
                  <div className="tt-search-modes" role="group" aria-label={t('home.choose')}>
                    <button type="button" className="tt-search-mode" onClick={startGuided}>
                      <HelpCircle size={22} aria-hidden />
                      <strong>{t('home.unsureTitle')}</strong>
                      <span>{t('home.unsureText')}</span>
                      <em>
                        {t('home.startMatch')}
                        <ArrowRight size={16} />
                      </em>
                    </button>
                    <button type="button" className="tt-search-mode" onClick={startBrowse}>
                      <Search size={22} aria-hidden />
                      <strong>{t('home.sureTitle')}</strong>
                      <span>{t('home.sureText')}</span>
                      <em>
                        {t('home.searchNow')}
                        <ArrowRight size={16} />
                      </em>
                    </button>
                  </div>
                ) : null}

                {searchMode === 'browse' ? (
                  <form className="tt-search-bar" onSubmit={onSearchSubmit}>
                    <label className="tt-search-need">
                      <Search size={18} aria-hidden />
                      <Input
                        ref={needInputRef}
                        value={intake.need}
                        onChange={(e) => update('need', e.target.value)}
                        placeholder={t('home.needPlaceholder')}
                        fullWidth
                        aria-label={t('home.needLabel')}
                      />
                    </label>
                    <div className="tt-search-location">
                      <LocationSelector value={selectedLocation} onChange={selectLocation} disabled={locationLoading || locationSaving} className="tt-location-selector--hero" />
                    </div>
                    <Button type="submit" variant="primary" className="tt-search-submit">
                      {t('home.seeOffers')}
                      <ArrowRight size={18} />
                    </Button>
                  </form>
                ) : null}

                {searchMode === 'browse' && locationError ? <p className="tt-location-save-error" role="alert">{locationError}</p> : null}

                {searchMode === 'browse' ? (
                  <>
                    {popularCategories.length > 0 ? (
                      <div className="tt-search-chips" aria-label={t('home.popular')}>
                        {popularCategories.map((category) => {
                          const Icon = CATEGORY_ICONS[category.slug] ?? BriefcaseBusiness
                          const label = category.name[namesLang] || category.name.sq
                          return (
                            <button
                              key={category._id}
                              type="button"
                              className="tt-quick-chip"
                              onClick={() => browseOffers('', { categoryId: category._id })}
                            >
                              <Icon size={15} strokeWidth={2} aria-hidden />
                              <span>{label}</span>
                            </button>
                          )
                        })}
                      </div>
                    ) : null}
                    <button type="button" className="tt-search-switch" onClick={startGuided}>
                      {t('home.unsureLink')}
                    </button>
                  </>
                ) : null}

                {matching && step <= TOTAL_STEPS ? (
                  <div className="tt-match-flow">
                    <div className="wizard-meta">
                      <ProgressBar
                        aria-label={t('home.progress', { step, total: TOTAL_STEPS })}
                        value={(step / TOTAL_STEPS) * 100}
                        className="wizard-progress-bar"
                      >
                        <ProgressBar.Track>
                          <ProgressBar.Fill />
                        </ProgressBar.Track>
                      </ProgressBar>
                      <p className="wizard-step-label">
                        {t('home.step')} <strong>{step}</strong> / {TOTAL_STEPS}
                      </p>
                    </div>

                    <form onSubmit={onNext} className="wizard-body">
                      {step === 1 ? (
                        <fieldset className="wizard-fieldset">
                          <legend>{t('home.what')}</legend>
                          <p className="muted">{t('home.whatHint')}</p>
                          <Input
                            ref={needInputRef}
                            value={intake.need}
                            onChange={(e) => update('need', e.target.value)}
                            placeholder={t('home.whatPlaceholder')}
                            fullWidth
                            aria-label={t('home.describe')}
                          />
                        </fieldset>
                      ) : null}
                      {step === 2 ? (
                        <fieldset className="wizard-fieldset">
                          <legend>{t('home.who')}</legend>
                          <p className="tt-match-need">{intake.need}</p>
                          <div className="choice-row">
                            <button
                              type="button"
                              className={`choice${intake.audience === 'individual' ? ' is-selected' : ''}`}
                              onClick={() => update('audience', 'individual')}
                            >
                              {t('home.individual')}
                            </button>
                            <button
                              type="button"
                              className={`choice${intake.audience === 'business' ? ' is-selected' : ''}`}
                              onClick={() => update('audience', 'business')}
                            >
                              {t('home.business')}
                            </button>
                          </div>
                        </fieldset>
                      ) : null}

                      {step === 3 ? (
                        <fieldset className="wizard-fieldset">
                          <legend>{t('home.where')}</legend>
                          <LocationSelector value={selectedLocation} onChange={selectLocation} disabled={locationLoading || locationSaving} className="tt-location-selector--wizard" />
                          {locationError ? <p className="tt-location-save-error" role="alert">{locationError}</p> : null}
                        </fieldset>
                      ) : null}

                      {step === 4 ? (
                        <fieldset className="wizard-fieldset">
                          <legend>{t('home.language')}</legend>
                          <div className="choice-row">
                            {(
                              [
                                ['Albanian', t('home.albanian')],
                                ['German', t('home.german')],
                                ['English', t('home.english')],
                              ] as const
                            ).map(([value, label]) => (
                              <button
                                key={value}
                                type="button"
                                className={`choice${intake.language === value ? ' is-selected' : ''}`}
                                onClick={() => update('language', value)}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                        </fieldset>
                      ) : null}

                      {step === 5 ? (
                        <fieldset className="wizard-fieldset">
                          <legend>{t('home.urgent')}</legend>
                          <div className="choice-row">
                            {(
                              [
                                ['today', t('home.today')],
                                ['this_week', t('home.week')],
                                ['flexible', t('home.flexible')],
                              ] as const
                            ).map(([value, label]) => (
                              <button
                                key={value}
                                type="button"
                                className={`choice${intake.urgency === value ? ' is-selected' : ''}`}
                                onClick={() => update('urgency', value)}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                        </fieldset>
                      ) : null}

                      {step === 6 ? (
                        <fieldset className="wizard-fieldset">
                          <legend>{t('home.budget')}</legend>
                          <Input
                            value={intake.budget}
                            onChange={(e) => update('budget', e.target.value)}
                            placeholder={t('home.budgetPlaceholder')}
                            fullWidth
                          />
                        </fieldset>
                      ) : null}

                      {step === 7 ? (
                        <fieldset className="wizard-fieldset">
                          <legend>{t('home.contact')}</legend>
                          <div className="choice-row">
                            {(
                              [
                                ['chat', 'Chat'],
                                ['phone', t('home.phone')],
                                ['email', 'Email'],
                              ] as const
                            ).map(([value, label]) => (
                              <button
                                key={value}
                                type="button"
                                className={`choice${intake.contact === value ? ' is-selected' : ''}`}
                                onClick={() => update('contact', value)}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                        </fieldset>
                      ) : null}

                      <div className="wizard-actions">
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
                          {!loading ? <ArrowRight size={18} /> : null}
                        </Button>
                      </div>
                    </form>
                  </div>
                ) : null}

                {step === 8 ? (
                  <div className="tt-match-flow match-results">
                    <h3>{resultMessage || t('home.results')}</h3>
                    <p className="muted">
                      {t('home.based')}
                      {engine === 'gemini' ? ` · ${t('home.ai')}` : null}
                      {engine === 'heuristic' ? ` · ${t('home.basic')}` : null}.
                    </p>

                    <div className="wizard-actions match-toolbar">
                      <Button type="button" variant="outline" onPress={onBack}>
                        {t('home.edit')}
                      </Button>
                      <Button type="button" variant="ghost" onPress={resetAll}>
                        {t('home.restart')}
                      </Button>
                    </div>

                    {!matches || matches.length === 0 ? (
                      <p className="muted home-services-status">
                        {t('home.none')}
                      </p>
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
                                {m.verified ? <li className="match-verified">{t('home.verified')}</li> : null}
                                <li>{m.respondsWithin}</li>
                              </ul>
                              <p>{m.reason}</p>
                              {m.bio ? <p className="match-bio">{m.bio}</p> : null}

                              <div className="provider-details">
                                <p className="provider-details-label">{t('home.provider')}</p>
                                <strong>{m.companyName || m.name}</strong>
                                <ul className="match-meta">
                                  {m.providerRoleLabel ? <li>{m.providerRoleLabel}</li> : null}
                                  <li>
                                    ★ {m.ratingCount > 0 ? m.rating.toFixed(1) : '—'}
                                    {m.ratingCount > 0
                                      ? ` (${t('home.ratings', { count: m.ratingCount })})`
                                      : ` (${t('home.noRatings')})`}
                                  </li>
                                </ul>
                              </div>

                              {m.source === 'service' ? (
                                <Link to={servicePath({ id: m.id, title: m.title })} className="ghost match-details-link">
                                  {t('home.details')}
                                </Link>
                              ) : (
                                <Link to={providerPath({ uid: m.providerUid, name: m.companyName || m.name })} className="ghost match-details-link">
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
                                  location: selectedLocation ? locationLabel(selectedLocation, namesLang) : intake.location,
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
                ) : null}
              </div>

              {searchMode === 'choose' ? (
                <p className="tt-hero-note">{t('home.noteChoose')}</p>
              ) : null}
              {searchMode === 'browse' ? (
                <p className="tt-hero-note">{t('home.noteBrowse')}</p>
              ) : null}
            </div>
          </div>
        </section>

        {searchMode !== 'guided' ? (
        <section id="categories" className="tt-section tt-categories" aria-labelledby="categories-heading">
          <div className="tt-section-inner">
            <div className="tt-section-head">
              <h2 id="categories-heading">{t('home.categories')}</h2>
              <p>{t('home.categoriesLead')}</p>
            </div>
            {categoriesLoading ? <p className="muted" role="status">{t('home.loadingCategories')}</p> : null}
            {catalogError ? <p className="error" role="alert">{catalogError}</p> : null}
            {!categoriesLoading && !catalogError && categories.length === 0 ? <p className="muted">{t('home.noCategories')}</p> : null}
          </div>
          {categories.length > 0 ? (
            <div className="tt-category-split" role="group" aria-label={t('home.categoryGroup')}>
              {[...categories]
                .sort((a, b) => Number(a.slug !== 'legal-services') - Number(b.slug !== 'legal-services'))
                .map((category) => {
                  const Icon = CATEGORY_ICONS[category.slug] ?? BriefcaseBusiness
                  const name = category.name[namesLang] || category.name.sq
                  const selected = selectedCategoryId === category._id
                  return (
                    <Button
                      key={category._id}
                      type="button"
                      variant="ghost"
                      className={`tt-category-panel${selected ? ' is-selected' : ''}`}
                      aria-pressed={selected}
                      onPress={() => setSelectedCategoryId(category._id)}
                    >
                      <img
                        className="tt-category-panel-photo"
                        src={catalogCategoryImage(category.slug)}
                        alt=""
                        onError={(event) => { event.currentTarget.src = heroPlaceholder }}
                      />
                      <span className="tt-category-panel-copy">
                        <span className="tt-category-mark" aria-hidden>
                          <Icon size={22} strokeWidth={1.75} />
                        </span>
                        <span className="tt-category-panel-title">{name}</span>
                        <span className="tt-category-panel-lead">
                          {t(CATEGORY_LEADS[category.slug] || 'home.leadFallback')}
                        </span>
                      </span>
                    </Button>
                  )
                })}
            </div>
          ) : null}
          {categories.length > 0 ? (
            <div className="tt-section-inner tt-category-services">
              <div className="tt-subcategory-heading">
                <h3>{selectedCategory?.name[namesLang] || selectedCategory?.name.sq}</h3>
                <p>{t('home.pickService')}</p>
              </div>
              {subcategoriesLoading ? <p className="muted" role="status">{t('home.loadingServices')}</p> : null}
              {subcategoriesError ? <p className="error" role="alert">{subcategoriesError}</p> : null}
              {!subcategoriesLoading && !subcategoriesError && selectedCategoryId && subcategories.length === 0 ? <p className="muted">{t('home.noServices')}</p> : null}
              {!subcategoriesLoading && !subcategoriesError ? (
                <div className="tt-service-list">
                  {subcategories.map((subcategory) => (
                    <button
                      key={subcategory._id}
                      type="button"
                      className="tt-service-tile"
                      onClick={() => browseOffers('', { categoryId: selectedCategoryId, subcategoryId: subcategory._id })}
                    >
                      <span className="tt-service-tile-image">
                        <img
                          src={catalogCardImage(subcategory.slug, selectedCategory?.slug)}
                          alt=""
                          loading="lazy"
                          onError={(event) => { event.currentTarget.src = heroPlaceholder }}
                        />
                      </span>
                      <span>{subcategory.name[namesLang] || subcategory.name.sq}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </section>
        ) : null}

        <section id="how" className="tt-section tt-how" aria-labelledby="how-heading">
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

        <section id="trust" className="tt-section tt-trust" aria-labelledby="trust-heading">
          <div className="tt-section-inner">
            <div className="tt-section-head tt-trust-head">
              <h2 id="trust-heading">{t('home.trustTitle')}</h2>
              <p>{t('home.trustLead')}</p>
            </div>
            <div className="tt-trust-grid">
              <div className="tt-trust-item">
                <BadgeCheck size={26} aria-hidden />
                <h3>{t('home.trust1')}</h3>
                <p>{t('home.trust1Text')}</p>
              </div>
              <div className="tt-trust-item">
                <MessageCircle size={26} aria-hidden />
                <h3>{t('home.trust2')}</h3>
                <p>{t('home.trust2Text')}</p>
              </div>
              <div className="tt-trust-item">
                <ShieldCheck size={26} aria-hidden />
                <h3>{t('home.trust3')}</h3>
                <p>{t('home.trust3Text')}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="tt-cta-band" aria-labelledby="cta-heading">
          <div className="tt-section-inner tt-cta-inner">
            <h2 id="cta-heading">{t('home.ctaTitle')}</h2>
            <p>{t('home.ctaLead')}</p>
            <div className="tt-cta-actions">
              <Button
                variant="primary"
                className="tt-cta-button"
                onPress={startGuided}
              >
                {t('home.startMatch')}
                <ArrowRight size={18} />
              </Button>
              <Button
                variant="outline"
                className="tt-cta-button tt-cta-register"
                onPress={startBrowse}
              >
                {t('home.ctaBrowse')}
              </Button>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}
