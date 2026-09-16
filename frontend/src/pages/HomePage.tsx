import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Button, Input, ProgressBar } from '@heroui/react'
import {
  ArrowRight,
  BadgeCheck,
  Briefcase,
  MapPin,
  MessageCircle,
  Search,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { fetchDomains } from '../api/domains'
import { runMatch, type MatchIntake, type MatchedExpert } from '../api/match'
import type { DomainDefinition } from '../data/domains'
import RateProvider from '../components/RateProvider'
import SendRequestButton from '../components/SendRequestButton'
import SiteNav from '../components/SiteNav'
import { useAuth } from '../auth/AuthContext'
import { getErrorMessage } from '../utils/errors'

const TOTAL_STEPS = 7

const NEED_CHIPS = [
  'Regjistrim biznesi + Tatime',
  'Kontrata / çështje ligjore',
  'Kontabilitet dhe paga',
  'Marketing / social media',
  'Website / IT support',
  'Përkthim Shqip ↔ Gjermanisht',
]

const LOCATIONS = ['Prishtinë', 'Prizren', 'Online', 'Pejë', 'Gjakovë', 'Mitrovicë']

const HOW_STEPS = [
  {
    title: 'Përshkruaj nevojën',
    text: 'Shkruaj me fjalët e tua çfarë të duhet — pa kategori të komplikuara.',
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
  location: 'Prishtinë',
  language: '',
  urgency: '',
  budget: '',
  contact: '',
}

export default function HomePage() {
  const { user } = useAuth()
  const heroRef = useRef<HTMLElement | null>(null)
  const needInputRef = useRef<HTMLInputElement | null>(null)
  const [step, setStep] = useState(1)
  const [intake, setIntake] = useState<IntakeState>(INITIAL)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [matches, setMatches] = useState<MatchedExpert[] | null>(null)
  const [resultMessage, setResultMessage] = useState('')
  const [engine, setEngine] = useState('')
  const [domains, setDomains] = useState<DomainDefinition[]>([])

  const matching = step > 1 || matches !== null

  useEffect(() => {
    let cancelled = false
    fetchDomains()
      .then((items) => {
        if (!cancelled) setDomains(items.slice(0, 8))
      })
      .catch(() => {
        if (!cancelled) setDomains([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  function update<K extends keyof IntakeState>(key: K, value: IntakeState[K]) {
    setIntake((prev) => ({ ...prev, [key]: value }))
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
    setError('')
    setMatches(null)
    try {
      const payload: MatchIntake = {
        need: intake.need.trim(),
        audience: intake.audience,
        location: intake.location,
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
      setError(getErrorMessage(err))
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
    setError('')
    if (step === 8) {
      setStep(7)
      setMatches(null)
      return
    }
    setStep((s) => Math.max(1, s - 1))
  }

  function resetAll() {
    setIntake(INITIAL)
    setStep(1)
    setMatches(null)
    setResultMessage('')
    setEngine('')
    setError('')
  }

  function startMatching(need: string, location = intake.location || 'Online') {
    const trimmed = need.trim()
    if (trimmed.length < 4) return
    setIntake((prev) => ({ ...prev, need: trimmed, location }))
    setStep(2)
    setMatches(null)
    setResultMessage('')
    setEngine('')
    setError('')
    scrollToHero()
  }

  function onSearchSubmit(e: FormEvent) {
    e.preventDefault()
    startMatching(intake.need, intake.location || 'Prishtinë')
  }

  function startFromCategory(domain: DomainDefinition) {
    const need = domain.examples[0] || domain.labelSq
    startMatching(need, intake.location || 'Online')
  }

  return (
    <div className="tt-shell">
      <SiteNav homeAnchors />

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
                Gjej ofrues lokalë dhe online për ligj, tatime, marketing, IT dhe më shumë —
                gjithçka në një vend.
              </p>

              <div className={`tt-search${matching ? ' is-matching' : ''}`}>
                {!matching ? (
                  <form className="tt-search-bar" onSubmit={onSearchSubmit}>
                    <label className="tt-search-need">
                      <Search size={18} aria-hidden />
                      <Input
                        ref={needInputRef}
                        value={intake.need}
                        onChange={(e) => update('need', e.target.value)}
                        placeholder="Përshkruaj çfarë të duhet — kontrata, tatime, IT..."
                        fullWidth
                        aria-label="Çfarë të duhet?"
                      />
                    </label>
                    <label className="tt-search-location">
                      <MapPin size={18} aria-hidden />
                      <Input
                        value={intake.location}
                        onChange={(e) => update('location', e.target.value)}
                        placeholder="Ku?"
                        fullWidth
                        list="tt-locations"
                        aria-label="Ku?"
                      />
                      <datalist id="tt-locations">
                        {LOCATIONS.map((loc) => (
                          <option key={loc} value={loc} />
                        ))}
                      </datalist>
                    </label>
                    <Button type="submit" variant="primary" className="tt-search-submit">
                      Gjej ofrues
                      <ArrowRight size={18} />
                    </Button>
                  </form>
                ) : null}

                {!matching ? (
                  <div className="tt-search-chips">
                    {NEED_CHIPS.map((chip) => (
                      <button
                        key={chip}
                        type="button"
                        className="tt-quick-chip"
                        onClick={() => startMatching(chip, intake.location || 'Online')}
                      >
                        {chip}
                      </button>
                    ))}
                  </div>
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
                          <div className="chip-row">
                            {LOCATIONS.map((loc) => (
                              <button
                                key={loc}
                                type="button"
                                className={`chip${intake.location === loc ? ' is-selected' : ''}`}
                                onClick={() => update('location', loc)}
                              >
                                {loc}
                              </button>
                            ))}
                          </div>
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

                      {error ? <p className="error">{error}</p> : null}

                      <div className="wizard-actions">
                        <Button type="button" variant="ghost" onPress={onBack} isDisabled={loading}>
                          {step === 2 ? 'Ndrysho kërkimin' : 'Kthehu'}
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

                              <RateProvider
                                providerUid={m.providerUid}
                                providerName={m.companyName || m.name}
                                initialAverage={m.rating}
                                initialCount={m.ratingCount}
                                compact
                              />

                              <SendRequestButton
                                providerUid={m.providerUid}
                                providerId={m.providerId}
                                providerName={m.companyName || m.name}
                                categoryId={m.categoryId}
                                serviceId={m.source === 'service' ? m.id : undefined}
                                serviceTitle={m.title}
                                intake={{
                                  need: intake.need,
                                  location: intake.location,
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

              {!matching ? (
                <p className="tt-hero-note">Pa thirrje derisa ti të dërgosh mesazh.</p>
              ) : null}
            </div>
          </div>
        </section>

        <section id="categories" className="tt-section tt-categories" aria-labelledby="categories-heading">
          <div className="tt-section-inner">
            <div className="tt-section-head">
              <h2 id="categories-heading">Zgjidh një shërbim</h2>
              <p>Shiko domenet më të kërkuara dhe nis matching menjëherë.</p>
            </div>
            <div className="tt-category-grid">
              {domains.map((domain) => (
                <button
                  key={domain.id}
                  type="button"
                  className="tt-category"
                  onClick={() => startFromCategory(domain)}
                >
                  <span className="tt-category-icon" aria-hidden>
                    <Briefcase size={22} />
                  </span>
                  <strong>{domain.labelSq}</strong>
                  <span>{domain.examples[0] || 'Shiko ofrues'}</span>
                </button>
              ))}
              {domains.length === 0 ? (
                <p className="muted">Kategoritë po ngarkohen...</p>
              ) : null}
            </div>
          </div>
        </section>

        <section id="how" className="tt-section tt-how" aria-labelledby="how-heading">
          <div className="tt-section-inner">
            <div className="tt-section-head">
              <h2 id="how-heading">Anashkalo kërkimin — nis matching</h2>
              <p>Ndaj detajet, shiko përputhjet dhe lidhu me ofruesin e duhur.</p>
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

        <section className="tt-section tt-trust" aria-labelledby="trust-heading">
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
                onPress={() => {
                  resetAll()
                  scrollToHero()
                  requestAnimationFrame(() => needInputRef.current?.focus())
                }}
              >
                Fillo matching
                <ArrowRight size={18} />
              </Button>
              {!user ? (
                <Button variant="outline">
                  <Link to="/register" className="tt-btn-link tt-btn-link-dark">
                    Krijo llogari
                  </Link>
                </Button>
              ) : null}
            </div>
          </div>
        </section>
      </main>

      <footer className="tt-footer">
        <div className="tt-section-inner tt-footer-inner">
          <p className="brand">KëshillaKos</p>
          <p className="muted">Matching me ofrues profesionalë në Kosovë dhe online.</p>
        </div>
      </footer>
    </div>
  )
}
