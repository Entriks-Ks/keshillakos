import MessageNavButton from '../chat/MessageNavButton'
import MessageUnreadBadge from '../chat/MessageUnreadBadge'
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FocusEvent, type PointerEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation } from 'react-router-dom'
import { Button, Drawer, Dropdown, Label, Separator, buttonVariants } from '@heroui/react'
import {
  ArrowRight,
  Briefcase,
  ChevronDown,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageCircle,
  Settings,
  Sparkles,
  UserRound,
  Users,
  type LucideIcon,
} from 'lucide-react'
import type { AuthUser } from '../api/auth'
import ThemeToggle from './ThemeToggle'
import LanguageSwitcher from './LanguageSwitcher'
import { useAuth } from '../auth/AuthContext'
import { useCompareLawyers } from '../hooks/useCompareLawyers'
import { LogoMark } from './Logo'
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

const SCROLL_THRESHOLD = 12

type IndicatorState = { x: number; width: number; visible: boolean; instant: boolean }

function useScrolled() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const update = () => setScrolled(window.scrollY > SCROLL_THRESHOLD)
    update()
    window.addEventListener('scroll', update, { passive: true })
    return () => window.removeEventListener('scroll', update)
  }, [])

  return scrolled
}

/** Pill that glides under the hovered/focused link and rests on the active one. */
function useLinkIndicator(resetKey: string) {
  const listRef = useRef<HTMLUListElement>(null)
  const [indicator, setIndicator] = useState<IndicatorState>({ x: 0, width: 0, visible: false, instant: true })

  const moveTo = useCallback((link: HTMLElement | null) => {
    // Links collapse to zero width while the mobile layout hides them; treat that as "no target".
    const target = link && link.dataset.indicator !== 'off' && link.offsetWidth > 0 ? link : null
    const x = target?.offsetLeft ?? 0
    const width = target?.offsetWidth ?? 0
    setIndicator((prev) => {
      if (!target) return prev.visible ? { ...prev, visible: false } : prev
      return { x, width, visible: true, instant: !prev.visible }
    })
  }, [])

  const reset = useCallback(() => {
    moveTo(listRef.current?.querySelector<HTMLElement>('.kk-nav-link[aria-current="page"]') ?? null)
  }, [moveTo])

  useLayoutEffect(() => {
    reset()
    const list = listRef.current
    const observer = list && typeof ResizeObserver !== 'undefined' ? new ResizeObserver(reset) : null
    if (list) observer?.observe(list)
    window.addEventListener('resize', reset)
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', reset)
    }
  }, [reset, resetKey])

  const track = (event: PointerEvent<HTMLElement> | FocusEvent<HTMLElement>) => {
    const link = (event.target as HTMLElement).closest<HTMLElement>('.kk-nav-link')
    if (link) moveTo(link)
  }

  return {
    listRef,
    indicator,
    listProps: { onPointerOver: track, onFocus: track, onPointerLeave: reset, onBlur: reset },
  }
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
  const scrolled = useScrolled()
  const { listRef, indicator, listProps } = useLinkIndicator(
    `${location.pathname}${location.search}|${compareCount}|${i18n.language}`,
  )
  const active = activeMarketplaceLink(location.pathname, location.search)
  const accountItems = user ? getAccountMenu(user) : []
  const closeMenu = () => setMenuOpen(false)

  function handleLogout() {
    setMenuOpen(false)
    logout()
  }

  return (
    <header className={scrolled ? 'kk-nav is-scrolled' : 'kk-nav'}>
      <div className="tt-nav-inner kk-nav-inner">
        <Link to="/" className="kk-nav-brand" aria-label={t('nav.home')}>
          <span className="kk-nav-brand-mark">
            <LogoMark size={34} />
          </span>
          <span>keshillohu</span>
        </Link>

        <nav className="kk-nav-center" aria-label={t('nav.main')}>
          <ul ref={listRef} className="kk-nav-links" {...listProps}>
            <li
              className="kk-nav-indicator"
              aria-hidden="true"
              data-visible={indicator.visible || undefined}
              data-instant={indicator.instant || undefined}
              style={{ width: indicator.width, transform: `translateX(${indicator.x}px)` }}
            />
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
            <li className="kk-nav-ai-item">
              <Link
                to="/ai-asistenti"
                className="kk-nav-link kk-nav-link-ai"
                data-indicator="off"
                aria-current={location.pathname === '/ai-asistenti' ? 'page' : undefined}
              >
                <Sparkles size={14} className="kk-nav-ai-icon" aria-hidden />
                <span className="kk-nav-ai-label">Këshilla AI</span>
              </Link>
            </li>
          </ul>
        </nav>

        <div className="kk-nav-actions">
          <div className="kk-nav-actions-desktop">
            <LanguageSwitcher />
            <ThemeToggle />
          </div>

          <span className="kk-nav-divider" aria-hidden />

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
              <Link to="/login" className="kk-nav-login">
                {t('nav.login')}
              </Link>
              <Link to="/register" className="kk-nav-cta">
                <span>{t('nav.register')}</span>
                <ArrowRight size={15} aria-hidden className="kk-nav-cta-arrow" />
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
                      <LogoMark size={34} />
                      <span>keshillohu</span>
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
                            className="kk-nav-drawer-link kk-nav-drawer-link-ai"
                            aria-current={location.pathname === '/ai-asistenti' ? 'page' : undefined}
                            onClick={closeMenu}
                          >
                            <Sparkles size={18} aria-hidden />
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
