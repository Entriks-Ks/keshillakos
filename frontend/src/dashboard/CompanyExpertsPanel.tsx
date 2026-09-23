import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Button, Input, Label, Modal, TextField, toast } from '@heroui/react'
import {
  cancelInvitation,
  fetchBusinessTeam,
  fetchMyBusinesses,
  inviteExpert,
  removeExpert,
  type BusinessSummary,
  type BusinessTeam,
} from '../api/onboarding'
import { mediaUrl } from '../api/media'
import { useAuth } from '../auth/AuthContext'
import { getErrorMessage } from '../utils/errors'
import DashPageHeader from './DashPageHeader'

function formatInviteDate(value: string) {
  try {
    return new Date(value).toLocaleString('sq-AL', { dateStyle: 'medium', timeStyle: 'short' })
  } catch {
    return value
  }
}

export default function CompanyExpertsPanel() {
  const { user } = useAuth()
  const [businesses, setBusinesses] = useState<BusinessSummary[]>([])
  const [selected, setSelected] = useState('')
  const [team, setTeam] = useState<BusinessTeam | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [inviteOpen, setInviteOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [emailError, setEmailError] = useState('')
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

  function openInvite() {
    setEmail('')
    setEmailError('')
    setInviteOpen(true)
  }

  async function onInvite(event: FormEvent) {
    event.preventDefault()
    if (!selected) return
    const trimmed = email.trim()
    if (!trimmed) {
      setEmailError('Email i ekspertit është i detyrueshëm')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setEmailError('Email i pavlefshëm')
      return
    }
    setEmailError('')
    setSaving(true)
    try {
      setTeam(await inviteExpert(selected, trimmed))
      setEmail('')
      setInviteOpen(false)
      toast.success('Ftesa u dërgua. Eksperti do ta shohë në llogari.')
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

  return (
    <section className="provider-section">
      <DashPageHeader
        title="Ekspertët"
        description="Fto ekspertë të regjistruar. Ata bashkohen vetëm pasi ta pranojnë ftesën në aplikacion."
        actions={
          <Button
            variant="primary"
            isDisabled={!selected || loading || !canInviteExperts}
            onPress={openInvite}
          >
            Fto ekspert
          </Button>
        }
      />

      {selectedBusiness && (selectedBusiness.status === 'suspended' || selectedBusiness.status === 'closed') ? (
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

      {!loading && selected ? (
        <>
          <div className="services-list">
            <h3>Ekspertët e kompanisë</h3>
            {members.length === 0 ? (
              <p className="muted">Nuk ka ekspertë në ekip ende. Fto një ekspert me email.</p>
            ) : null}
            <ul>
              {members.map((member) => {
                const photo = mediaUrl(member.photoUrl)
                return (
                  <li key={member.id} className="company-expert-row">
                    <div className="company-expert-main">
                      <div className="profile-avatar-sm" aria-hidden>
                        {photo ? <img src={photo} alt="" /> : <span>{member.name.slice(0, 1)}</span>}
                      </div>
                      <div>
                        <strong>{member.name}</strong>
                        {member.headline ? <span>{member.headline}</span> : null}
                        <span className="muted">{member.email}</span>
                      </div>
                    </div>
                    <div className="services-list-actions">
                      {member.uid ? (
                        <Link to={`/providers/${member.uid}`} className="ghost link-btn">
                          Shiko profilin
                        </Link>
                      ) : null}
                      <button
                        type="button"
                        className="ghost danger-ghost"
                        disabled={busyId === member.id}
                        onClick={() => void onRemove(member.id)}
                      >
                        {busyId === member.id ? 'Duke hequr…' : 'Hiq nga kompania'}
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>

          <div className="services-list">
            <h3>Ftesat në pritje</h3>
            {invitations.length === 0 ? (
              <p className="muted">Nuk ka ftesa në pritje.</p>
            ) : null}
            <ul>
              {invitations.map((invite) => (
                <li key={invite.id} className="company-expert-row">
                  <div>
                    <strong>{invite.email}</strong>
                    <span>
                      {invite.name}
                      {invite.invitedAt ? ` · ${formatInviteDate(invite.invitedAt)}` : ''}
                    </span>
                    <span className="muted">Statusi: Në pritje</span>
                  </div>
                  <div className="services-list-actions">
                    <button
                      type="button"
                      className="ghost"
                      disabled={busyId === invite.id}
                      onClick={() => void onCancelInvite(invite.id)}
                    >
                      {busyId === invite.id ? 'Duke anuluar…' : 'Anulo ftesën'}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </>
      ) : null}

      <Modal.Backdrop isOpen={inviteOpen} onOpenChange={setInviteOpen}>
        <Modal.Container size="sm">
          <Modal.Dialog>
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>Fto ekspert</Modal.Heading>
            </Modal.Header>
            <form onSubmit={onInvite}>
              <Modal.Body>
                <TextField
                  isInvalid={Boolean(emailError)}
                  validationBehavior="aria"
                  fullWidth
                >
                  <Label>Email i ekspertit</Label>
                  <Input
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value)
                      setEmailError('')
                    }}
                    placeholder="eksperti@email.com"
                    autoFocus
                  />
                  {emailError ? <p className="error">{emailError}</p> : null}
                </TextField>
              </Modal.Body>
              <Modal.Footer>
                <Button type="button" variant="secondary" slot="close" isDisabled={saving}>
                  Anulo
                </Button>
                <Button type="submit" variant="primary" isDisabled={saving || !selected}>
                  {saving ? 'Duke ftuar…' : 'Fto ekspertin'}
                </Button>
              </Modal.Footer>
            </form>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </section>
  )
}
