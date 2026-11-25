import { useState, type FormEvent } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { Button, FieldError, Input, Label, TextField, toast } from '@heroui/react'
import { ArrowRight, Building2, Eye, EyeOff, Scale, UserRound } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { useAuth } from '../auth/AuthContext'
import AuthShowcase from '../components/AuthShowcase'
import GoogleAuthButton from '../components/GoogleAuthButton'
import { LogoMark, LogoWordmark } from '../components/Logo'
import { getErrorMessage } from '../utils/errors'
import './LoginPage.css'

/** Messages are i18n keys, translated where they are displayed. */
const accountSchema = z.object({
  firstName: z.string().trim().min(1, 'register.firstNameRequired').max(80, 'register.firstNameTooLong'),
  lastName: z.string().trim().min(1, 'register.lastNameRequired').max(80, 'register.lastNameTooLong'),
  email: z.string().trim().min(1, 'auth.emailRequired').email('auth.emailInvalid'),
})

const registerSchema = accountSchema.extend({
  password: z.string().min(6, 'auth.passwordShort'),
  confirmPassword: z.string().min(1, 'register.confirmRequired'),
}).refine((values) => values.password === values.confirmPassword, {
  path: ['confirmPassword'],
  message: 'register.passwordMismatch',
})

type RegisterField = keyof z.infer<typeof registerSchema>
type RegisterErrors = Partial<Record<RegisterField | 'terms', string>>

const roles = [
  { label: 'auth.client', icon: UserRound },
  { label: 'auth.expert', icon: Scale },
  { label: 'auth.company', icon: Building2 },
]

