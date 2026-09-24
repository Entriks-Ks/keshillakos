import { useState, type FormEvent } from 'react'
import { Button, FieldError, Input, Label, TextField, toast } from '@heroui/react'
import { ArrowRight, Building2, Eye, EyeOff, Scale, UserRound } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { useAuth } from '../auth/AuthContext'
import AuthShowcase from '../components/AuthShowcase'
import GoogleAuthButton from '../components/GoogleAuthButton'
import { getErrorMessage } from '../utils/errors'
import './LoginPage.css'

const accountSchema = z.object({
  firstName: z.string().trim().min(1, 'Emri është i detyrueshëm').max(80, 'Emri është shumë i gjatë'),
  lastName: z.string().trim().min(1, 'Mbiemri është i detyrueshëm').max(80, 'Mbiemri është shumë i gjatë'),
  email: z.string().trim().min(1, 'Email është i detyrueshëm').email('Email i pavlefshëm'),
})

const registerSchema = accountSchema.extend({
  password: z.string().min(6, 'Fjalëkalimi duhet të ketë të paktën 6 karaktere'),
  confirmPassword: z.string().min(1, 'Konfirmo fjalëkalimin'),
}).refine((values) => values.password === values.confirmPassword, {
  path: ['confirmPassword'],
  message: 'Fjalëkalimi dhe konfirmimi nuk përputhen',
})

type RegisterField = keyof z.infer<typeof registerSchema>

const roles = [
  { label: 'Klient', icon: UserRound },
  { label: 'Ekspert', icon: Scale },
  { label: 'Kompani', icon: Building2 },
]

export default function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState<1 | 2>(1)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [passwordVisible, setPasswordVisible] = useState(false)
  const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<RegisterField | 'terms', string>>>({})
  const [submitting, setSubmitting] = useState(false)

  function collectErrors(error: { issues: { path: PropertyKey[]; message: string }[] }) {
    const next: Partial<Record<RegisterField, string>> = {}
    for (const issue of error.issues) {
      const field = issue.path[0]
      if (typeof field === 'string' && !next[field as RegisterField]) {
        next[field as RegisterField] = issue.message
      }
    }
    return next
  }

  function onContinue(e: FormEvent) {
    e.preventDefault()
    const result = accountSchema.safeParse({ firstName, lastName, email })
    if (!result.success) {
      setFieldErrors(collectErrors(result.error))
      return
    }
    setFieldErrors({})
    setStep(2)
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const result = registerSchema.safeParse({ firstName, lastName, email, password, confirmPassword })
    const next = result.success ? {} : collectErrors(result.error)
    if (!acceptedTerms) next.terms = 'Prano kushtet për të vazhduar'
    if (!result.success || next.terms) {
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
      <div className="login-split">
        <AuthShowcase />
        <div className="auth-panel">
        <Link to="/" className="brand brand-link">
          KëshillaKos
        </Link>
        <h1>Krijo llogari</h1>
        <p className="auth-lead">Regjistrohu për të gjetur avokatë, juristë dhe kontabilistë.</p>

        <div className="register-progress" aria-hidden="true">
          <div className="register-progress-meta">
            <span>Hapi {step} nga 2</span>
            <span>{step === 1 ? 'Llogaria' : 'Siguria'}</span>
          </div>
          <div className="register-progress-track">
            <span style={{ width: step === 1 ? '50%' : '100%' }} />
          </div>
        </div>

        {step === 1 ? (
          <form onSubmit={onContinue} className="auth-form register-form" noValidate>
            <div className="register-names">
              <TextField isInvalid={Boolean(fieldErrors.firstName)} validationBehavior="aria" fullWidth>
                <Label>Emri</Label>
                <Input
                  type="text"
                  autoComplete="given-name"
                  placeholder="Emri"
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
                  placeholder="Mbiemri"
                  value={lastName}
                  onChange={(e) => {
                    setLastName(e.target.value)
                    setFieldErrors((current) => ({ ...current, lastName: undefined }))
                  }}
                />
                <FieldError>{fieldErrors.lastName}</FieldError>
              </TextField>
            </div>
            <TextField isInvalid={Boolean(fieldErrors.email)} validationBehavior="aria" fullWidth>
              <Label>Email</Label>
              <Input
                type="email"
                autoComplete="email"
                placeholder="ti@shembull.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  setFieldErrors((current) => ({ ...current, email: undefined }))
                }}
              />
              <FieldError>{fieldErrors.email}</FieldError>
            </TextField>

            <div className="register-roles">
              <span>Rolet</span>
              <div className="register-role-grid">
                {roles.map((item) => {
                  const Icon = item.icon
                  return (
                    <div key={item.label} className="register-role">
                      <Icon size={22} strokeWidth={1.8} />
                      {item.label}
                    </div>
                  )
                })}
              </div>
            </div>

            <Button type="submit" size="md" className="auth-submit" fullWidth>
              Vazhdo <ArrowRight size={16} />
            </Button>
          </form>
        ) : (
          <form onSubmit={onSubmit} className="auth-form register-form" noValidate>
            <TextField isInvalid={Boolean(fieldErrors.password)} validationBehavior="aria" fullWidth>
              <Label>Fjalëkalimi</Label>
              <span className="password-control">
                <Input
                  type={passwordVisible ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="Krijo një fjalëkalim"
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
                  placeholder="Përsërit fjalëkalimin"
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

            <label className="register-terms">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => {
                  setAcceptedTerms(e.target.checked)
                  setFieldErrors((current) => ({ ...current, terms: undefined }))
                }}
              />
              <span>
                Pranoj <Link to="/kushtet">Kushtet e përdorimit</Link> dhe <Link to="/privatesia">Privatësinë</Link>.
              </span>
            </label>
            {fieldErrors.terms ? <p className="error">{fieldErrors.terms}</p> : null}

            <div className="register-actions">
              <button type="button" className="register-back" onClick={() => setStep(1)}>Kthehu</button>
              <Button type="submit" size="md" className="auth-submit" isDisabled={submitting}>
                {submitting ? 'Duke u regjistruar...' : 'Krijo llogari'} <ArrowRight size={16} />
              </Button>
            </div>
          </form>
        )}

        {step === 1 ? <GoogleAuthButton disabled={submitting} /> : null}

        <p className="switch">
          Ke tashmë llogari? <Link to="/login">Hyr</Link>
        </p>
        </div>
      </div>
    </div>
  )
}
