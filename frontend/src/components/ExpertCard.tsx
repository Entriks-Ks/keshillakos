import { useState, type KeyboardEvent, type MouseEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Award,
  Briefcase,
  Globe,
  Mail,
  MapPin,
  Phone,
  Quote,
} from 'lucide-react'
import { mediaUrl } from '../api/media'
import type { MarketplaceProvider } from '../api/providerProfiles'
import SendRequestButton from './SendRequestButton'
import StartChatButton from './StartChatButton'

function isVerified(provider: MarketplaceProvider) {
  const v = provider.verification
  if (!v) return false
  return v.identity === 'verified' || v.qualification === 'verified' || v.business === 'verified'
}

function starRow(average: number, count: number) {
  if (count <= 0) return '☆☆☆☆☆'
  const filled = Math.max(1, Math.min(5, Math.round(average)))
  return `${'★'.repeat(filled)}${'☆'.repeat(Math.max(0, 5 - filled))}`
}

type Props = {
  provider: MarketplaceProvider
}

export default function ExpertCard({ provider }: Props) {
  const navigate = useNavigate()
  const [expanded, setExpanded] = useState(false)
  const photo = mediaUrl(provider.photoUrl)
  const ratingCount = provider.ratingCount ?? 0
  const rating = provider.ratingAverage ?? 0
  const specialties = [...provider.specializations, ...provider.categoryLabels].filter(Boolean)
  const description = (provider.description || provider.experience || '').trim()
  const longDescription = description.length > 160
  const shownDescription = expanded || !longDescription ? description : `${description.slice(0, 160).trim()}…`
  const experienceLabel = provider.yearsOfExperience != null
    ? (provider.yearsOfExperience === 1 ? '1 vit përvojë' : `${provider.yearsOfExperience} vite përvojë`)
    : null
  const verified = isVerified(provider)
  const phone = provider.publicPhone?.trim()
  const website = provider.website?.trim()
  const profilePath = `/providers/${provider.uid}`

  function openProfile() {
    navigate(profilePath)
  }

  function onCardClick(e: MouseEvent<HTMLElement>) {
    if ((e.target as HTMLElement).closest('a, button, input, label, form')) return
    openProfile()
  }

  function onCardKeyDown(e: KeyboardEvent<HTMLElement>) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      openProfile()
    }
  }

  return (
    <article
      className="tt-dir-card is-expert is-clickable"
      onClick={onCardClick}
      onKeyDown={onCardKeyDown}
      role="link"
      tabIndex={0}
      aria-label={`Shiko profilin e ${provider.name}`}
    >
      {provider.companyName ? (
        <p className="tt-dir-card-kicker">{provider.companyName}</p>
      ) : null}

      <div className="tt-dir-card-main">
        <div className="tt-dir-photo-wrap">
          <div className="tt-dir-photo" aria-hidden>
            {photo ? <img src={photo} alt="" /> : <span>{provider.name.slice(0, 1)}</span>}
          </div>
          {verified ? <span className="tt-dir-photo-badge" title="I verifikuar">✓</span> : null}
        </div>

        <div className="tt-dir-content">
          <h3 className="tt-dir-name">
            <Link to={profilePath} onClick={(e) => e.stopPropagation()}>{provider.name}</Link>
          </h3>

          <p className="tt-dir-rating">
            {ratingCount > 0 ? (
              <>
                <strong>{rating.toFixed(1)}</strong>
                <span className="tt-dir-stars" aria-hidden>{starRow(rating, ratingCount)}</span>
                <Link to={`${profilePath}#vleresimet`} onClick={(e) => e.stopPropagation()}>
                  {ratingCount} {ratingCount === 1 ? 'vlerësim' : 'vlerësime'}
                </Link>
              </>
            ) : (
              <span className="muted">Ende pa vlerësime</span>
            )}
          </p>

          <ul className="tt-dir-meta">
            {provider.location ? (
              <li>
                <MapPin size={16} aria-hidden />
                <span>{provider.location}</span>
              </li>
            ) : null}
            {experienceLabel || verified ? (
              <li>
                <Award size={16} aria-hidden />
                <span>
                  {[experienceLabel, verified ? 'Profil i verifikuar' : null].filter(Boolean).join(' · ')}
                </span>
              </li>
            ) : null}
            {description ? (
              <li>
                <Quote size={16} aria-hidden />
                <span>
                  {shownDescription}
                  {longDescription ? (
                    <button
                      type="button"
                      className="tt-dir-read-more"
                      onClick={(e) => {
                        e.stopPropagation()
                        setExpanded((value) => !value)
                      }}
                    >
                      {expanded ? 'shiko më pak' : 'lexo më shumë'}
                    </button>
                  ) : null}
                </span>
              </li>
            ) : null}
            {specialties.length ? (
              <li>
                <Briefcase size={16} aria-hidden />
                <span>{specialties.slice(0, 4).join(' | ')}</span>
              </li>
            ) : null}
          </ul>
        </div>
      </div>

      <div className="tt-dir-actions">
        {phone ? (
          <a className="tt-dir-action is-primary" href={`tel:${phone.replace(/\s+/g, '')}`} onClick={(e) => e.stopPropagation()}>
            <Phone size={18} aria-hidden />
            <span>{phone}</span>
          </a>
        ) : (
          <Link className="tt-dir-action is-primary" to={profilePath} onClick={(e) => e.stopPropagation()}>
            <Phone size={18} aria-hidden />
            <span>Shiko profilin</span>
          </Link>
        )}

        <div className="tt-dir-actions-secondary">
          <div className="tt-dir-action-slot" onClick={(e) => e.stopPropagation()}>
            {provider.publicEmail?.trim() ? (
              <a className="tt-dir-action is-icon" href={`mailto:${provider.publicEmail.trim()}`} aria-label="Email">
                <Mail size={18} aria-hidden />
                <span className="tt-dir-action-text">Kontakto</span>
              </a>
            ) : (
              <SendRequestButton
                providerUid={provider.uid}
                providerId={provider.id}
                providerName={provider.name}
                categoryId={provider.categories[0]}
                compact
                ctaLabel="Kontakto"
                intake={{
                  need: provider.title || provider.name,
                  location: provider.location || '',
                  language: provider.languages[0] || 'Albanian',
                  urgency: 'flexible',
                  contact: 'chat',
                }}
              />
            )}
          </div>

          {website ? (
            <a
              className="tt-dir-action is-icon"
              href={website.startsWith('http') ? website : `https://${website}`}
              target="_blank"
              rel="noreferrer"
              aria-label="Website"
              onClick={(e) => e.stopPropagation()}
            >
              <Globe size={18} aria-hidden />
              <span className="tt-dir-action-text">Website</span>
            </a>
          ) : (
            <Link
              className="tt-dir-action is-icon"
              to={profilePath}
              aria-label="Profili"
              onClick={(e) => e.stopPropagation()}
            >
              <Globe size={18} aria-hidden />
              <span className="tt-dir-action-text">Profili</span>
            </Link>
          )}

          <div className="tt-dir-action-slot" onClick={(e) => e.stopPropagation()}>
            <StartChatButton
              providerUid={provider.uid}
              providerName={provider.name}
              compact
              hideGuestHint
              label="Live Chat"
              className="tt-dir-action is-icon"
            />
          </div>
        </div>
      </div>
    </article>
  )
}
