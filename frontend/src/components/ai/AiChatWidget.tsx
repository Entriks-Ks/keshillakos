import { useState, useEffect, useRef, useCallback, type FormEvent, type KeyboardEvent, type ChangeEvent } from 'react'
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
  Copy,
  Check,
  Briefcase,
  Scale,
  Calculator,
  Building2,
  Trash2,
} from 'lucide-react'
import { toast } from '@heroui/react'
import {
  sendAiChatMessage,
  type AiChatMessage,
  type RecommendedEntity,
} from '../../api/aiChat'
import { FormattedAiMessage } from './FormattedAiMessage'
import { AiRecommendedCard } from './AiRecommendedCard'
import { useCompareLawyers } from '../../hooks/useCompareLawyers'
import './AiChatWidget.css'

interface ChatMessageItem {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp?: string
  suggestedActions?: string[]
  recommendedEntities?: RecommendedEntity[]
}

interface StarterTopic {
  id: string
  category: 'business' | 'law' | 'taxes' | 'platform'
  icon: typeof Briefcase
  badge: string
  title: string
  prompt: string
}

const STARTER_CATEGORIES = [
  { id: 'all', label: 'Të gjitha' },
  { id: 'business', label: '🏢 Biznes' },
  { id: 'law', label: '⚖️ Ligj' },
  { id: 'taxes', label: '💰 Taksa' },
  { id: 'platform', label: '⭐ KeshillaKos' },
] as const

const STARTER_TOPICS: StarterTopic[] = [
  {
    id: 'arbk',
    category: 'business',
    icon: Briefcase,
    badge: 'ARBK',
    title: 'Hapja e Biznesit (Sh.p.k.)',
    prompt: 'Si të regjistroj një biznes në Kosovë (Sh.p.k.) dhe cilat janë dokumentet në ARBK?',
  },
  {
    id: 'contract',
    category: 'law',
    icon: Scale,
    badge: 'Ligj',
    title: 'Avokat për Kontratë Pune',
    prompt: 'Më duhet një avokat në Prishtinë për kontratë pune sipas Ligjit të Punës në Kosovë.',
  },
  {
    id: 'atk',
    category: 'taxes',
    icon: Calculator,
    badge: 'ATK',
    title: 'Pragu i TVSH-së & Taksat',
    prompt: 'Cilat janë normat kryesore të taksave dhe kur regjistrohet TVSH (30,000€) në ATK?',
  },
  {
    id: 'property',
    category: 'law',
    icon: Building2,
    badge: 'Prona',
    title: 'Blerja e Pronës & Noteri',
    prompt: 'Cilat janë hapat dhe tarifat e noterit për verifikimin dhe blerjen e një prone në Kosovë?',
  },
  {
    id: 'plans',
    category: 'platform',
    icon: Sparkles,
    badge: 'Platforma',
    title: 'Planet & 0% Komision',
    prompt: 'Si funksionon platforma KeshillaKos dhe çfarë përfitimesh ka Plani Pro për ofruesit?',
  },
]

const STORAGE_KEY = 'kk_ai_chat_session'

