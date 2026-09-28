import { useState } from 'react'
import { Link } from 'react-router-dom'
import { BadgeCheck, Briefcase, Building2, ChevronRight, MapPin, Users, Video } from 'lucide-react'
import { mediaUrl } from '../api/media'
import type { MarketplaceProvider } from '../api/providerProfiles'
import { humanLabels } from '../utils/displayLabels'
import ProviderCardActions from './ProviderCardActions'
import { ProviderDescription, ProviderRating, ProviderTags } from './ProviderCardParts'
import { isProviderVerified, useProviderCardLink } from './providerCardUtils'

type Props = {
  provider: MarketplaceProvider
}

export default function CompanyCard({ provider }: Props) {
  const [expanded, setExpanded] = useState(false)
  const logo = mediaUrl(provider.photoUrl)
  const profilePath = `/providers/${provider.uid}`
  const cardLink = useProviderCardLink(profilePath)
  const specialties = humanLabels(
    [...provider.specializations, ...provider.categoryLabels],
    provider.categories,
  )
  const description = (provider.description || '').trim()
  const verified = isProviderVerified(provider)
  const expertCount = provider.expertCount ?? 0
  const featured = provider.featuredExpert
  const featuredPhoto = mediaUrl(featured?.photoUrl)
  const subtitle = specialties[0] || 'Kompani'

  return (
    <article
      className="pc-card is-clickable"
      onClick={cardLink.onClick}
      onKeyDown={cardLink.onKeyDown}
      role="link"
      tabIndex={0}
      aria-label={`Shiko profilin e ${provider.name}`}
    >
      <div className="pc-top">
        <div className="pc-avatar is-company" aria-hidden>
          {logo ? <img src={logo} alt="" /> : <Building2 size={28} />}
          {verified ? (
            <span className="pc-avatar-badge" title="E verifikuar">
              <BadgeCheck size={14} />
            </span>
          ) : null}
        </div>

        <div className="pc-heading">
          <h3 className="pc-name">
            <Link to={profilePath} onClick={(e) => e.stopPropagation()}>{provider.name}</Link>
          </h3>
          <p className="pc-subtitle">{subtitle}</p>
          <ProviderRating provider={provider} profilePath={profilePath} />
        </div>
      </div>

      <ul className="pc-facts">
        {provider.location ? (
          <li>
            <MapPin size={15} aria-hidden />
            {provider.location}
          </li>
        ) : null}
        <li>
          <Users size={15} aria-hidden />
          {expertCount === 1 ? '1 ekspert' : `${expertCount} ekspertë`}
        </li>
        {provider.serviceCount > 0 ? (
          <li>
            <Briefcase size={15} aria-hidden />
            {provider.serviceCount === 1 ? '1 shërbim' : `${provider.serviceCount} shërbime`}
          </li>
        ) : null}
        {provider.modes.includes('online') ? (
          <li className="is-accent">
            <Video size={15} aria-hidden />
            Online
          </li>
        ) : null}
        {verified ? (
          <li className="is-accent">
            <BadgeCheck size={15} aria-hidden />
            E verifikuar
          </li>
        ) : null}
      </ul>

      {description ? (
        <ProviderDescription text={description} expanded={expanded} onToggle={() => setExpanded((v) => !v)} />
      ) : null}

      <ProviderTags items={specialties.slice(1)} max={4} />

      {featured ? (
        <div className="pc-team">
          <Link to={`/providers/${featured.uid}`} className="pc-team-member" onClick={(e) => e.stopPropagation()}>
            <span className="pc-team-photo" aria-hidden>
              {featuredPhoto ? <img src={featuredPhoto} alt="" /> : featured.name.slice(0, 1)}
            </span>
            <span className="pc-team-copy">
              <strong>{featured.name}</strong>
              <span>{featured.title || 'Ekspert i ekipit'}</span>
            </span>
          </Link>
          {expertCount > 1 ? (
            <Link to={`${profilePath}#ekspertet`} className="pc-team-more" onClick={(e) => e.stopPropagation()}>
              Shiko ekipin
              <ChevronRight size={16} aria-hidden />
            </Link>
          ) : null}
        </div>
      ) : null}

      <ProviderCardActions provider={provider} profilePath={profilePath} need={provider.name} />
    </article>
  )
}
