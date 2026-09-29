import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Award, BadgeCheck, Building2, MapPin, Video } from 'lucide-react'
import type { MarketplaceProvider } from '../api/providerProfiles'
import { humanLabels } from '../utils/displayLabels'
import ProfileAvatar from './ProfileAvatar'
import ProviderCardActions from './ProviderCardActions'
import { ProviderDescription, ProviderRating, ProviderTags } from './ProviderCardParts'
import { isProviderVerified, useProviderCardLink } from './providerCardUtils'

type Props = {
  provider: MarketplaceProvider
}

export default function ExpertCard({ provider }: Props) {
  const [expanded, setExpanded] = useState(false)
  const profilePath = `/providers/${provider.uid}`
  const cardLink = useProviderCardLink(profilePath)
  const specialties = humanLabels(
    [...provider.specializations, ...provider.categoryLabels],
    provider.categories,
  )
  const description = (provider.description || provider.experience || '').trim()
  const verified = isProviderVerified(provider)
  const title = provider.title?.trim()
  const subtitle = title || specialties[0] || 'Ekspert'
  const tags = title ? specialties : specialties.slice(1)
  const experienceLabel = provider.yearsOfExperience != null
    ? (provider.yearsOfExperience === 1 ? '1 vit përvojë' : `${provider.yearsOfExperience} vite përvojë`)
    : null

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
        <div className="pc-avatar" aria-hidden>
          <ProfileAvatar src={provider.photoUrl} seed={provider.uid} size="fill" />
          {verified ? (
            <span className="pc-avatar-badge" title="I verifikuar">
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
        {experienceLabel ? (
          <li>
            <Award size={15} aria-hidden />
            {experienceLabel}
          </li>
        ) : null}
        {provider.companyName ? (
          <li>
            <Building2 size={15} aria-hidden />
            {provider.companyName}
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
            I verifikuar
          </li>
        ) : null}
      </ul>

      {description ? (
        <ProviderDescription text={description} expanded={expanded} onToggle={() => setExpanded((v) => !v)} />
      ) : null}

      <ProviderTags items={tags} max={3} />

      <ProviderCardActions provider={provider} profilePath={profilePath} need={provider.title || provider.name} />
    </article>
  )
}
