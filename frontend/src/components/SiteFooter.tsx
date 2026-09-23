import { Link as HeroLink, Separator } from '@heroui/react'
import { Camera, MessageCircle, UsersRound } from 'lucide-react'
import { Link as RouterLink } from 'react-router-dom'
import FooterFeedback from './FooterFeedback'

const columns = [
  {
    title: 'Për klientë',
    links: [
      { label: 'Eksploro shërbimet', to: '/#categories' },
      { label: 'Shiko ofertat', to: '/ofertat' },
      { label: 'Si funksionon', to: '/#how' },
    ],
  },
  {
    title: 'Për profesionistë',
    links: [
      { label: 'Bëhu ofrues', to: '/register' },
      { label: 'Hyr në llogari', to: '/login' },
    ],
  },
  {
    title: 'Mbështetje',
    links: [
      { label: 'Si funksionon', to: '/#how' },
      { label: 'Krijo llogari', to: '/register' },
    ],
  },
  {
    title: 'Kompania',
    links: [
      { label: 'Rreth KëshillaKos', to: '/rreth-nesh' },
      { label: 'Pse të na zgjedhësh', to: '/#trust' },
    ],
  },
] as const

export default function SiteFooter() {
  return (
    <footer className="tt-footer">
      <div className="tt-section-inner">
        <div className="tt-footer-main">
          <div className="tt-footer-about">
            <RouterLink to="/" className="brand brand-link tt-footer-brand">
              KëshillaKos
            </RouterLink>
            <p>Matching me ofrues profesionalë në Kosovë dhe online.</p>
            <div className="tt-footer-social" aria-label="Rrjetet sociale së shpejti">
              <span title="Instagram — së shpejti"><Camera size={19} aria-hidden /></span>
              <span title="Facebook — së shpejti"><MessageCircle size={19} aria-hidden /></span>
              <span title="LinkedIn — së shpejti"><UsersRound size={19} aria-hidden /></span>
            </div>
            <FooterFeedback />
          </div>

          <nav className="tt-footer-columns" aria-label="Lidhjet e faqes">
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
          <small>© {new Date().getFullYear()} KëshillaKos. Të gjitha të drejtat e rezervuara.</small>
          <div className="tt-footer-legal" aria-label="Dokumentet ligjore">
            <RouterLink to="/kushtet" className="tt-footer-link">Kushtet e përdorimit</RouterLink>
            <RouterLink to="/privatesia" className="tt-footer-link">Privatësia</RouterLink>
            <RouterLink to="/cookies" className="tt-footer-link">Cookies</RouterLink>
          </div>
        </div>
      </div>
    </footer>
  )
}
