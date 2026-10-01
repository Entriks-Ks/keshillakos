import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Briefcase, ChevronRight, MapPin, Users, Video } from 'lucide-react'
import type { MarketplaceProvider } from '../api/providerProfiles'
import { humanLabels } from '../utils/displayLabels'
import { providerPath } from '../utils/publicPaths'
import ProfileAvatar from './ProfileAvatar'
import ProviderCardActions from './ProviderCardActions'
import { CardMeta, CardShell, CardTitle, ProviderDescription, ProviderTags, RatingMeta } from './ProviderCardParts'
import { isProviderVerified } from './providerCardUtils'

type Props = {
  provider: MarketplaceProvider
}

export default function CompanyCard({ provider }: Props) {
  const [expanded, setExpanded] = useState(false)
  const profilePath = providerPath(provider)
  const specialties = humanLabels(
    [...provider.specializations, ...provider.categoryLabels],
    provider.categories,
  )
  const description = (provider.description || '').trim()
  const verified = isProviderVerified(provider)
  const expertCount = provider.expertCount ?? 0
  const featured = provider.featuredExpert
  const subtitle = specialties[0] || 'Kompani'

  return (
    <CardShell
      href={profilePath}
      label={`Shiko profilin e ${provider.name}`}
      mediaKind="company"
      media={<ProfileAvatar src={provider.photoUrl} seed={provider.uid} size="fill" fit="contain" />}
      footer={<ProviderCardActions provider={provider} profilePath={profilePath} need={provider.name} />}
    >
      <CardTitle to={profilePath} verified={verified ? 'E verifikuar' : undefined}>{provider.name}</CardTitle>
      <p className="pc-subtitle">{subtitle}</p>

      <CardMeta>
        {provider.location ? (
          <li>
            <MapPin size={14} aria-hidden />
            {provider.location}
          </li>
        ) : null}
        <RatingMeta average={provider.ratingAverage ?? 0} count={provider.ratingCount ?? 0} href={profilePath} />
        <li>
          <Users size={14} aria-hidden />
          {expertCount === 1 ? '1 ekspert' : `${expertCount} ekspertë`}
        </li>
        {provider.serviceCount > 0 ? (
          <li>
            <Briefcase size={14} aria-hidden />
            {provider.serviceCount === 1 ? '1 shërbim' : `${provider.serviceCount} shërbime`}
          </li>
        ) : null}
        {provider.modes.includes('online') ? (
          <li>
            <Video size={14} aria-hidden />
            Online
          </li>
        ) : null}
      </CardMeta>

      {description ? (
        <ProviderDescription text={description} expanded={expanded} onToggle={() => setExpanded((v) => !v)} />
      ) : null}

      <ProviderTags items={specialties.slice(1)} max={4} />

      {featured ? (
        <div className="pc-sub">
          <span className="pc-sub-label">Ekspertët</span>
          <Link to={providerPath(featured)} className="pc-sub-person" onClick={(e) => e.stopPropagation()}>
            <span className="pc-sub-photo" aria-hidden>
              <ProfileAvatar src={featured.photoUrl} seed={featured.uid} size="fill" />
            </span>
            <strong>{featured.name}</strong>
            <span className="pc-sub-muted">{featured.title || 'Ekspert i ekipit'}</span>
          </Link>
          {expertCount > 1 ? (
            <Link to={`${profilePath}#ekspertet`} className="pc-sub-more" onClick={(e) => e.stopPropagation()}>
              Shiko ekipin
              <ChevronRight size={14} aria-hidden />
            </Link>
          ) : null}
        </div>
      ) : null}
    </CardShell>
  )
}
