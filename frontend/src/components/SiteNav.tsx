import MessageNavButton from '../chat/MessageNavButton'
import MessageUnreadBadge from '../chat/MessageUnreadBadge'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation } from 'react-router-dom'
import { Button, Drawer, Dropdown, Label, Separator, buttonVariants } from '@heroui/react'
import {
  Briefcase,
  ChevronDown,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageCircle,
  Settings,
  UserRound,
  Users,
  type LucideIcon,
} from 'lucide-react'
import type { AuthUser } from '../api/auth'
import ThemeToggle from './ThemeToggle'
import LanguageSwitcher from './LanguageSwitcher'
import { useAuth } from '../auth/AuthContext'
import { useCompareLawyers } from '../hooks/useCompareLawyers'
import { ROLE_LABELS } from '../dashboard/nav'
import i18n from '../i18n'
import { resolveActiveContext } from '../utils/dashboardPath'
import {
  activeMarketplaceLink,
  getAccountMenu,
  userDisplayName,
  type AccountMenuId,
} from '../utils/siteNavMenu'
import ProfileAvatar from './ProfileAvatar'
import NotificationBell from '../notifications/NotificationBell'
import './SiteNav.css'

const ACCOUNT_ICONS: Record<AccountMenuId, LucideIcon> = {
  profile: UserRound,
  dashboard: LayoutDashboard,
  offers: Briefcase,
  team: Users,
  messages: MessageCircle,
  settings: Settings,
}

function roleLabel(user: AuthUser) {
  const context = resolveActiveContext(user)
  return i18n.t(context === 'user' ? 'role.private' : ROLE_LABELS[context])
}

function AccountMenu({ user, onLogout }: { user: AuthUser; onLogout: () => void }) {
  const { t } = useTranslation()
  const items = getAccountMenu(user)
  const displayName = userDisplayName(user)
  const shortName = displayName.split(' ')[0]

  return (
    <Dropdown>
      <Dropdown.Trigger
        className="kk-nav-account"
        aria-label={displayName ? `Llogaria: ${displayName}` : 'Llogaria ime'}
      >
        <ProfileAvatar
          src={user.profilePhoto}
          seed={user.uid}
          alt={displayName || 'Profili i përdoruesit'}
          size="sm"
          className="kk-nav-avatar"
        />
        {shortName ? <span className="kk-nav-account-name">{shortName}</span> : null}
        <ChevronDown size={16} aria-hidden className="kk-nav-account-caret" />
      </Dropdown.Trigger>
      <Dropdown.Popover placement="bottom end" className="kk-nav-popover">
        <div className="kk-nav-account-head">
          <ProfileAvatar src={user.profilePhoto} seed={user.uid} size="md" className="kk-nav-avatar" />
          <div className="kk-nav-account-meta">
            <strong>{displayName || user.email}</strong>
            {displayName ? <span>{user.email}</span> : null}
            <span className="kk-nav-role">{roleLabel(user)}</span>
          </div>
        </div>
        <Dropdown.Menu aria-label="Menuja e llogarisë" className="kk-nav-menu">
          {items.map((item) => {
            const Icon = ACCOUNT_ICONS[item.id]
            return (
              <Dropdown.Item key={item.id} id={item.id} href={item.to} textValue={t(item.label)}>
                <Icon size={16} aria-hidden className="kk-nav-menu-icon" />
                <Label>{t(item.label)}{item.id === 'messages' && <MessageUnreadBadge />}</Label>
              </Dropdown.Item>
            )
          })}
          <Dropdown.Item id="logout" textValue={t('nav.logout')} variant="danger" onAction={onLogout}>
            <LogOut size={16} aria-hidden className="kk-nav-menu-icon" />
            <Label>{t('nav.logout')}</Label>
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  )
}

