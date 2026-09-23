import { useState, type FormEvent } from 'react'
import { Button, FieldError, Input, Label, TextField, toast } from '@heroui/react'
import { Eye, EyeOff } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { useAuth } from '../auth/AuthContext'
import GoogleAuthButton from '../components/GoogleAuthButton'
import { getErrorMessage } from '../utils/errors'

const registerSchema = z.object({
  firstName: z.string().trim().min(1, 'Emri është i detyrueshëm').max(80, 'Emri është shumë i gjatë'),
  lastName: z.string().trim().min(1, 'Mbiemri është i detyrueshëm').max(80, 'Mbiemri është shumë i gjatë'),
  email: z.string().trim().min(1, 'Email është i detyrueshëm').email('Email i pavlefshëm'),
  password: z.string().min(6, 'Fjalëkalimi duhet të ketë të paktën 6 karaktere'),
  confirmPassword: z.string().min(1, 'Konfirmo fjalëkalimin'),
}).refine((values) => values.password === values.confirmPassword, {
  path: ['confirmPassword'],
  message: 'Fjalëkalimi dhe konfirmimi nuk përputhen',
})

type RegisterField = keyof z.infer<typeof registerSchema>

export default function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordVisible, setPasswordVisible] = useState(false)
  const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<RegisterField, string>>>({})
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const result = registerSchema.safeParse({ firstName, lastName, email, password, confirmPassword })
    if (!result.success) {
      const next: Partial<Record<RegisterField, string>> = {}
      for (const issue of result.error.issues) {
        const field = issue.path[0]
        if (typeof field === 'string' && field in registerSchema.shape && !next[field as RegisterField]) {
          next[field as RegisterField] = issue.message
        }
      }
      setFieldErrors(next)
      return
    }
    setFieldErrors({})
    setSubmitting(true)
    try {
      await register(result.data.firstName, result.data.lastName, result.data.email, result.data.password)
      toast.success('Llogaria u krijua. Mirë se erdhe!')
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
        <h1>Krijo llogari</h1>

        <form onSubmit={onSubmit} className="auth-form register-form" noValidate>
          <TextField isInvalid={Boolean(fieldErrors.firstName)} validationBehavior="aria" fullWidth>
            <Label>Emri</Label>
            <Input
              type="text"
              autoComplete="given-name"
              value={firstName}
              onChange={(e) => {
                setFirstName(e.target.value)
                setFieldErrors((current) => ({ ...current, firstName: undefined }))
              }}
            />
            <FieldError>{fieldErrors.firstName}</FieldError>
          </TextField>
          <TextField isInvalid={Boolean(fieldErrors.lastName)} validationBehavior="aria" fullWidth>
            <Label>Mbiemri</Label>
            <Input
              type="text"
              autoComplete="family-name"
              value={lastName}
              onChange={(e) => {
                setLastName(e.target.value)
                setFieldErrors((current) => ({ ...current, lastName: undefined }))
              }}
            />
            <FieldError>{fieldErrors.lastName}</FieldError>
          </TextField>
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
            <span className="password-control">
              <Input
                type={passwordVisible ? 'text' : 'password'}
                autoComplete="new-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  setFieldErrors((current) => ({ ...current, password: undefined, confirmPassword: undefined }))
                }}
              />
              <Button type="button" variant="ghost" size="sm" isIconOnly className="password-toggle"
                aria-label={passwordVisible ? 'Fshih fjalëkalimin' : 'Shfaq fjalëkalimin'}
                aria-pressed={passwordVisible} onPress={() => setPasswordVisible((visible) => !visible)}>
                {passwordVisible ? <Eye size={18} aria-hidden="true" /> : <EyeOff size={18} aria-hidden="true" />}
              </Button>
            </span>
            <FieldError>{fieldErrors.password}</FieldError>
          </TextField>
          <TextField isInvalid={Boolean(fieldErrors.confirmPassword)} validationBehavior="aria" fullWidth>
            <Label>Konfirmo fjalëkalimin</Label>
            <span className="password-control">
              <Input
                type={confirmPasswordVisible ? 'text' : 'password'}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value)
                  setFieldErrors((current) => ({ ...current, confirmPassword: undefined }))
                }}
              />
              <Button type="button" variant="ghost" size="sm" isIconOnly className="password-toggle"
                aria-label={confirmPasswordVisible ? 'Fshih fjalëkalimin' : 'Shfaq fjalëkalimin'}
                aria-pressed={confirmPasswordVisible} onPress={() => setConfirmPasswordVisible((visible) => !visible)}>
                {confirmPasswordVisible ? <Eye size={18} aria-hidden="true" /> : <EyeOff size={18} aria-hidden="true" />}
              </Button>
            </span>
            <FieldError>{fieldErrors.confirmPassword}</FieldError>
          </TextField>

          <Button type="submit" size="md" className="auth-submit" isDisabled={submitting} fullWidth>
            {submitting ? 'Duke u regjistruar...' : 'Regjistrohu'}
          </Button>
        </form>

        <GoogleAuthButton disabled={submitting} />

        <p className="switch">
          Ke tashmë llogari? <Link to="/login">Hyr</Link>
        </p>
      </div>
    </div>
  )
}
