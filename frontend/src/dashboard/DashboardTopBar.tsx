import type { ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button, Drawer, Dropdown, Label, Tooltip } from '@heroui/react'
import { ChevronDown, ExternalLink, Home, LogOut, Menu } from 'lucide-react'
import type { AuthUser, UserRole } from '../api/auth'
import ProfileAvatar from '../components/ProfileAvatar'
import { providerPath } from '../utils/publicPaths'
import { userDisplayName } from '../utils/siteNavMenu'
import { CONTEXT_LABELS } from './nav'

type DashboardTopBarProps = {
  user: AuthUser
  role: UserRole
  pageTitle: string
  /** Sidebar content rendered inside the mobile drawer. */
  navigation: ReactNode
  menuOpen: boolean
  onMenuOpenChange: (open: boolean) => void
  /** Hidden when the role navigation already links to the homepage. */
  showHome: boolean
  onLogout: () => void
}

function AccountMenu({ user, role, onLogout }: { user: AuthUser; role: UserRole; onLogout: () => void }) {
  const displayName = userDisplayName(user)
  const shortName = displayName.split(' ')[0]
  const publicProfile = role === 'provider' || role === 'company' ? providerPath(user) : null

  return (
    <Dropdown>
      <Dropdown.Trigger
        className="dtb-account"
        aria-label={displayName ? `Llogaria: ${displayName}` : 'Llogaria ime'}
      >
        <ProfileAvatar src={user.profilePhoto} seed={user.uid} alt="" size="sm" />
        {shortName ? <span className="dtb-account-name">{shortName}</span> : null}
        <ChevronDown size={16} aria-hidden className="dtb-account-caret" />
      </Dropdown.Trigger>
      <Dropdown.Popover placement="bottom end" className="dtb-popover">
        <div className="dtb-account-head">
          <ProfileAvatar src={user.profilePhoto} seed={user.uid} alt="" size="md" />
          <div className="dtb-account-meta">
            <strong>{displayName || user.email}</strong>
            {displayName ? <span>{user.email}</span> : null}
            <span className="dtb-account-role">{CONTEXT_LABELS[role]}</span>
          </div>
        </div>
        <Dropdown.Menu aria-label="Menuja e llogarisë">
          {publicProfile ? (
            <Dropdown.Item id="public-profile" href={publicProfile} textValue="Shiko profilin publik">
              <ExternalLink size={16} aria-hidden className="dtb-menu-icon" />
              <Label>Shiko profilin publik</Label>
            </Dropdown.Item>
          ) : null}
          <Dropdown.Item id="logout" textValue="Dil" variant="danger" onAction={onLogout}>
            <LogOut size={16} aria-hidden className="dtb-menu-icon" />
            <Label>Dil</Label>
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  )
}

export default function DashboardTopBar({
  user,
  role,
  pageTitle,
  navigation,
  menuOpen,
  onMenuOpenChange,
  showHome,
  onLogout,
}: DashboardTopBarProps) {
  const navigate = useNavigate()

  return (
    <header className="dtb">
      <div className="dtb-start">
        <Drawer isOpen={menuOpen} onOpenChange={onMenuOpenChange}>
          <Button
            isIconOnly
            variant="ghost"
            className="dtb-menu"
            aria-label={menuOpen ? 'Mbyll menunë' : 'Hap menunë'}
            aria-expanded={menuOpen}
          >
            <Menu size={20} aria-hidden />
          </Button>
          <Drawer.Backdrop>
            <Drawer.Content placement="left">
              <Drawer.Dialog aria-label="Navigimi i dashboard" className="dtb-drawer-dialog">
                <Drawer.Header className="dtb-drawer-head">
                  <Link
                    to="/"
                    className="brand brand-link dsb-brand"
                    aria-label="KëshillaKos, faqja kryesore"
                    onClick={() => onMenuOpenChange(false)}
                  >
                    KëshillaKos
                  </Link>
                  <Drawer.CloseTrigger aria-label="Mbyll menunë" />
                </Drawer.Header>
                <Drawer.Body className="dtb-drawer-body">{navigation}</Drawer.Body>
              </Drawer.Dialog>
            </Drawer.Content>
          </Drawer.Backdrop>
        </Drawer>

        <div className="dtb-title">
          <span className="dtb-kicker">{CONTEXT_LABELS[role]}</span>
          <p className="dtb-page">{pageTitle}</p>
        </div>
      </div>

      <div className="dtb-end">
        {showHome ? (
          <Tooltip delay={400}>
            <Button
              isIconOnly
              variant="ghost"
              className="dtb-icon"
              aria-label="Kthehu në faqen kryesore"
              onPress={() => navigate('/')}
            >
              <Home size={19} aria-hidden />
            </Button>
            <Tooltip.Content placement="bottom">Kthehu në faqen kryesore</Tooltip.Content>
          </Tooltip>
        ) : null}
        <AccountMenu user={user} role={role} onLogout={onLogout} />
      </div>
    </header>
  )
}
