import { useState, useEffect, useRef, useCallback, type FormEvent, type KeyboardEvent } from 'react'
import { useLocation, Link } from 'react-router-dom'
import {
  Sparkles,
  X,
  Maximize2,
  Send,
  RotateCcw,
  Bot,
  User,
  ArrowRight,
} from 'lucide-react'
import {
  sendAiChatMessage,
  type AiChatMessage,
  type RecommendedEntity,
} from '../../api/aiChat'
import { FormattedAiMessage } from './FormattedAiMessage'
import { AiRecommendedCard } from './AiRecommendedCard'
import './AiChatWidget.css'

interface ChatMessageItem {
  id: string
  role: 'user' | 'assistant'
  content: string
  suggestedActions?: string[]
  recommendedEntities?: RecommendedEntity[]
}

const STARTER_PROMPTS = [
  'Si të hap një biznes në Kosovë (Sh.p.k.)?',
  'Më duhet një avokat në Prishtinë për kontratë',
  'Cilat janë taksat kryesore dhe TVSH në ATK?',
  'Si funksionon platforma KeshillaKos dhe planet?',
]

const STORAGE_KEY = 'kk_ai_chat_session'

export default function AiChatWidget() {
  const location = useLocation()
  const isDedicatedAiPage = location.pathname === '/ai-asistenti'

  const [isOpen, setIsOpen] = useState(false)
  const [hasPromptPill, setHasPromptPill] = useState(true)
  const [inputValue, setInputValue] = useState('')
  const [loading, setLoading] = useState(false)

  const [messages, setMessages] = useState<ChatMessageItem[]>(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY)
      if (saved) {
        return JSON.parse(saved)
      }
    } catch {
      // ignore
    }
    return []
  })

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const scrollToBottom = useCallback((smooth = true) => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({
        behavior: smooth ? 'smooth' : 'auto',
      })
    }
  }, [])

  useEffect(() => {
    if (isOpen) {
      scrollToBottom(false)
      textareaRef.current?.focus()
    }
  }, [isOpen, scrollToBottom])

  useEffect(() => {
    if (messages.length > 0) {
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages))
      } catch {
        // ignore
      }
      scrollToBottom(true)
    }
  }, [messages, scrollToBottom])

  async function handleSendMessage(textToSend?: string) {
    const text = (textToSend ?? inputValue).trim()
    if (!text || loading) return

    setInputValue('')
    setHasPromptPill(false)

    const userMessage: ChatMessageItem = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
    }

    const updatedMessages = [...messages, userMessage]
    setMessages(updatedMessages)
    setLoading(true)

    try {
      const payload: AiChatMessage[] = updatedMessages.map((m) => ({
        role: m.role,
        content: m.content,
      }))

      const response = await sendAiChatMessage(payload, {
        pathname: location.pathname,
      })

      const botMessage: ChatMessageItem = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: response.reply,
        suggestedActions: response.suggestedActions,
        recommendedEntities: response.recommendedEntities,
      }

      setMessages((prev) => [...prev, botMessage])
    } catch (err) {
      const errorMessage: ChatMessageItem = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content:
          'Më vjen keq, ndodhi një gabim gjatë përpunimit të kërkesës suaj. Ju lutem provoni sërish ose zgjidhni një nga pyetjet e sugjeruara.',
        suggestedActions: ['Provo përsëri', 'Shiko Ofertat', 'Faqja Kryesore'],
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  function handleResetChat() {
    setMessages([])
    try {
      sessionStorage.removeItem(STORAGE_KEY)
    } catch {
      // ignore
    }
  }

  // If we are already on the dedicated full AI page, we don't need the floating widget
  if (isDedicatedAiPage) {
    return null
  }

  return (
    <>
      {/* Floating launcher trigger */}
      <div className="kk-ai-trigger-container">
        {!isOpen && hasPromptPill && (
          <button
            type="button"
            className="kk-ai-trigger-pill"
            onClick={() => {
              setIsOpen(true)
              setHasPromptPill(false)
            }}
          >
            <Sparkles size={14} className="text-yellow-400" />
            <span>Keni pyetje? Pyet AI</span>
          </button>
        )}

        <button
          type="button"
          className="kk-ai-trigger-btn"
          onClick={() => {
            setIsOpen((prev) => !prev)
            setHasPromptPill(false)
          }}
          aria-label={isOpen ? 'Mbyll Këshilla AI' : 'Hap asistentin Këshilla AI'}
          aria-expanded={isOpen}
        >
          {isOpen ? <X size={24} /> : <Sparkles size={24} />}
          {!isOpen && <span className="kk-ai-trigger-badge" />}
        </button>
      </div>

      {/* Floating chat window */}
      {isOpen && (
        <div
          className="kk-ai-window"
          role="dialog"
          aria-modal="false"
          aria-label="Këshilla AI Chatbot"
        >
          {/* Header */}
          <div className="kk-ai-header">
            <div className="kk-ai-header-info">
              <div className="kk-ai-header-avatar">
                <Bot size={20} />
                <span className="kk-ai-avatar-online" />
              </div>
              <div className="kk-ai-header-titles">
                <div className="kk-ai-header-title-row">
                  <h3 className="kk-ai-header-title">Këshilla AI</h3>
                  <span className="kk-ai-gemini-badge">Gemini</span>
                </div>
                <p className="kk-ai-header-subtitle">Asistenti virtual i KeshillaKos</p>
              </div>
            </div>

            <div className="kk-ai-header-actions">
              <Link
                to="/ai-asistenti"
                onClick={() => setIsOpen(false)}
                className="kk-ai-header-btn"
                title="Hap në faqe të plotë"
                aria-label="Hap në faqe të plotë"
              >
                <Maximize2 size={16} />
              </Link>
              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={handleResetChat}
                  className="kk-ai-header-btn"
                  title="Pastro bisedën"
                  aria-label="Pastro bisedën"
                >
                  <RotateCcw size={15} />
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="kk-ai-header-btn"
                title="Minimizo"
                aria-label="Minimizo dritaren"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="kk-ai-body">
            {messages.length === 0 ? (
              <div className="kk-ai-welcome-box">
                <div className="kk-ai-welcome-icon">
                  <Sparkles size={24} />
                </div>
                <h4 className="kk-ai-welcome-title">Mirë se vini në Këshilla AI!</h4>
                <p className="kk-ai-welcome-desc">
                  Jam asistenti juaj inteligjent për Kosovën. Më pyet për regjistrim biznesi, taksa, kontrata apo gjetje ekspertësh.
                </p>

                <div className="kk-ai-starters-label">Pyetje të shpeshta</div>
                <div className="kk-ai-starters-grid">
                  {STARTER_PROMPTS.map((prompt, idx) => (
                    <button
                      key={idx}
                      type="button"
                      className="kk-ai-starter-chip"
                      onClick={() => handleSendMessage(prompt)}
                    >
                      <span>{prompt}</span>
                      <ArrowRight size={14} className="opacity-60 flex-shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg) => (
                <div key={msg.id} className="kk-ai-msg-group">
                  <div
                    className={`kk-ai-msg ${
                      msg.role === 'user' ? 'kk-ai-msg-user' : 'kk-ai-msg-assistant'
                    }`}
                  >
                    <div className="kk-ai-msg-avatar">
                      {msg.role === 'user' ? <User size={15} /> : <Bot size={16} />}
                    </div>
                    <div className="kk-ai-msg-bubble">
                      <FormattedAiMessage content={msg.content} />
                    </div>
                  </div>

                  {/* Render recommendation cards if available */}
                  {msg.recommendedEntities && msg.recommendedEntities.length > 0 && (
                    <div className="kk-ai-cards-container">
                      {msg.recommendedEntities.map((item) => (
                        <AiRecommendedCard
                          key={item.id}
                          item={item}
                          onNavigate={() => setIsOpen(false)}
                        />
                      ))}
                    </div>
                  )}

                  {/* Render action suggestions if available */}
                  {msg.suggestedActions && msg.suggestedActions.length > 0 && (
                    <div className="kk-ai-actions-row">
                      {msg.suggestedActions.map((action, idx) => (
                        <button
                          key={idx}
                          type="button"
                          className="kk-ai-action-btn"
                          onClick={() => handleSendMessage(action)}
                        >
                          {action}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}

            {/* Typing indicator */}
            {loading && (
              <div className="kk-ai-msg kk-ai-msg-assistant">
                <div className="kk-ai-msg-avatar">
                  <Bot size={16} />
                </div>
                <div className="kk-ai-typing">
                  <span className="kk-ai-typing-dot" />
                  <span className="kk-ai-typing-dot" />
                  <span className="kk-ai-typing-dot" />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Footer Input */}
          <div className="kk-ai-footer">
            <form
              className="kk-ai-input-form"
              onSubmit={(e: FormEvent) => {
                e.preventDefault()
                handleSendMessage()
              }}
            >
              <textarea
                ref={textareaRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Pyet për ligj, taksa, shërbime..."
                rows={1}
                className="kk-ai-textarea"
                disabled={loading}
              />
              <button
                type="submit"
                className="kk-ai-send-btn"
                disabled={!inputValue.trim() || loading}
                aria-label="Dërgo mesazhin"
              >
                <Send size={15} />
              </button>
            </form>
            <p className="kk-ai-disclaimer">
              Këshilla AI mund të bëjë gabime. Verifikoni me një ekspert të licencuar.
            </p>
          </div>
        </div>
      )}
    </>
  )
}
