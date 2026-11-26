import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router-dom'
import { Button, buttonVariants, Card, Chip, Label, Separator, Switch, toast } from '@heroui/react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import ProfileAvatar from '../components/ProfileAvatar'
import { readSessionSignIn } from '../utils/authSession'
import { getDashboardPath, resolveActiveContext } from '../utils/dashboardPath'
import { getErrorMessage } from '../utils/errors'
import { userDisplayName } from '../utils/siteNavMenu'
import AccountRequestModal, { type AccountRequestKind } from './AccountRequestModal'
import ChangePasswordModal from './ChangePasswordModal'
import { CONTEXT_LABELS } from './nav'
import { SettingsRow, SettingsSection } from './SettingsSection'
import { routePath } from '../routes/routeMap'
import './UserOverview.css'

type SectionId = 'account' | 'security' | 'privacy' | 'delete'

const SECTIONS: Array<{ id: SectionId; label: string; hint: string; danger?: boolean }> = [
  { id: 'account', label: 'auth.account', hint: 'settings.accountHint' },
  { id: 'security', label: 'auth.security', hint: 'settings.securityHint' },
  { id: 'privacy', label: 'footer.privacy', hint: 'settings.privacyHint' },
  { id: 'delete', label: 'settings.deleteTitle', hint: 'settings.deleteHint', danger: true },
]

const editLink = buttonVariants({ variant: 'outline', size: 'sm' })

function isSectionId(value: string | null): value is SectionId {
  return SECTIONS.some((section) => section.id === value)
}

function SettingsNav({ active }: { active: SectionId }) {
  const { t } = useTranslation()
  const regular = SECTIONS.filter((section) => !section.danger)
  const danger = SECTIONS.filter((section) => section.danger)

  function renderItem(section: (typeof SECTIONS)[number]) {
    const isActive = section.id === active
    return (
      <li key={section.id}>
        <Link
          to={{ search: `?section=${section.id}` }}
          className={`st-nav-link${isActive ? ' is-active' : ''}${section.danger ? ' is-danger' : ''}`}
          aria-current={isActive ? 'page' : undefined}
        >
          <span className="st-nav-copy">
            <span className="st-nav-label">{t(section.label)}</span>
            <span className="st-nav-hint">{t(section.hint)}</span>
          </span>
          <ChevronRight size={18} aria-hidden className="st-nav-chevron" />
        </Link>
      </li>
    )
  }

  return (
    <Card className="st-nav">
      <nav aria-label={t('settings.navLabel')}>
        <ul className="st-nav-list">{regular.map(renderItem)}</ul>
        <Separator className="st-nav-sep" />
        <ul className="st-nav-list">{danger.map(renderItem)}</ul>
      </nav>
    </Card>
  )
}

