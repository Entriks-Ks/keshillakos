import { Link as HeroLink, Separator } from '@heroui/react'
import { useTranslation } from 'react-i18next'
import { Link as RouterLink } from 'react-router-dom'
import type { SocialLinkKey } from '../api/socialLinks'
import FooterFeedback from './FooterFeedback'
import SocialIcon from './SocialIcon'

const SOCIAL: Array<{ key: SocialLinkKey; label: string }> = [
  { key: 'instagram', label: 'Instagram' },
  { key: 'facebook', label: 'Facebook' },
  { key: 'linkedin', label: 'LinkedIn' },
]

export default function SiteFooter() {
  const { t } = useTranslation()
  const columns = [
    {
      title: t('footer.clients'),
      links: [
        { label: t('footer.explore'), to: '/#categories' },
        { label: t('footer.offers'), to: '/ofertat' },
        { label: t('footer.how'), to: '/#how' },
      ],
    },
    {
      title: t('footer.pros'),
      links: [
        { label: t('nav.plans'), to: '/planet' },
        { label: t('footer.become'), to: '/register' },
        { label: t('footer.login'), to: '/login' },
      ],
    },
    {
      title: t('footer.support'),
      links: [
        { label: t('footer.how'), to: '/#how' },
        { label: t('footer.create'), to: '/register' },
      ],
    },
    {
      title: t('footer.company'),
      links: [
        { label: t('footer.about'), to: '/rreth-nesh' },
        { label: t('footer.why'), to: '/#trust' },
      ],
    },
  ]

  return (
    <footer className="tt-footer">
      <div className="tt-section-inner">
        <div className="tt-footer-main">
          <div className="tt-footer-about">
            <RouterLink to="/" className="brand brand-link tt-footer-brand">
              KLAW
            </RouterLink>
            <p>{t('footer.tagline')}</p>
            <div className="tt-footer-social" aria-label={t('footer.social')}>
              {SOCIAL.map(({ key, label }) => (
                <span key={key} title={label}>
                  <SocialIcon name={key} size={18} />
                  <span className="sr-only">{label}</span>
                </span>
              ))}
            </div>
            <FooterFeedback />
          </div>

          <nav className="tt-footer-columns" aria-label={t('footer.links')}>
            {columns.map((column) => (
              <div className="tt-footer-column" key={column.title}>
                <h2>{column.title}</h2>
                <ul>
                  {column.links.map(({ label, to }) => (
                    <li key={label}>
                      <HeroLink href={to} className="tt-footer-link">{label}</HeroLink>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <Separator className="tt-footer-divider" />
        <div className="tt-footer-bottom">
          <small>© {new Date().getFullYear()} KLAW. {t('footer.rights')}</small>
          <div className="tt-footer-legal" aria-label={t('footer.legal')}>
            <RouterLink to="/kushtet" className="tt-footer-link">{t('footer.terms')}</RouterLink>
            <RouterLink to="/privatesia" className="tt-footer-link">{t('footer.privacy')}</RouterLink>
            <RouterLink to="/cookies" className="tt-footer-link">{t('footer.cookies')}</RouterLink>
          </div>
        </div>
      </div>
    </footer>
  )
}
