import { type KeyboardEvent, type MouseEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Clock, MapPin } from 'lucide-react'
import { mediaUrl } from '../api/media'
import type { ServiceItem } from '../api/services'
import { humanLabels } from '../utils/displayLabels'
import { providerPath, servicePath } from '../utils/publicPaths'
import { formatServicePrice } from '../utils/serviceDiscovery'
import ProfileAvatar from './ProfileAvatar'
import ServiceMediaPlaceholder from './ServiceMediaPlaceholder'

/** Translation keys for delivery modes; translated at render. */
const DELIVERY_LABEL_KEYS: Record<string, string> = {
  online: 'cards.online',
  physical: 'offers.inPerson',
  group: 'cards.group',
}

/** Returns the translation key for the rating summary word. */
function ratingWordKey(average: number, count: number) {
  if (count <= 0) return 'offers.noRatings'
  if (average >= 4.8) return 'cards.ratingWord.excellent'
  if (average >= 4) return 'cards.ratingWord.veryGood'
  if (average >= 3) return 'cards.ratingWord.good'
  return 'cards.ratingWord.improving'
}

function isCompanyOwned(service: ServiceItem) {
  return service.provider?.providerType === 'business' || service.provider?.role === 'company'
}

type Props = {
  service: ServiceItem
  mode?: 'list' | 'compact'
}

export default function ServiceCard({ service, mode = 'list' }: Props) {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const isCompact = mode === 'compact'
  const details = service.details || {}
  const provider = service.provider
  const price = formatServicePrice(service)
  const ratingCount = provider?.ratingCount ?? 0
  const rating = provider?.ratingAverage ?? 0
  const companyOwned = isCompanyOwned(service)
  const providerName = provider?.name || service.providerName
  const responsibleExpert = companyOwned ? service.responsibleExpert : undefined
  const providerUid = provider?.uid || service.providerUid
  const categoryLine = humanLabels(
    [service.categoryLabel || service.category, service.subcategory],
    [service.categoryId, service.category, service.subcategoryId].filter(Boolean) as string[],
  ).join(' · ')
  const workPhoto = details.photos?.[0] ? mediaUrl(details.photos[0]) : ''
  const rounded = ratingCount > 0 ? Math.max(1, Math.round(rating)) : 0
  function openDetails() {
    navigate(servicePath(service))
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
      aria-label={t('cards.viewServiceNamed', { title: service.title })}
    >
      <div className={`tt-result-avatar${companyOwned ? ' is-company' : ''}`} aria-hidden>
        <ProfileAvatar src={provider?.profilePhoto} seed={providerUid} size="fill" fit={companyOwned ? 'contain' : 'cover'} />
      </div>

      <div className="tt-result-body">
        <h3>{service.title}</h3>

        {providerName ? (
          <p className="tt-result-provider">
            {providerUid ? (
              <Link to={providerPath({ uid: providerUid, name: providerName })}>{providerName}</Link>
            ) : (
              <span>{providerName}</span>
            )}
            {responsibleExpert?.name ? (
              <>
                <span className="tt-result-provider-sep" aria-hidden>
                  ·
                </span>
                {responsibleExpert.uid ? (
                  <Link to={providerPath(responsibleExpert)}>{responsibleExpert.name}</Link>
                ) : (
                  <span>{responsibleExpert.name}</span>
                )}
              </>
            ) : null}
          </p>
        ) : null}

        <p className="tt-pro-rating">
          <strong>{t(ratingWordKey(rating, ratingCount))}</strong>
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
          {categoryLine ? <span>{categoryLine}</span> : null}
          {details.deliveryModes?.[0] ? (
            <span>
              {DELIVERY_LABEL_KEYS[details.deliveryModes[0]]
                ? t(DELIVERY_LABEL_KEYS[details.deliveryModes[0]])
                : details.deliveryModes[0]}
            </span>
          ) : null}
        </p>
        {service.description ? <p className="service-card-desc">{service.description}</p> : null}
        <div className="tt-result-media" aria-hidden>
          {workPhoto ? <img src={workPhoto} alt="" /> : <ServiceMediaPlaceholder compact />}
        </div>
      </div>

      <div className="tt-result-cta">
        <Link to={servicePath(service)} className="primary-btn tt-result-profile-btn">
          {t('cards.viewService')}
        </Link>
        <span className="tt-result-responds">
          <Clock size={14} aria-hidden />
          {t('cards.respondsFast')}
        </span>
      </div>
    </article>
  )
}
