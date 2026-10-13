import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Globe, Mail, MessageCircle, Phone } from 'lucide-react'
import { toMatchLanguage } from '../api/match'
import type { MarketplaceProvider } from '../api/providerProfiles'
import { useAuth } from '../auth/AuthContext'
import SendRequestButton from './SendRequestButton'
import StartChatButton from './StartChatButton'

const OWN_PROFILE_HINT = 'Ky është profili yt'

type Props = {
  provider: MarketplaceProvider
  profilePath: string
  need: string
}

export default function ProviderCardActions({ provider, profilePath, need }: Props) {
  const { user } = useAuth()
  const { t } = useTranslation()
  const isOwn = Boolean(user && user.uid === provider.uid)
  const phone = provider.publicPhone?.trim()
  const email = provider.publicEmail?.trim()
  const website = provider.website?.trim()

  return (
    <div className={`tt-dir-actions pc-actions${phone ? ' has-call' : ''}`}>
      {phone ? (
        <a className="tt-dir-action is-primary" href={`tel:${phone.replace(/\s+/g, '')}`} onClick={(e) => e.stopPropagation()}>
          <Phone size={16} aria-hidden />
          <span>{t('card.call')}</span>
        </a>
      ) : null}

      <div className="tt-dir-actions-secondary">
        <div className="tt-dir-action-slot" onClick={(e) => e.stopPropagation()}>
          {email ? (
            <a className="tt-dir-action is-icon" href={`mailto:${email}`} aria-label={t('card.contact')}>
              <Mail size={18} aria-hidden />
              <span className="tt-dir-action-text">{t('card.contact')}</span>
            </a>
          ) : isOwn ? (
            <span className="tt-dir-action is-icon" aria-disabled="true" aria-label={t('card.contact')} title={OWN_PROFILE_HINT}>
              <Mail size={18} aria-hidden />
              <span className="tt-dir-action-text">{t('card.contact')}</span>
            </span>
          ) : (
            <SendRequestButton
              providerUid={provider.uid}
              providerId={provider.id}
              providerName={provider.name}
              categoryId={provider.categories[0]}
              compact
              ctaLabel={t('card.contact')}
              ctaIcon="mail"
              intake={{
                need,
                location: provider.location || '',
                language: toMatchLanguage(provider.languages[0]),
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
            aria-label="Website"
            onClick={(e) => e.stopPropagation()}
          >
            <Globe size={18} aria-hidden />
            <span className="tt-dir-action-text">Website</span>
          </Link>
        )}

        <div className="tt-dir-action-slot" onClick={(e) => e.stopPropagation()}>
          {isOwn ? (
            <span className="tt-dir-action is-icon" aria-disabled="true" aria-label="Live Chat" title={OWN_PROFILE_HINT}>
              <MessageCircle size={18} aria-hidden />
              <span className="tt-dir-action-text">Live Chat</span>
            </span>
          ) : (
            <StartChatButton
              providerUid={provider.uid}
              providerName={provider.name}
              compact
              hideGuestHint
              label="Live Chat"
              className="tt-dir-action is-icon"
            />
          )}
        </div>
      </div>
    </div>
  )
}
