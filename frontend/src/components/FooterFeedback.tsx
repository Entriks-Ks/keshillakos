import { useEffect, useId, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { MessageSquare, X } from 'lucide-react'
import { submitPlatformFeedback } from '../api/feedback'
import { useAuth } from '../auth/AuthContext'
import { getErrorMessage } from '../utils/errors'
import './FooterFeedback.css'

export default function FooterFeedback() {
  const { user } = useAuth()
  const titleId = useId()
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  useEffect(() => {
    if (!open) return
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [open])

  function close() {
    setOpen(false)
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setSending(true)
    setError('')
    try {
      await submitPlatformFeedback({
        message,
        name: user ? user.name : name,
        email: user ? user.email : email,
      })
      setMessage('')
      setName('')
      setEmail('')
      setSent(true)
    } catch (err) {
      setSent(false)
      setError(getErrorMessage(err))
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <button type="button" className="tt-feedback-open" onClick={() => setOpen(true)}>
        <MessageSquare size={15} aria-hidden />
        Dërgo feedback
      </button>
      {open
        ? createPortal(
            <div className="tt-feedback-modal" role="presentation" onMouseDown={close}>
              <div
                className="tt-feedback-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                onMouseDown={(event) => event.stopPropagation()}
              >
                <header className="tt-feedback-head">
                  <div className="tt-feedback-head-copy">
                    <span className="tt-feedback-mark" aria-hidden>
                      <MessageSquare size={18} />
                    </span>
                    <div>
                      <h2 id={titleId}>Feedback për KëshillaKos</h2>
                      <p>Na ndihmo ta përmirësojmë platformën.</p>
                    </div>
                  </div>
                  <button type="button" className="tt-feedback-close" onClick={close} aria-label="Mbyll">
                    <X size={18} />
                  </button>
                </header>
                {sent ? (
                  <div className="tt-feedback-done">
                    <p role="status">Faleminderit. Feedback-u iu dërgua adminit.</p>
                    <button type="button" className="tt-feedback-submit" onClick={close}>Mbyll</button>
                  </div>
                ) : (
                  <form className="tt-feedback-form" onSubmit={onSubmit}>
                    {user ? (
                      <p className="tt-feedback-as">Po dërgon si {user.name}</p>
                    ) : (
                      <div className="tt-feedback-fields">
                        <label>
                          Emri
                          <input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" maxLength={80} />
                        </label>
                        <label>
                          Email
                          <input
                            type="email"
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                            autoComplete="email"
                            required
                            maxLength={160}
                          />
                        </label>
                      </div>
                    )}
                    <label>
                      Mesazhi
                      <textarea
                        value={message}
                        onChange={(event) => setMessage(event.target.value)}
                        required
                        minLength={5}
                        maxLength={1000}
                        rows={4}
                        placeholder="Si po të duket KëshillaKos?"
                      />
                    </label>
                    {error ? <p className="tt-feedback-error" role="alert">{error}</p> : null}
                    <button type="submit" className="tt-feedback-submit" disabled={sending}>
                      {sending ? 'Duke u dërguar…' : 'Dërgo'}
                    </button>
                  </form>
                )}
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  )
}
