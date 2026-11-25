import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation()
  const profilePath = providerPath(provider)
  const specialties = humanLabels(
    [...provider.specializations, ...provider.categoryLabels],
    provider.categories,
  )
  const description = (provider.description || '').trim()
  const verified = isProviderVerified(provider)
  const expertCount = provider.expertCount ?? 0
  const featured = provider.featuredExpert
  const subtitle = specialties[0] || t('role.company')

  return (
    <CardShell
      href={profilePath}
      label={t('cards.viewProfileNamed', { name: provider.name })}
      mediaKind="company"
      media={<ProfileAvatar src={provider.photoUrl} seed={provider.uid} size="fill" fit="contain" />}
      footer={<ProviderCardActions provider={provider} profilePath={profilePath} need={provider.name} />}
    >
      <CardTitle to={profilePath} verified={verified ? t('cards.verifiedCompany') : undefined}>{provider.name}</CardTitle>
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
          {t('cards.expertCount', { count: expertCount })}
        </li>
        {provider.serviceCount > 0 ? (
          <li>
            <Briefcase size={14} aria-hidden />
            {t('cards.serviceCount', { count: provider.serviceCount })}
          </li>
        ) : null}
        {provider.modes.includes('online') ? (
          <li>
            <Video size={14} aria-hidden />
            {t('cards.online')}
          </li>
        ) : null}
      </CardMeta>

      {description ? (
        <ProviderDescription text={description} expanded={expanded} onToggle={() => setExpanded((v) => !v)} />
      ) : null}

      <ProviderTags items={specialties.slice(1)} max={4} />

      {featured ? (
        <div className="pc-sub">
          <span className="pc-sub-label">{t('cards.teamLabel')}</span>
          <Link to={providerPath(featured)} className="pc-sub-person" onClick={(e) => e.stopPropagation()}>
            <span className="pc-sub-photo" aria-hidden>
              <ProfileAvatar src={featured.photoUrl} seed={featured.uid} size="fill" />
            </span>
            <strong>{featured.name}</strong>
            <span className="pc-sub-muted">{featured.title || t('cards.teamExpert')}</span>
          </Link>
          {expertCount > 1 ? (
            <Link to={`${profilePath}#ekspertet`} className="pc-sub-more" onClick={(e) => e.stopPropagation()}>
              {t('cards.viewTeam')}
              <ChevronRight size={14} aria-hidden />
            </Link>
          ) : null}
        </div>
      ) : null}
    </CardShell>
  )
}
