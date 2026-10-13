import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import SiteFooter from '../components/SiteFooter'
import SiteNav from '../components/SiteNav'
import PlanBoxes, { type PlanBoxChoice } from '../components/PlanBoxes'
import { useAuth } from '../auth/AuthContext'
import './PlansPage.css'

export default function PlansPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const roles = user?.roles ?? (user?.role ? [user.role] : [])
  const canProvider = roles.includes('provider')
  const canCompany = roles.includes('company')

  function hrefFor(_choice: PlanBoxChoice) {
    if (user?.activeContext === 'company' && canCompany) return '/dashboard/company/plans'
    if (canProvider) return '/dashboard/provider/plans'
    if (canCompany) return '/dashboard/company/plans'
    return user ? '/dashboard' : '/register'
  }

  return (
    <div className="tt-shell tt-home">
      <SiteNav />
      <main className="pl">
        <section className="pl-hero">
          <div className="tt-section-inner">
            <p className="pl-kicker">{t('plans.kicker')}</p>
            <h1>{t('plans.title')}</h1>
            <p className="pl-lead">{t('plans.lead')}</p>
          </div>
        </section>
        <section className="pl-compare" aria-label={t('plans.title')}>
          <div className="tt-section-inner">
            <PlanBoxes hrefFor={hrefFor} />
            {!canProvider && !canCompany ? (
              <p className="pl-login">
                {t('plans.login')} <Link to={user ? '/dashboard' : '/login'}>{user ? t('dash.board') : t('nav.login')}</Link>
                {' · '}
                <Link to="/register">{t('plans.register')}</Link>
              </p>
            ) : null}
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}
