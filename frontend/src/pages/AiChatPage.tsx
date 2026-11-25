import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  type CSSProperties,
  type KeyboardEvent,
  type ChangeEvent,
} from 'react'
import { Link } from 'react-router-dom'
import {
  User,
  ArrowUp,
  RotateCcw,
  Briefcase,
  Scale,
  Calculator,
  Building,
  ShieldCheck,
  CreditCard,
  ArrowRight,
  ChevronRight,
  CheckCircle2,
  Clock3,
  Copy,
  Check,
  Trash2,
  X,
  type LucideIcon,
  ArrowUpRight,
  ListChecks,
  MessageSquareText,
} from 'lucide-react'
import { toast } from '@heroui/react'
import { useTranslation, Trans } from 'react-i18next'
import { dateLocale } from '../i18n'
import SiteNav from '../components/SiteNav'
import SiteFooter from '../components/SiteFooter'
import {
  sendAiChatMessage,
  type AiChatMessage,
  type RecommendedEntity,
} from '../api/aiChat'
import { FormattedAiMessage } from '../components/ai/FormattedAiMessage'
import { AiRecommendedCard } from '../components/ai/AiRecommendedCard'
import './AiChatPage.css'

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

interface PopularTopic {
  id: string
  key: string
  icon: LucideIcon
  color: string
}

const POPULAR_TOPICS: PopularTopic[] = [
  { id: 'arbk', key: 'arbk', icon: Briefcase, color: '#2563eb' },
  { id: 'lawyer', key: 'lawyer', icon: Scale, color: '#2563eb' },
  { id: 'atk', key: 'atk', icon: Calculator, color: '#2563eb' },
  { id: 'notary', key: 'notary', icon: Building, color: '#2563eb' },
  { id: 'plans', key: 'plans', icon: CreditCard, color: '#2563eb' },
  { id: 'become-expert', key: 'becomeExpert', icon: ShieldCheck, color: '#2563eb' },
]

const QUICK_STARTS: { key: string; icon: LucideIcon; color: string }[] = [
  { key: 'arbk', icon: Briefcase, color: '#2563eb' },
  { key: 'lawyer', icon: Scale, color: '#2563eb' },
  { key: 'atk', icon: Calculator, color: '#2563eb' },
  { key: 'plans', icon: CreditCard, color: '#2563eb' },
]

/** Example questions the input "types" while it is empty. */
const TYPEWRITER_HINT_KEYS = [
  'ai.page.hints.h1',
  'ai.page.hints.h2',
  'ai.page.hints.h3',
  'ai.page.hints.h4',
  'ai.page.hints.h5',
]

const HERO_CHIPS: { icon: LucideIcon; key: string }[] = [
  { icon: Briefcase, key: 'arbk' },
  { icon: Calculator, key: 'atk' },
  { icon: Building, key: 'notary' },
  { icon: Scale, key: 'contract' },
  { icon: ShieldCheck, key: 'experts' },
]

/** Animated gradient sphere used as the assistant's identity. */
function AiOrb({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  return (
    <span className={`kk-ai-orb kk-ai-orb--${size}`} aria-hidden>
      <span className="kk-ai-orb-core" />
      <MessageSquareText className="kk-ai-orb-icon" />
    </span>
  )
}

/** Overlay that types and erases example questions; isolated so only it re-renders. */
function TypewriterHint({ phrases }: { phrases: string[] }) {
  const [text, setText] = useState('')

  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setText(phrases[0])
      return
    }
    let phrase = 0
    let char = 0
    let deleting = false
    let timer = 0
    const tick = () => {
      const full = phrases[phrase]
      if (!deleting) {
        char += 1
        setText(full.slice(0, char))
        if (char >= full.length) {
          deleting = true
          timer = window.setTimeout(tick, 1900)
          return
        }
        timer = window.setTimeout(tick, 42)
      } else {
        char -= 1
        setText(full.slice(0, char))
        if (char <= 0) {
          deleting = false
          phrase = (phrase + 1) % phrases.length
          timer = window.setTimeout(tick, 380)
          return
        }
        timer = window.setTimeout(tick, 20)
      }
    }
    timer = window.setTimeout(tick, 700)
    return () => window.clearTimeout(timer)
  }, [phrases])

  return (
    <span className="kk-aipage-typewriter" aria-hidden>
      {text}
      <span className="kk-aipage-caret" />
    </span>
  )
}

