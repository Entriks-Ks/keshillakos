import KeshillaPagination from '../components/KeshillaPagination'
import { usePagination } from '../hooks/usePagination'
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
  const { page, setPage, pagination, receivePagination } = usePagination()
  const [revision, setRevision] = useState(0)
  const [invitations, setInvitations] = useState<MyBusinessInvitation[]>([])
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setError('')
    fetchMyInvitations({ page, limit: 20 })
      .then((items) => { if (!cancelled) { setInvitations(items); receivePagination(items.pagination) } })
      .catch((err) => { if (!cancelled) setError(getErrorMessage(err)) })
    return () => { cancelled = true }
  }, [page, revision, receivePagination])

  async function accept(id: string) {
    setBusyId(id)
    try {
      await acceptInvitation(id)
      setRevision((value) => value + 1)
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
      setRevision((value) => value + 1)
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
        <KeshillaPagination pagination={pagination} onPageChange={setPage} isDisabled={Boolean(busyId)} />
      </Card.Content>
    </Card>
  )
}
