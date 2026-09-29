import { useState } from 'react'
import { Link } from 'react-router-dom'
import { BadgeCheck, Building2, MapPin, Tag, Users, Video } from 'lucide-react'
import type { MarketplaceProvider } from '../api/providerProfiles'
import type { ServiceItem } from '../api/services'
import { humanLabels } from '../utils/displayLabels'
import { formatServicePrice, isVerified } from '../utils/serviceDiscovery'
import ProfileAvatar from './ProfileAvatar'
import ProviderCardActions from './ProviderCardActions'
import { ProviderDescription, ProviderRating, ProviderTags } from './ProviderCardParts'
import { useProviderCardLink } from './providerCardUtils'

type Props = {
  service: ServiceItem
  provider?: MarketplaceProvider
}

function fallbackProvider(service: ServiceItem, companyOwned: boolean): MarketplaceProvider {
  const owner = service.provider
  return {
    id: service.providerId || owner?.uid || service.providerUid,
    uid: owner?.uid || service.providerUid,
    providerType: companyOwned ? 'business' : 'individual',
    name: owner?.name || service.providerName,
    location: service.location || owner?.location,
    languages: owner?.languages ?? [],
    modes: [],
    categories: [service.categoryId],
    categoryLabels: [],
    subcategoryIds: [],
    specializations: [],
    verification: owner?.verification,
    ratingAverage: owner?.ratingAverage ?? 0,
    ratingCount: owner?.ratingCount ?? 0,
    serviceCount: 0,
  }
}

export default function ServiceOfferCard({ service, provider }: Props) {
  const [expanded, setExpanded] = useState(false)
  const servicePath = `/services/${service.id}`
  const cardLink = useProviderCardLink(servicePath)
  const owner = service.provider
  const companyOwned = owner?.providerType === 'business' || owner?.role === 'company'
  const contact: MarketplaceProvider = {
    ...(provider ?? fallbackProvider(service, companyOwned)),
    categories: [service.categoryId],
    location: service.location || provider?.location || owner?.location,
  }
  const profilePath = `/providers/${contact.uid}`
  const photo = provider?.photoUrl || owner?.profilePhoto
  const verified = isVerified(owner)
  const responsibleExpert = companyOwned ? service.responsibleExpert : undefined
  const price = formatServicePrice(service)
  const deliveryModes = service.details?.deliveryModes ?? []
  const tags = humanLabels(
    [service.categoryLabel || service.category, service.subcategory],
    [service.categoryId, service.category, service.subcategoryId].filter(Boolean) as string[],
  )
  const description = (service.description || '').trim()

  return (
    <article
      className="pc-card is-clickable"
      onClick={cardLink.onClick}
      onKeyDown={cardLink.onKeyDown}
      role="link"
      tabIndex={0}
      aria-label={`Shiko shërbimin ${service.title}`}
    >
      <div className="pc-top">
        <div className={`pc-avatar${companyOwned ? ' is-company' : ''}`} aria-hidden>
          <ProfileAvatar src={photo} seed={contact.uid} size="fill" fit={companyOwned ? 'contain' : 'cover'} />
          {verified ? (
            <span className="pc-avatar-badge" title={companyOwned ? 'E verifikuar' : 'I verifikuar'}>
              <BadgeCheck size={14} />
            </span>
          ) : null}
        </div>

        <div className="pc-heading">
          <h3 className="pc-name">
            <Link to={servicePath} onClick={(e) => e.stopPropagation()}>{service.title}</Link>
          </h3>
          <p className="pc-subtitle">
            <Link to={profilePath} onClick={(e) => e.stopPropagation()}>{contact.name}</Link>
            {responsibleExpert?.name ? (
              <>
                {' · '}
                {responsibleExpert.uid ? (
                  <Link to={`/providers/${responsibleExpert.uid}`} onClick={(e) => e.stopPropagation()}>
                    {responsibleExpert.name}
                  </Link>
                ) : responsibleExpert.name}
              </>
            ) : null}
          </p>
          <ProviderRating provider={contact} profilePath={profilePath} />
        </div>
      </div>

      <ul className="pc-facts">
        {contact.location ? (
          <li>
            <MapPin size={15} aria-hidden />
            {contact.location}
          </li>
        ) : null}
        {price ? (
          <li>
            <Tag size={15} aria-hidden />
            {price}
          </li>
        ) : null}
        {deliveryModes.includes('physical') ? (
          <li>
            <Building2 size={15} aria-hidden />
            Fizikisht
          </li>
        ) : null}
        {deliveryModes.includes('group') ? (
          <li>
            <Users size={15} aria-hidden />
            Grup
          </li>
        ) : null}
        {deliveryModes.includes('online') ? (
          <li className="is-accent">
            <Video size={15} aria-hidden />
            Online
          </li>
        ) : null}
        {verified ? (
          <li className="is-accent">
            <BadgeCheck size={15} aria-hidden />
            {companyOwned ? 'E verifikuar' : 'I verifikuar'}
          </li>
        ) : null}
      </ul>

      {description ? (
        <ProviderDescription text={description} expanded={expanded} onToggle={() => setExpanded((v) => !v)} />
      ) : null}

      <ProviderTags items={tags} max={3} />

      <ProviderCardActions provider={contact} profilePath={profilePath} need={service.title} />
    </article>
  )
}
