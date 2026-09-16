import { Link } from 'react-router-dom'
import { mediaUrl } from '../api/auth'
import { useAuth } from '../auth/AuthContext'
import { ROLE_LABELS } from './nav'

function OverviewCard({
  title,
  description,
  to,
  cta,
}: {
  title: string
  description: string
  to: string
  cta: string
}) {
  return (
    <Link to={to} className="dash-overview-card">
      <strong>{title}</strong>
      <p>{description}</p>
      <span>{cta}</span>
    </Link>
  )
}

function AccountSummary() {
  const { user } = useAuth()
  if (!user) return null

  const photo = mediaUrl(user.profilePhoto)
  const profilePath =
    user.role === 'provider'
      ? '/dashboard/provider/profile'
      : user.role === 'company'
        ? '/dashboard/company/profile'
        : user.role === 'admin'
          ? '/dashboard/admin/profile'
          : '/dashboard/user/profile'

  return (
    <div className="info-block dash-account">
      <div className="dash-account-head">
        <div className="profile-avatar-md" aria-hidden>
          {photo ? <img src={photo} alt="" /> : <span>{user.name.slice(0, 1)}</span>}
        </div>
        <div>
          <strong>{user.name}</strong>
          {user.headline ? <p className="muted">{user.headline}</p> : null}
          <Link className="dash-edit-profile" to={profilePath}>
            Ndrysho profilin →
          </Link>
        </div>
      </div>
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
  )
}

export function UserOverviewPage() {
  const { user } = useAuth()
  return (
    <section className="dash-overview">
      <p className="muted">
        Mirë se erdhe, {user?.name}. Kërko ndihmë, ndiq kërkesat dhe vlerëso ofruesit.
      </p>
      <AccountSummary />
      <div className="dash-overview-grid">
        <OverviewCard
          title="Kërko ndihmë"
          description="Përshkruaj problemin dhe gjej ofruesin e duhur."
          to="/"
          cta="Fillo →"
        />
        <OverviewCard
          title="Kërkesat e mia"
          description="Shiko statusin e kërkesave që ke dërguar."
          to="/dashboard/user/requests"
          cta="Hap →"
        />
        <OverviewCard
          title="Vlerëso ofruesit"
          description="Jep feedback pasi të marrësh ndihmë."
          to="/dashboard/user/ratings"
          cta="Hap →"
        />
      </div>
    </section>
  )
}

export function ProviderOverviewPage() {
  const { user } = useAuth()
  return (
    <section className="dash-overview">
      <p className="muted">
        Mirë se erdhe, {user?.name}. Menaxho kërkesat, shërbimet dhe vlerësimet nga menyja.
      </p>
      <AccountSummary />
      <div className="dash-overview-grid">
        <OverviewCard
          title="Kërkesat"
          description="Prano ose refuzo kërkesat e klientëve."
          to="/dashboard/provider/inbox"
          cta="Hap →"
        />
        <OverviewCard
          title="Disponueshmëria"
          description="Vendos oraret kur je i lirë për termine."
          to="/dashboard/provider/availability"
          cta="Hap →"
        />
        <OverviewCard
          title="Shërbimet"
          description="Publiko dhe menaxho ofertat e tua."
          to="/dashboard/provider/services"
          cta="Hap →"
        />
      </div>
    </section>
  )
}

export function CompanyOverviewPage() {
  const { user } = useAuth()
  return (
    <section className="dash-overview">
      <p className="muted">
        Mirë se erdhe, {user?.name}. Menaxho ekipin e ekspertëve dhe kërkesat e klientëve.
      </p>
      <AccountSummary />
      <div className="dash-overview-grid">
        <OverviewCard
          title="Kërkesat"
          description="Inbox-i i kërkesave për kompaninë."
          to="/dashboard/company/inbox"
          cta="Hap →"
        />
        <OverviewCard
          title="Disponueshmëria"
          description="Vendos oraret e lira për termine."
          to="/dashboard/company/availability"
          cta="Hap →"
        />
        <OverviewCard
          title="Ekspertët"
          description="Shto dhe menaxho ekspertët e ekipit."
          to="/dashboard/company/experts"
          cta="Hap →"
        />
      </div>
    </section>
  )
}

export function AdminOverviewPage() {
  const { user } = useAuth()
  return (
    <section className="dash-overview">
      <p className="muted">
        Mirë se erdhe, {user?.name}. Menaxho platformën nga seksionet në sidebar.
      </p>
      <AccountSummary />
      <div className="dash-overview-grid">
        <OverviewCard
          title="Përdoruesit"
          description="Krijo, ndrysho ose fshi llogaritë."
          to="/dashboard/admin/users"
          cta="Hap →"
        />
        <OverviewCard
          title="Kërkesat"
          description="Shiko të gjitha kërkesat në platformë."
          to="/dashboard/admin/requests"
          cta="Hap →"
        />
        <OverviewCard
          title="Kategoritë"
          description="Menaxho domenet dhe kategoritë."
          to="/dashboard/admin/domains"
          cta="Hap →"
        />
      </div>
    </section>
  )
}
