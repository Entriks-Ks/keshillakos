import MessageUnreadBadge from '../chat/MessageUnreadBadge'
import { useTranslation } from 'react-i18next'
import { useNotifications } from '../notifications/NotificationProvider'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { Dropdown, Label, Separator } from '@heroui/react'
import { Check, ChevronsUpDown } from 'lucide-react'
import type { DashboardContext, UserRole } from '../api/auth'
import LanguageSwitcher from '../components/LanguageSwitcher'
import ThemeToggle from '../components/ThemeToggle'
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
  const { t } = useTranslation()
  const Icon = item.icon
  const location = useLocation()
  const { messageUnreadCount } = useNotifications()
  const isMessages = item.to.endsWith('/messages')
  const hasUnread = isMessages && messageUnreadCount > 0
  const isPrivateEdit = location.pathname === '/dashboard/profile/edit' && item.to === '/dashboard/user/profile'
  return (
    <li>
      <NavLink
        to={item.to}
        end={item.end}
        className={({ isActive }) => `dsb-link${isActive || isPrivateEdit ? ' is-active' : ''}${hasUnread ? ' has-unread' : ''}`}
        onClick={onNavigate}
      >
        <Icon size={18} strokeWidth={2} aria-hidden />
        <span>{t(item.label)}</span>
        {isMessages && <MessageUnreadBadge />}
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
  const { t } = useTranslation()
  const current: DashboardContext = role === 'admin' ? 'user' : role
  const unavailable = options.filter((option) => !option.available).map((option) => option.context)

  return (
    <Dropdown>
      <Dropdown.Trigger className="dsb-context" isDisabled={switching} aria-label={t('dash.switchContext')}>
        <span className="dsb-context-meta">
          <span className="dsb-context-label">{t('dash.context')}</span>
          <span className="dsb-context-value">{t(CONTEXT_LABELS[role])}</span>
        </span>
        <ChevronsUpDown size={16} aria-hidden className="dsb-context-caret" />
      </Dropdown.Trigger>
      <Dropdown.Popover placement="bottom start" className="dsb-context-popover">
        <Dropdown.Menu
          aria-label={t('dash.contextMenu')}
          disabledKeys={unavailable}
          onAction={(key) => onSwitch(key as DashboardContext)}
        >
          {options.map((option) => (
            <Dropdown.Item key={option.context} id={option.context} textValue={t(CONTEXT_LABELS[option.context])}>
              <Label>{t(CONTEXT_LABELS[option.context])}</Label>
              {option.context === current ? (
                <Check size={16} aria-hidden className="dsb-context-check" />
              ) : !option.available ? (
                <span className="dsb-context-note">{t('dash.inactive')}</span>
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
  const { t } = useTranslation()
  const { main, manage, account } = groupDashboardNav(nav)

  return (
    <div className={`dsb${inDrawer ? ' is-drawer' : ''}`}>
      <div className="dsb-head">
        {inDrawer ? null : (
          <Link to="/" className="brand brand-link dsb-brand" aria-label={t('dash.homeAria')}>
            <span className="dsb-mark" aria-hidden>K</span>
            <span>KLAW</span>
          </Link>
        )}
        {contextOptions ? (
          <ContextSwitch role={role} options={contextOptions} switching={switching} onSwitch={onSwitchContext} />
        ) : (
          <div className="dsb-context is-static">
            <span className="dsb-context-meta">
              <span className="dsb-context-label">{t('dash.context')}</span>
              <span className="dsb-context-value">{t(CONTEXT_LABELS[role])}</span>
            </span>
          </div>
        )}
      </div>

      <nav className="dsb-nav" aria-label={t('dash.nav')}>
        <ul className="dsb-list">
          {main.map((item) => (
            <SidebarLink key={item.to} item={item} onNavigate={onNavigate} />
          ))}
        </ul>
        {manage.length > 0 ? (
          <>
            <p className="dsb-group-label">{t(NAV_GROUP_LABELS.manage)}</p>
            <ul className="dsb-list">
              {manage.map((item) => (
                <SidebarLink key={item.to} item={item} onNavigate={onNavigate} />
              ))}
            </ul>
          </>
        ) : null}
      </nav>

      {account.length > 0 ? (
        <nav className="dsb-foot" aria-label={t(NAV_GROUP_LABELS.account)}>
          <Separator />
          <ul className="dsb-list is-secondary">
            {account.map((item) => (
              <SidebarLink key={item.to} item={item} onNavigate={onNavigate} />
            ))}
          </ul>
        </nav>
      ) : null}

      {inDrawer ? (
        <div className="dsb-drawer-prefs">
          <Separator />
          <div className="dsb-drawer-prefs-body">
            <div className="dsb-drawer-pref">
              <span className="dsb-drawer-pref-label">{t('lang.label')}</span>
              <LanguageSwitcher />
            </div>
            <div className="dsb-drawer-pref">
              <span className="dsb-drawer-pref-label">{t('theme.label')}</span>
              <ThemeToggle />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
