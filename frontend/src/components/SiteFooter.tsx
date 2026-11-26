import { Link as HeroLink, Separator } from '@heroui/react'
import { useTranslation } from 'react-i18next'
import { Link as RouterLink } from 'react-router-dom'
import { LogoMark, LogoWordmark } from './Logo'
import type { SocialLinkKey } from '../api/socialLinks'
import FooterFeedback from './FooterFeedback'
import SocialIcon from './SocialIcon'
import { routePath } from '../routes/routeMap'

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
        { label: t('footer.explore'), to: routePath('home', { hash: 'categories' }) },
        { label: t('footer.offers'), to: routePath('services') },
        { label: t('footer.how'), to: routePath('home', { hash: 'how' }) },
      ],
    },
    {
      title: t('footer.pros'),
      links: [
        { label: t('nav.plans'), to: routePath('plans') },
        { label: t('footer.become'), to: routePath('register') },
        { label: t('footer.login'), to: routePath('login') },
      ],
    },
    {
      title: t('footer.support'),
      links: [
        { label: t('footer.how'), to: routePath('home', { hash: 'how' }) },
        { label: t('footer.create'), to: routePath('register') },
      ],
    },
    {
      title: t('footer.company'),
      links: [
        { label: t('footer.about'), to: routePath('about') },
        { label: t('footer.why'), to: routePath('home', { hash: 'trust' }) },
      ],
    },
  ]

  return (
    <footer className="tt-footer">
      <div className="tt-section-inner tt-footer-inner">
        <div className="tt-footer-main">
          <div className="tt-footer-about">
            <RouterLink to={routePath('home')} className="brand brand-link tt-footer-brand" aria-label={t('nav.home')}>
              <LogoMark size={32} />
              <LogoWordmark height={21} variant="white" />
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
          <small>© {new Date().getFullYear()} Këshillohu. {t('footer.rights')}</small>
          <div className="tt-footer-legal" aria-label={t('footer.legal')}>
            <RouterLink to={routePath('terms')} className="tt-footer-link">{t('footer.terms')}</RouterLink>
            <RouterLink to={routePath('privacy')} className="tt-footer-link">{t('footer.privacy')}</RouterLink>
            <RouterLink to={routePath('cookies')} className="tt-footer-link">{t('footer.cookies')}</RouterLink>
          </div>
        </div>
      </div>
    </footer>
  )
}
