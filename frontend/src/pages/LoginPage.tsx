import { useState, type FormEvent } from 'react'
import { Button, FieldError, Input, InputGroup, Label, TextField, toast } from '@heroui/react'
import { Eye, EyeOff } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { useAuth } from '../auth/AuthContext'
import GoogleAuthButton from '../components/GoogleAuthButton'
import { getErrorMessage } from '../utils/errors'

const loginSchema = z.object({
  email: z.string().trim().min(1, 'Email është i detyrueshëm').email('Email i pavlefshëm'),
  password: z.string().min(6, 'Fjalëkalimi duhet të ketë të paktën 6 karaktere'),
})

type LoginField = keyof z.infer<typeof loginSchema>

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordVisible, setPasswordVisible] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<LoginField, string>>>({})
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const result = loginSchema.safeParse({ email, password })
    if (!result.success) {
      const next: Partial<Record<LoginField, string>> = {}
      for (const issue of result.error.issues) {
        const field = issue.path[0]
        if ((field === 'email' || field === 'password') && !next[field]) next[field] = issue.message
      }
      setFieldErrors(next)
      return
    }
    setFieldErrors({})
    setSubmitting(true)
    try {
      await login(email, password)
      toast.success('Mirë se erdhe! Hyrja u krye me sukses.')
      navigate('/dashboard', { replace: true })
    } catch (err) {
      toast.danger(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-panel">
        <Link to="/" className="brand brand-link">
          KëshillaKos
        </Link>
        <h1>Hyr në llogari</h1>

        <form onSubmit={onSubmit} className="auth-form login-form" noValidate>
          <TextField isInvalid={Boolean(fieldErrors.email)} validationBehavior="aria" fullWidth>
            <Label>Email</Label>
            <Input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                setFieldErrors((current) => ({ ...current, email: undefined }))
              }}
            />
            <FieldError>{fieldErrors.email}</FieldError>
          </TextField>
          <TextField isInvalid={Boolean(fieldErrors.password)} validationBehavior="aria" fullWidth>
            <Label>Fjalëkalimi</Label>
            <InputGroup fullWidth>
              <InputGroup.Input
                type={passwordVisible ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  setFieldErrors((current) => ({ ...current, password: undefined }))
                }}
              />
              <InputGroup.Suffix>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  isIconOnly
                  aria-label={passwordVisible ? 'Fshih fjalëkalimin' : 'Shfaq fjalëkalimin'}
                  aria-pressed={passwordVisible}
                  onPress={() => setPasswordVisible((visible) => !visible)}
                >
                  {passwordVisible ? <Eye size={18} aria-hidden="true" /> : <EyeOff size={18} aria-hidden="true" />}
                </Button>
              </InputGroup.Suffix>
            </InputGroup>
            <FieldError>{fieldErrors.password}</FieldError>
          </TextField>

          <Button type="submit" size="md" className="auth-submit" isDisabled={submitting} fullWidth>
            {submitting ? 'Duke hyrë...' : 'Hyr'}
          </Button>
        </form>

        <GoogleAuthButton disabled={submitting} />

        <p className="switch">
          Nuk ke llogari? <Link to="/register">Regjistrohu</Link>
        </p>
      </div>
    </div>
  )
}
