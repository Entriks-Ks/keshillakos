import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, FieldError, Input, InputGroup, Label, TextField, toast } from '@heroui/react'
import { Eye, EyeOff } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { useAuth } from '../auth/AuthContext'
import AuthShowcase from '../components/AuthShowcase'
import GoogleAuthButton from '../components/GoogleAuthButton'
import { getErrorMessage } from '../utils/errors'
import './LoginPage.css'

const loginSchema = (t: (key: string) => string) => z.object({
  email: z.string().trim().min(1, t('auth.emailRequired')).email(t('auth.emailInvalid')),
  password: z.string().min(6, t('auth.passwordShort')),
})

type LoginField = 'email' | 'password'

export default function LoginPage() {
  const { t } = useTranslation()
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordVisible, setPasswordVisible] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<LoginField, string>>>({})
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const result = loginSchema(t).safeParse({ email, password })
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
      toast.success(t('auth.hello'))
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
          KLAW
        </Link>
        <h1>{t('auth.welcome')}</h1>
        <p className="auth-lead">{t('auth.loginLead')}</p>

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
            <Label>{t('auth.password')}</Label>
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
                  aria-label={passwordVisible ? t('auth.hide') : t('auth.show')}
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
            {submitting ? t('auth.entering') : t('auth.login')}
          </Button>
        </form>

        <GoogleAuthButton disabled={submitting} />

        <p className="switch">
          {t('auth.noAccount')} <Link to="/register">{t('auth.register')}</Link>
        </p>
        </div>
      </div>
    </div>
  )
}
