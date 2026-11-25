import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Award, Building2, Check, MapPin, Scale, Video } from 'lucide-react'
import type { MarketplaceProvider } from '../api/providerProfiles'
import { useCompareLawyers } from '../hooks/useCompareLawyers'
import { humanLabels } from '../utils/displayLabels'
import { providerPath } from '../utils/publicPaths'
import ProfileAvatar from './ProfileAvatar'
import ProviderCardActions from './ProviderCardActions'
import { CardMeta, CardShell, CardTitle, ProviderDescription, ProviderTags, RatingMeta } from './ProviderCardParts'
import { isProviderVerified } from './providerCardUtils'

type Props = {
  provider: MarketplaceProvider
}

export default function ExpertCard({ provider }: Props) {
  const [expanded, setExpanded] = useState(false)
  const { t } = useTranslation()
  const { isLawyerSelected, toggleLawyer } = useCompareLawyers()
  const compared = isLawyerSelected(provider.uid)
  const profilePath = providerPath(provider)
  const specialties = humanLabels(
    [...provider.specializations, ...provider.categoryLabels],
    provider.categories,
  )
  const description = (provider.description || provider.experience || '').trim()
  const verified = isProviderVerified(provider)
  const title = provider.title?.trim()
  const subtitle = title || specialties[0] || t('role.expert')
  const tags = title ? specialties : specialties.slice(1)
  const experienceLabel = provider.yearsOfExperience != null
    ? t('cards.experience', { count: provider.yearsOfExperience })
    : null

  return (
    <CardShell
      href={profilePath}
      label={t('cards.viewProfileNamed', { name: provider.name })}
      mediaKind="person"
      media={<ProfileAvatar src={provider.photoUrl} seed={provider.uid} size="fill" />}
      footer={<ProviderCardActions provider={provider} profilePath={profilePath} need={provider.title || provider.name} />}
    >
      <CardTitle
        to={profilePath}
        verified={verified ? t('compare.verified') : undefined}
        action={(
          <button
            type="button"
            className={`pc-compare-toggle${compared ? ' is-selected' : ''}`}
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              toggleLawyer(provider.uid, {
                name: provider.name,
                photoUrl: provider.photoUrl,
                title: subtitle,
              })
            }}
            aria-pressed={compared}
            title={compared ? t('cards.compareRemove') : t('cards.compareAdd')}
          >
            {compared ? <Check size={12} aria-hidden /> : <Scale size={12} aria-hidden />}
            <span>{compared ? t('cards.compared') : t('cards.compare')}</span>
          </button>
        )}
      >
        {provider.name}
      </CardTitle>
      <p className="pc-subtitle">{subtitle}</p>

      <CardMeta>
        {provider.location ? (
          <li>
            <MapPin size={14} aria-hidden />
            {provider.location}
          </li>
        ) : null}
        <RatingMeta average={provider.ratingAverage ?? 0} count={provider.ratingCount ?? 0} href={profilePath} />
        {experienceLabel ? (
          <li>
            <Award size={14} aria-hidden />
            {experienceLabel}
          </li>
        ) : null}
        {provider.companyName ? (
          <li>
            <Building2 size={14} aria-hidden />
            {provider.companyName}
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

      <ProviderTags items={tags} max={4} />
    </CardShell>
  )
}
