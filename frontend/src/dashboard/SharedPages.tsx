import ChangePasswordPanel from './ChangePasswordPanel'
import ProfilePanel from './ProfilePanel'
import ProviderRatingsPanel from './ProviderRatingsPanel'
import { useAuth } from '../auth/AuthContext'

export function OwnRatingsPage() {
  const { user } = useAuth()
  if (!user) return null
  return (
    <ProviderRatingsPanel
      providerUid={user.uid}
      audience={user.role === 'company' ? 'company' : 'provider'}
    />
  )
}

export function ProfilePage() {
  return <ProfilePanel />
}

export function SettingsPage() {
  return <ChangePasswordPanel />
}
