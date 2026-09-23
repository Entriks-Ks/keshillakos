import { useEffect, useState, type FormEvent } from 'react'
import { toast } from '@heroui/react'
import { fetchBusinessTeam, fetchMyBusinesses, inviteExpert, removeExpert, type BusinessSummary, type BusinessTeam } from '../api/onboarding'
import { useAuth } from '../auth/AuthContext'
import { getErrorMessage } from '../utils/errors'
import DashPageHeader from './DashPageHeader'

export default function CompanyTeamPanel() {
  const { user } = useAuth()
  const [businesses, setBusinesses] = useState<BusinessSummary[]>([])
  const [selected, setSelected] = useState('')
  const [team, setTeam] = useState<BusinessTeam | null>(null)
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!(user?.roles ?? []).includes('company')) return
    fetchMyBusinesses().then((items) => {
      setBusinesses(items)
      setSelected((current) => current || items[0]?._id || '')
    }).catch((err) => setError(getErrorMessage(err)))
  }, [user?.roles])

  useEffect(() => {
    if (!selected) return
    fetchBusinessTeam(selected).then(setTeam).catch((err) => setError(getErrorMessage(err)))
  }, [selected])

  async function invite(event: FormEvent) {
    event.preventDefault()
    if (!selected) return
    setSaving(true)
    try {
      setTeam(await inviteExpert(selected, email))
      setEmail('')
      toast.success('Ftesa u dërgua te eksperti.')
    } catch (err) { toast.danger(getErrorMessage(err)) }
    finally { setSaving(false) }
  }

  async function remove(userId: string) {
    try {
      setTeam(await removeExpert(selected, userId))
      toast.success('Anëtari u hoq nga ekipi.')
    } catch (err) { toast.danger(getErrorMessage(err)) }
  }

  if (!(user?.roles ?? []).includes('company')) return null
  return (
    <section className="provider-section">
      <DashPageHeader
        title="Ekipi i kompanisë"
        description="Fto ekspertë të regjistruar me email. Ata bashkohen vetëm pasi ta pranojnë ftesën."
      />
      {businesses.length > 1 ? (
        <label className="dash-inline-select">
          Kompania
          <select value={selected} onChange={(e) => setSelected(e.target.value)}>
            {businesses.map((business) => (
              <option key={business._id} value={business._id}>
                {business.publicName}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {team ? (
        <p>
          <strong>{team.business.publicName}</strong>
        </p>
      ) : null}
      <form className="service-form" onSubmit={invite}>
        <label className="full">
          Email i ekspertit
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        {error ? <p className="error full">{error}</p> : null}
        <button type="submit" className="full" disabled={saving || !selected}>
          {saving ? 'Duke ftuar...' : 'Fto ekspertin'}
        </button>
      </form>
      {team ? (
        <div className="services-list">
          <h3>Anëtarët</h3>
          <ul>
            {team.members.map((member) => (
              <li key={member.id}>
                <strong>{member.name}</strong>
                <span>{member.email}</span>
                <button type="button" className="ghost" onClick={() => remove(member.id)}>
                  Hiq nga ekipi
                </button>
              </li>
            ))}
          </ul>
          <h3>Ftesat në pritje</h3>
          <ul>
            {team.invitations.map((inviteItem) => (
              <li key={inviteItem.id}>
                <strong>{inviteItem.name}</strong>
                <span>{inviteItem.email}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  )
}