export default function RegisterPage() {
  const { t } = useTranslation()
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
  const [fieldErrors, setFieldErrors] = useState<RegisterErrors>({})
  const [submitting, setSubmitting] = useState(false)

  function collectErrors(error: { issues: { path: PropertyKey[]; message: string }[] }) {
    const next: RegisterErrors = {}
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
    const next: RegisterErrors = result.success ? {} : collectErrors(result.error)
    if (!acceptedTerms) next.terms = 'register.termsRequired'
    if (!result.success || next.terms) {
      setFieldErrors(next)
      return
    }
    setFieldErrors({})
    setSubmitting(true)
    try {
      await register(result.data.firstName, result.data.lastName, result.data.email, result.data.password)
      toast.success(t('register.success'))
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
        <Link to="/" className="brand brand-link" aria-label={t('nav.home')}>
          <LogoMark size={36} />
          <LogoWordmark height={23} />
        </Link>
        <h1>{t('auth.create')}</h1>
        <p className="auth-lead">{t('auth.registerLead')}</p>

        <div className="register-progress" aria-hidden="true">
          <div className="register-progress-meta">
            <span>{t('home.progress', { step, total: 2 })}</span>
            <span>{step === 1 ? t('auth.account') : t('auth.security')}</span>
          </div>
          <div className="register-progress-track">
            <span style={{ width: step === 1 ? '50%' : '100%' }} />
          </div>
        </div>

        {step === 1 ? (
          <form onSubmit={onContinue} className="auth-form register-form" noValidate>
            <div className="register-names">
              <TextField isInvalid={Boolean(fieldErrors.firstName)} validationBehavior="aria" fullWidth>
                <Label>{t('register.firstName')}</Label>
                <Input
                  type="text"
                  autoComplete="given-name"
                  placeholder={t('register.firstName')}
                  value={firstName}
                  onChange={(e) => {
                    setFirstName(e.target.value)
                    setFieldErrors((current) => ({ ...current, firstName: undefined }))
                  }}
                />
                <FieldError>{fieldErrors.firstName ? t(fieldErrors.firstName) : null}</FieldError>
              </TextField>
              <TextField isInvalid={Boolean(fieldErrors.lastName)} validationBehavior="aria" fullWidth>
                <Label>{t('register.lastName')}</Label>
                <Input
                  type="text"
                  autoComplete="family-name"
                  placeholder={t('register.lastName')}
                  value={lastName}
                  onChange={(e) => {
                    setLastName(e.target.value)
                    setFieldErrors((current) => ({ ...current, lastName: undefined }))
                  }}
                />
                <FieldError>{fieldErrors.lastName ? t(fieldErrors.lastName) : null}</FieldError>
              </TextField>
            </div>
            <TextField isInvalid={Boolean(fieldErrors.email)} validationBehavior="aria" fullWidth>
              <Label>{t('req.email')}</Label>
              <Input
                type="email"
                autoComplete="email"
                placeholder={t('register.emailPlaceholder')}
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  setFieldErrors((current) => ({ ...current, email: undefined }))
                }}
              />
              <FieldError>{fieldErrors.email ? t(fieldErrors.email) : null}</FieldError>
            </TextField>

            <div className="register-roles">
              <span>{t('auth.roles')}</span>
              <div className="register-role-grid">
                {roles.map((item) => {
                  const Icon = item.icon
                  return (
                    <div key={item.label} className="register-role">
                      <Icon size={22} strokeWidth={1.8} />
                      {t(item.label)}
                    </div>
                  )
                })}
              </div>
            </div>

            <Button type="submit" size="md" className="auth-submit" fullWidth>
              {t('home.next')} <ArrowRight size={16} />
            </Button>
          </form>
        ) : (
          <form onSubmit={onSubmit} className="auth-form register-form" noValidate>
            <TextField isInvalid={Boolean(fieldErrors.password)} validationBehavior="aria" fullWidth>
              <Label>{t('auth.password')}</Label>
              <span className="password-control">
                <Input
                  type={passwordVisible ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder={t('register.passwordPlaceholder')}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    setFieldErrors((current) => ({ ...current, password: undefined, confirmPassword: undefined }))
                  }}
                />
                <Button type="button" variant="ghost" size="sm" isIconOnly className="password-toggle"
                  aria-label={passwordVisible ? t('auth.hide') : t('auth.show')}
                  aria-pressed={passwordVisible} onPress={() => setPasswordVisible((visible) => !visible)}>
                  {passwordVisible ? <Eye size={18} aria-hidden="true" /> : <EyeOff size={18} aria-hidden="true" />}
                </Button>
              </span>
              <FieldError>{fieldErrors.password ? t(fieldErrors.password) : null}</FieldError>
            </TextField>
            <TextField isInvalid={Boolean(fieldErrors.confirmPassword)} validationBehavior="aria" fullWidth>
              <Label>{t('register.confirmPassword')}</Label>
              <span className="password-control">
                <Input
                  type={confirmPasswordVisible ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder={t('register.confirmPlaceholder')}
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value)
                    setFieldErrors((current) => ({ ...current, confirmPassword: undefined }))
                  }}
                />
                <Button type="button" variant="ghost" size="sm" isIconOnly className="password-toggle"
                  aria-label={confirmPasswordVisible ? t('auth.hide') : t('auth.show')}
                  aria-pressed={confirmPasswordVisible} onPress={() => setConfirmPasswordVisible((visible) => !visible)}>
                  {confirmPasswordVisible ? <Eye size={18} aria-hidden="true" /> : <EyeOff size={18} aria-hidden="true" />}
                </Button>
              </span>
              <FieldError>{fieldErrors.confirmPassword ? t(fieldErrors.confirmPassword) : null}</FieldError>
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
                <Trans
                  i18nKey="register.terms"
                  components={{ terms: <Link to="/kushtet" />, privacy: <Link to="/privatesia" /> }}
                />
              </span>
            </label>
            {fieldErrors.terms ? <p className="error">{t(fieldErrors.terms)}</p> : null}

            <div className="register-actions">
              <button type="button" className="register-back" onClick={() => setStep(1)}>{t('home.back')}</button>
              <Button type="submit" size="md" className="auth-submit" isDisabled={submitting}>
                {submitting ? t('register.submitting') : t('register.submit')} <ArrowRight size={16} />
              </Button>
            </div>
          </form>
        )}

        {step === 1 ? <GoogleAuthButton disabled={submitting} /> : null}

        <p className="switch">
          {t('register.haveAccount')} <Link to="/login">{t('nav.login')}</Link>
        </p>
        </div>
      </div>
    </div>
  )
}
