import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import {
  ArrowRight,
  Briefcase,
  Building2,
  CalendarDays,
  FolderKanban,
  Inbox,
  MessageCircle,
  Search,
  Star,
  Tags,
  Users,
} from 'lucide-react'
import { mediaUrl } from '../api/auth'
import { useAuth } from '../auth/AuthContext'
import { getDashboardPath } from '../utils/dashboardPath'
import { ROLE_LABELS } from './nav'

function OverviewCard({
  title,
  description,
  to,
  cta,
  icon: Icon,
}: {
  title: string
  description: string
  to: string
  cta: string
  icon: LucideIcon
}) {
  return (
    <Link to={to} className="dash-overview-card">
      <span className="dash-overview-card-icon" aria-hidden>
        <Icon size={20} strokeWidth={2} />
      </span>
      <strong>{title}</strong>
      <p>{description}</p>
      <span className="dash-overview-card-cta">
        {cta}
        <ArrowRight size={15} aria-hidden />
      </span>
    </Link>
  )
}

function AccountSummary() {
  const { user } = useAuth()
  if (!user) return null

  const photo = mediaUrl(user.profilePhoto)
  const profilePath = `${getDashboardPath(user.role)}/profile`

  return (
    <div className="dash-account-card">
      <div className="dash-account-head">
        <div className="profile-avatar-md" aria-hidden>
          {photo ? <img src={photo} alt="" /> : <span>{user.name.slice(0, 1)}</span>}
        </div>
        <div className="dash-account-intro">
          <strong>{user.name}</strong>
          {user.headline ? <p className="muted">{user.headline}</p> : null}
          <Link className="dash-edit-profile" to={profilePath}>
            Ndrysho profilin
            <ArrowRight size={14} aria-hidden />
          </Link>
        </div>
      </div>

      <div className="dash-account-grid">
        <div>
          <span>Email</span>
          <strong>{user.email}</strong>
        </div>
        <div>
          <span>Roli</span>
          <strong>{ROLE_LABELS[user.role]}</strong>
        </div>
        {user.location ? (
          <div>
            <span>Lokacioni</span>
            <strong>{user.location}</strong>
          </div>
        ) : null}
        {user.skills && user.skills.length > 0 ? (
          <div>
            <span>Aftësitë</span>
            <strong>{user.skills.join(' · ')}</strong>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function OverviewShell({
  greeting,
  subtitle,
  children,
}: {
  greeting: string
  subtitle: string
  children: ReactNode
}) {
  return (
    <section className="dash-overview">
      <div className="dash-overview-hero">
        <p className="dash-overview-hello">{greeting}</p>
        <p className="dash-overview-sub">{subtitle}</p>
      </div>
      <AccountSummary />
      <div className="dash-overview-section">
        <div className="dash-overview-section-head">
          <h2>Veprime të shpejta</h2>
          <p>Hap seksionet që përdor më shpesh.</p>
        </div>
        <div className="dash-overview-grid">{children}</div>
      </div>
    </section>
  )
}

export function UserOverviewPage() {
  const { user } = useAuth()
  return (
    <OverviewShell
      greeting={`Mirë se erdhe, ${user?.name || ''}`}
      subtitle="Kërko ndihmë, ndiq kërkesat dhe vlerëso ofruesit nga një vend."
    >
      <OverviewCard
        title="Kërko ndihmë"
        description="Përshkruaj problemin dhe gjej ofruesin e duhur."
        to="/"
        cta="Fillo"
        icon={Search}
      />
      <OverviewCard
        title="Kërkesat e mia"
        description="Shiko statusin e kërkesave që ke dërguar."
        to="/dashboard/user/requests"
        cta="Hap"
        icon={Inbox}
      />
      <OverviewCard
        title="Mesazhet"
        description="Bisedo drejtpërdrejt me ofruesit."
        to="/dashboard/user/messages"
        cta="Hap"
        icon={MessageCircle}
      />
      <OverviewCard
        title="Vlerëso ofruesit"
        description="Jep feedback pasi të marrësh ndihmë."
        to="/dashboard/user/ratings"
        cta="Hap"
        icon={Star}
      />
    </OverviewShell>
  )
}

export function ProviderOverviewPage() {
  const { user } = useAuth()
  return (
    <OverviewShell
      greeting={`Mirë se erdhe, ${user?.name || ''}`}
      subtitle="Menaxho kërkesat, shërbimet dhe vlerësimet me lehtësi."
    >
      <OverviewCard
        title="Kërkesat"
        description="Prano ose refuzo kërkesat e klientëve."
        to="/dashboard/provider/inbox"
        cta="Hap"
        icon={Inbox}
      />
      <OverviewCard
        title="Mesazhet"
        description="Përgjigju klientëve në kohë reale."
        to="/dashboard/provider/messages"
        cta="Hap"
        icon={MessageCircle}
      />
      <OverviewCard
        title="Shërbimet"
        description="Publiko dhe menaxho ofertat e tua."
        to="/dashboard/provider/services"
        cta="Hap"
        icon={Briefcase}
      />
      <OverviewCard
        title="Disponueshmëria"
        description="Vendos oraret kur je i lirë për termine."
        to="/dashboard/provider/availability"
        cta="Hap"
        icon={CalendarDays}
      />
    </OverviewShell>
  )
}

export function CompanyOverviewPage() {
  const { user } = useAuth()
  return (
    <OverviewShell
      greeting={`Mirë se erdhe, ${user?.name || ''}`}
      subtitle="Menaxho ekipin e ekspertëve dhe kërkesat e klientëve."
    >
      <OverviewCard
        title="Kërkesat"
        description="Inbox-i i kërkesave për kompaninë."
        to="/dashboard/company/inbox"
        cta="Hap"
        icon={Inbox}
      />
      <OverviewCard
        title="Mesazhet"
        description="Komuniko me klientët e kompanisë."
        to="/dashboard/company/messages"
        cta="Hap"
        icon={MessageCircle}
      />
      <OverviewCard
        title="Ekspertët"
        description="Shto dhe menaxho ekspertët e ekipit."
        to="/dashboard/company/experts"
        cta="Hap"
        icon={Users}
      />
      <OverviewCard
        title="Disponueshmëria"
        description="Vendos oraret e lira për termine."
        to="/dashboard/company/availability"
        cta="Hap"
        icon={CalendarDays}
      />
    </OverviewShell>
  )
}

export function AdminOverviewPage() {
  const { user } = useAuth()
  return (
    <OverviewShell
      greeting={`Mirë se erdhe, ${user?.name || ''}`}
      subtitle="Kontrollo platformën, përdoruesit dhe kategoritë nga këtu."
    >
      <OverviewCard
        title="Përdoruesit"
        description="Krijo, ndrysho ose fshi llogaritë."
        to="/dashboard/admin/users"
        cta="Hap"
        icon={Users}
      />
      <OverviewCard
        title="Kërkesat"
        description="Shiko të gjitha kërkesat në platformë."
        to="/dashboard/admin/requests"
        cta="Hap"
        icon={FolderKanban}
      />
      <OverviewCard
        title="Kategoritë"
        description="Menaxho domenet dhe kategoritë."
        to="/dashboard/admin/domains"
        cta="Hap"
        icon={Tags}
      />
      <OverviewCard
        title="Shërbimet"
        description="Shiko dhe administro ofertat e publikuara."
        to="/dashboard/admin/services"
        cta="Hap"
        icon={Building2}
      />
    </OverviewShell>
  )
}
