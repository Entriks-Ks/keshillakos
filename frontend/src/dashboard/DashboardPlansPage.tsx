import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import PlanBoxes, { type PlanBoxChoice } from '../components/PlanBoxes'
import { choosePlan, fetchMyPlan, fetchPlanCatalog, type PlanAudience, type PlanChoice, type PlanSubscription } from '../api/plans'
import { getErrorMessage } from '../utils/errors'
import '../pages/PlansPage.css'
import './UserOverview.css'

function currentBox(mine: PlanSubscription | null): PlanBoxChoice | null {
  if (!mine || mine.plan !== 'pro' || mine.status === 'trialing') return mine?.plan === 'basic' ? 'basic' : null
  if (mine.interval === 'yearly') return 'yearly'
  if (mine.interval === 'monthly') return 'monthly'
  return null
}

export default function DashboardPlansPage() {
  const { t } = useTranslation()
  const location = useLocation()
  const audience: PlanAudience = location.pathname.includes('/dashboard/company') ? 'company' : 'provider'
  const [testMode, setTestMode] = useState(false)
  const [mine, setMine] = useState<PlanSubscription | null>(null)
  const [busy, setBusy] = useState<PlanChoice | null>(null)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    setMine(null)
    setNotice('')
    setError('')
    void Promise.all([fetchPlanCatalog(), fetchMyPlan(audience)])
      .then(([catalog, subscription]) => {
        if (!active) return
        setTestMode(catalog.testMode || subscription.testMode)
        setMine(subscription)
      })
      .catch((err) => { if (active) setError(getErrorMessage(err)) })
    return () => { active = false }
  }, [audience])

  async function pick(choice: PlanChoice) {
    setBusy(choice)
    setError('')
    setNotice('')
    try {
      setMine(await choosePlan(audience, choice))
      setNotice(t('plans.saved'))
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setBusy(null)
    }
  }

  const current = currentBox(mine)

  return (
    <section className="uo pl-dash">
      <header className="uo-head">
        <div className="uo-head-copy">
          <h1>{t('plans.choose')}</h1>
          {mine ? (
            <p>
              {t('plans.current')}: {mine.plan === 'pro' ? t('plans.pro') : t('plans.basic')}
              {mine.status === 'trialing' ? ` · ${t('plans.trial')}` : ''}
              {mine.interval === 'monthly' ? ` · ${t('plans.monthly')}` : ''}
              {mine.interval === 'yearly' ? ` · ${t('plans.yearly')}` : ''}
            </p>
          ) : null}
        </div>
      </header>

      {testMode ? <p className="pl-test">{t('plans.test')}</p> : null}
      {mine?.storedPlan === 'pro' && mine.plan === 'basic' ? <p className="pl-expired">{t('plans.expired')}</p> : null}

      <PlanBoxes current={current} busy={busy} onChoose={(choice) => void pick(choice)} />

      {mine?.trialAvailable ? (
        <button type="button" className="pl-trial" disabled={busy !== null} onClick={() => void pick('trial')}>{t('plans.trial')}</button>
      ) : mine ? <p className="pl-note">{t('plans.trialUsed')}</p> : null}

      {mine?.stats ? (
        <ul className="pl-stats">
          <li><strong>{mine.stats.visits}</strong>{t('plans.visits')}</li>
          <li><strong>{mine.stats.contacts}</strong>{t('plans.contacts')}</li>
          <li><strong>{mine.stats.requests}</strong>{t('plans.requests')}</li>
          <li><strong>{mine.stats.clicks}</strong>{t('plans.clicks')}</li>
        </ul>
      ) : null}
      {notice ? <p className="pl-ok">{notice}</p> : null}
      {error ? <p className="pl-error">{error}</p> : null}
    </section>
  )
}
