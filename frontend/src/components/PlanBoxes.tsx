import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowRight, Check, Star } from 'lucide-react'
import type { PlanChoice } from '../api/plans'
import { routePath } from '../routes/routeMap'

const BASIC = ['profile', 'identity', 'contact', 'bioBasic', 'ratings'] as const
const PRO = ['allBasic', 'bioPro', 'mediaPro', 'specialtiesPro', 'servicesPro', 'hours', 'social', 'forms', 'extrasPro', 'manage', 'stats', 'badge'] as const

/** Feature values that only make sense next to their row title ("Up to 10" → "Specialties: up to 10"). */
const FEATURE_TITLES: Record<string, string> = {
  bioBasic: 'bio',
  bioPro: 'bio',
  specialtiesPro: 'specialties',
  servicesPro: 'services',
}

const MONTHLY_PRICE = 19.9
const YEARLY_PRICE = 199

export type PlanBoxChoice = 'basic' | 'monthly' | 'yearly'

type Props = {
  current?: PlanBoxChoice | null
  busy?: PlanChoice | null
  onChoose?: (choice: PlanBoxChoice) => void
  hrefFor?: (choice: PlanBoxChoice) => string
}

function formatEuro(value: number) {
  return value.toFixed(2)
}

export default function PlanBoxes({ current, busy, onChoose, hrefFor }: Props) {
  const { t } = useTranslation()
  const yearlySaving = MONTHLY_PRICE * 12 - YEARLY_PRICE
  const cards: Array<{
    choice: PlanBoxChoice
    name: string
    price: string
    period: string
    features: readonly string[]
    featured?: boolean
    note?: string
    save?: string
  }> = [
    { choice: 'basic', name: t('plans.basic'), price: '€0', period: t('plans.free'), features: BASIC },
    { choice: 'monthly', name: t('plans.pro'), price: '€19.90', period: t('plans.perMonth'), features: PRO, featured: true },
    {
      choice: 'yearly',
      name: t('plans.pro'),
      price: '€199',
      period: t('plans.perYear'),
      features: PRO,
      note: t('plans.perMonthEquiv', { price: formatEuro(YEARLY_PRICE / 12) }),
      save: t('plans.save', { amount: formatEuro(yearlySaving) }),
    },
  ]

  return (
    <div className="pl-grid">
      {cards.map((card, index) => {
        const active = current === card.choice
        const label = active ? t('plans.current') : t('plans.select')
        const className = `pl-box pl-box--${card.choice}${card.featured ? ' is-featured' : ''}${active ? ' is-current' : ''}`
        const list = (
          <ul>
            {card.features.map((key) => {
              const titleKey = FEATURE_TITLES[key]
              const value = key === 'allBasic' ? t('plans.allBasic') : t(`plans.rows.${key}`)
              return (
                <li key={key} className={key === 'allBasic' ? 'is-all-basic' : undefined}>
                  <Check size={16} aria-hidden />
                  <span>
                    {titleKey ? <strong>{t(`plans.rows.${titleKey}`)}: </strong> : null}
                    {value}
                  </span>
                </li>
              )
            })}
          </ul>
        )
        return (
          <article className={className} key={card.choice} style={{ animationDelay: `${index * 90}ms` }}>
            {card.featured ? (
              <span className="pl-ribbon">
                <Star size={13} aria-hidden /> {t('plans.recommended')}
              </span>
            ) : null}
            {card.save ? <span className="pl-save">{card.save}</span> : null}
            <h3>{card.name}</h3>
            <p className="pl-price">
              {card.price}
              <small>{card.period}</small>
            </p>
            {card.note ? <p className="pl-price-note">{card.note}</p> : null}
            {list}
            {onChoose ? (
              <button type="button" disabled={busy !== null || active} onClick={() => onChoose(card.choice)}>
                {label}
              </button>
            ) : (
              <Link to={hrefFor?.(card.choice) ?? routePath('login')}>
                {label}
                <ArrowRight size={16} aria-hidden />
              </Link>
            )}
          </article>
        )
      })}
    </div>
  )
}
