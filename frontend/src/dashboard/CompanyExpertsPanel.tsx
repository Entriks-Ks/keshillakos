import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Button, toast } from '@heroui/react'
import {
  cancelInvitation,
  fetchBusinessTeam,
  fetchMyBusinesses,
  inviteExpert,
  lookupExpert,
  removeExpert,
  type BusinessSummary,
  type BusinessTeam,
  type ExpertLookup,
} from '../api/onboarding'
import { mediaUrl } from '../api/media'
import { useAuth } from '../auth/AuthContext'
import { getErrorMessage } from '../utils/errors'
import DashPageHeader from './DashPageHeader'
import './CompanyExpertsPanel.css'

function formatInviteDate(value: string) {
  try {
    return new Date(value).toLocaleString('sq-AL', { dateStyle: 'medium', timeStyle: 'short' })
  } catch {
    return value
  }
}

const LOOKUP_HINT: Record<Exclude<ExpertLookup['status'], 'ready' | 'invalid'>, string> = {
  missing: 'Ky email nuk është i regjistruar në KëshillaKos.',
  not_expert: 'Ky përdorues nuk ka profil eksperti. Duhet të regjistrohet si ekspert fillimisht.',
  member: 'Ky ekspert është tashmë në ekip.',
  invited: 'Ftesa është dërguar. Pret që eksperti ta pranojë.',
  owner: 'Ky person e menaxhon kompaninë.',
}

