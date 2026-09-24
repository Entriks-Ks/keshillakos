import { useState, type KeyboardEvent, type MouseEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Briefcase,
  Building2,
  CheckCircle2,
  ChevronDown,
  Globe,
  Mail,
  MapPin,
  Phone,
  UserRound,
  Video,
} from 'lucide-react'
import { mediaUrl } from '../api/media'
import type { MarketplaceProvider } from '../api/providerProfiles'
import SendRequestButton from './SendRequestButton'
import StartChatButton from './StartChatButton'

function isVerified(provider: MarketplaceProvider) {
  const v = provider.verification
  if (!v) return false
  return v.business === 'verified' || v.identity === 'verified' || v.qualification === 'verified'
}

function starRow(average: number, count: number) {
  if (count <= 0) return '☆☆☆☆☆'
  const filled = Math.max(1, Math.min(5, Math.round(average)))
  return `${'★'.repeat(filled)}${'☆'.repeat(Math.max(0, 5 - filled))}`
}

type Props = {
  provider: MarketplaceProvider
}

export default function CompanyCard({ provider }: Props) {
  const navigate = useNavigate()
  const [expanded, setExpanded] = useState(false)
  const ratingCount = provider.ratingCount ?? 0
  const rating = provider.ratingAverage ?? 0
  const specialties = [...provider.specializations, ...provider.categoryLabels].filter(Boolean)
  const description = (provider.description || '').trim()
  const longDescription = description.length > 160
  const shownDescription = expanded || !longDescription ? description : `${description.slice(0, 160).trim()}…`
  const expertCount = provider.expertCount ?? 0
  const verified = isVerified(provider)
  const phone = provider.publicPhone?.trim()
  const website = provider.website?.trim()
  const email = provider.publicEmail?.trim()
  const featured = provider.featuredExpert
  const featuredPhoto = mediaUrl(featured?.photoUrl)
  const profilePath = `/providers/${provider.uid}`
  const offersOnline = provider.modes.includes('online')

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

  const contactIntake = {
    need: provider.name,
    location: provider.location || '',
    language: provider.languages[0] || 'Albanian',
    urgency: 'flexible' as const,
    contact: 'chat' as const,
  }

  return (
    <article
      className="tt-dir-card is-company is-clickable"
      onClick={onCardClick}
      onKeyDown={onCardKeyDown}
      role="link"
      tabIndex={0}
      aria-label={`Shiko profilin e ${provider.name}`}
    >
      <div className="tt-dir-card-body">
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
            <li>
              <Building2 size={16} aria-hidden />
              <span>
                {[
                  expertCount === 1 ? '1 ekspert në ekip' : `${expertCount} ekspertë në ekip`,
                  provider.serviceCount > 0
                    ? (provider.serviceCount === 1 ? '1 shërbim' : `${provider.serviceCount} shërbime`)
                    : null,
                ].filter(Boolean).join(' · ')}
              </span>
            </li>
            {description ? (
              <li>
                <UserRound size={16} aria-hidden />
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
                <span>{specialties.slice(0, 5).join(' | ')}</span>
              </li>
            ) : null}
          </ul>

          <div className="tt-dir-perks">
            {verified ? (
              <span>
                <CheckCircle2 size={15} aria-hidden />
                E verifikuar
              </span>
            ) : null}
            {offersOnline ? (
              <span>
                <Video size={15} aria-hidden />
                Ofrohet online
              </span>
            ) : null}
          </div>
        </div>

        {featured ? (
          <aside className="tt-dir-featured">
            <Link to={`/providers/${featured.uid}`} className="tt-dir-featured-card" onClick={(e) => e.stopPropagation()}>
              <div className="tt-dir-featured-photo" aria-hidden>
                {featuredPhoto ? <img src={featuredPhoto} alt="" /> : <span>{featured.name.slice(0, 1)}</span>}
              </div>
              <div className="tt-dir-featured-copy">
                <strong>{featured.name}</strong>
                <span className="tt-dir-featured-pill">
                  {featured.title || 'Ekspert i ekipit'}
                </span>
              </div>
            </Link>
            {expertCount > 1 ? (
              <Link
                to={`${profilePath}#ekspertet`}
                className="tt-dir-other-experts"
                onClick={(e) => e.stopPropagation()}
              >
                Ekspertë të tjerë të kësaj kompanie
                <ChevronDown size={16} aria-hidden />
              </Link>
            ) : null}
          </aside>
        ) : null}
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
            <span>Shiko kompaninë</span>
          </Link>
        )}

        <div className="tt-dir-actions-secondary">
          <div className="tt-dir-action-slot" onClick={(e) => e.stopPropagation()}>
            {email ? (
              <a className="tt-dir-action is-icon" href={`mailto:${email}`} aria-label="Email">
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
                intake={contactIntake}
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
