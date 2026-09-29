import type { KeyboardEvent, MouseEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import type { MarketplaceProvider } from '../api/providerProfiles'

export function isProviderVerified(provider: MarketplaceProvider) {
  const v = provider.verification
  if (!v) return false
  return v.identity === 'verified' || v.qualification === 'verified' || v.business === 'verified'
}

export function useProviderCardLink(profilePath: string) {
  const navigate = useNavigate()

  return {
    onClick(e: MouseEvent<HTMLElement>) {
      if ((e.target as HTMLElement).closest('a, button, input, label, form')) return
      navigate(profilePath)
    },
    onKeyDown(e: KeyboardEvent<HTMLElement>) {
      if (e.target !== e.currentTarget) return
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        navigate(profilePath)
      }
    },
  }
}