export default function CompanyExpertsPanel() {
  const { user } = useAuth()
  const [businesses, setBusinesses] = useState<BusinessSummary[]>([])
  const [selected, setSelected] = useState('')
  const [team, setTeam] = useState<BusinessTeam | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [email, setEmail] = useState('')
  const [match, setMatch] = useState<ExpertLookup | null>(null)
  const [checking, setChecking] = useState(false)
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState('')

  useEffect(() => {
    if (!(user?.roles ?? []).includes('company') && user?.role !== 'admin') return
    let cancelled = false
    setLoading(true)
    fetchMyBusinesses()
      .then((items) => {
        if (cancelled) return
        setBusinesses(items)
        setSelected((current) => current || items[0]?._id || '')
        if (!items.length) setLoading(false)
      })
      .catch((err) => {
        if (!cancelled) {
          setError(getErrorMessage(err))
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [user?.roles, user?.role])

  useEffect(() => {
    if (!selected) return
    let cancelled = false
    setLoading(true)
    fetchBusinessTeam(selected)
      .then((next) => {
        if (!cancelled) {
          setTeam(next)
          setError('')
        }
      })
      .catch((err) => {
        if (!cancelled) setError(getErrorMessage(err))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [selected])

  useEffect(() => {
    const trimmed = email.trim()
    if (!selected || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setMatch(null)
      setChecking(false)
      return
    }
    setMatch(null)
    let cancelled = false
    const timer = window.setTimeout(() => {
      setChecking(true)
      lookupExpert(selected, trimmed)
        .then((next) => {
          if (!cancelled) setMatch(next)
        })
        .catch(() => {
          if (!cancelled) setMatch(null)
        })
        .finally(() => {
          if (!cancelled) setChecking(false)
        })
    }, 350)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [email, selected])

  async function onInvite(event: FormEvent) {
    event.preventDefault()
    if (!selected || match?.status !== 'ready') return
    setSaving(true)
    try {
      setTeam(await inviteExpert(selected, email.trim()))
      setMatch({ ...match, status: 'invited' })
      toast.success('Ftesa u dërgua. Eksperti e pranon te profili i tij.')
    } catch (err) {
      toast.danger(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  async function onRemove(userId: string) {
    if (!selected) return
    const ok = window.confirm('A je i sigurt që do ta heqësh këtë ekspert nga kompania?')
    if (!ok) return
    setBusyId(userId)
    try {
      setTeam(await removeExpert(selected, userId))
      toast.success('Eksperti u hoq nga kompania.')
    } catch (err) {
      toast.danger(getErrorMessage(err))
    } finally {
      setBusyId('')
    }
  }

  async function onCancelInvite(userId: string) {
    if (!selected) return
    setBusyId(userId)
    try {
      setTeam(await cancelInvitation(selected, userId))
      if (match?.person?.id === userId) setMatch({ ...match, status: 'ready' })
      toast.success('Ftesa u anulua.')
    } catch (err) {
      toast.danger(getErrorMessage(err))
    } finally {
      setBusyId('')
    }
  }

  const members = team?.members ?? []
  const invitations = team?.invitations ?? []
  const selectedBusiness = businesses.find((item) => item._id === selected)
  const canInviteExperts = Boolean(selectedBusiness && selectedBusiness.status !== 'suspended' && selectedBusiness.status !== 'closed')
  const photo = match?.person ? mediaUrl(match.person.photoUrl) : ''

  return (
    <section className="provider-section company-experts">
      <DashPageHeader
        title="Ekspertët"
        description="Shto ekspertë që janë tashmë në KëshillaKos. Pasi e pranojnë ftesën, klientët i shohin te profili i kompanisë, u shkruajnë dhe caktojnë takim."
      />

      {selectedBusiness && !canInviteExperts ? (
        <p className="muted role-pending-pill" role="status">
          Kompania është pezulluar ose e mbyllur. Ftesat e ekspertëve nuk janë të disponueshme.
        </p>
      ) : null}
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

      {error ? <p className="error">{error}</p> : null}
      {loading ? <p className="muted">Duke u ngarkuar…</p> : null}

      {!loading && !selected ? (
        <p className="muted">Nuk ke ende një kompani të menaxhueshme. <Link to="/dashboard/company/create">Krijo kompaninë</Link>.</p>
      ) : null}

      {!loading && selected && canInviteExperts ? (
        <form className="company-invite" onSubmit={onInvite}>
          <label htmlFor="expert-email">Email i ekspertit</label>
          <div className="company-invite-row">
            <input
              id="expert-email"
              type="email"
              autoComplete="email"
              value={email}
              placeholder="eksperti@email.com"
              onChange={(e) => setEmail(e.target.value)}
            />
            <Button type="submit" variant="primary" isDisabled={saving || match?.status !== 'ready'}>
              {saving ? 'Duke ftuar…' : 'Fto'}
            </Button>
          </div>
          {checking ? <p className="company-invite-note">Po kontrollohet…</p> : null}
          {!checking && match?.status === 'ready' && match.person ? (
            <div className="company-invite-match">
              <div className="profile-avatar-sm" aria-hidden>
                {photo ? <img src={photo} alt="" /> : <span>{match.person.name.slice(0, 1)}</span>}
              </div>
              <div>
                <strong>{match.person.name}</strong>
                <span>{match.person.headline || match.person.email}</span>
              </div>
            </div>
          ) : null}
          {!checking && match && match.status !== 'ready' && match.status !== 'invalid' ? (
            <p className="company-invite-note">{LOOKUP_HINT[match.status]}</p>
          ) : null}
        </form>
      ) : null}

      {!loading && selected ? (
        <>
          <div className="company-team">
            <h3>Në ekip ({members.length})</h3>
            {members.length === 0 ? <p className="muted">Ende nuk ka ekspertë. Fto të parin me email.</p> : null}
            <ul>
              {members.map((member) => {
                const memberPhoto = mediaUrl(member.photoUrl)
                return (
                  <li key={member.id}>
                    <div className="company-person">
                      <div className="profile-avatar-sm" aria-hidden>
                        {memberPhoto ? <img src={memberPhoto} alt="" /> : <span>{member.name.slice(0, 1)}</span>}
                      </div>
                      <div>
                        <strong>{member.name}</strong>
                        <span>{member.headline || member.email}</span>
                      </div>
                    </div>
                    <div className="company-person-actions">
                      {member.uid ? (
                        <Link to={`/providers/${member.uid}`}>Profili</Link>
                      ) : null}
                      <button type="button" disabled={busyId === member.id} onClick={() => void onRemove(member.id)}>
                        {busyId === member.id ? 'Duke hequr…' : 'Hiq'}
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>

          {invitations.length > 0 ? (
            <div className="company-team">
              <h3>Në pritje ({invitations.length})</h3>
              <ul>
                {invitations.map((invite) => (
                  <li key={invite.id}>
                    <div className="company-person">
                      <div>
                        <strong>{invite.name || invite.email}</strong>
                        <span>
                          {invite.email}
                          {invite.invitedAt ? ` · ${formatInviteDate(invite.invitedAt)}` : ''}
                        </span>
                      </div>
                    </div>
                    <div className="company-person-actions">
                      <button type="button" disabled={busyId === invite.id} onClick={() => void onCancelInvite(invite.id)}>
                        {busyId === invite.id ? 'Duke anuluar…' : 'Anulo'}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  )
}