export default function AiChatPage() {
  const { t, i18n } = useTranslation()
  const typewriterHints = useMemo(() => TYPEWRITER_HINT_KEYS.map((key) => t(key)), [t])
  const [inputValue, setInputValue] = useState('')
  const [loading, setLoading] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [copiedFullChat, setCopiedFullChat] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)

  const [messages, setMessages] = useState<ChatMessageItem[]>(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY)
      if (saved) return JSON.parse(saved)
    } catch {
      // ignore
    }
    return []
  })

  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Always keep window view at the top on mount — avoid any auto-scrolling to the bottom of the page
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior })
  }, [])

  // Container-scoped scroll strictly inside the chat box
  const scrollToBottom = useCallback((smooth = true) => {
    const container = messagesContainerRef.current
    if (container) {
      container.scrollTo({
        top: container.scrollHeight,
        behavior: smooth ? 'smooth' : 'auto',
      })
    }
  }, [])

  // Scroll to bottom of chat messages when new messages arrive (without moving window)
  useEffect(() => {
    if (messages.length > 0) {
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages))
      } catch {
        // ignore
      }
      requestAnimationFrame(() => {
        scrollToBottom(true)
      })
    }
  }, [messages, scrollToBottom])

  // Auto-resize textarea as user types
  const handleTextareaChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value)
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`
    }
  }

  async function handleSendMessage(textToSend?: string) {
    const text = (textToSend ?? inputValue).trim()
    if (!text || loading) return

    setInputValue('')
    setShowResetConfirm(false)
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }

    const userMessage: ChatMessageItem = {
      ...stampMessage('user'),
      role: 'user',
      content: text,
    }

    const updated = [...messages, userMessage]
    setMessages(updated)
    setLoading(true)

    try {
      const payload: AiChatMessage[] = updated.map((m) => ({
        role: m.role,
        content: messageText(m),
      }))

      const response = await sendAiChatMessage(payload, {
        pathname: '/ai-asistenti',
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
        content: t('ai.page.error'),
        errorKey: 'ai.page.error',
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

  return (
    <div className="tt-shell of-marketplace kk-aipage-root">
      <SiteNav />

      {/* ================= Hero ================= */}
      <section className="kk-aipage-hero">
        <div className="kk-aipage-hero-bg" aria-hidden>
          <span className="kk-aipage-hero-glow kk-aipage-hero-glow--a" />
          <span className="kk-aipage-hero-glow kk-aipage-hero-glow--b" />
        </div>

        <div className="kk-aipage-hero-inner">
          <header className="kk-aipage-hero-copy">
            <div className="kk-aipage-badge">
              <span className="kk-aipage-live-dot" aria-hidden />
              <span>{t('ai.page.badge')}</span>
            </div>
            <h1 className="kk-aipage-title">
              <Trans
                i18nKey="ai.page.title"
                components={{ hl: <span className="kk-aipage-title-gradient" /> }}
              />
            </h1>
            <p className="kk-aipage-lead">{t('ai.page.lead')}</p>
            <ul className="kk-aipage-hero-points">
              <li>
                <Clock3 size={15} aria-hidden /> 24/7
              </li>
              <li>
                <CheckCircle2 size={15} aria-hidden /> {t('ai.page.free')}
              </li>
              <li>
                <ShieldCheck size={15} aria-hidden /> {t('ai.page.verifiedLink')}
              </li>
            </ul>
          </header>

          <div className="kk-aipage-hero-visual" aria-hidden>
            <span className="kk-aipage-ring kk-aipage-ring--1" />
            <span className="kk-aipage-ring kk-aipage-ring--2" />
            <span className="kk-aipage-ring kk-aipage-ring--3" />
            <AiOrb size="xl" />
            {HERO_CHIPS.map((chip, i) => {
              const Icon = chip.icon
              return (
                <span
                  key={chip.key}
                  className={`kk-aipage-float-chip kk-aipage-float-chip--${i + 1}`}
                >
                  <Icon size={13} />
                  {t(`ai.page.chips.${chip.key}`)}
                </span>
              )
            })}
          </div>
        </div>
      </section>

      <main className="kk-aipage-main">
        <div className="kk-aipage-layout">
          {/* ================= Sidebar ================= */}
          <aside className="kk-aipage-sidebar" aria-label={t('ai.page.sidebarAria')}>
            <div className="kk-aipage-sidecard">
              <div className="kk-aipage-sidehead">
                <span className="kk-aipage-sidehead-icon">
                  <ListChecks size={16} aria-hidden />
                </span>
                <div>
                  <h2>{t('ai.page.topicsTitle')}</h2>
                  <p className="kk-aipage-sidesub">{t('ai.page.topicsSub')}</p>
                </div>
              </div>

              <div className="kk-aipage-topic-list">
                {POPULAR_TOPICS.map((topic, i) => {
                  const Icon = topic.icon
                  return (
                    <button
                      key={topic.id}
                      type="button"
                      className="kk-aipage-topic-btn"
                      style={{ '--topic': topic.color, '--i': i } as CSSProperties}
                      onClick={() => handleSendMessage(t(`ai.page.topics.${topic.key}.prompt`))}
                      disabled={loading}
                    >
                      <span className="kk-aipage-topic-icon-wrap">
                        <Icon size={17} aria-hidden />
                      </span>
                      <span className="kk-aipage-topic-body">
                        <span className="kk-aipage-topic-badge">{t(`ai.page.topics.${topic.key}.badge`)}</span>
                        <span className="kk-aipage-topic-title">{t(`ai.page.topics.${topic.key}.title`)}</span>
                        <span className="kk-aipage-topic-desc">{t(`ai.page.topics.${topic.key}.desc`)}</span>
                      </span>
                      <ChevronRight size={16} className="kk-aipage-topic-arrow" aria-hidden />
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="kk-aipage-sidecard kk-aipage-info-card">
              <div className="kk-aipage-info-head">
                <AiOrb size="sm" />
                <h3>{t('ai.page.whyTitle')}</h3>
              </div>
              <ul className="kk-aipage-info-checklist">
                <li>
                  <CheckCircle2 size={16} className="kk-aipage-check-icon" aria-hidden />
                  <span>{t('ai.page.why1')}</span>
                </li>
                <li>
                  <CheckCircle2 size={16} className="kk-aipage-check-icon" aria-hidden />
                  <span>{t('ai.page.why2')}</span>
                </li>
                <li>
                  <CheckCircle2 size={16} className="kk-aipage-check-icon" aria-hidden />
                  <span>{t('ai.page.why3')}</span>
                </li>
              </ul>
              <Link to="/ofertat" className="kk-aipage-info-cta">
                {t('ai.page.seeExperts')} <ArrowRight size={15} aria-hidden />
              </Link>
            </div>
          </aside>

          {/* ================= Chat panel ================= */}
          <section className="kk-aipage-chat-panel" aria-label={t('ai.page.chatAria')}>
            <div className="kk-aipage-chat-head">
              <div className="kk-aipage-chat-identity">
                <span className="kk-aipage-chat-avatar">
                  <AiOrb size="md" />
                  <span className="kk-aipage-chat-online" aria-label={t('ai.chat.onlineAria')} />
                </span>
                <div>
                  <div className="kk-aipage-name-wrap">
                    <h2 className="kk-aipage-chat-name">Këshilla AI</h2>
                    <span className="kk-aipage-model-pill">Gemini</span>
                  </div>
                  <p className="kk-aipage-chat-status">
                    <span className="kk-aipage-status-dot" aria-hidden />
                    <span className="kk-aipage-status-text">{loading ? t('ai.page.typing') : t('ai.page.status')}</span>
                  </p>
                </div>
              </div>

              <div className="kk-aipage-chat-tools">
                {messages.length > 0 && (
                  <>
                    <button
                      type="button"
                      onClick={handleCopyFullChat}
                      className="kk-aipage-tool-btn"
                      title={t('ai.chat.copyChat')}
                      aria-label={t('ai.chat.copyChat')}
                    >
                      {copiedFullChat ? <Check size={14} className="is-ok" /> : <Copy size={14} />}
                      <span>{copiedFullChat ? t('ai.chat.copied') : t('ai.page.copyChatShort')}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowResetConfirm((prev) => !prev)}
                      className={`kk-aipage-tool-btn is-danger${showResetConfirm ? ' is-active' : ''}`}
                      title={t('ai.chat.clearChat')}
                      aria-label={t('ai.chat.clearChat')}
                    >
                      <RotateCcw size={14} />
                      <span>{t('ai.page.clearShort')}</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            {showResetConfirm && (
              <div className="kk-aipage-confirm-bar" role="alert">
                <span>{t('ai.page.confirmClear')}</span>
                <div className="kk-aipage-confirm-actions">
                  <button type="button" className="kk-aipage-confirm-yes" onClick={handleConfirmReset}>
                    <Trash2 size={13} />
                    <span>{t('ai.chat.confirmYes')}</span>
                  </button>
                  <button
                    type="button"
                    className="kk-aipage-confirm-no"
                    onClick={() => setShowResetConfirm(false)}
                  >
                    {t('notifications.cancel')}
                  </button>
                </div>
              </div>
            )}

            {/* Messages (internal scroll only) */}
            <div
              ref={messagesContainerRef}
              className="kk-aipage-messages"
              role="log"
              aria-live="polite"
              aria-relevant="additions"
            >
              {messages.length === 0 ? (
                <div className="kk-aipage-welcome-state">
                  <div className="kk-aipage-welcome-orb">
                    <span className="kk-aipage-welcome-halo" aria-hidden />
                    <AiOrb size="lg" />
                  </div>
                  <h3 className="kk-aipage-welcome-title">
                    <Trans i18nKey="ai.page.welcomeTitle" components={{ hl: <span /> }} />
                  </h3>
                  <p className="kk-aipage-welcome-text">{t('ai.page.welcomeText')}</p>

                  <div className="kk-aipage-quick-grid">
                    {QUICK_STARTS.map((q, i) => {
                      const Icon = q.icon
                      return (
                        <button
                          key={q.key}
                          type="button"
                          className="kk-aipage-quick-card"
                          style={{ '--topic': q.color, '--i': i } as CSSProperties}
                          onClick={() => handleSendMessage(t(`ai.page.quick.${q.key}.prompt`))}
                        >
                          <span className="kk-aipage-quick-top">
                            <span className="kk-aipage-quick-icon">
                              <Icon size={17} aria-hidden />
                            </span>
                            <span className="kk-aipage-quick-badge">{t(`ai.page.quick.${q.key}.badge`)}</span>
                          </span>
                          <span className="kk-aipage-quick-text">{t(`ai.page.quick.${q.key}.text`)}</span>
                          <span className="kk-aipage-quick-arrow">
                            {t('ai.page.ask')} <ArrowRight size={14} aria-hidden />
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ) : (
                messages.map((msg) => {
                  const actions = messageActions(msg)
                  return (
                    <div key={msg.id} className={`kk-ai-msg-group is-${msg.role}`}>
                      <div
                        className={`kk-ai-msg ${msg.role === 'user' ? 'kk-ai-msg-user' : 'kk-ai-msg-assistant'}`}
                      >
                        <div className="kk-ai-msg-avatar" aria-hidden="true">
                          {msg.role === 'user' ? <User size={16} /> : <AiOrb size="sm" />}
                        </div>
                        <div className="kk-ai-msg-bubble">
                          <FormattedAiMessage content={messageText(msg)} />
                        </div>
                      </div>

                      <div className={`kk-ai-msg-actions ${msg.role === 'user' ? 'is-user' : 'is-assistant'}`}>
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
                                <Check size={12} />
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

                      {msg.recommendedEntities && msg.recommendedEntities.length > 0 && (
                        <div className="kk-ai-cards-container">
                          {msg.recommendedEntities.map((item) => (
                            <AiRecommendedCard key={item.id} item={item} />
                          ))}
                        </div>
                      )}

                      {actions && actions.length > 0 && (
                        <div className="kk-ai-actions-row">
                          {actions.map((action, idx) => (
                            <button
                              key={idx}
                              type="button"
                              className="kk-ai-action-btn"
                              onClick={() => handleSendMessage(action)}
                            >
                              <ArrowUpRight size={12} className="kk-ai-action-sparkle" aria-hidden />
                              <span>{action}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })
              )}

              {loading && (
                <div className="kk-ai-msg kk-ai-msg-assistant kk-ai-msg-loading">
                  <div className="kk-ai-msg-avatar" aria-hidden="true">
                    <AiOrb size="sm" />
                  </div>
                  <div className="kk-ai-typing-card" aria-label={t('ai.chat.thinkingAria')}>
                    <span className="kk-ai-typing-dots">
                      <span className="kk-ai-typing-dot" />
                      <span className="kk-ai-typing-dot" />
                      <span className="kk-ai-typing-dot" />
                    </span>
                    <span className="kk-ai-typing-text">{t('ai.chat.thinking')}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <div className="kk-aipage-chat-footer">
              <div className={`kk-aipage-input-box${loading ? ' is-busy' : ''}`}>
                <div className="kk-aipage-input-field">
                  <textarea
                    ref={textareaRef}
                    value={inputValue}
                    onChange={handleTextareaChange}
                    onKeyDown={handleKeyDown}
                    aria-label={t('ai.page.inputAria')}
                    rows={1}
                    className="kk-aipage-textarea"
                    disabled={loading}
                  />
                  {!inputValue && !loading && <TypewriterHint phrases={typewriterHints} />}
                </div>
                {inputValue && !loading && (
                  <button
                    type="button"
                    className="kk-aipage-clear-btn"
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
                    <X size={16} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleSendMessage()}
                  className="kk-aipage-send-btn"
                  disabled={!inputValue.trim() || loading}
                  aria-label={t('ai.page.send')}
                >
                  <ArrowUp size={19} strokeWidth={2.5} />
                </button>
              </div>

              <div className="kk-aipage-footer-meta">
                <span className="kk-aipage-meta-hint">
                  <Trans i18nKey="ai.page.keyHint" components={{ kbd: <kbd /> }} />
                </span>
                <span className="kk-aipage-meta-disclaimer">{t('ai.page.disclaimer')}</span>
              </div>
            </div>
          </section>
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
