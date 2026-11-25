import { useState, useEffect, useRef, useCallback, type FormEvent, type KeyboardEvent, type ChangeEvent } from 'react'
import { useLocation, Link } from 'react-router-dom'
import {
  X,
  Maximize2,
  Send,
  RotateCcw,
  User,
  ArrowRight,
  Copy,
  Check,
  Briefcase,
  Scale,
  Calculator,
  Building2,
  Trash2,
  ArrowUpRight,
  CreditCard,
  MessageSquareText,
  ShieldCheck,
} from 'lucide-react'
import { toast } from '@heroui/react'
import { useTranslation, Trans } from 'react-i18next'
import { dateLocale } from '../../i18n'
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
  /** Legacy preformatted time (older sessions); new messages use createdAt. */
  timestamp?: string
  createdAt?: number
  /** Client-side error bubbles are rendered from these keys so they follow the language. */
  errorKey?: string
  suggestedActionKeys?: string[]
  suggestedActions?: string[]
  recommendedEntities?: RecommendedEntity[]
}

interface StarterTopic {
  id: string
  category: 'business' | 'law' | 'taxes' | 'platform'
  icon: typeof Briefcase
}

/** `label` is a translation key, except the platform tab which shows the brand name. */
const STARTER_CATEGORIES = [
  { id: 'all', emoji: '', label: 'ai.widget.cats.all' },
  { id: 'business', emoji: '🏢', label: 'ai.widget.cats.business' },
  { id: 'law', emoji: '⚖️', label: 'ai.widget.cats.law' },
  { id: 'taxes', emoji: '💰', label: 'ai.widget.cats.taxes' },
  { id: 'platform', emoji: '⭐', label: null },
] as const

const STARTER_TOPICS: StarterTopic[] = [
  { id: 'arbk', category: 'business', icon: Briefcase },
  { id: 'contract', category: 'law', icon: Scale },
  { id: 'atk', category: 'taxes', icon: Calculator },
  { id: 'property', category: 'law', icon: Building2 },
  { id: 'plans', category: 'platform', icon: CreditCard },
]

const STORAGE_KEY = 'kk_ai_chat_session'

const ERROR_ACTION_KEYS = ['notifications.retry', 'home.seeOffers', 'ai.chat.homePage']

/** Unique id plus creation time; the time is formatted at render in the active language. */
function stampMessage(prefix: string): { id: string; createdAt: number } {
  const createdAt = Date.now()
  return { id: `${prefix}-${createdAt}`, createdAt }
}

function formatMessageTime(msg: ChatMessageItem): string | undefined {
  if (typeof msg.createdAt !== 'number') return msg.timestamp
  try {
    return new Date(msg.createdAt).toLocaleTimeString(dateLocale(), {
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return undefined
  }
}

/** True while the site footer is on screen, so the launcher can stay out of its way. */
function useFooterInView(pathname: string) {
  const [inView, setInView] = useState(false)
  useEffect(() => {
    setInView(false)
    if (typeof IntersectionObserver === 'undefined') return
    let observer: IntersectionObserver | undefined
    // The footer can mount after lazy route content, so look it up on the next frame.
    const frame = requestAnimationFrame(() => {
      const footer = document.querySelector('.tt-footer')
      if (!footer) return
      observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), {
        rootMargin: '0px 0px -40px 0px',
      })
      observer.observe(footer)
    })
    return () => {
      cancelAnimationFrame(frame)
      observer?.disconnect()
    }
  }, [pathname])
  return inView
}

