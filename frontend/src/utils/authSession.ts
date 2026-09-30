export type SessionSignIn = {
  /** Firebase `sign_in_provider` of the current token, e.g. `password` or `google.com`. */
  provider: string
  /** Identity providers linked to the Firebase account. */
  linked: string[]
}

/**
 * Reads display-only sign-in details from the stored Firebase ID token.
 * The backend verifies the token on every request; nothing here is trusted for authorization.
 */
export function readSessionSignIn(): SessionSignIn | null {
  const token = localStorage.getItem('token')
  const payload = token?.split('.')[1]
  if (!payload) return null
  try {
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(payload.length / 4) * 4, '=')
    const claims = JSON.parse(atob(base64)) as {
      firebase?: { sign_in_provider?: string; identities?: Record<string, unknown> }
    }
    const provider = claims.firebase?.sign_in_provider
    if (!provider) return null
    return { provider, linked: Object.keys(claims.firebase?.identities ?? {}) }
  } catch {
    return null
  }
}
