import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  changePassword as changePasswordRequest,
  fetchMe,
  loginUser,
  registerUser,
  updateProfile as updateProfileRequest,
  uploadProfilePhoto as uploadProfilePhotoRequest,
  type AuthUser,
  type ProfileUpdatePayload,
  type PublicRole,
} from '../api/auth'

type AuthContextValue = {
  user: AuthUser | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (
    name: string,
    email: string,
    password: string,
    role: PublicRole,
  ) => Promise<void>
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>
  updateProfile: (payload: ProfileUpdatePayload) => Promise<AuthUser>
  uploadProfilePhoto: (file: File) => Promise<AuthUser>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      setLoading(false)
      return
    }

    fetchMe()
      .then(setUser)
      .catch(() => {
        localStorage.removeItem('token')
        setUser(null)
      })
      .finally(() => setLoading(false))
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const data = await loginUser({ email, password })
    localStorage.setItem('token', data.token)
    setUser(data.user)
  }, [])

  const register = useCallback(
    async (name: string, email: string, password: string, role: PublicRole) => {
      const data = await registerUser({ name, email, password, role })
      localStorage.setItem('token', data.token)
      setUser(data.user)
    },
    [],
  )

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    const data = await changePasswordRequest({ currentPassword, newPassword })
    localStorage.setItem('token', data.token)
  }, [])

  const updateProfile = useCallback(async (payload: ProfileUpdatePayload) => {
    const next = await updateProfileRequest(payload)
    setUser(next)
    return next
  }, [])

  const uploadProfilePhoto = useCallback(async (file: File) => {
    const next = await uploadProfilePhotoRequest(file)
    setUser(next)
    return next
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('token')
    setUser(null)
  }, [])

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      register,
      changePassword,
      updateProfile,
      uploadProfilePhoto,
      logout,
    }),
    [
      user,
      loading,
      login,
      register,
      changePassword,
      updateProfile,
      uploadProfilePhoto,
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
