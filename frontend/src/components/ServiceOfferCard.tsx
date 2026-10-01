import { useState } from 'react'
import { Link } from 'react-router-dom'
import { BadgeCheck, Building2, Images, MapPin, Tag, Users, Video } from 'lucide-react'
import { mediaUrl } from '../api/media'
import type { MarketplaceProvider } from '../api/providerProfiles'
import type { ServiceItem } from '../api/services'
import { humanLabels } from '../utils/displayLabels'
import { providerPath, servicePath as publicServicePath } from '../utils/publicPaths'
import { formatServicePrice, isVerified } from '../utils/serviceDiscovery'
import ProfileAvatar from './ProfileAvatar'
import ProviderCardActions from './ProviderCardActions'
import { CardMeta, CardShell, CardTitle, ProviderDescription, RatingMeta } from './ProviderCardParts'

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
  const servicePath = publicServicePath(service)
  const owner = service.provider
  const companyOwned = owner?.providerType === 'business' || owner?.role === 'company'
  const contact: MarketplaceProvider = {
    ...(provider ?? fallbackProvider(service, companyOwned)),
    categories: [service.categoryId],
    location: service.location || provider?.location || owner?.location,
  }
  const profilePath = providerPath(contact)
  const photo = provider?.photoUrl || owner?.profilePhoto
  const verified = isVerified(owner)
  const responsibleExpert = companyOwned ? service.responsibleExpert : undefined
  const price = formatServicePrice(service)
  const deliveryModes = service.details?.deliveryModes ?? []
  const categoryPath = humanLabels(
    [service.categoryLabel || service.category, service.subcategory],
    [service.categoryId, service.category, service.subcategoryId].filter(Boolean) as string[],
  )
  const description = (service.description || '').trim()
  const photos = (service.details?.photos ?? []).map((url) => mediaUrl(url)).filter(Boolean)

  return (
    <CardShell
      href={servicePath}
      label={`Shiko shërbimin ${service.title}`}
      mediaKind="photo"
      media={photos.length > 0 ? (
        <>
          <img src={photos[0]} alt="" loading="lazy" />
          {photos.length > 1 ? (
            <span className="pc-media-count">
              <Images size={12} aria-hidden />
              {photos.length}
            </span>
          ) : null}
        </>
      ) : undefined}
      footer={<ProviderCardActions provider={contact} profilePath={profilePath} need={service.title} />}
    >
      <CardTitle to={servicePath}>{service.title}</CardTitle>
      {categoryPath.length > 0 ? <p className="pc-subtitle">{categoryPath.join(' › ')}</p> : null}

      <CardMeta>
        {price ? (
          <li className="is-strong">
            <Tag size={14} aria-hidden />
            {price}
          </li>
        ) : null}
        {contact.location ? (
          <li>
            <MapPin size={14} aria-hidden />
            {contact.location}
          </li>
        ) : null}
        {deliveryModes.includes('online') ? (
          <li>
            <Video size={14} aria-hidden />
            Online
          </li>
        ) : null}
        {deliveryModes.includes('physical') ? (
          <li>
            <Building2 size={14} aria-hidden />
            Fizikisht
          </li>
        ) : null}
        {deliveryModes.includes('group') ? (
          <li>
            <Users size={14} aria-hidden />
            Grup
          </li>
        ) : null}
      </CardMeta>

      {description ? (
        <ProviderDescription text={description} expanded={expanded} onToggle={() => setExpanded((v) => !v)} />
      ) : null}

      <div className="pc-sub">
        <span className="pc-sub-label">{companyOwned ? 'Kompania' : 'Eksperti'}</span>
        <Link to={profilePath} className="pc-sub-person" onClick={(e) => e.stopPropagation()}>
          <span className={`pc-sub-photo${companyOwned ? ' is-company' : ''}`} aria-hidden>
            <ProfileAvatar src={photo} seed={contact.uid} size="fill" fit={companyOwned ? 'contain' : 'cover'} />
          </span>
          <strong>{contact.name}</strong>
          {verified ? <BadgeCheck size={14} className="pc-sub-verified" aria-label="I verifikuar" /> : null}
        </Link>
        {responsibleExpert?.name ? (
          <span className="pc-sub-muted">
            me{' '}
            {responsibleExpert.uid ? (
              <Link to={providerPath(responsibleExpert)} onClick={(e) => e.stopPropagation()}>
                {responsibleExpert.name}
              </Link>
            ) : responsibleExpert.name}
          </span>
        ) : null}
        <ul className="pc-sub-rating">
          <RatingMeta average={contact.ratingAverage ?? 0} count={contact.ratingCount ?? 0} href={profilePath} />
        </ul>
      </div>
    </CardShell>
  )
}
