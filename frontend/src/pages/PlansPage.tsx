import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { BadgeCheck, Check, Gift, Minus, Sparkles } from 'lucide-react'
import SiteFooter from '../components/SiteFooter'
import SiteNav from '../components/SiteNav'
import PlanBoxes, { type PlanBoxChoice } from '../components/PlanBoxes'
import { useAuth } from '../auth/AuthContext'
import './PlansPage.css'

/**
 * Basic vs Pro matrix. `true` = included, `false` = not included,
 * a string = the rows.* key holding that plan's limit.
 */
const MATRIX: Array<{ row: string; basic: boolean | string; pro: boolean | string }> = [
  { row: 'profile', basic: true, pro: true },
  { row: 'identity', basic: true, pro: true },
  { row: 'contact', basic: true, pro: true },
  { row: 'bio', basic: 'bioBasic', pro: 'bioPro' },
  { row: 'ratings', basic: true, pro: true },
  { row: 'media', basic: false, pro: 'mediaPro' },
  { row: 'specialties', basic: false, pro: 'specialtiesPro' },
  { row: 'services', basic: false, pro: 'servicesPro' },
  { row: 'hours', basic: false, pro: true },
  { row: 'social', basic: false, pro: true },
  { row: 'forms', basic: false, pro: true },
  { row: 'extras', basic: false, pro: 'extrasPro' },
  { row: 'manage', basic: false, pro: true },
  { row: 'stats', basic: false, pro: true },
  { row: 'badge', basic: false, pro: true },
]

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

  function renderCell(value: boolean | string) {
    if (value === true) {
      return (
        <span className="pl-cell-yes" title={t('plans.included')}>
          <Check size={15} strokeWidth={3} aria-hidden />
          <span className="pl-sr">{t('plans.included')}</span>
        </span>
      )
    }
    if (value === false) {
      return (
        <span className="pl-cell-no" title={t('plans.missing')}>
          <Minus size={15} aria-hidden />
          <span className="pl-sr">{t('plans.missing')}</span>
        </span>
      )
    }
    return <span className="pl-cell-text">{t(`plans.rows.${value}`)}</span>
  }

  return (
    <div className="tt-shell tt-home pl-shell">
      <SiteNav />
      <main className="pl">
        <section className="pl-hero">
          <div className="pl-hero-bg" aria-hidden>
            <span className="pl-hero-orb pl-hero-orb--a" />
            <span className="pl-hero-orb pl-hero-orb--b" />
          </div>
          <div className="tt-section-inner">
            <p className="pl-kicker">
              <Sparkles size={14} aria-hidden />
              {t('plans.kicker')}
            </p>
            <h1>{t('plans.title')}</h1>
            <p className="pl-lead">{t('plans.lead')}</p>
            <ul className="pl-hero-points">
              <li>
                <Gift size={15} aria-hidden /> {t('plans.basic')}: {t('plans.free')}
              </li>
              <li>
                <Sparkles size={15} aria-hidden /> {t('plans.trial')}
              </li>
              <li>
                <BadgeCheck size={15} aria-hidden /> {t('plans.rows.badge')}
              </li>
            </ul>
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

        <section className="pl-matrix-section" aria-labelledby="pl-matrix-title">
          <div className="tt-section-inner">
            <header className="pl-matrix-head">
              <h2 id="pl-matrix-title">{t('plans.compareTitle')}</h2>
              <p>{t('plans.compareLead')}</p>
            </header>

            <div className="pl-matrix-wrap">
              <table className="pl-matrix">
                <thead>
                  <tr>
                    <th scope="col">{t('plans.feature')}</th>
                    <th scope="col">
                      <span className="pl-matrix-plan">{t('plans.basic')}</span>
                      <span className="pl-matrix-price">€0</span>
                    </th>
                    <th scope="col" className="is-pro">
                      <span className="pl-matrix-plan">
                        <Sparkles size={14} aria-hidden /> {t('plans.pro')}
                      </span>
                      <span className="pl-matrix-price">{t('plans.monthly')}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {MATRIX.map((item) => (
                    <tr key={item.row}>
                      <th scope="row">{t(`plans.rows.${item.row}`)}</th>
                      <td>{renderCell(item.basic)}</td>
                      <td className="is-pro">{renderCell(item.pro)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}
