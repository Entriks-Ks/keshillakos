import { Link, NavLink } from 'react-router-dom'
import { Button } from '@heroui/react'
import { LayoutDashboard } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { getDashboardPath } from '../utils/dashboardPath'

export default function SiteNav() {
  const { user } = useAuth()

  return (
    <header className="tt-nav">
      <div className="tt-nav-inner">
        <Link to="/" className="brand brand-link tt-nav-brand">
          KëshillaKos
        </Link>
        <nav className="tt-nav-links" aria-label="Kryesore">
          <NavLink
            to="/ofertat"
            className={({ isActive }) => `tt-nav-offers${isActive ? ' is-active' : ''}`}
          >
            Ofertat
          </NavLink>
          <NavLink
            to="/rreth-nesh"
            className={({ isActive }) => `tt-nav-about${isActive ? ' is-active' : ''}`}
          >
            Rreth nesh
          </NavLink>
          {!user || user.role === 'user' ? <Link to="/register">Bëhu ofrues</Link> : null}
        </nav>
        <div className="tt-nav-actions">
          {user ? (
            <Button variant="primary" size="sm">
              <Link to={getDashboardPath(user.role)} className="tt-btn-link">
                <LayoutDashboard size={16} />
                Dashboard
              </Link>
            </Button>
          ) : (
            <>
              <Link className="tt-nav-login" to="/login">
                Hyr
              </Link>
              <Button variant="primary" size="sm">
                <Link to="/register" className="tt-btn-link">
                  Regjistrohu
                </Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
