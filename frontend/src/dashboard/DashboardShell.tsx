import { NavLink, Outlet, Link, useLocation } from 'react-router-dom'
import { mediaUrl } from '../api/auth'
import { useAuth } from '../auth/AuthContext'
import { getDashboardNav, ROLE_LABELS } from './nav'
import type { UserRole } from '../api/auth'

export default function DashboardShell() {
  const { user, logout } = useAuth()
  const location = useLocation()

  if (!user) return null

  const section = location.pathname.split('/')[2] as UserRole
  const activeRole = (user.roles ?? [user.role]).includes(section) ? section : user.role
  const nav = getDashboardNav(activeRole)
  const active = nav.find((item) =>
    item.end
      ? location.pathname === item.to
      : item.to !== '/' && location.pathname.startsWith(item.to),
  )
  const pageTitle = active?.label ?? 'Dashboard'
  const photo = mediaUrl(user.profilePhoto)

  return (
    <div className="dash-layout">
      <aside className="dash-sidebar">
        <Link to="/" className="brand brand-link dash-brand">
          KëshillaKos
        </Link>
        <p className="dash-role">{ROLE_LABELS[activeRole]}</p>

        <nav className="dash-nav" aria-label="Navigimi i dashboard">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `dash-nav-link${isActive ? ' is-active' : ''}`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="dash-sidebar-foot">
          <div className="dash-user-chip">
            <div className="profile-avatar-sm" aria-hidden>
              {photo ? <img src={photo} alt="" /> : <span>{user.name.slice(0, 1)}</span>}
            </div>
            <div>
              <strong>{user.name}</strong>
              <span>{user.email}</span>
            </div>
          </div>
          <button type="button" className="ghost dash-logout" onClick={logout}>
            Dil
          </button>
        </div>
      </aside>

      <div className="dash-body">
        <header className="dash-topbar">
          <div>
            <p className="dashboard-kicker">{ROLE_LABELS[activeRole]}</p>
            <h1>{pageTitle}</h1>
          </div>
          <button type="button" className="ghost dash-logout-mobile" onClick={logout}>
            Dil
          </button>
        </header>

        <nav className="dash-mobile-nav" aria-label="Navigimi mobil">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `dash-nav-link${isActive ? ' is-active' : ''}`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <main className="dash-main">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