export default function SiteNav() {
  const { t } = useTranslation()
  const { user, loading, logout } = useAuth()
  const { count: compareCount } = useCompareLawyers()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const active = activeMarketplaceLink(location.pathname, location.search)
  const accountItems = user ? getAccountMenu(user) : []
  const closeMenu = () => setMenuOpen(false)

  function handleLogout() {
    setMenuOpen(false)
    logout()
  }

  return (
    <header className="kk-nav">
      <div className="tt-nav-inner kk-nav-inner">
        <Link to="/" className="kk-nav-brand" aria-label={t('nav.home')}>
          <span className="kk-nav-mark" aria-hidden>K</span>
          <span>KLAW</span>
        </Link>

        <nav className="kk-nav-center" aria-label={t('nav.main')}>
          <ul className="kk-nav-links">
            <li>
              <Link
                to="/ofertat"
                className="kk-nav-link"
                aria-current={active ? 'page' : undefined}
              >
                {t('nav.offers')}
              </Link>
            </li>
            <li>
              <Link
                to="/krahaso"
                className="kk-nav-link"
                aria-current={location.pathname === '/krahaso' || location.pathname === '/krahaso-avokatet' ? 'page' : undefined}
              >
                <span>{t('nav.compare', 'Krahaso Avokatët')}</span>
                {compareCount > 0 ? <span className="kk-compare-nav-count">{compareCount}</span> : null}
              </Link>
            </li>
            <li>
              <Link
                to="/planet"
                className="kk-nav-link"
                aria-current={location.pathname === '/planet' ? 'page' : undefined}
              >
                {t('nav.plans')}
              </Link>
            </li>
            <li>
              <Link
                to="/rreth-nesh"
                className="kk-nav-link"
                aria-current={location.pathname === '/rreth-nesh' ? 'page' : undefined}
              >
                {t('nav.about')}
              </Link>
            </li>
            <li>
              <Link
                to="/ai-asistenti"
                className="kk-nav-link"
                aria-current={location.pathname === '/ai-asistenti' ? 'page' : undefined}
              >
                <span>Këshilla AI</span>
              </Link>
            </li>
          </ul>
        </nav>

        <div className="kk-nav-actions">
          <div className="kk-nav-actions-desktop">
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
          {loading ? (
            <span className="kk-nav-pending" aria-hidden />
          ) : user ? (
            <>
              <MessageNavButton />
              <NotificationBell />
              <AccountMenu user={user} onLogout={handleLogout} />
            </>
          ) : (
            <div className="kk-nav-guest">
              <Link to="/login" className={`${buttonVariants({ variant: 'ghost', size: 'sm' })} kk-nav-login`}>
                {t('nav.login')}
              </Link>
              <Link to="/register" className={`${buttonVariants({ variant: 'primary', size: 'sm' })} kk-nav-cta`}>
                {t('nav.register')}
              </Link>
            </div>
          )}

          <Drawer isOpen={menuOpen} onOpenChange={setMenuOpen}>
            <Button
              isIconOnly
              variant="ghost"
              size="sm"
              className="kk-nav-toggle"
              aria-label={menuOpen ? t('nav.close') : t('nav.open')}
              aria-expanded={menuOpen}
            >
              <Menu size={20} aria-hidden />
            </Button>
            <Drawer.Backdrop className="kk-nav-drawer-backdrop">
              <Drawer.Content placement="right" className="kk-nav-drawer">
                <Drawer.Dialog aria-label={t('nav.main')} className="kk-nav-drawer-dialog">
                  <Drawer.Header className="kk-nav-drawer-head">
                    <Link to="/" className="kk-nav-brand" onClick={closeMenu}>
                      <span className="kk-nav-mark" aria-hidden>K</span>
                      <span>KLAW</span>
                    </Link>
                    <Drawer.CloseTrigger aria-label={t('nav.close')} />
                  </Drawer.Header>

                  <Drawer.Body className="kk-nav-drawer-body">
                    {user ? (
                      <div className="kk-nav-drawer-user">
                        <ProfileAvatar src={user.profilePhoto} seed={user.uid} size="md" className="kk-nav-avatar" />
                        <div className="kk-nav-account-meta">
                          <strong>{userDisplayName(user) || user.email}</strong>
                          {userDisplayName(user) ? <span>{user.email}</span> : null}
                        </div>
                      </div>
                    ) : null}

                    <nav aria-label={t('nav.mobile')}>
                      <ul className="kk-nav-drawer-list">
                        <li>
                          <Link
                            to="/ofertat"
                            className="kk-nav-drawer-link"
                            aria-current={active ? 'page' : undefined}
                            onClick={closeMenu}
                          >
                            {t('nav.offers')}
                          </Link>
                        </li>
                        <li>
                          <Link
                            to="/krahaso"
                            className="kk-nav-drawer-link"
                            aria-current={location.pathname === '/krahaso' || location.pathname === '/krahaso-avokatet' ? 'page' : undefined}
                            onClick={closeMenu}
                          >
                            <span>{t('nav.compare', 'Krahaso Avokatët')}</span>
                            {compareCount > 0 ? <span className="kk-compare-nav-count">{compareCount}</span> : null}
                          </Link>
                        </li>
                        <li>
                          <Link
                            to="/planet"
                            className="kk-nav-drawer-link"
                            aria-current={location.pathname === '/planet' ? 'page' : undefined}
                            onClick={closeMenu}
                          >
                            {t('nav.plans')}
                          </Link>
                        </li>
                        <li>
                          <Link
                            to="/rreth-nesh"
                            className="kk-nav-drawer-link"
                            aria-current={location.pathname === '/rreth-nesh' ? 'page' : undefined}
                            onClick={closeMenu}
                          >
                            {t('nav.about')}
                          </Link>
                        </li>
                        <li>
                          <Link
                            to="/ai-asistenti"
                            className="kk-nav-drawer-link"
                            aria-current={location.pathname === '/ai-asistenti' ? 'page' : undefined}
                            onClick={closeMenu}
                          >
                            <span>Këshilla AI</span>
                          </Link>
                        </li>
                      </ul>

                      {user ? (
                        <>
                          <Separator className="kk-nav-drawer-sep" />
                          <ul className="kk-nav-drawer-list">
                            {accountItems.map((item) => {
                              const Icon = ACCOUNT_ICONS[item.id]
                              return (
                                <li key={item.id}>
                                  <Link
                                    to={item.to}
                                    className="kk-nav-drawer-link has-icon"
                                    aria-current={location.pathname === item.to ? 'page' : undefined}
                                    onClick={closeMenu}
                                  >
                                    <Icon size={18} aria-hidden />
                                    <span>{t(item.label)}{item.id === 'messages' && <MessageUnreadBadge />}</span>
                                  </Link>
                                </li>
                              )
                            })}
                          </ul>
                        </>
                      ) : null}
                    </nav>

                    <Separator className="kk-nav-drawer-sep" />

                    <div className="kk-nav-drawer-prefs">
                      <div className="kk-nav-drawer-pref">
                        <span className="kk-nav-drawer-pref-label">{t('lang.label')}</span>
                        <LanguageSwitcher />
                      </div>
                      <div className="kk-nav-drawer-pref">
                        <span className="kk-nav-drawer-pref-label">{t('theme.label')}</span>
                        <ThemeToggle />
                      </div>
                    </div>
                  </Drawer.Body>

                  <Drawer.Footer className="kk-nav-drawer-foot">
                    {user ? (
                      <Button variant="danger-soft" fullWidth onPress={handleLogout}>
                        <LogOut size={16} aria-hidden />
                        {t('nav.logout')}
                      </Button>
                    ) : (
                      <>
                        <Link
                          to="/login"
                          className={buttonVariants({ variant: 'outline', fullWidth: true })}
                          onClick={closeMenu}
                        >
                          {t('nav.login')}
                        </Link>
                        <Link
                          to="/register"
                          className={buttonVariants({ variant: 'primary', fullWidth: true })}
                          onClick={closeMenu}
                        >
                          {t('nav.register')}
                        </Link>
                      </>
                    )}
                  </Drawer.Footer>
                </Drawer.Dialog>
              </Drawer.Content>
            </Drawer.Backdrop>
          </Drawer>
        </div>
      </div>
    </header>
  )
}