export default function AiChatWidget() {
  const { t, i18n } = useTranslation()
  const location = useLocation()
  const isDedicatedAiPage = location.pathname === '/ai-asistenti'
  const { count: compareCount } = useCompareLawyers()
  const hasCompareDock =
    compareCount > 0 &&
    location.pathname !== '/krahaso' &&
    location.pathname !== '/krahaso-avokatet'
  const isDashboard = location.pathname.startsWith('/dashboard')
  // The floating assistant is shown only on the home page.
  const isHomePage = location.pathname === '/'
  const footerInView = useFooterInView(location.pathname)

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

  // Close the chat when leaving the home page so it doesn't reopen on return
  useEffect(() => {
    if (!isHomePage) setIsOpen(false)
  }, [isHomePage])

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
      ...stampMessage('user'),
      role: 'user',
      content: text,
    }

    const updatedMessages = [...messages, userMessage]
    setMessages(updatedMessages)
    setLoading(true)

    try {
      const payload: AiChatMessage[] = updatedMessages.map((m) => ({
        role: m.role,
        content: messageText(m),
      }))

      const response = await sendAiChatMessage(payload, {
        pathname: location.pathname,
        language: i18n.resolvedLanguage || i18n.language,
      })

      const botMessage: ChatMessageItem = {
        ...stampMessage('assistant'),
        role: 'assistant',
        content: response.reply,
        suggestedActions: response.suggestedActions,
        recommendedEntities: response.recommendedEntities,
      }

      setMessages((prev) => [...prev, botMessage])
    } catch {
      const errorMessage: ChatMessageItem = {
        ...stampMessage('err'),
        role: 'assistant',
        content: t('ai.widget.error'),
        errorKey: 'ai.widget.error',
        suggestedActionKeys: ERROR_ACTION_KEYS,
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

  function messageText(msg: ChatMessageItem): string {
    return msg.errorKey ? t(msg.errorKey) : msg.content
  }

  function messageActions(msg: ChatMessageItem): string[] | undefined {
    return msg.suggestedActionKeys ? msg.suggestedActionKeys.map((key) => t(key)) : msg.suggestedActions
  }

  async function handleCopyMessage(id: string, text: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(id)
      toast.success(t('ai.chat.toastReplyCopied'))
      setTimeout(() => setCopiedId(null), 2200)
    } catch {
      toast.danger(t('ai.chat.toastCopyFailed'))
    }
  }

  async function handleCopyFullChat() {
    if (messages.length === 0) return
    const transcript = messages
      .map(
        (m) =>
          `${m.role === 'user' ? `👤 ${t('ai.chat.you')}` : '🤖 Këshilla AI'} (${formatMessageTime(m) || ''}):\n${messageText(m)}\n`,
      )
      .join('\n---\n\n')
    try {
      await navigator.clipboard.writeText(`${t('ai.chat.transcriptTitle')}\n\n${transcript}`)
      setCopiedFullChat(true)
      toast.success(t('ai.chat.toastChatCopied'))
      setTimeout(() => setCopiedFullChat(false), 2200)
    } catch {
      toast.danger(t('ai.chat.toastCopyFailed'))
    }
  }

  function handleConfirmReset() {
    setMessages([])
    setShowResetConfirm(false)
    try {
      sessionStorage.removeItem(STORAGE_KEY)
      toast.info(t('ai.chat.toastCleared'))
    } catch {
      // ignore
    }
  }

  // If we are already on the dedicated full AI page, we don't need the floating widget
  if (isDedicatedAiPage || !isHomePage) {
    return null
  }

  const filteredTopics = activeCategory === 'all'
    ? STARTER_TOPICS
    : STARTER_TOPICS.filter((topic) => topic.category === activeCategory)

  return (
    <>
      {/* Floating launcher trigger */}
      <div
        className={`kk-ai-trigger-container${hasCompareDock ? ' has-dock' : ''}${isDashboard ? ' has-dash-nav' : ''}${isOpen ? ' is-open' : ''}${footerInView ? ' near-footer' : ''}`}
      >
        {!isOpen && hasPromptPill && !hasCompareDock && !footerInView && (
          <button
            type="button"
            className="kk-ai-trigger-pill"
            onClick={() => {
              setIsOpen(true)
              setHasPromptPill(false)
            }}
          >
            <MessageSquareText size={14} />
            <span>{t('ai.widget.pill')}</span>
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
          aria-label={isOpen ? t('ai.widget.closeAria') : t('ai.widget.openAria')}
          aria-expanded={isOpen}
        >
          {isOpen ? <X size={24} /> : <MessageSquareText size={24} />}
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
            aria-label={t('ai.widget.closeAssistant')}
          >
            <span className="kk-ai-drag-handle" />
          </button>

          {/* Header */}
          <div className="kk-ai-header">
            <div className="kk-ai-header-info">
              <div className="kk-ai-header-avatar">
                <MessageSquareText size={20} />
                <span className="kk-ai-avatar-online" />
              </div>
              <div className="kk-ai-header-titles">
                <div className="kk-ai-header-title-row">
                  <h3 className="kk-ai-header-title">Këshilla AI</h3>
                  <span className="kk-ai-gemini-badge">Gemini</span>
                </div>
                <p className="kk-ai-header-subtitle">{t('ai.widget.subtitle')}</p>
              </div>
            </div>

            <div className="kk-ai-header-actions">
              <Link
                to="/ai-asistenti"
                onClick={() => setIsOpen(false)}
                className="kk-ai-header-btn"
                title={t('ai.widget.fullPage')}
                aria-label={t('ai.widget.fullPage')}
              >
                <Maximize2 size={16} />
              </Link>
              {messages.length > 0 && (
                <>
                  <button
                    type="button"
                    onClick={handleCopyFullChat}
                    className="kk-ai-header-btn"
                    title={t('ai.chat.copyChat')}
                    aria-label={t('ai.chat.copyChat')}
                  >
                    {copiedFullChat ? <Check size={15} className="text-green-500" /> : <Copy size={15} />}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowResetConfirm((prev) => !prev)}
                    className={`kk-ai-header-btn${showResetConfirm ? ' is-active' : ''}`}
                    title={t('ai.chat.clearChat')}
                    aria-label={t('ai.chat.clearChat')}
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
                title={t('ai.widget.minimize')}
                aria-label={t('ai.widget.minimizeAria')}
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Reset Confirmation Banner */}
          {showResetConfirm && (
            <div className="kk-ai-reset-confirm-bar" role="alert">
              <span className="kk-ai-reset-confirm-text">{t('ai.widget.confirmClear')}</span>
              <div className="kk-ai-reset-confirm-actions">
                <button
                  type="button"
                  className="kk-ai-confirm-yes"
                  onClick={handleConfirmReset}
                >
                  <Trash2 size={12} />
                  <span>{t('ai.chat.confirmYes')}</span>
                </button>
                <button
                  type="button"
                  className="kk-ai-confirm-no"
                  onClick={() => setShowResetConfirm(false)}
                >
                  {t('notifications.cancel')}
                </button>
              </div>
            </div>
          )}

          {/* Body */}
          <div className="kk-ai-body">
            {messages.length === 0 ? (
              <div className="kk-ai-welcome-box">
                <div className="kk-ai-welcome-badge">
                  <ShieldCheck size={13} />
                  <span>{t('ai.widget.officialBadge')}</span>
                </div>
                <h4 className="kk-ai-welcome-title">{t('ai.widget.welcomeTitle')}</h4>
                <p className="kk-ai-welcome-desc">{t('ai.widget.welcomeDesc')}</p>

                {/* Category filter tabs */}
                <div className="kk-ai-cat-pill-row" role="tablist" aria-label={t('ai.widget.catsAria')}>
                  {STARTER_CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      role="tab"
                      aria-selected={activeCategory === cat.id}
                      className={`kk-ai-cat-pill${activeCategory === cat.id ? ' is-active' : ''}`}
                      onClick={() => setActiveCategory(cat.id)}
                    >
                      {cat.emoji ? `${cat.emoji} ` : ''}
                      {cat.label ? t(cat.label) : 'KeshillaKos'}
                    </button>
                  ))}
                </div>

                {/* Quick starter question chips */}
                <div className="kk-ai-starters-grid">
                  {filteredTopics.map((topic) => {
                    const Icon = topic.icon
                    const prompt = t(`ai.widget.topics.${topic.id}.prompt`)
                    return (
                      <button
                        key={topic.id}
                        type="button"
                        className="kk-ai-starter-chip"
                        onClick={() => handleSendMessage(prompt)}
                      >
                        <div className="kk-ai-starter-left">
                          <span className="kk-ai-starter-icon-wrap">
                            <Icon size={14} />
                          </span>
                          <div className="kk-ai-starter-texts">
                            <span className="kk-ai-starter-title">{t(`ai.widget.topics.${topic.id}.title`)}</span>
                            <span className="kk-ai-starter-prompt-preview">{prompt}</span>
                          </div>
                        </div>
                        <ArrowRight size={14} className="kk-ai-starter-arrow flex-shrink-0" />
                      </button>
                    )
                  })}
                </div>
              </div>
            ) : (
              messages.map((msg) => {
                const actions = messageActions(msg)
                return (
                  <div key={msg.id} className="kk-ai-msg-group">
                    <div
                      className={`kk-ai-msg ${
                        msg.role === 'user' ? 'kk-ai-msg-user' : 'kk-ai-msg-assistant'
                      }`}
                    >
                      <div className="kk-ai-msg-avatar" aria-hidden="true">
                        {msg.role === 'user' ? <User size={15} /> : <MessageSquareText size={16} />}
                      </div>
                      <div className="kk-ai-msg-bubble">
                        <FormattedAiMessage content={messageText(msg)} />
                      </div>
                    </div>

                    {/* Message Action Bar (Timestamp & Copy) */}
                    <div
                      className={`kk-ai-msg-actions ${
                        msg.role === 'user' ? 'is-user' : 'is-assistant'
                      }`}
                    >
                      <span className="kk-ai-msg-time">{formatMessageTime(msg) || t('ai.chat.now')}</span>
                      {msg.role === 'assistant' && (
                        <button
                          type="button"
                          className={`kk-ai-msg-action-btn${copiedId === msg.id ? ' is-copied' : ''}`}
                          onClick={() => handleCopyMessage(msg.id, messageText(msg))}
                          title={t('ai.chat.copyReply')}
                          aria-label={t('ai.chat.copyReply')}
                        >
                          {copiedId === msg.id ? (
                            <>
                              <Check size={12} className="text-green-500" />
                              <span>{t('ai.chat.copied')}</span>
                            </>
                          ) : (
                            <>
                              <Copy size={12} />
                              <span>{t('ai.chat.copy')}</span>
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
                    {actions && actions.length > 0 && (
                      <div className="kk-ai-actions-row">
                        {actions.map((action, idx) => (
                          <button
                            key={idx}
                            type="button"
                            className="kk-ai-action-btn"
                            onClick={() => handleSendMessage(action)}
                          >
                            <ArrowUpRight size={11} className="kk-ai-action-sparkle" />
                            <span>{action}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })
            )}

            {/* Friendly Typing Indicator */}
            {loading && (
              <div className="kk-ai-msg kk-ai-msg-assistant kk-ai-msg-loading">
                <div className="kk-ai-msg-avatar" aria-hidden="true">
                  <MessageSquareText size={16} />
                </div>
                <div className="kk-ai-typing-card">
                  <div className="kk-ai-typing-dots">
                    <span className="kk-ai-typing-dot" />
                    <span className="kk-ai-typing-dot" />
                    <span className="kk-ai-typing-dot" />
                  </div>
                  <span className="kk-ai-typing-text">{t('ai.chat.thinking')}</span>
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
                placeholder={t('ai.widget.placeholder')}
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
                  title={t('ai.chat.clearInput')}
                  aria-label={t('ai.chat.clearInputAria')}
                >
                  <X size={14} />
                </button>
              )}
              <button
                type="submit"
                className="kk-ai-send-btn"
                disabled={!inputValue.trim() || loading}
                title={t('ai.widget.sendTitle')}
                aria-label={t('ai.widget.send')}
              >
                <Send size={15} />
              </button>
            </form>
            <div className="kk-ai-footer-hints">
              <span className="kk-ai-keyboard-hint">
                <Trans i18nKey="ai.widget.keyHint" components={{ strong: <strong /> }} />
              </span>
              <p className="kk-ai-disclaimer">{t('ai.widget.disclaimer')}</p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