function formatMessageTime(): string {
  try {
    return new Date().toLocaleTimeString('sq-AL', {
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return 'Tani'
  }
}

export default function AiChatWidget() {
  const location = useLocation()
  const isDedicatedAiPage = location.pathname === '/ai-asistenti'
  const { count: compareCount } = useCompareLawyers()
  const hasCompareDock =
    compareCount > 0 &&
    location.pathname !== '/krahaso' &&
    location.pathname !== '/krahaso-avokatet'
  const isDashboard = location.pathname.startsWith('/dashboard')

  const [isOpen, setIsOpen] = useState(false)
  const [hasPromptPill, setHasPromptPill] = useState(true)
  const [inputValue, setInputValue] = useState('')
  const [loading, setLoading] = useState(false)
  const [activeCategory, setActiveCategory] = useState<string>('all')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [copiedFullChat, setCopiedFullChat] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)

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

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDownGlobal = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false)
        setShowResetConfirm(false)
      }
    }
    window.addEventListener('keydown', handleKeyDownGlobal)
    return () => window.removeEventListener('keydown', handleKeyDownGlobal)
  }, [isOpen])

  // Prevent background body scroll on mobile when sheet is open
  useEffect(() => {
    if (isOpen && typeof window !== 'undefined' && window.innerWidth <= 640) {
      const originalOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = originalOverflow
      }
    }
  }, [isOpen])

  useEffect(() => {
    if (isOpen) {
      scrollToBottom(false)
      // Only autofocus on desktop to prevent iOS keyboard jumping on sheet open
      if (typeof window !== 'undefined' && window.innerWidth > 640) {
        textareaRef.current?.focus()
      }
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

  const handleInputChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value)
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`
    }
  }

  async function handleSendMessage(textToSend?: string) {
    const text = (textToSend ?? inputValue).trim()
    if (!text || loading) return

    setInputValue('')
    setHasPromptPill(false)
    setShowResetConfirm(false)

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }

    const userMessage: ChatMessageItem = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: formatMessageTime(),
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
        timestamp: formatMessageTime(),
        suggestedActions: response.suggestedActions,
        recommendedEntities: response.recommendedEntities,
      }

      setMessages((prev) => [...prev, botMessage])
    } catch {
      const errorMessage: ChatMessageItem = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content:
          'Më vjen keq, ndodhi një gabim gjatë përpunimit të kërkesës suaj. Mund të provoni përsëri ose të zgjidhni një nga pyetjet e sugjeruara.',
        timestamp: formatMessageTime(),
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

  async function handleCopyMessage(id: string, text: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(id)
      toast.success('Përgjigja u kopjua!')
      setTimeout(() => setCopiedId(null), 2200)
    } catch {
      toast.danger('Dështoi kopjimi.')
    }
  }

  async function handleCopyFullChat() {
    if (messages.length === 0) return
    const transcript = messages
      .map((m) => `${m.role === 'user' ? '👤 Ju' : '🤖 Këshilla AI'} (${m.timestamp || ''}):\n${m.content}\n`)
      .join('\n---\n\n')
    try {
      await navigator.clipboard.writeText(`Bisedë me Këshilla AI (KeshillaKos):\n\n${transcript}`)
      setCopiedFullChat(true)
      toast.success('E gjithë biseda u kopjua në kujtesë!')
      setTimeout(() => setCopiedFullChat(false), 2200)
    } catch {
      toast.danger('Dështoi kopjimi.')
    }
  }

  function handleConfirmReset() {
    setMessages([])
    setShowResetConfirm(false)
    try {
      sessionStorage.removeItem(STORAGE_KEY)
      toast.info('Biseda u pastrua.')
    } catch {
      // ignore
    }
  }

  // If we are already on the dedicated full AI page, we don't need the floating widget
  if (isDedicatedAiPage) {
    return null
  }

  const filteredTopics = activeCategory === 'all'
    ? STARTER_TOPICS
    : STARTER_TOPICS.filter((t) => t.category === activeCategory)

  return (
    <>
      {/* Floating launcher trigger */}
      <div
        className={`kk-ai-trigger-container${hasCompareDock ? ' has-dock' : ''}${isDashboard ? ' has-dash-nav' : ''}${isOpen ? ' is-open' : ''}`}
      >
        {!isOpen && hasPromptPill && !hasCompareDock && (
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
            setShowResetConfirm(false)
          }}
          aria-label={isOpen ? 'Mbyll Këshilla AI' : 'Hap asistentin Këshilla AI'}
          aria-expanded={isOpen}
        >
          {isOpen ? <X size={24} /> : <Sparkles size={24} />}
          {!isOpen && <span className="kk-ai-trigger-badge" />}
        </button>
      </div>

      {/* Backdrop overlay for closing on outside click */}
      {isOpen && (
        <div
          className="kk-ai-backdrop"
          onClick={() => {
            setIsOpen(false)
            setShowResetConfirm(false)
          }}
          aria-hidden="true"
        />
      )}

      {/* Floating chat window */}
      {isOpen && (
        <div
          className="kk-ai-window"
          role="dialog"
          aria-modal="true"
          aria-label="Këshilla AI Chatbot"
        >
          {/* Mobile Sheet Drag Handle */}
          <button
            type="button"
            className="kk-ai-drag-handle-bar"
            onClick={() => setIsOpen(false)}
            aria-label="Mbyll asistentin"
          >
            <span className="kk-ai-drag-handle" />
          </button>

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
                <>
                  <button
                    type="button"
                    onClick={handleCopyFullChat}
                    className="kk-ai-header-btn"
                    title="Kopjo të gjithë bisedën"
                    aria-label="Kopjo të gjithë bisedën"
                  >
                    {copiedFullChat ? <Check size={15} className="text-green-500" /> : <Copy size={15} />}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowResetConfirm((prev) => !prev)}
                    className={`kk-ai-header-btn${showResetConfirm ? ' is-active' : ''}`}
                    title="Pastro bisedën"
                    aria-label="Pastro bisedën"
                  >
                    <RotateCcw size={15} />
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false)
                  setShowResetConfirm(false)
                }}
                className="kk-ai-header-btn kk-ai-close-btn"
                title="Minimizo"
                aria-label="Minimizo dritaren"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Reset Confirmation Banner */}
          {showResetConfirm && (
            <div className="kk-ai-reset-confirm-bar" role="alert">
              <span className="kk-ai-reset-confirm-text">Dëshironi ta pastroni bisedën?</span>
              <div className="kk-ai-reset-confirm-actions">
                <button
                  type="button"
                  className="kk-ai-confirm-yes"
                  onClick={handleConfirmReset}
                >
                  <Trash2 size={12} />
                  <span>Po, pastro</span>
                </button>
                <button
                  type="button"
                  className="kk-ai-confirm-no"
                  onClick={() => setShowResetConfirm(false)}
                >
                  Anulo
                </button>
              </div>
            </div>
          )}

          {/* Body */}
          <div className="kk-ai-body">
            {messages.length === 0 ? (
              <div className="kk-ai-welcome-box">
                <div className="kk-ai-welcome-badge">
                  <Sparkles size={13} className="text-yellow-400" />
                  <span>Asistenti Zyrtar i KeshillaKos</span>
                </div>
                <h4 className="kk-ai-welcome-title">Si mund t&apos;ju ndihmoj sot?</h4>
                <p className="kk-ai-welcome-desc">
                  Jam këtu për t&apos;ju ndihmuar me ligjin në Kosovë, regjistrimin e biznesit, taksat dhe gjetjen e ekspertëve të verifikuar.
                </p>

                {/* Category filter tabs */}
                <div className="kk-ai-cat-pill-row" role="tablist" aria-label="Kategoritë e pyetjeve">
                  {STARTER_CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      role="tab"
                      aria-selected={activeCategory === cat.id}
                      className={`kk-ai-cat-pill${activeCategory === cat.id ? ' is-active' : ''}`}
                      onClick={() => setActiveCategory(cat.id)}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>

                {/* Quick starter question chips */}
                <div className="kk-ai-starters-grid">
                  {filteredTopics.map((topic) => {
                    const Icon = topic.icon
                    return (
                      <button
                        key={topic.id}
                        type="button"
                        className="kk-ai-starter-chip"
                        onClick={() => handleSendMessage(topic.prompt)}
                      >
                        <div className="kk-ai-starter-left">
                          <span className="kk-ai-starter-icon-wrap">
                            <Icon size={14} />
                          </span>
                          <div className="kk-ai-starter-texts">
                            <span className="kk-ai-starter-title">{topic.title}</span>
                            <span className="kk-ai-starter-prompt-preview">{topic.prompt}</span>
                          </div>
                        </div>
                        <ArrowRight size={14} className="kk-ai-starter-arrow flex-shrink-0" />
                      </button>
                    )
                  })}
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
                    <div className="kk-ai-msg-avatar" aria-hidden="true">
                      {msg.role === 'user' ? <User size={15} /> : <Bot size={16} />}
                    </div>
                    <div className="kk-ai-msg-bubble">
                      <FormattedAiMessage content={msg.content} />
                    </div>
                  </div>

                  {/* Message Action Bar (Timestamp & Copy) */}
                  <div
                    className={`kk-ai-msg-actions ${
                      msg.role === 'user' ? 'is-user' : 'is-assistant'
                    }`}
                  >
                    <span className="kk-ai-msg-time">{msg.timestamp || 'Tani'}</span>
                    {msg.role === 'assistant' && (
                      <button
                        type="button"
                        className={`kk-ai-msg-action-btn${copiedId === msg.id ? ' is-copied' : ''}`}
                        onClick={() => handleCopyMessage(msg.id, msg.content)}
                        title="Kopjo përgjigjen"
                        aria-label="Kopjo përgjigjen"
                      >
                        {copiedId === msg.id ? (
                          <>
                            <Check size={12} className="text-green-500" />
                            <span>U kopjua</span>
                          </>
                        ) : (
                          <>
                            <Copy size={12} />
                            <span>Kopjo</span>
                          </>
                        )}
                      </button>
                    )}
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
                          <Sparkles size={11} className="kk-ai-action-sparkle" />
                          <span>{action}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}

            {/* Friendly Typing Indicator */}
            {loading && (
              <div className="kk-ai-msg kk-ai-msg-assistant kk-ai-msg-loading">
                <div className="kk-ai-msg-avatar" aria-hidden="true">
                  <Bot size={16} />
                </div>
                <div className="kk-ai-typing-card">
                  <div className="kk-ai-typing-dots">
                    <span className="kk-ai-typing-dot" />
                    <span className="kk-ai-typing-dot" />
                    <span className="kk-ai-typing-dot" />
                  </div>
                  <span className="kk-ai-typing-text">
                    Këshilla AI po analizon kërkesën...
                  </span>
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
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="Shkruaj pyetjen tuaj (ligj, taksa, kontrata)..."
                rows={1}
                className="kk-ai-textarea"
                disabled={loading}
              />
              {inputValue && !loading && (
                <button
                  type="button"
                  className="kk-ai-clear-input-btn"
                  onClick={() => {
                    setInputValue('')
                    if (textareaRef.current) {
                      textareaRef.current.style.height = 'auto'
                      textareaRef.current.focus()
                    }
                  }}
                  title="Fshi tekstin"
                  aria-label="Fshi tekstin e shkruar"
                >
                  <X size={14} />
                </button>
              )}
              <button
                type="submit"
                className="kk-ai-send-btn"
                disabled={!inputValue.trim() || loading}
                title="Dërgo mesazhin (Enter)"
                aria-label="Dërgo mesazhin"
              >
                <Send size={15} />
              </button>
            </form>
            <div className="kk-ai-footer-hints">
              <span className="kk-ai-keyboard-hint">
                Shtyp <strong>Enter</strong> për dërgim
              </span>
              <p className="kk-ai-disclaimer">
                Verifikoni këshillat me një ekspert të licencuar në KeshillaKos.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