export function SettingsPage() {
  const { t } = useTranslation()
  const { user, updateProfile } = useAuth()
  const [searchParams] = useSearchParams()
  const [passwordOpen, setPasswordOpen] = useState(false)
  const [accountRequest, setAccountRequest] = useState<AccountRequestKind | null>(null)
  const [pendingConsent, setPendingConsent] = useState<boolean | null>(null)

  if (!user) return null

  const requested = searchParams.get('section')
  /** On mobile the category list is shown until a section is chosen; desktop falls back to Llogaria. */
  const hasSection = isSectionId(requested)
  const active: SectionId = hasSection ? requested : 'account'

  const profileTo = `${getDashboardPath(resolveActiveContext(user))}/profile`
  const displayName = userDisplayName(user) || user.name
  const roles = user.roles ?? [user.role]
  const session = readSessionSignIn()
  const signedInWithGoogle = session?.provider === 'google.com'
  const googleLinked = Boolean(session?.linked.includes('google.com'))
  const consent = pendingConsent ?? user.privacy?.marketingConsent ?? false

  async function onConsentChange(next: boolean) {
    setPendingConsent(next)
    try {
      await updateProfile({ marketingConsent: next })
      toast.success(next ? t('settings.marketingOn') : t('settings.marketingOff'))
    } catch (err) {
      toast.danger(getErrorMessage(err))
    } finally {
      setPendingConsent(null)
    }
  }

  return (
    <div className="st">
      <header className="uo-head">
        <div className="uo-head-copy">
          <h1>{t('dash.settings')}</h1>
          <p>{t('settings.lead')}</p>
        </div>
      </header>

      <div className={`st-layout${hasSection ? ' has-section' : ''}`}>
        <SettingsNav active={active} />

        <div className="st-content">
          <Link to={{ search: '' }} className="st-back">
            <ChevronLeft size={18} aria-hidden />
            {t('settings.back')}
          </Link>

          {active === 'account' ? (
            <SettingsSection
              id="llogaria"
              title={t('auth.account')}
              description={t('settings.accountDesc')}
            >
              <SettingsRow
                leading={<ProfileAvatar src={user.profilePhoto} seed={user.uid} size={44} alt="" />}
                label={t('settings.photo')}
                value={user.profilePhoto ? t('settings.uploaded') : <span className="st-muted">{t('settings.notAdded')}</span>}
                action={
                  <Link to={profileTo} className={editLink}>
                    {user.profilePhoto ? t('settings.change') : t('settings.add')}
                  </Link>
                }
              />
              <SettingsRow
                label={t('settings.fullName')}
                value={displayName}
                action={
                  <Link to={profileTo} className={editLink}>
                    {t('settings.change')}
                  </Link>
                }
              />
              <SettingsRow
                label={t('req.email')}
                value={user.email}
                description={t('settings.emailDesc')}
              />
              <SettingsRow
                label={t('settings.phone')}
                value={user.phone || <span className="st-muted">{t('settings.notAdded')}</span>}
                action={
                  <Link to={profileTo} className={editLink}>
                    {user.phone ? t('settings.change') : t('settings.add')}
                  </Link>
                }
              />
              <SettingsRow
                label={t('settings.profiles')}
                value={
                  <span className="st-chips">
                    {roles.map((role) => (
                      <Chip key={role} size="sm" variant="soft" color={role === 'user' ? 'default' : 'accent'}>
                        <Chip.Label>{t(CONTEXT_LABELS[role])}</Chip.Label>
                      </Chip>
                    ))}
                  </span>
                }
              />
            </SettingsSection>
          ) : null}

          {active === 'security' ? (
            <SettingsSection id="siguria" title={t('auth.security')} description={t('settings.securityDesc')}>
              <SettingsRow
                label={t('auth.password')}
                value={signedInWithGoogle ? undefined : '••••••••'}
                description={
                  signedInWithGoogle
                    ? t('settings.passwordGoogle')
                    : t('settings.passwordHint')
                }
                action={
                  signedInWithGoogle ? null : (
                    <Button variant="outline" size="sm" onPress={() => setPasswordOpen(true)}>
                      {t('settings.changePassword')}
                    </Button>
                  )
                }
              />
              {session ? (
                <SettingsRow
                  label={t('settings.google')}
                  value={
                    <Chip size="sm" variant="soft" color={googleLinked ? 'success' : 'default'}>
                      <Chip.Label>{googleLinked ? t('settings.linked') : t('settings.notLinked')}</Chip.Label>
                    </Chip>
                  }
                  description={
                    googleLinked
                      ? signedInWithGoogle
                        ? t('settings.googleSession')
                        : t('settings.googleAvailable')
                      : t('settings.emailOnly')
                  }
                />
              ) : null}
            </SettingsSection>
          ) : null}

          {active === 'privacy' ? (
            <SettingsSection
              id="privatesia"
              title={t('footer.privacy')}
              description={t('settings.privacyDesc')}
            >
              <SettingsRow
                label={t('settings.marketing')}
                description={t('settings.marketingDesc')}
                action={
                  <Switch
                    isSelected={consent}
                    isDisabled={pendingConsent !== null}
                    onChange={(next) => void onConsentChange(next)}
                  >
                    <Switch.Content>
                      <Switch.Control>
                        <Switch.Thumb />
                      </Switch.Control>
                      <Label className="st-sr-only">{t('settings.marketing')}</Label>
                    </Switch.Content>
                  </Switch>
                }
              />
              <SettingsRow
                label={t('settings.dataCopy')}
                description={t('settings.dataCopyDesc')}
                action={
                  <Button variant="outline" size="sm" onPress={() => setAccountRequest('export')}>
                    {t('settings.requestCopy')}
                  </Button>
                }
              />
              <SettingsRow
                label={t('settings.policy')}
                description={t('settings.policyDesc')}
                action={
                  <Link to={routePath('privacy')} className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
                    {t('settings.readPolicy')}
                  </Link>
                }
              />
            </SettingsSection>
          ) : null}

          {active === 'delete' ? (
            <SettingsSection
              id="fshirja"
              title={t('settings.deleteTitle')}
              description={t('settings.deleteDesc')}
              tone="danger"
            >
              <SettingsRow
                label={t('settings.deleteAccount')}
                description={t('settings.deleteAccountDesc')}
                action={
                  <Button variant="danger-soft" size="sm" onPress={() => setAccountRequest('deletion')}>
                    {t('settings.requestDeletion')}
                  </Button>
                }
              />
            </SettingsSection>
          ) : null}
        </div>
      </div>

      <ChangePasswordModal isOpen={passwordOpen} onOpenChange={setPasswordOpen} />
      <AccountRequestModal kind={accountRequest} user={user} onClose={() => setAccountRequest(null)} />
    </div>
  )
}
