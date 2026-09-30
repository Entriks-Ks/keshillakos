import { useState } from 'react'
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
import './UserOverview.css'

type SectionId = 'account' | 'security' | 'privacy' | 'delete'

const SECTIONS: Array<{ id: SectionId; label: string; hint: string; danger?: boolean }> = [
  { id: 'account', label: 'Llogaria', hint: 'Fotoja, emri, email-i dhe telefoni' },
  { id: 'security', label: 'Siguria', hint: 'Fjalëkalimi dhe hyrja me Google' },
  { id: 'privacy', label: 'Privatësia', hint: 'Pëlqimet dhe të dhënat personale' },
  { id: 'delete', label: 'Fshirja e llogarisë', hint: 'Veprime të përhershme', danger: true },
]

const editLink = buttonVariants({ variant: 'outline', size: 'sm' })

function isSectionId(value: string | null): value is SectionId {
  return SECTIONS.some((section) => section.id === value)
}

function SettingsNav({ active }: { active: SectionId }) {
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
            <span className="st-nav-label">{section.label}</span>
            <span className="st-nav-hint">{section.hint}</span>
          </span>
          <ChevronRight size={18} aria-hidden className="st-nav-chevron" />
        </Link>
      </li>
    )
  }

  return (
    <Card className="st-nav">
      <nav aria-label="Seksionet e cilësimeve">
        <ul className="st-nav-list">{regular.map(renderItem)}</ul>
        <Separator className="st-nav-sep" />
        <ul className="st-nav-list">{danger.map(renderItem)}</ul>
      </nav>
    </Card>
  )
}

export function SettingsPage() {
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
      toast.success(next ? 'Do të marrësh lajme dhe oferta nga KëshillaKos.' : 'Nuk do të marrësh më komunikime promovuese.')
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
          <h1>Cilësimet</h1>
          <p>Menaxho llogarinë, sigurinë, privatësinë dhe preferencat e tua.</p>
        </div>
      </header>

      <div className={`st-layout${hasSection ? ' has-section' : ''}`}>
        <SettingsNav active={active} />

        <div className="st-content">
          <Link to={{ search: '' }} className="st-back">
            <ChevronLeft size={18} aria-hidden />
            Të gjitha cilësimet
          </Link>

          {active === 'account' ? (
            <SettingsSection
              id="llogaria"
              title="Llogaria"
              description="Të dhënat bazë të llogarisë. Emri, fotoja dhe telefoni ndryshohen te Profili."
            >
              <SettingsRow
                leading={<ProfileAvatar src={user.profilePhoto} seed={user.uid} size={44} alt="" />}
                label="Fotoja e profilit"
                value={user.profilePhoto ? 'E ngarkuar' : <span className="st-muted">Nuk është shtuar</span>}
                action={
                  <Link to={profileTo} className={editLink}>
                    {user.profilePhoto ? 'Ndrysho' : 'Shto'}
                  </Link>
                }
              />
              <SettingsRow
                label="Emri dhe mbiemri"
                value={displayName}
                action={
                  <Link to={profileTo} className={editLink}>
                    Ndrysho
                  </Link>
                }
              />
              <SettingsRow
                label="Email"
                value={user.email}
                description="Përdoret për hyrjen në llogari dhe nuk mund të ndryshohet këtu."
              />
              <SettingsRow
                label="Numri i telefonit"
                value={user.phone || <span className="st-muted">Nuk është shtuar</span>}
                action={
                  <Link to={profileTo} className={editLink}>
                    {user.phone ? 'Ndrysho' : 'Shto'}
                  </Link>
                }
              />
              <SettingsRow
                label="Profilet e llogarisë"
                value={
                  <span className="st-chips">
                    {roles.map((role) => (
                      <Chip key={role} size="sm" variant="soft" color={role === 'user' ? 'default' : 'accent'}>
                        <Chip.Label>{CONTEXT_LABELS[role]}</Chip.Label>
                      </Chip>
                    ))}
                  </span>
                }
              />
            </SettingsSection>
          ) : null}

          {active === 'security' ? (
            <SettingsSection id="siguria" title="Siguria" description="Si hyn në KëshillaKos dhe si mbrohet llogaria jote.">
              <SettingsRow
                label="Fjalëkalimi"
                value={signedInWithGoogle ? undefined : '••••••••'}
                description={
                  signedInWithGoogle
                    ? 'Ke hyrë me Google, prandaj fjalëkalimin e menaxhon te llogaria jote Google.'
                    : 'Përdor një fjalëkalim të fortë që nuk e përdor në faqe të tjera.'
                }
                action={
                  signedInWithGoogle ? null : (
                    <Button variant="outline" size="sm" onPress={() => setPasswordOpen(true)}>
                      Ndrysho fjalëkalimin
                    </Button>
                  )
                }
              />
              {session ? (
                <SettingsRow
                  label="Hyrja me Google"
                  value={
                    <Chip size="sm" variant="soft" color={googleLinked ? 'success' : 'default'}>
                      <Chip.Label>{googleLinked ? 'E lidhur' : 'Nuk është lidhur'}</Chip.Label>
                    </Chip>
                  }
                  description={
                    googleLinked
                      ? signedInWithGoogle
                        ? 'Je kyçur me Google në këtë sesion.'
                        : 'Mund të hysh edhe me llogarinë Google.'
                      : 'Llogaria jote hyn me email dhe fjalëkalim.'
                  }
                />
              ) : null}
            </SettingsSection>
          ) : null}

          {active === 'privacy' ? (
            <SettingsSection
              id="privatesia"
              title="Privatësia"
              description="Pëlqimet dhe të drejtat e tua për të dhënat personale."
            >
              <SettingsRow
                label="Komunikime promovuese"
                description="Lejo KëshillaKos të të dërgojë lajme dhe oferta me email. Mund ta ndryshosh kurdo."
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
                      <Label className="st-sr-only">Komunikime promovuese</Label>
                    </Switch.Content>
                  </Switch>
                }
              />
              <SettingsRow
                label="Kopja e të dhënave"
                description="Kërko një kopje të të dhënave personale që ruajmë për llogarinë tënde."
                action={
                  <Button variant="outline" size="sm" onPress={() => setAccountRequest('export')}>
                    Kërko kopjen
                  </Button>
                }
              />
              <SettingsRow
                label="Politika e privatësisë"
                description="Si i mbledhim, i përdorim dhe i mbrojmë të dhënat."
                action={
                  <Link to="/privatesia" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
                    Lexo politikën
                  </Link>
                }
              />
            </SettingsSection>
          ) : null}

          {active === 'delete' ? (
            <SettingsSection
              id="fshirja"
              title="Fshirja e llogarisë"
              description="Veprime të përhershme për llogarinë tënde."
              tone="danger"
            >
              <SettingsRow
                label="Fshi llogarinë"
                description="Llogaria mbyllet dhe të dhënat fshihen përgjithmonë pasi ekipi ta verifikojë kërkesën. Ky veprim nuk mund të kthehet."
                action={
                  <Button variant="danger-soft" size="sm" onPress={() => setAccountRequest('deletion')}>
                    Kërko fshirjen
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
