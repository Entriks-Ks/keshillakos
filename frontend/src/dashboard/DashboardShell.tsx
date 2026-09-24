import { useEffect, useId, useState } from 'react'
import { NavLink, Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { toast } from '@heroui/react'
import { Home, LogOut, MoreHorizontal, X } from 'lucide-react'
import type { DashboardContext } from '../api/auth'
import { mediaUrl } from '../api/media'
import { useAuth } from '../auth/AuthContext'
import { getErrorMessage } from '../utils/errors'
import { getDashboardPath, resolveActiveContext } from '../utils/dashboardPath'
import {
  getDashboardNav,
  getMobilePrimaryNav,
  groupDashboardNav,
  NAV_GROUP_LABELS,
  ROLE_HINTS,
  ROLE_LABELS,
  type DashNavItem,
} from './nav'
import './Dashboard.css'

export default function DashboardShell() {
  const { user, logout, switchContext } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [moreOpen, setMoreOpen] = useState(false)
  const [switching, setSwitching] = useState(false)
  const moreTitleId = useId()

  useEffect(() => {
    setMoreOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!moreOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMoreOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [moreOpen])

  if (!user) return null

  const context = resolveActiveContext(user)
  const shellRole = context === 'admin' ? 'admin' : context
  const nav = getDashboardNav(shellRole)
  const { main, manage, account } = groupDashboardNav(nav)
  const mobilePrimary = getMobilePrimaryNav(nav)
  const mobileMore = nav.filter((item) => !mobilePrimary.some((p) => p.to === item.to))
  const active = nav.find((item) =>
    item.end
      ? location.pathname === item.to
      : item.to !== '/' && location.pathname.startsWith(item.to),
  )
  const pageTitle = active?.label ?? 'Dashboard'
  const photo = mediaUrl(user.profilePhoto)
  const profileTo = `/dashboard/${shellRole === 'admin' ? 'admin' : shellRole}/profile`
  const isOverview = Boolean(active?.end && active.to.startsWith('/dashboard'))
  const roles = user.roles ?? [user.role]
  const showContextSwitch = roles.includes('provider') || roles.includes('company')
  const contextOptions: Array<{ context: DashboardContext; label: string; available: boolean }> = [
    { context: 'user', label: 'Përdorues privat', available: true },
    { context: 'provider', label: 'Ekspert', available: roles.includes('provider') },
    { context: 'company', label: 'Kompani', available: roles.includes('company') },
  ]

  async function onSwitchContext(next: DashboardContext) {
    if (next === context || switching) return
    setSwitching(true)
    try {
      await switchContext(next)
      navigate(getDashboardPath(next), { replace: true })
    } catch (err) {
      toast.danger(getErrorMessage(err))
    } finally {
      setSwitching(false)
    }
  }

  function isItemActive(item: DashNavItem) {
    if (item.end) return location.pathname === item.to
    if (item.to === '/') return location.pathname === '/'
    return location.pathname.startsWith(item.to)
  }

  function renderNavLink(item: DashNavItem, opts?: { compact?: boolean }) {
    const Icon = item.icon
    return (
      <NavLink
        key={item.to}
        to={item.to}
        end={item.end}
        className={({ isActive }) =>
          `dash-nav-link${isActive ? ' is-active' : ''}${opts?.compact ? ' is-compact' : ''}`
        }
      >
        <span className="dash-nav-icon" aria-hidden>
          <Icon size={opts?.compact ? 20 : 18} strokeWidth={2} />
        </span>
        <span className="dash-nav-label">{item.label}</span>
      </NavLink>
    )
  }

  return (
    <div className="dash-layout" data-role={shellRole}>
      <aside className="dash-sidebar">
        <div className="dash-sidebar-top">
          <Link to="/" className="brand brand-link dash-brand">
            KëshillaKos
          </Link>
          <span className="dash-role-badge">{ROLE_LABELS[shellRole]}</span>
        </div>

        {showContextSwitch ? (
          <label className="dash-context-switch">
            <span>Konteksti</span>
            <select
              value={context === 'admin' ? 'user' : context}
              disabled={switching}
              onChange={(e) => void onSwitchContext(e.target.value as DashboardContext)}
            >
              {contextOptions.map((item) => (
                <option key={item.context} value={item.context} disabled={!item.available}>
                  {item.label}{item.available ? '' : ' (krijo)'}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <nav className="dash-nav" aria-label="Navigimi i dashboard">
          <div className="dash-nav-group">
            <p className="dash-nav-group-label">{NAV_GROUP_LABELS.main}</p>
            {main.map((item) => renderNavLink(item))}
          </div>

          {manage.length > 0 ? (
            <div className="dash-nav-group">
              <p className="dash-nav-group-label">{NAV_GROUP_LABELS.manage}</p>
              {manage.map((item) => renderNavLink(item))}
            </div>
          ) : null}

          {account.length > 0 ? (
            <div className="dash-nav-group">
              <p className="dash-nav-group-label">{NAV_GROUP_LABELS.account}</p>
              {account.map((item) => renderNavLink(item))}
            </div>
          ) : null}
        </nav>

        <div className="dash-sidebar-foot">
          <Link to={profileTo} className="dash-user-chip">
            <div className="profile-avatar-sm" aria-hidden>
              {photo ? <img src={photo} alt="" /> : <span>{user.name.slice(0, 1)}</span>}
            </div>
            <div className="dash-user-meta">
              <strong>{user.name}</strong>
              <span>{user.email}</span>
            </div>
          </Link>
          <div className="dash-sidebar-actions">
            <Link to="/" className="dash-side-btn" title="Kthehu në faqen kryesore">
              <Home size={16} aria-hidden />
              Kryefaqja
            </Link>
            <button type="button" className="dash-side-btn is-danger" onClick={logout}>
              <LogOut size={16} aria-hidden />
              Dil
            </button>
          </div>
        </div>
      </aside>

      <div className="dash-body">
        <header className={`dash-topbar${isOverview ? ' is-overview' : ''}`}>
          <div className="dash-topbar-title">
            <p className="dashboard-kicker">{ROLE_LABELS[shellRole]}</p>
            <h1>{pageTitle}</h1>
            {!isOverview ? <p className="dash-topbar-hint">{ROLE_HINTS[shellRole]}</p> : null}
          </div>
          <div className="dash-topbar-actions">
            <Link to={profileTo} className="dash-topbar-user" title="Profili">
              <div className="profile-avatar-sm" aria-hidden>
                {photo ? <img src={photo} alt="" /> : <span>{user.name.slice(0, 1)}</span>}
              </div>
            </Link>
            <button type="button" className="dash-side-btn is-danger dash-logout-mobile" onClick={logout}>
              <LogOut size={16} aria-hidden />
              Dil
            </button>
          </div>
        </header>

        <main className="dash-main">
          <Outlet />
        </main>
      </div>

      <nav className="dash-bottom-nav" aria-label="Navigimi mobil">
        {mobilePrimary.map((item) => {
          const Icon = item.icon
          const activeItem = isItemActive(item)
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={`dash-bottom-link${activeItem ? ' is-active' : ''}`}
            >
              <Icon size={20} strokeWidth={activeItem ? 2.4 : 2} aria-hidden />
              <span>{item.shortLabel || item.label}</span>
            </NavLink>
          )
        })}
        {mobileMore.length > 0 ? (
          <button
            type="button"
            className={`dash-bottom-link${moreOpen || mobileMore.some(isItemActive) ? ' is-active' : ''}`}
            onClick={() => setMoreOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={moreOpen}
          >
            <MoreHorizontal size={20} aria-hidden />
            <span>Më shumë</span>
          </button>
        ) : null}
      </nav>

      {moreOpen ? (
        <div className="dash-more-overlay" role="presentation" onClick={() => setMoreOpen(false)}>
          <div
            className="dash-more-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby={moreTitleId}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="dash-more-head">
              <div>
                <p className="dashboard-kicker">{ROLE_LABELS[shellRole]}</p>
                <h2 id={moreTitleId}>Menu e plotë</h2>
              </div>
              <button
                type="button"
                className="dash-more-close"
                onClick={() => setMoreOpen(false)}
                aria-label="Mbyll"
              >
                <X size={18} />
              </button>
            </div>
            <div className="dash-more-grid">
              {mobileMore.map((item) => renderNavLink(item))}
            </div>
            <div className="dash-more-foot">
              <Link to="/" className="dash-side-btn" onClick={() => setMoreOpen(false)}>
                <Home size={16} aria-hidden />
                Kryefaqja
              </Link>
              <button type="button" className="dash-side-btn is-danger" onClick={logout}>
                <LogOut size={16} aria-hidden />
                Dil
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
