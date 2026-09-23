import { useEffect, useState } from 'react'
import { toast } from '@heroui/react'
import {
  acceptInvitation,
  fetchMyInvitations,
  rejectInvitation,
  type MyBusinessInvitation,
} from '../api/onboarding'
import { getErrorMessage } from '../utils/errors'

function formatInviteDate(value: string | null) {
  if (!value) return ''
  try {
    return new Date(value).toLocaleString('sq-AL', { dateStyle: 'medium', timeStyle: 'short' })
  } catch {
    return value
  }
}

export default function ExpertInvitationsPanel() {
  const [invitations, setInvitations] = useState<MyBusinessInvitation[]>([])
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => {
    fetchMyInvitations()
      .then(setInvitations)
      .catch((err) => setError(getErrorMessage(err)))
  }, [])

  async function accept(id: string) {
    setBusyId(id)
    try {
      await acceptInvitation(id)
      setInvitations((items) => items.filter((item) => item.id !== id))
      toast.success('Ftesa u pranua. Tani je pjesë e kompanisë.')
    } catch (err) {
      toast.danger(getErrorMessage(err))
    } finally {
      setBusyId(null)
    }
  }

  async function reject(id: string) {
    setBusyId(id)
    try {
      await rejectInvitation(id)
      setInvitations((items) => items.filter((item) => item.id !== id))
      toast.info('Ftesa u refuzua.')
    } catch (err) {
      toast.danger(getErrorMessage(err))
    } finally {
      setBusyId(null)
    }
  }

  if (invitations.length === 0 && !error) return null

  return (
    <div className="services-list">
      <h3>Ftesat nga kompanitë</h3>
      {error ? <p className="error">{error}</p> : null}
      <ul>
        {invitations.map((invite) => (
          <li key={invite.id} className="company-expert-row">
            <div>
              <strong>{invite.publicName}</strong>
              <span>
                {invite.invitedAt ? formatInviteDate(invite.invitedAt) : 'Ftesë në pritje'}
                {' · '}
                Statusi: Në pritje
              </span>
            </div>
            <div className="services-list-actions">
              <button
                type="button"
                className="ghost"
                disabled={busyId === invite.id}
                onClick={() => void accept(invite.id)}
              >
                {busyId === invite.id ? 'Duke pranuar…' : 'Prano'}
              </button>
              <button
                type="button"
                className="ghost danger-ghost"
                disabled={busyId === invite.id}
                onClick={() => void reject(invite.id)}
              >
                Refuzo
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
