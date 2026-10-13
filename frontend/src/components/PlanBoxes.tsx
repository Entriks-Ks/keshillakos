import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Check } from 'lucide-react'
import type { PlanChoice } from '../api/plans'

const BASIC = ['profile', 'identity', 'contact', 'bioBasic', 'ratings'] as const
const PRO = ['allBasic', 'bioPro', 'mediaPro', 'specialtiesPro', 'servicesPro', 'hours', 'social', 'forms', 'extrasPro', 'manage', 'stats', 'badge'] as const

export type PlanBoxChoice = 'basic' | 'monthly' | 'yearly'

type Props = {
  current?: PlanBoxChoice | null
  busy?: PlanChoice | null
  onChoose?: (choice: PlanBoxChoice) => void
  hrefFor?: (choice: PlanBoxChoice) => string
}

export default function PlanBoxes({ current, busy, onChoose, hrefFor }: Props) {
  const { t } = useTranslation()
  const cards: Array<{ choice: PlanBoxChoice; name: string; price: string; period: string; features: readonly string[]; featured?: boolean }> = [
    { choice: 'basic', name: t('plans.basic'), price: '€0', period: t('plans.free'), features: BASIC },
    { choice: 'monthly', name: t('plans.pro'), price: '€19.90', period: t('plans.perMonth'), features: PRO, featured: true },
    { choice: 'yearly', name: t('plans.pro'), price: '€199', period: t('plans.perYear'), features: PRO },
  ]

  return (
    <div className="pl-grid">
      {cards.map((card) => {
        const active = current === card.choice
        const label = active ? t('plans.current') : t('plans.select')
        const className = `pl-box${card.featured ? ' is-featured' : ''}${active ? ' is-current' : ''}`
        const list = (
          <ul>
            {card.features.map((key) => (
              <li key={key}>
                <Check size={16} aria-hidden />
                <span>{key === 'allBasic' ? t('plans.allBasic') : t(`plans.rows.${key}`)}</span>
              </li>
            ))}
          </ul>
        )
        return (
          <article className={className} key={card.choice}>
            <h3>{card.name}</h3>
            <p className="pl-price">{card.price}<small>{card.period}</small></p>
            {list}
            {onChoose ? (
              <button type="button" disabled={busy !== null || active} onClick={() => onChoose(card.choice)}>
                {label}
              </button>
            ) : (
              <Link to={hrefFor?.(card.choice) ?? '/login'}>{label}</Link>
            )}
          </article>
        )
      })}
    </div>
  )
}
