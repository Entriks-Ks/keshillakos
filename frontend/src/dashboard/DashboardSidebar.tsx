import { Link, NavLink, useLocation } from 'react-router-dom'
import { Dropdown, Label, Separator } from '@heroui/react'
import { Check, ChevronsUpDown } from 'lucide-react'
import type { DashboardContext, UserRole } from '../api/auth'
import { CONTEXT_LABELS, groupDashboardNav, NAV_GROUP_LABELS, type DashNavItem } from './nav'

export type ContextOption = { context: DashboardContext; available: boolean }

type DashboardSidebarProps = {
  role: UserRole
  nav: DashNavItem[]
  /** Present only when the account can switch between dashboard contexts. */
  contextOptions: ContextOption[] | null
  switching: boolean
  onSwitchContext: (next: DashboardContext) => void
  /** Called after any navigation so the mobile drawer can close. */
  onNavigate?: () => void
  /** The mobile drawer renders its own header with the brand and close button. */
  inDrawer?: boolean
}

function SidebarLink({ item, onNavigate }: { item: DashNavItem; onNavigate?: () => void }) {
  const Icon = item.icon
  const location = useLocation()
  const isPrivateEdit = location.pathname === '/dashboard/profile/edit' && item.to === '/dashboard/user/profile'
  return (
    <li>
      <NavLink
        to={item.to}
        end={item.end}
        className={({ isActive }) => `dsb-link${isActive || isPrivateEdit ? ' is-active' : ''}`}
        onClick={onNavigate}
      >
        <Icon size={18} strokeWidth={2} aria-hidden />
        <span>{item.label}</span>
      </NavLink>
    </li>
  )
}

function ContextSwitch({
  role,
  options,
  switching,
  onSwitch,
}: {
  role: UserRole
  options: ContextOption[]
  switching: boolean
  onSwitch: (next: DashboardContext) => void
}) {
  const current: DashboardContext = role === 'admin' ? 'user' : role
  const unavailable = options.filter((option) => !option.available).map((option) => option.context)

  return (
    <Dropdown>
      <Dropdown.Trigger className="dsb-context" isDisabled={switching} aria-label="Ndrysho kontekstin e dashboard">
        <span className="dsb-context-meta">
          <span className="dsb-context-label">Konteksti</span>
          <span className="dsb-context-value">{CONTEXT_LABELS[role]}</span>
        </span>
        <ChevronsUpDown size={16} aria-hidden className="dsb-context-caret" />
      </Dropdown.Trigger>
      <Dropdown.Popover placement="bottom start" className="dsb-context-popover">
        <Dropdown.Menu
          aria-label="Konteksti i dashboard"
          disabledKeys={unavailable}
          onAction={(key) => onSwitch(key as DashboardContext)}
        >
          {options.map((option) => (
            <Dropdown.Item key={option.context} id={option.context} textValue={CONTEXT_LABELS[option.context]}>
              <Label>{CONTEXT_LABELS[option.context]}</Label>
              {option.context === current ? (
                <Check size={16} aria-hidden className="dsb-context-check" />
              ) : !option.available ? (
                <span className="dsb-context-note">Jo aktiv</span>
              ) : null}
            </Dropdown.Item>
          ))}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  )
}

export default function DashboardSidebar({
  role,
  nav,
  contextOptions,
  switching,
  onSwitchContext,
  onNavigate,
  inDrawer = false,
}: DashboardSidebarProps) {
  const { main, manage, account } = groupDashboardNav(nav)

  return (
    <div className={`dsb${inDrawer ? ' is-drawer' : ''}`}>
      <div className="dsb-head">
        {inDrawer ? null : (
          <Link to="/" className="brand brand-link dsb-brand" aria-label="KëshillaKos, faqja kryesore">
            KëshillaKos
          </Link>
        )}
        {contextOptions ? (
          <ContextSwitch role={role} options={contextOptions} switching={switching} onSwitch={onSwitchContext} />
        ) : (
          <div className="dsb-context is-static">
            <span className="dsb-context-meta">
              <span className="dsb-context-label">Konteksti</span>
              <span className="dsb-context-value">{CONTEXT_LABELS[role]}</span>
            </span>
          </div>
        )}
      </div>

      <nav className="dsb-nav" aria-label="Navigimi i dashboard">
        <ul className="dsb-list">
          {main.map((item) => (
            <SidebarLink key={item.to} item={item} onNavigate={onNavigate} />
          ))}
        </ul>
        {manage.length > 0 ? (
          <>
            <p className="dsb-group-label">{NAV_GROUP_LABELS.manage}</p>
            <ul className="dsb-list">
              {manage.map((item) => (
                <SidebarLink key={item.to} item={item} onNavigate={onNavigate} />
              ))}
            </ul>
          </>
        ) : null}
      </nav>

      {account.length > 0 ? (
        <nav className="dsb-foot" aria-label={NAV_GROUP_LABELS.account}>
          <Separator />
          <ul className="dsb-list is-secondary">
            {account.map((item) => (
              <SidebarLink key={item.to} item={item} onNavigate={onNavigate} />
            ))}
          </ul>
        </nav>
      ) : null}
    </div>
  )
}
