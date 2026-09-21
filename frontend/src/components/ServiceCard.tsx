import { type KeyboardEvent, type MouseEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Clock, MapPin } from 'lucide-react'
import { mediaUrl } from '../api/auth'
import type { ServiceItem } from '../api/services'
import { catalogImageForLabels } from '../data/catalogImages'

const DELIVERY_LABELS: Record<string, string> = {
  online: 'Online',
  physical: 'Fizikisht',
  group: 'Grup',
}

function formatPrice(service: ServiceItem) {
  const from = service.priceFrom
  const to = service.details?.priceTo
  if (from == null && to == null) return null
  if (from != null && to != null) return `€${from} – €${to}`
  if (from != null) return `nga €${from}`
  return `deri €${to}`
}

function ratingWord(average: number, count: number) {
  if (count <= 0) return 'Ende pa vlerësime'
  if (average >= 4.8) return 'Shkëlqyeshëm'
  if (average >= 4) return 'Shumë mirë'
  if (average >= 3) return 'Mirë'
  return 'Në përmirësim'
}

type Props = {
  service: ServiceItem
  mode?: 'list' | 'compact'
}

export default function ServiceCard({ service, mode = 'list' }: Props) {
  const navigate = useNavigate()
  const isCompact = mode === 'compact'
  const details = service.details || {}
  const provider = service.provider
  const photo = mediaUrl(provider?.profilePhoto)
  const price = formatPrice(service)
  const ratingCount = provider?.ratingCount ?? 0
  const rating = provider?.ratingAverage ?? 0
  const name = provider?.name || service.providerName
  const workPhoto = details.photos?.[0]
    ? mediaUrl(details.photos[0])
    : catalogImageForLabels(service.subcategory, service.categoryLabel || service.category)
  const rounded = ratingCount > 0 ? Math.max(1, Math.round(rating)) : 0

  function openDetails() {
    navigate(`/services/${service.id}`)
  }

  function onCardClick(e: MouseEvent<HTMLElement>) {
    const target = e.target as HTMLElement
    if (target.closest('a, button, input, textarea, select, label, form')) return
    openDetails()
  }

  function onCardKeyDown(e: KeyboardEvent<HTMLElement>) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      openDetails()
    }
  }

  return (
    <article
      className={`service-card is-clickable tt-result-card${isCompact ? ' is-compact' : ''}`}
      onClick={onCardClick}
      onKeyDown={onCardKeyDown}
      role="link"
      tabIndex={0}
      aria-label={`Shiko profilin e ${name} për ${service.title}`}
    >
      <div className="tt-result-avatar" aria-hidden>
        {photo ? <img src={photo} alt="" /> : <span>{name.slice(0, 1)}</span>}
      </div>

      <div className="tt-result-body">
        <h3>{name}</h3>
        <p className="tt-pro-rating">
          <strong>{ratingWord(rating, ratingCount)}</strong>
          {ratingCount > 0 ? (
            <>
              <span className="tt-pro-rating-score">{rating.toFixed(1)}</span>
              <span className="tt-pro-stars" aria-hidden>
                {'★'.repeat(rounded)}
                {'☆'.repeat(Math.max(0, 5 - rounded))}
              </span>
              <span className="muted">({ratingCount})</span>
            </>
          ) : null}
        </p>
        <p className="tt-result-facts">
          {service.location ? (
            <span>
              <MapPin size={14} aria-hidden />
              {service.location}
            </span>
          ) : null}
          {price ? <span>{price}</span> : null}
          {service.subcategory || service.title ? <span>{service.subcategory || service.title}</span> : null}
          {details.deliveryModes?.[0] ? <span>{DELIVERY_LABELS[details.deliveryModes[0]] || details.deliveryModes[0]}</span> : null}
        </p>
        {service.description ? <p className="service-card-desc">{service.description}</p> : null}
        {workPhoto ? (
          <div className="tt-result-media" aria-hidden>
            <img src={workPhoto} alt="" />
          </div>
        ) : null}
      </div>

      <div className="tt-result-cta">
        <Link to={`/services/${service.id}`} className="primary-btn tt-result-profile-btn">
          Shiko profilin
        </Link>
        <span className="tt-result-responds">
          <Clock size={14} aria-hidden />
          Zakonisht përgjigjet shpejt
        </span>
      </div>
    </article>
  )
}
