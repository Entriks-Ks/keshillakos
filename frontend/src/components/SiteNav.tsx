import { useState } from 'react'
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
import { useAuth } from '../auth/AuthContext'
import { ROLE_LABELS } from '../dashboard/nav'
import { resolveActiveContext } from '../utils/dashboardPath'
import {
  MARKETPLACE_LINKS,
  activeMarketplaceLink,
  getAccountMenu,
  userDisplayName,
  type AccountMenuId,
} from '../utils/siteNavMenu'
import ProfileAvatar from './ProfileAvatar'
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
  return context === 'user' ? 'Përdorues privat' : ROLE_LABELS[context]
}

function AccountMenu({ user, onLogout }: { user: AuthUser; onLogout: () => void }) {
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
              <Dropdown.Item key={item.id} id={item.id} href={item.to} textValue={item.label}>
                <Icon size={16} aria-hidden className="kk-nav-menu-icon" />
                <Label>{item.label}</Label>
              </Dropdown.Item>
            )
          })}
          <Dropdown.Item id="logout" textValue="Dil" variant="danger" onAction={onLogout}>
            <LogOut size={16} aria-hidden className="kk-nav-menu-icon" />
            <Label>Dil</Label>
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  )
}

export default function SiteNav() {
  const { user, loading, logout } = useAuth()
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
        <Link to="/" className="kk-nav-brand" aria-label="KëshillaKos, faqja kryesore">
          KëshillaKos
        </Link>

        <nav className="kk-nav-center" aria-label="Kryesore">
          <ul className="kk-nav-links">
            {MARKETPLACE_LINKS.map((link) => (
              <li key={link.id}>
                <Link
                  to={link.to}
                  className="kk-nav-link"
                  aria-current={active === link.id ? 'page' : undefined}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="kk-nav-actions">
          {loading ? (
            <span className="kk-nav-pending" aria-hidden />
          ) : user ? (
            <AccountMenu user={user} onLogout={handleLogout} />
          ) : (
            <div className="kk-nav-guest">
              <Link to="/login" className={`${buttonVariants({ variant: 'ghost', size: 'sm' })} kk-nav-login`}>
                Hyr
              </Link>
              <Link to="/register" className={`${buttonVariants({ variant: 'primary', size: 'sm' })} kk-nav-cta`}>
                Regjistrohu
              </Link>
            </div>
          )}

          <Drawer isOpen={menuOpen} onOpenChange={setMenuOpen}>
            <Button
              isIconOnly
              variant="ghost"
              size="sm"
              className="kk-nav-toggle"
              aria-label={menuOpen ? 'Mbyll menunë' : 'Hap menunë'}
              aria-expanded={menuOpen}
            >
              <Menu size={20} aria-hidden />
            </Button>
            <Drawer.Backdrop className="kk-nav-drawer-backdrop">
              <Drawer.Content placement="right" className="kk-nav-drawer">
                <Drawer.Dialog aria-label="Menuja kryesore" className="kk-nav-drawer-dialog">
                  <Drawer.Header className="kk-nav-drawer-head">
                    <Link to="/" className="kk-nav-brand" onClick={closeMenu}>
                      KëshillaKos
                    </Link>
                    <Drawer.CloseTrigger aria-label="Mbyll menunë" />
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

                    <nav aria-label="Menuja mobile">
                      <ul className="kk-nav-drawer-list">
                        {MARKETPLACE_LINKS.map((link) => (
                          <li key={link.id}>
                            <Link
                              to={link.to}
                              className="kk-nav-drawer-link"
                              aria-current={active === link.id ? 'page' : undefined}
                              onClick={closeMenu}
                            >
                              {link.label}
                            </Link>
                          </li>
                        ))}
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
                                    {item.label}
                                  </Link>
                                </li>
                              )
                            })}
                          </ul>
                        </>
                      ) : null}
                    </nav>
                  </Drawer.Body>

                  <Drawer.Footer className="kk-nav-drawer-foot">
                    {user ? (
                      <Button variant="danger-soft" fullWidth onPress={handleLogout}>
                        <LogOut size={16} aria-hidden />
                        Dil
                      </Button>
                    ) : (
                      <>
                        <Link
                          to="/login"
                          className={buttonVariants({ variant: 'outline', fullWidth: true })}
                          onClick={closeMenu}
                        >
                          Hyr
                        </Link>
                        <Link
                          to="/register"
                          className={buttonVariants({ variant: 'primary', fullWidth: true })}
                          onClick={closeMenu}
                        >
                          Regjistrohu
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
