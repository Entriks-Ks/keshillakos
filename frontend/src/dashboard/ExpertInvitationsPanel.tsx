import { useEffect, useState } from 'react'
import { acceptInvitation, fetchMyInvitations } from '../api/onboarding'
import { getErrorMessage } from '../utils/errors'

export default function ExpertInvitationsPanel() {
  const [invitations, setInvitations] = useState<Array<{ id: string; publicName: string }>>([])
  const [error, setError] = useState('')
  const [accepting, setAccepting] = useState<string | null>(null)

  useEffect(() => { fetchMyInvitations().then(setInvitations).catch((err) => setError(getErrorMessage(err))) }, [])

  async function accept(id: string) {
    setError('')
    setAccepting(id)
    try {
      await acceptInvitation(id)
      setInvitations((items) => items.filter((item) => item.id !== id))
    } catch (err) { setError(getErrorMessage(err)) }
    finally { setAccepting(null) }
  }

  if (invitations.length === 0 && !error) return null
  return <div className="services-list">
    <h3>Ftesat nga kompanitë</h3>
    {error ? <p className="error">{error}</p> : null}
    <ul>{invitations.map((invite) => <li key={invite.id}>
      <strong>{invite.publicName}</strong>
      <button type="button" className="ghost" disabled={accepting === invite.id} onClick={() => accept(invite.id)}>
        {accepting === invite.id ? 'Duke pranuar...' : 'Prano ftesën'}
      </button>
    </li>)}</ul>
  </div>
}
