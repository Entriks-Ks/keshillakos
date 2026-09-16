import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { runMatch, type MatchIntake, type MatchedExpert } from '../api/match'
import { fetchActiveServices, type ServiceItem } from '../api/services'
import RateProvider from '../components/RateProvider'
import SendRequestButton from '../components/SendRequestButton'
import ServiceCard from '../components/ServiceCard'
import { useAuth } from '../auth/AuthContext'
import { getDashboardPath } from '../utils/dashboardPath'
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
  const { user } = useAuth()
  const [step, setStep] = useState(1)
  const [intake, setIntake] = useState<IntakeState>(INITIAL)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [matches, setMatches] = useState<MatchedExpert[] | null>(null)
  const [resultMessage, setResultMessage] = useState('')
  const [engine, setEngine] = useState('')
  const [services, setServices] = useState<ServiceItem[]>([])
  const [servicesLoading, setServicesLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetchActiveServices()
      .then((items) => {
        if (!cancelled) setServices(items)
      })
      .catch(() => {
        if (!cancelled) setServices([])
      })
      .finally(() => {
        if (!cancelled) setServicesLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  function update<K extends keyof IntakeState>(key: K, value: IntakeState[K]) {
    setIntake((prev) => ({ ...prev, [key]: value }))
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

  return (
    <div className="home-shell">
      <header className="home-header">
        <p className="brand">KëshillaKos</p>
        {user ? (
          <Link className="ghost link-btn" to={getDashboardPath(user?.role)}>
            Dashboard
          </Link>
        ) : (
          <Link className="ghost link-btn" to="/login">
            Hyr
          </Link>
        )}
      </header>

      <main>
        <section className="home-hero home-hero-problem">
          <p className="brand home-brand">KëshillaKos</p>
          <h1>Me çfarë ke nevojë për ndihmë?</h1>
          <p className="home-lead">
            Përgjigju hap pas hapi — pa kategori të komplikuar. Pastaj të gjejmë ekspertët e duhur.
          </p>

          {step <= TOTAL_STEPS ? (
            <div className="wizard">
              <div className="wizard-progress" aria-hidden="true">
                <div
                  className="wizard-progress-bar"
                  style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
                />
              </div>
              <p className="wizard-step-label">
                Hapi {step} nga {TOTAL_STEPS}
              </p>

              <form onSubmit={onNext} className="wizard-body">
                {step === 1 ? (
                  <fieldset className="wizard-fieldset">
                    <legend>Për çfarë ke nevojë?</legend>
                    <textarea
                      value={intake.need}
                      onChange={(e) => update('need', e.target.value)}
                      rows={3}
                      placeholder="Përshkruaj problemin tënd..."
                      required
                    />
                    <div className="chip-row">
                      {NEED_CHIPS.map((chip) => (
                        <button
                          key={chip}
                          type="button"
                          className={`chip${intake.need === chip ? ' is-selected' : ''}`}
                          onClick={() => update('need', chip)}
                        >
                          {chip}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                ) : null}

                {step === 2 ? (
                  <fieldset className="wizard-fieldset">
                    <legend>Për kë?</legend>
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
                    <input
                      value={intake.budget}
                      onChange={(e) => update('budget', e.target.value)}
                      placeholder="p.sh. deri €100 / fleksibël"
                    />
                  </fieldset>
                ) : null}

                {step === 7 ? (
                  <fieldset className="wizard-fieldset">
                    <legend>Si të të kontaktojnë ekspertët?</legend>
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
                  {step > 1 ? (
                    <button type="button" className="ghost" onClick={onBack} disabled={loading}>
                      Kthehu
                    </button>
                  ) : (
                    <span />
                  )}
                  <button type="submit" className="primary-btn" disabled={!canContinue() || loading}>
                    {loading
                      ? 'Duke gjetur ekspertë...'
                      : step === TOTAL_STEPS
                        ? 'Gjej ekspertë'
                        : 'Vazhdo'}
                  </button>
                </div>
              </form>
            </div>
          ) : null}
        </section>

        {step === 8 ? (
          <section className="home-services match-results" aria-labelledby="match-heading">
            <h2 id="match-heading">{resultMessage || 'Rezultatet e matching'}</h2>
            <p className="muted">
              Bazuar në përgjigjet e tua
              {engine === 'gemini' ? ' · matching me AI' : null}
              {engine === 'heuristic' ? ' · matching bazë' : null}.
            </p>

            <div className="wizard-actions match-toolbar">
              <button type="button" className="ghost" onClick={onBack}>
                Ndrysho përgjigjet
              </button>
              <button type="button" className="ghost" onClick={resetAll}>
                Fillo nga e para
              </button>
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
                          {m.providerEmail ? <li>{m.providerEmail}</li> : null}
                          <li>
                            ★ {m.ratingCount > 0 ? m.rating.toFixed(1) : '—'}
                            {m.ratingCount > 0
                              ? ` (${m.ratingCount} vlerësime)`
                              : ' (pa vlerësime)'}
                          </li>
                          {m.licenseNumber ? <li>License: {m.licenseNumber}</li> : null}
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

            {!user ? (
              <div className="home-cta">
                <Link className="primary-btn" to="/register">
                  Vazhdo me Get Started
                </Link>
              </div>
            ) : (
              <div className="home-cta">
                <Link className="primary-btn" to={getDashboardPath(user.role)}>
                  Hap dashboard
                </Link>
              </div>
            )}
          </section>
        ) : null}

        <section className="home-services" aria-labelledby="services-heading">
          <h2 id="services-heading">Shërbimet e ofruara</h2>
          <p className="muted">
            Kliko një shërbim për të parë detajet e plota: çmimi, ofruesi, aftësitë dhe oraret e lira.
          </p>

          {servicesLoading ? (
            <p className="muted home-services-status">Duke u ngarkuar...</p>
          ) : null}
          {!servicesLoading && services.length === 0 ? (
            <p className="muted home-services-status">Ende nuk ka shërbime të publikuara.</p>
          ) : null}

          <div className="home-services-list">
            {services.map((service) => (
              <ServiceCard key={service.id} service={service} />
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}
