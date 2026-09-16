import { NavLink, Outlet, Link, useLocation } from 'react-router-dom'
import { Home, LogOut } from 'lucide-react'
import { mediaUrl } from '../api/auth'
import { useAuth } from '../auth/AuthContext'
import { getDashboardNav, groupDashboardNav, ROLE_LABELS } from './nav'

export default function DashboardShell() {
  const { user, logout } = useAuth()
  const location = useLocation()

  if (!user) return null

  const nav = getDashboardNav(user.role)
  const { main, account } = groupDashboardNav(nav)
  const active = nav.find((item) =>
    item.end
      ? location.pathname === item.to
      : item.to !== '/' && location.pathname.startsWith(item.to),
  )
  const pageTitle = active?.label ?? 'Dashboard'
  const photo = mediaUrl(user.profilePhoto)

  function renderNavLink(item: (typeof nav)[number]) {
    const Icon = item.icon
    return (
      <NavLink
        key={item.to}
        to={item.to}
        end={item.end}
        className={({ isActive }) => `dash-nav-link${isActive ? ' is-active' : ''}`}
      >
        <span className="dash-nav-icon" aria-hidden>
          <Icon size={18} strokeWidth={2} />
        </span>
        <span className="dash-nav-label">{item.label}</span>
      </NavLink>
    )
  }

  return (
    <div className="dash-layout">
      <aside className="dash-sidebar">
        <div className="dash-sidebar-top">
          <Link to="/" className="brand brand-link dash-brand">
            KëshillaKos
          </Link>
          <span className="dash-role-badge">{ROLE_LABELS[user.role]}</span>
        </div>

        <nav className="dash-nav" aria-label="Navigimi i dashboard">
          <div className="dash-nav-group">
            <p className="dash-nav-group-label">Menu</p>
            {main.map(renderNavLink)}
          </div>

          {account.length > 0 ? (
            <div className="dash-nav-group">
              <p className="dash-nav-group-label">Llogaria</p>
              {account.map(renderNavLink)}
            </div>
          ) : null}
        </nav>

        <div className="dash-sidebar-foot">
          <div className="dash-user-chip">
            <div className="profile-avatar-sm" aria-hidden>
              {photo ? <img src={photo} alt="" /> : <span>{user.name.slice(0, 1)}</span>}
            </div>
            <div className="dash-user-meta">
              <strong>{user.name}</strong>
              <span>{user.email}</span>
            </div>
          </div>
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
        <header className="dash-topbar">
          <div>
            <p className="dashboard-kicker">{ROLE_LABELS[user.role]}</p>
            <h1>{pageTitle}</h1>
          </div>
          <button type="button" className="dash-side-btn is-danger dash-logout-mobile" onClick={logout}>
            <LogOut size={16} aria-hidden />
            Dil
          </button>
        </header>

        <nav className="dash-mobile-nav" aria-label="Navigimi mobil">
          {nav.map(renderNavLink)}
        </nav>

        <main className="dash-main">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
