import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { PublicRole } from '../api/auth'
import { useAuth } from '../auth/AuthContext'
import { getErrorMessage } from '../utils/errors'

const ROLE_OPTIONS: { value: PublicRole; label: string; hint: string }[] = [
  {
    value: 'user',
    label: 'Përdorues',
    hint: 'Kërkoj ndihmë / ekspert',
  },
  {
    value: 'provider',
    label: 'Ofrues shërbimi',
    hint: 'Ofroj këshilla profesionale',
  },
  {
    value: 'company',
    label: 'Kompani',
    hint: 'Kam ekspertë të mi në ekip',
  },
]

export default function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<PublicRole>('user')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await register(name, email, password, role)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(getErrorMessage(err))
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
        <p className="muted">Zgjidh rolin dhe regjistrohu.</p>

        <form onSubmit={onSubmit} className="auth-form">
          <fieldset className="role-fieldset">
            <legend>Unë jam</legend>
            <div className="role-options">
              {ROLE_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className={`role-option${role === option.value ? ' is-selected' : ''}`}
                >
                  <input
                    type="radio"
                    name="role"
                    value={option.value}
                    checked={role === option.value}
                    onChange={() => setRole(option.value)}
                  />
                  <span className="role-option-text">
                    <strong>{option.label}</strong>
                    <small>{option.hint}</small>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <label>
            {role === 'company' ? 'Emri i kompanisë' : 'Emri'}
            <input
              type="text"
              autoComplete="organization"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </label>
          <label>
            Email
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label>
            Fjalëkalimi
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </label>

          {error ? <p className="error">{error}</p> : null}

          <button type="submit" disabled={submitting}>
            {submitting ? 'Duke u regjistruar...' : 'Regjistrohu'}
          </button>
        </form>

        <p className="switch">
          Ke tashmë llogari? <Link to="/login">Hyr</Link>
        </p>
      </div>
    </div>
  )
}
