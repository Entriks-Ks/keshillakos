import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { toast } from '@heroui/react'
import {
  changePassword as changePasswordRequest,
  API_BASE_URL,
  fetchMe,
  loginUser,
  loginWithGoogleToken,
  registerUser,
  setActiveContext as setActiveContextRequest,
  updateProfile as updateProfileRequest,
  uploadProfilePhoto as uploadProfilePhotoRequest,
  type AuthUser,
  type DashboardContext,
  type ProfileUpdatePayload,
} from '../api/auth'

type AuthContextValue = {
  user: AuthUser | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  loginWithGoogle: () => Promise<boolean>
  register: (
    firstName: string,
    lastName: string,
    email: string,
    password: string,
  ) => Promise<void>
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>
  updateProfile: (payload: ProfileUpdatePayload) => Promise<AuthUser>
  uploadProfilePhoto: (file: File) => Promise<AuthUser>
  switchContext: (context: DashboardContext) => Promise<AuthUser>
  refreshUser: () => Promise<AuthUser>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

const USER_CACHE_KEY = 'authUser'
const ME_TIMEOUT_MS = 8000

/** Seconds-since-epoch expiry of a JWT, or null if it can't be read. */
function tokenExpiry(token: string): number | null {
  const payload = token.split('.')[1]
  if (!payload) return null
  try {
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(payload.length / 4) * 4, '=')
    const { exp } = JSON.parse(atob(base64)) as { exp?: number }
    return typeof exp === 'number' ? exp : null
  } catch {
    return null
  }
}

function isTokenExpired(token: string) {
  const exp = tokenExpiry(token)
  return exp !== null && exp * 1000 <= Date.now()
}

function readCachedUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(USER_CACHE_KEY)
    return raw ? (JSON.parse(raw) as AuthUser) : null
  } catch {
    return null
  }
}

function clearSession() {
  localStorage.removeItem('token')
  localStorage.removeItem(USER_CACHE_KEY)
}

/** Resolve the initial session synchronously so the nav never waits on the network. */
function initialSession(): { user: AuthUser | null; loading: boolean } {
  const token = localStorage.getItem('token')
  if (!token || isTokenExpired(token)) {
    if (token) clearSession()
    return { user: null, loading: false }
  }
  const cached = readCachedUser()
  // With a cached profile we render immediately and revalidate in the background.
  return { user: cached, loading: !cached }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [initial] = useState(initialSession)
  const [user, setUserState] = useState<AuthUser | null>(initial.user)
  const [loading, setLoading] = useState(initial.loading)

  const setUser = useCallback((next: AuthUser | null) => {
    setUserState(next)
    if (next) localStorage.setItem(USER_CACHE_KEY, JSON.stringify(next))
    else localStorage.removeItem(USER_CACHE_KEY)
  }, [])

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      // Wake the API early so the first login/register request isn't slowed by a cold start.
      fetch(`${API_BASE_URL}/api/health`).catch(() => {})
      return
    }

    let cancelled = false
    // Don't keep the UI blocked if the API is slow (e.g. a cold-starting server).
    const timer = window.setTimeout(() => {
      if (!cancelled) setLoading(false)
    }, ME_TIMEOUT_MS)

    fetchMe()
      .then((me) => {
        if (!cancelled) setUser(me)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        const status = (err as { response?: { status?: number } })?.response?.status
        // Only an explicit auth rejection ends the session; network errors keep it.
        if (status === 401 || status === 403) {
          clearSession()
          setUserState(null)
        }
      })
      .finally(() => {
        window.clearTimeout(timer)
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [setUser])

  const login = useCallback(async (email: string, password: string) => {
    const data = await loginUser({ email, password })
    localStorage.setItem('token', data.token)
    setUser(data.user)
  }, [setUser])

  const loginWithGoogle = useCallback(async () => {
    const [{ FirebaseError }, { signInWithPopup }, { firebaseAuth, googleProvider, isFirebaseConfigured, mapFirebaseClientError }] = await Promise.all([
      import('firebase/app'), import('firebase/auth'), import('../firebase'),
    ])
    if (!isFirebaseConfigured()) {
      throw new Error('Hyrja me Google nuk është e konfiguruar')
    }
    try {
      const credential = await signInWithPopup(firebaseAuth(), googleProvider)
      const idToken = await credential.user.getIdToken()
      const data = await loginWithGoogleToken(idToken)
      localStorage.setItem('token', data.token)
      setUser(data.user)
      return true
    } catch (err) {
      if (err instanceof FirebaseError) {
        const message = mapFirebaseClientError(err.code)
        if (!message) return false
        throw new Error(message)
      }
      throw err
    }
  }, [setUser])

  const register = useCallback(
    async (firstName: string, lastName: string, email: string, password: string) => {
      const data = await registerUser({ firstName, lastName, email, password })
      localStorage.setItem('token', data.token)
      setUser(data.user)
    },
    [],
  )

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    const data = await changePasswordRequest({ currentPassword, newPassword })
    localStorage.setItem('token', data.token)
  }, [setUser])

  const updateProfile = useCallback(async (payload: ProfileUpdatePayload) => {
    const next = await updateProfileRequest(payload)
    setUser(next)
    return next
  }, [setUser])

  const uploadProfilePhoto = useCallback(async (file: File) => {
    const next = await uploadProfilePhotoRequest(file)
    setUser(next)
    return next
  }, [setUser])

  const refreshUser = useCallback(async () => {
    const next = await fetchMe()
    setUser(next)
    return next
  }, [setUser])

  const switchContext = useCallback(async (context: DashboardContext) => {
    const next = await setActiveContextRequest(context)
    setUser(next)
    return next
  }, [setUser])

  const logout = useCallback(() => {
    clearSession()
    setUserState(null)
    toast.info('U çkyçe me sukses.')
  }, [])

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      loginWithGoogle,
      register,
      changePassword,
      updateProfile,
      uploadProfilePhoto,
      switchContext,
      refreshUser,
      logout,
    }),
    [
      user,
      loading,
      login,
      loginWithGoogle,
      register,
      changePassword,
      updateProfile,
      uploadProfilePhoto,
      switchContext,
      refreshUser,
      logout,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
