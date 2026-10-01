import { useEffect, useState } from 'react'
import { Button, Card, toast } from '@heroui/react'
import { Building2 } from 'lucide-react'
import {
  acceptInvitation,
  fetchMyInvitations,
  rejectInvitation,
  type MyBusinessInvitation,
} from '../api/onboarding'
import { getErrorMessage } from '../utils/errors'
import { SectionHead } from './OverviewParts'
import './DashboardSections.css'
import './ExpertProfile.css'

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
    <Card className="uo-card">
      <SectionHead
        title="Ftesa nga kompania"
        meta={invitations.length ? <span className="uo-card-meta">{invitations.length}</span> : null}
      />
      <Card.Content className="uo-card-body ep-stack">
        <p className="ds-hint">Pranoje për t’u bashkuar me ekipin, ose refuzoje nëse nuk të përket.</p>
        {error ? <p className="ds-error">{error}</p> : null}
        {invitations.length ? (
          <ul className="uo-rows">
            {invitations.map((invite) => (
              <li key={invite.id} className="uo-row ep-invite">
                <span className="uo-row-icon" aria-hidden><Building2 size={16} /></span>
                <span className="uo-row-copy">
                  <strong>{invite.publicName}</strong>
                  <span>
                    {invite.invitedAt ? formatInviteDate(invite.invitedAt) : 'Ftesë në pritje'} · Në pritje
                  </span>
                </span>
                <span className="ep-invite-actions">
                  <Button
                    size="sm"
                    variant="outline"
                    className="ds-danger-btn"
                    isDisabled={busyId === invite.id}
                    onPress={() => void reject(invite.id)}
                  >
                    Refuzo
                  </Button>
                  <Button size="sm" variant="primary" isPending={busyId === invite.id} onPress={() => void accept(invite.id)}>
                    {busyId === invite.id ? 'Duke pranuar…' : 'Prano'}
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </Card.Content>
    </Card>
  )
}
