import { useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { toast } from '@heroui/react'
import type { DashboardContext } from '../api/auth'
import { useAuth } from '../auth/AuthContext'
import { getErrorMessage } from '../utils/errors'
import { getDashboardPath, resolveActiveContext } from '../utils/dashboardPath'
import DashboardSidebar, { type ContextOption } from './DashboardSidebar'
import DashboardTopBar from './DashboardTopBar'
import { getDashboardNav, getMobilePrimaryNav } from './nav'
import './Dashboard.css'
import './DashboardNav.css'

export default function DashboardShell() {
  const { user, logout, switchContext } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const [switching, setSwitching] = useState(false)

  if (!user) return null

  const context = resolveActiveContext(user)
  const nav = getDashboardNav(context)
  const mobilePrimary = getMobilePrimaryNav(nav)
  const activePath = location.pathname === '/dashboard/profile/edit' ? '/dashboard/user/profile' : location.pathname
  const active = nav.find((item) =>
    item.end
      ? activePath === item.to
      : item.to !== '/' && activePath.startsWith(item.to),
  )
  const pageTitle = active?.label ?? 'Dashboard'
  const roles = user.roles ?? [user.role]
  const contextOptions: ContextOption[] | null =
    roles.includes('provider') || roles.includes('company')
      ? [
          { context: 'user', available: true },
          { context: 'provider', available: roles.includes('provider') },
          { context: 'company', available: roles.includes('company') },
        ]
      : null

  const closeMenu = () => setMenuOpen(false)

  async function onSwitchContext(next: DashboardContext) {
    if (next === context || switching) return
    setSwitching(true)
    try {
      await switchContext(next)
      setMenuOpen(false)
      navigate(getDashboardPath(next), { replace: true })
    } catch (err) {
      toast.danger(getErrorMessage(err))
    } finally {
      setSwitching(false)
    }
  }

  function handleLogout() {
    setMenuOpen(false)
    logout()
  }

  const sidebarProps = {
    role: context,
    nav,
    contextOptions,
    switching,
    onSwitchContext: (next: DashboardContext) => void onSwitchContext(next),
  }

  return (
    <div className="dash-layout" data-role={context}>
      <aside className="dsb-rail">
        <DashboardSidebar {...sidebarProps} />
      </aside>

      <div className="dash-body">
        <DashboardTopBar
          user={user}
          role={context}
          pageTitle={pageTitle}
          navigation={<DashboardSidebar {...sidebarProps} inDrawer onNavigate={closeMenu} />}
          menuOpen={menuOpen}
          onMenuOpenChange={setMenuOpen}
          showHome={!nav.some((item) => item.to === '/')}
          onLogout={handleLogout}
        />

        <main className="dash-main">
          <Outlet />
        </main>
      </div>

      <nav className="dash-bottom-nav" aria-label="Navigimi mobil">
        {mobilePrimary.map((item) => {
          const Icon = item.icon
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `dash-bottom-link${isActive ? ' is-active' : ''}`}
            >
              {({ isActive }) => (
                <>
                  <Icon size={20} strokeWidth={isActive ? 2.4 : 2} aria-hidden />
                  <span>{item.shortLabel || item.label}</span>
                </>
              )}
            </NavLink>
          )
        })}
      </nav>
    </div>
  )
}
