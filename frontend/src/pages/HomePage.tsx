import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button, Card, Input, ProgressBar, toast } from '@heroui/react'
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
  Sparkles,
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
import { catalogCardImage } from '../data/catalogImages'
import { getErrorMessage } from '../utils/errors'
import { useSavedLocation } from '../hooks/useSavedLocation'
import heroPlaceholder from '../assets/hero.png'

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

function currentCatalogLanguage(): 'sq' | 'en' {
  return document.documentElement.lang.toLowerCase().startsWith('en') ? 'en' : 'sq'
}

const POPULAR_CATEGORY_COUNT = 6

const HOW_STEPS = [
  {
    title: 'Zgjidh si të kërkosh',
    text: 'Nëse e di shërbimin, kërko drejtpërdrejt. Nëse jo, të udhëheqim me 7 hapa.',
    icon: Search,
  },
  {
    title: 'Shiko përputhjet',
    text: 'Të gjejmë ofrues lokalë ose online që përputhen me rastin tënd.',
    icon: Sparkles,
  },
  {
    title: 'Bisedo dhe rezervo',
    text: 'Dërgo mesazh, kërkesë ose orar — pa thirrje të papritura.',
    icon: MessageCircle,
  },
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
  const [catalogLanguage, setCatalogLanguage] = useState(currentCatalogLanguage)
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
    const observer = new MutationObserver(() => setCatalogLanguage(currentCatalogLanguage()))
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    setIntake((previous) => ({ ...previous, location: selectedLocation ? locationLabel(selectedLocation, catalogLanguage) : '' }))
  }, [selectedLocation, catalogLanguage])

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
        location: selectedLocation ? locationLabel(selectedLocation, catalogLanguage) : intake.location,
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
    setIntake({ ...INITIAL, location: selectedLocation ? locationLabel(selectedLocation, catalogLanguage) : '' })
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
    <div className="tt-shell">
      <SiteNav />

      <main>
        <section
          ref={heroRef}
          className={`tt-hero${matching ? ' is-matching' : ''}`}
          aria-labelledby="tt-hero-heading"
        >
          <div className="tt-hero-media" aria-hidden />
          <div className="tt-hero-inner">
            <div className="tt-hero-copy">
              <p className="brand tt-hero-brand">KëshillaKos</p>
              <h1 id="tt-hero-heading">Për çdo nevojë që ke.</h1>
              <p className="tt-hero-lead">
                Gjej avokatë, juristë dhe kontabilistë — lokalë ose online, në një vend.
              </p>

              <div className={`tt-search${matching ? ' is-matching' : ''}`}>
                {searchMode === 'choose' ? (
                  <div className="tt-search-modes" role="group" aria-label="Si dëshiron të kërkosh?">
                    <button type="button" className="tt-search-mode" onClick={startGuided}>
                      <HelpCircle size={22} aria-hidden />
                      <strong>Nuk e di saktësisht</strong>
                      <span>Të udhëheqim me 7 hapa të shkurtra derisa të gjejmë ofruesin e duhur.</span>
                      <em>
                        Fillo matching
                        <ArrowRight size={16} />
                      </em>
                    </button>
                    <button type="button" className="tt-search-mode" onClick={startBrowse}>
                      <Search size={22} aria-hidden />
                      <strong>E di çfarë më duhet</strong>
                      <span>Kërko me fjalë ose zgjidh kategorinë dhe shiko ofertat menjëherë.</span>
                      <em>
                        Kërko tani
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
                        placeholder="Shkruaj shërbimin — kontrata, tatime, IT..."
                        fullWidth
                        aria-label="Çfarë të duhet?"
                      />
                    </label>
                    <div className="tt-search-location">
                      <LocationSelector value={selectedLocation} onChange={selectLocation} disabled={locationLoading || locationSaving} className="tt-location-selector--hero" />
                    </div>
                    <Button type="submit" variant="primary" className="tt-search-submit">
                      Shiko ofertat
                      <ArrowRight size={18} />
                    </Button>
                  </form>
                ) : null}

                {searchMode === 'browse' && locationError ? <p className="tt-location-save-error" role="alert">{locationError}</p> : null}

                {searchMode === 'browse' ? (
                  <>
                    {popularCategories.length > 0 ? (
                      <div className="tt-search-chips" aria-label="Kategori të popullarizuara">
                        {popularCategories.map((category) => {
                          const Icon = CATEGORY_ICONS[category.slug] ?? BriefcaseBusiness
                          const label = category.name[catalogLanguage] || category.name.sq
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
                      Nuk e di saktësisht? Fillo matching me 7 hapa
                    </button>
                  </>
                ) : null}

                {matching && step <= TOTAL_STEPS ? (
                  <div className="tt-match-flow">
                    <div className="wizard-meta">
                      <ProgressBar
                        aria-label={`Progresi: hapi ${step} nga ${TOTAL_STEPS}`}
                        value={(step / TOTAL_STEPS) * 100}
                        className="wizard-progress-bar"
                      >
                        <ProgressBar.Track>
                          <ProgressBar.Fill />
                        </ProgressBar.Track>
                      </ProgressBar>
                      <p className="wizard-step-label">
                        Hapi <strong>{step}</strong> / {TOTAL_STEPS}
                      </p>
                    </div>

                    <form onSubmit={onNext} className="wizard-body">
                      {step === 1 ? (
                        <fieldset className="wizard-fieldset">
                          <legend>Çfarë të duhet?</legend>
                          <p className="muted">Përshkruaj me fjalët e tua — edhe nëse nuk je i sigurt.</p>
                          <Input
                            ref={needInputRef}
                            value={intake.need}
                            onChange={(e) => update('need', e.target.value)}
                            placeholder="p.sh. dua të hap biznes, por nuk di nga t'ia nisi"
                            fullWidth
                            aria-label="Përshkruaj nevojën"
                          />
                        </fieldset>
                      ) : null}
                      {step === 2 ? (
                        <fieldset className="wizard-fieldset">
                          <legend>Për kë është?</legend>
                          <p className="tt-match-need">{intake.need}</p>
                          <div className="choice-row">
                            <button
                              type="button"
                              className={`choice${intake.audience === 'individual' ? ' is-selected' : ''}`}
                              onClick={() => update('audience', 'individual')}
                            >
                              Individ
                            </button>
                            <button
                              type="button"
                              className={`choice${intake.audience === 'business' ? ' is-selected' : ''}`}
                              onClick={() => update('audience', 'business')}
                            >
                              Biznes
                            </button>
                          </div>
                        </fieldset>
                      ) : null}

                      {step === 3 ? (
                        <fieldset className="wizard-fieldset">
                          <legend>Ku?</legend>
                          <LocationSelector value={selectedLocation} onChange={selectLocation} disabled={locationLoading || locationSaving} className="tt-location-selector--wizard" />
                          {locationError ? <p className="tt-location-save-error" role="alert">{locationError}</p> : null}
                        </fieldset>
                      ) : null}

                      {step === 4 ? (
                        <fieldset className="wizard-fieldset">
                          <legend>Gjuha</legend>
                          <div className="choice-row">
                            {(
                              [
                                ['Albanian', 'Shqip'],
                                ['German', 'Gjermanisht'],
                                ['English', 'Anglisht'],
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
                          <legend>Sa urgjente është?</legend>
                          <div className="choice-row">
                            {(
                              [
                                ['today', 'Sot'],
                                ['this_week', 'Këtë javë'],
                                ['flexible', 'Fleksibël'],
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
                          <legend>Buxheti (opsionale)</legend>
                          <Input
                            value={intake.budget}
                            onChange={(e) => update('budget', e.target.value)}
                            placeholder="p.sh. deri €100 / fleksibël"
                            fullWidth
                          />
                        </fieldset>
                      ) : null}

                      {step === 7 ? (
                        <fieldset className="wizard-fieldset">
                          <legend>Si të të kontaktojnë?</legend>
                          <div className="choice-row">
                            {(
                              [
                                ['chat', 'Chat'],
                                ['phone', 'Telefon'],
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
                          {step === 1 ? 'Ndrysho llojin e kërkimit' : 'Kthehu'}
                        </Button>
                        <Button
                          type="submit"
                          variant="primary"
                          isDisabled={!canContinue() || loading}
                          className="wizard-submit"
                        >
                          {loading
                            ? 'Duke gjetur ekspertë...'
                            : step === TOTAL_STEPS
                              ? 'Gjej ekspertë'
                              : 'Vazhdo'}
                          {!loading ? <ArrowRight size={18} /> : null}
                        </Button>
                      </div>
                    </form>
                  </div>
                ) : null}

                {step === 8 ? (
                  <div className="tt-match-flow match-results">
                    <h3>{resultMessage || 'Rezultatet e matching'}</h3>
                    <p className="muted">
                      Bazuar në përgjigjet e tua
                      {engine === 'gemini' ? ' · matching me AI' : null}
                      {engine === 'heuristic' ? ' · matching bazë' : null}.
                    </p>

                    <div className="wizard-actions match-toolbar">
                      <Button type="button" variant="outline" onPress={onBack}>
                        Ndrysho përgjigjet
                      </Button>
                      <Button type="button" variant="ghost" onPress={resetAll}>
                        Fillo nga e para
                      </Button>
                    </div>

                    {!matches || matches.length === 0 ? (
                      <p className="muted home-services-status">
                        Nuk u gjetën ekspertë. Provo lokacion Online ose një përshkrim tjetër.
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
                                {m.verified ? <li className="match-verified">I verifikuar</li> : null}
                                <li>{m.respondsWithin}</li>
                              </ul>
                              <p>{m.reason}</p>
                              {m.bio ? <p className="match-bio">{m.bio}</p> : null}

                              <div className="provider-details">
                                <p className="provider-details-label">Ofruesi i shërbimit</p>
                                <strong>{m.companyName || m.name}</strong>
                                <ul className="match-meta">
                                  {m.providerRoleLabel ? <li>{m.providerRoleLabel}</li> : null}
                                  <li>
                                    ★ {m.ratingCount > 0 ? m.rating.toFixed(1) : '—'}
                                    {m.ratingCount > 0
                                      ? ` (${m.ratingCount} vlerësime)`
                                      : ' (pa vlerësime)'}
                                  </li>
                                </ul>
                              </div>

                              {m.source === 'service' ? (
                                <Link to={`/services/${m.id}`} className="ghost match-details-link">
                                  Shiko detajet
                                </Link>
                              ) : (
                                <Link to={`/providers/${m.providerUid}`} className="ghost match-details-link">
                                  Shiko profilin
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
                                  location: selectedLocation ? locationLabel(selectedLocation, catalogLanguage) : intake.location,
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
                <p className="tt-hero-note">Zgjidh si të kërkosh — matching me 7 hapa, ose kërkim i drejtpërdrejtë.</p>
              ) : null}
              {searchMode === 'browse' ? (
                <p className="tt-hero-note">Pa thirrje derisa ti të dërgosh mesazh.</p>
              ) : null}
            </div>
          </div>
        </section>

        {searchMode !== 'guided' ? (
        <section id="categories" className="tt-section tt-categories" aria-labelledby="categories-heading">
          <div className="tt-section-inner">
            <div className="tt-section-head">
              <h2 id="categories-heading">Zgjidh një shërbim</h2>
              <p>Eksploro kategoritë dhe zgjidh shërbimin që të duhet.</p>
            </div>
            {categoriesLoading ? <p className="muted" role="status">Kategoritë po ngarkohen...</p> : null}
            {catalogError ? <p className="error" role="alert">{catalogError}</p> : null}
            {!categoriesLoading && !catalogError && categories.length === 0 ? <p className="muted">Nuk ka kategori të disponueshme.</p> : null}
            {categories.length > 0 ? (
              <>
                <div className="tt-category-scroll" aria-label="Kategoritë">
                  {categories.map((category) => {
                    const Icon = CATEGORY_ICONS[category.slug] ?? BriefcaseBusiness
                    return (
                      <Button
                        key={category._id}
                        type="button"
                        variant="ghost"
                        className={`tt-category-choice${selectedCategoryId === category._id ? ' is-selected' : ''}`}
                        aria-pressed={selectedCategoryId === category._id}
                        onPress={() => setSelectedCategoryId(category._id)}
                      >
                        <Icon size={36} strokeWidth={1.55} aria-hidden />
                        <span>{category.name[catalogLanguage] || category.name.sq}</span>
                      </Button>
                    )
                  })}
                </div>
                <div className="tt-subcategory-heading">
                  <h3>{selectedCategory?.name[catalogLanguage] || selectedCategory?.name.sq}</h3>
                  <p>Zgjidh një shërbim për të parë ofertat.</p>
                </div>
                {subcategoriesLoading ? <p className="muted" role="status">Shërbimet po ngarkohen...</p> : null}
                {subcategoriesError ? <p className="error" role="alert">{subcategoriesError}</p> : null}
                {!subcategoriesLoading && !subcategoriesError && selectedCategoryId && subcategories.length === 0 ? <p className="muted">Nuk ka shërbime të disponueshme.</p> : null}
                {!subcategoriesLoading && !subcategoriesError ? (
                  <div className="tt-subcategory-grid">
                    {subcategories.map((subcategory) => (
                      <button
                        key={subcategory._id}
                        type="button"
                        className="tt-subcategory-action"
                        onClick={() => browseOffers(subcategory.name[catalogLanguage] || subcategory.name.sq, { categoryId: selectedCategoryId, subcategoryId: subcategory._id })}
                      >
                        <Card className="tt-subcategory-card">
                          <img
                            className="tt-subcategory-image"
                            src={catalogCardImage(subcategory.slug, selectedCategory?.slug)}
                            alt=""
                            loading="lazy"
                            onError={(event) => { event.currentTarget.src = heroPlaceholder }}
                          />
                          <span className="tt-subcategory-shade" aria-hidden />
                          <span className="tt-subcategory-title">
                            {subcategory.name[catalogLanguage] || subcategory.name.sq}
                          </span>
                        </Card>
                      </button>
                    ))}
                  </div>
                ) : null}
              </>
            ) : null}
          </div>
        </section>
        ) : null}

        <section id="how" className="tt-section tt-how" aria-labelledby="how-heading">
          <div className="tt-section-inner">
            <div className="tt-section-head">
              <h2 id="how-heading">Gjej ndihmën që të duhet</h2>
              <p>Kërko drejtpërdrejt kur e di shërbimin, ose nis matching me 7 hapa kur nuk je i sigurt.</p>
            </div>
            <div className="tt-how-grid">
              {HOW_STEPS.map((item, index) => {
                const Icon = item.icon
                return (
                  <div key={item.title} className="tt-how-item">
                    <span className="tt-how-num">{index + 1}</span>
                    <Icon size={22} className="tt-how-icon" aria-hidden />
                    <h3>{item.title}</h3>
                    <p>{item.text}</p>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        <section id="trust" className="tt-section tt-trust" aria-labelledby="trust-heading">
          <div className="tt-section-inner">
            <div className="tt-section-head">
              <h2 id="trust-heading">Pse klientët zgjedhin KëshillaKos</h2>
              <p>Çdo ditë njerëz si ti mbështeten te ofruesit tanë për probleme reale.</p>
            </div>
            <div className="tt-trust-grid">
              <div className="tt-trust-item">
                <BadgeCheck size={26} aria-hidden />
                <h3>Vetëm ofrues të besueshëm</h3>
                <p>Shfaqim profile me shërbime publike, vlerësime dhe detaje të qarta.</p>
              </div>
              <div className="tt-trust-item">
                <MessageCircle size={26} aria-hidden />
                <h3>Ti kontrollon kontaktin</h3>
                <p>Pa thirrje të papritura — nis chat ose kërkesë kur je gati.</p>
              </div>
              <div className="tt-trust-item">
                <ShieldCheck size={26} aria-hidden />
                <h3>Matching i thjeshtë</h3>
                <p>Përshkruaj nevojën me fjalët e tua dhe merr përputhje të personalizuara.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="tt-cta-band" aria-labelledby="cta-heading">
          <div className="tt-section-inner tt-cta-inner">
            <h2 id="cta-heading">Një vend për çdo ndihmë që të duhet.</h2>
            <p>Nis tani — gjej ofruesin e duhur për rastin tënd.</p>
            <div className="tt-cta-actions">
              <Button
                variant="primary"
                className="tt-cta-button"
                onPress={startGuided}
              >
                Fillo matching
                <ArrowRight size={18} />
              </Button>
              <Button
                variant="outline"
                className="tt-cta-button tt-cta-register"
                onPress={startBrowse}
              >
                Kërko drejtpërdrejt
              </Button>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}
