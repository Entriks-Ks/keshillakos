import {
  useState,
  useEffect,
  useRef,
  useCallback,
  type CSSProperties,
  type KeyboardEvent,
  type ChangeEvent,
} from 'react'
import { Link } from 'react-router-dom'
import {
  Sparkles,
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
  Zap,
  Copy,
  Check,
  Trash2,
  X,
  type LucideIcon,
} from 'lucide-react'
import { toast } from '@heroui/react'
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
  timestamp?: string
  suggestedActions?: string[]
  recommendedEntities?: RecommendedEntity[]
}

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

interface PopularTopic {
  id: string
  icon: LucideIcon
  color: string
  badge: string
  title: string
  desc: string
  prompt: string
}

const POPULAR_TOPICS: PopularTopic[] = [
  {
    id: 'arbk',
    icon: Briefcase,
    color: '#2563eb',
    badge: 'Biznes',
    title: 'Hapja e Biznesit (ARBK)',
    desc: 'Statuti, Sh.p.k., certifikata dhe dokumentet e nevojshme',
    prompt: 'Si hapet një biznes në Kosovë (Sh.p.k.) dhe cilat janë procedurat hap pas hapi në ARBK?',
  },
  {
    id: 'lawyer',
    icon: Scale,
    color: '#7c3aed',
    badge: 'Ligj',
    title: 'Avokatë & Kontrata Pune',
    desc: 'Ligji i punës në Kosovë, kontratat dhe zgjidhja e mosmarrëveshjeve',
    prompt: 'Çfarë duhet të përmbajë një kontratë pune e rregullt sipas Ligjit të Punës në Kosovë?',
  },
  {
    id: 'atk',
    icon: Calculator,
    color: '#059669',
    badge: 'Taksat',
    title: 'Taksa & Kontabiliteti (ATK)',
    desc: 'Pragu i TVSH-së (30k€), 10% TAK, deklarimi mujor në EDI',
    prompt: 'Më shpjego sistemin e taksave në Kosovë: kur regjistrohet TVSH dhe si llogaritet tatimi në korporata?',
  },
  {
    id: 'notary',
    icon: Building,
    color: '#0891b2',
    badge: 'Prona',
    title: 'Prona & Shërbime Noteriale',
    desc: 'Kontratat e shitblerjes, verifikimi në Kadastër dhe akti noterial',
    prompt: 'Si bëhet verifikimi ligjor i një prone dhe cilat janë tarifat e noterit për shitblerje në Kosovë?',
  },
  {
    id: 'plans',
    icon: CreditCard,
    color: '#d97706',
    badge: 'Platforma',
    title: 'Planet në KeshillaKos',
    desc: 'Plani Standard dhe Pro me 0% komision për ofruesit',
    prompt: 'Cilat janë përfitimet e Planit Pro në KeshillaKos dhe sa kushton anëtarësimi?',
  },
  {
    id: 'become-expert',
    icon: ShieldCheck,
    color: '#db2777',
    badge: 'Karrierë',
    title: 'Regjistrohu si Ekspert',
    desc: 'Si të ofrosh shërbime profesionale dhe të marrësh klientë',
    prompt: 'Si mund të regjistrohem si ekspert i verifikuar në platformën KeshillaKos?',
  },
]

const QUICK_STARTS: { icon: LucideIcon; color: string; badge: string; text: string; prompt: string }[] = [
  {
    icon: Briefcase,
    color: '#2563eb',
    badge: 'ARBK',
    text: 'Hapja e një Sh.p.k. në ARBK',
    prompt: 'Si hapet një biznes në Kosovë (Sh.p.k.) dhe çfarë dokumentesh duhen?',
  },
  {
    icon: Scale,
    color: '#7c3aed',
    badge: 'Drejtësi',
    text: 'Gjej avokat për kontratë pune',
    prompt: 'Më duhet një avokat në Prishtinë për kontratë pune',
  },
  {
    icon: Calculator,
    color: '#059669',
    badge: 'ATK',
    text: 'Taksat, TVSH 18% & deklarimi EDI',
    prompt: 'Cilat janë normat e TVSH-së dhe taksave në ATK?',
  },
  {
    icon: CreditCard,
    color: '#d97706',
    badge: 'Ekspertë',
    text: 'Plani Pro dhe 0% komision',
    prompt: 'Çfarë përfitimesh ka Plani Pro në KeshillaKos?',
  },
]

/** Example questions the input "types" while it is empty. */
const TYPEWRITER_HINTS = [
  'Si ta regjistroj një Sh.p.k. në ARBK?',
  'Kur duhet të regjistrohem për TVSH?',
  'Çfarë duhet të ketë një kontratë pune?',
  'Si verifikohet një pronë para blerjes?',
  'Më gjej një avokat në Prishtinë…',
]

const HERO_CHIPS: { icon: LucideIcon; label: string }[] = [
  { icon: Briefcase, label: 'ARBK' },
  { icon: Calculator, label: 'ATK & TVSH' },
  { icon: Building, label: 'Noteri' },
  { icon: Scale, label: 'Kontrata pune' },
  { icon: ShieldCheck, label: 'Ekspertë' },
]

/** Animated gradient sphere used as the assistant's identity. */
function AiOrb({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  return (
    <span className={`kk-ai-orb kk-ai-orb--${size}`} aria-hidden>
      <span className="kk-ai-orb-core" />
      <Sparkles className="kk-ai-orb-icon" />
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
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: formatMessageTime(),
    }

    const updated = [...messages, userMessage]
    setMessages(updated)
    setLoading(true)

    try {
      const payload: AiChatMessage[] = updated.map((m) => ({
        role: m.role,
        content: m.content,
      }))

      const response = await sendAiChatMessage(payload, {
        pathname: '/ai-asistenti',
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
          'Ndodhi një gabim gjatë lidhjes me asistentin. Ju lutem provoni sërish ose zgjidhni një nga pyetjet e sugjeruara.',
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
              <span>Këshilla AI • Fuqizuar me Gemini AI</span>
            </div>
            <h1 className="kk-aipage-title">
              Asistenti yt inteligjent për <span className="kk-aipage-title-gradient">Kosovën</span>
            </h1>
            <p className="kk-aipage-lead">
              Merr përgjigje të menjëhershme për hapat ligjorë, regjistrimin në ARBK, taksat në ATK
              dhe zbulo ekspertët e duhur të verifikuar në KeshillaKos.
            </p>
            <ul className="kk-aipage-hero-points">
              <li>
                <Clock3 size={15} aria-hidden /> 24/7
              </li>
              <li>
                <CheckCircle2 size={15} aria-hidden /> Falas
              </li>
              <li>
                <ShieldCheck size={15} aria-hidden /> Lidhje me ekspertë të verifikuar
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
                  key={chip.label}
                  className={`kk-aipage-float-chip kk-aipage-float-chip--${i + 1}`}
                >
                  <Icon size={13} />
                  {chip.label}
                </span>
              )
            })}
          </div>
        </div>
      </section>

      <main className="kk-aipage-main">
        <div className="kk-aipage-layout">
          {/* ================= Sidebar ================= */}
          <aside className="kk-aipage-sidebar" aria-label="Temat e shpeshta dhe informacione">
            <div className="kk-aipage-sidecard">
              <div className="kk-aipage-sidehead">
                <span className="kk-aipage-sidehead-icon">
                  <Zap size={16} aria-hidden />
                </span>
                <div>
                  <h2>Tema të shpeshta</h2>
                  <p className="kk-aipage-sidesub">Kliko një temë për përgjigje të menjëhershme</p>
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
                      onClick={() => handleSendMessage(topic.prompt)}
                      disabled={loading}
                    >
                      <span className="kk-aipage-topic-icon-wrap">
                        <Icon size={17} aria-hidden />
                      </span>
                      <span className="kk-aipage-topic-body">
                        <span className="kk-aipage-topic-badge">{topic.badge}</span>
                        <span className="kk-aipage-topic-title">{topic.title}</span>
                        <span className="kk-aipage-topic-desc">{topic.desc}</span>
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
                <h3>Pse Këshilla AI?</h3>
              </div>
              <ul className="kk-aipage-info-checklist">
                <li>
                  <CheckCircle2 size={16} className="kk-aipage-check-icon" aria-hidden />
                  <span>Informacione të sakta sipas ligjeve dhe rregulloreve në fuqi në Kosovë</span>
                </li>
                <li>
                  <CheckCircle2 size={16} className="kk-aipage-check-icon" aria-hidden />
                  <span>Lidhje e drejtpërdrejtë me avokatë e kontabilistë të licencuar</span>
                </li>
                <li>
                  <CheckCircle2 size={16} className="kk-aipage-check-icon" aria-hidden />
                  <span>E disponueshme 24/7 falas për të gjithë qytetarët dhe bizneset</span>
                </li>
              </ul>
              <Link to="/ofertat" className="kk-aipage-info-cta">
                Shiko ekspertët <ArrowRight size={15} aria-hidden />
              </Link>
            </div>
          </aside>

          {/* ================= Chat panel ================= */}
          <section className="kk-aipage-chat-panel" aria-label="Zona e bisedës me AI">
            <div className="kk-aipage-chat-head">
              <div className="kk-aipage-chat-identity">
                <span className="kk-aipage-chat-avatar">
                  <AiOrb size="md" />
                  <span className="kk-aipage-chat-online" aria-label="Statusi: Online" />
                </span>
                <div>
                  <div className="kk-aipage-name-wrap">
                    <h2 className="kk-aipage-chat-name">Këshilla AI</h2>
                    <span className="kk-aipage-model-pill">Gemini</span>
                  </div>
                  <p className="kk-aipage-chat-status">
                    <span className="kk-aipage-status-dot" aria-hidden />
                    {loading ? 'Po shkruan…' : 'Online · pyetje ligjore, biznesi & shërbimesh'}
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
                      title="Kopjo të gjithë bisedën"
                      aria-label="Kopjo të gjithë bisedën"
                    >
                      {copiedFullChat ? <Check size={14} className="is-ok" /> : <Copy size={14} />}
                      <span>{copiedFullChat ? 'U kopjua' : 'Kopjo bisedën'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowResetConfirm((prev) => !prev)}
                      className={`kk-aipage-tool-btn is-danger${showResetConfirm ? ' is-active' : ''}`}
                      title="Pastro bisedën"
                      aria-label="Pastro bisedën"
                    >
                      <RotateCcw size={14} />
                      <span>Pastro</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            {showResetConfirm && (
              <div className="kk-aipage-confirm-bar" role="alert">
                <span>Dëshironi ta pastroni të gjithë bisedën me asistentin?</span>
                <div className="kk-aipage-confirm-actions">
                  <button type="button" className="kk-aipage-confirm-yes" onClick={handleConfirmReset}>
                    <Trash2 size={13} />
                    <span>Po, pastro</span>
                  </button>
                  <button
                    type="button"
                    className="kk-aipage-confirm-no"
                    onClick={() => setShowResetConfirm(false)}
                  >
                    Anulo
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
                    Si mund t&apos;ju ndihmoj <span>sot?</span>
                  </h3>
                  <p className="kk-aipage-welcome-text">
                    Bëni pyetje mbi procedurat ligjore, taksat, hapjen e biznesit apo gjeni ekspertë të
                    verifikuar në Kosovë. Zgjidhni një shembull ose shkruani më poshtë.
                  </p>

                  <div className="kk-aipage-quick-grid">
                    {QUICK_STARTS.map((q, i) => {
                      const Icon = q.icon
                      return (
                        <button
                          key={q.badge}
                          type="button"
                          className="kk-aipage-quick-card"
                          style={{ '--topic': q.color, '--i': i } as CSSProperties}
                          onClick={() => handleSendMessage(q.prompt)}
                        >
                          <span className="kk-aipage-quick-top">
                            <span className="kk-aipage-quick-icon">
                              <Icon size={17} aria-hidden />
                            </span>
                            <span className="kk-aipage-quick-badge">{q.badge}</span>
                          </span>
                          <span className="kk-aipage-quick-text">{q.text}</span>
                          <span className="kk-aipage-quick-arrow">
                            Pyet <ArrowRight size={14} aria-hidden />
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ) : (
                messages.map((msg) => (
                  <div key={msg.id} className={`kk-ai-msg-group is-${msg.role}`}>
                    <div
                      className={`kk-ai-msg ${msg.role === 'user' ? 'kk-ai-msg-user' : 'kk-ai-msg-assistant'}`}
                    >
                      <div className="kk-ai-msg-avatar" aria-hidden="true">
                        {msg.role === 'user' ? <User size={16} /> : <AiOrb size="sm" />}
                      </div>
                      <div className="kk-ai-msg-bubble">
                        <FormattedAiMessage content={msg.content} />
                      </div>
                    </div>

                    <div className={`kk-ai-msg-actions ${msg.role === 'user' ? 'is-user' : 'is-assistant'}`}>
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
                              <Check size={12} />
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

                    {msg.recommendedEntities && msg.recommendedEntities.length > 0 && (
                      <div className="kk-ai-cards-container">
                        {msg.recommendedEntities.map((item) => (
                          <AiRecommendedCard key={item.id} item={item} />
                        ))}
                      </div>
                    )}

                    {msg.suggestedActions && msg.suggestedActions.length > 0 && (
                      <div className="kk-ai-actions-row">
                        {msg.suggestedActions.map((action, idx) => (
                          <button
                            key={idx}
                            type="button"
                            className="kk-ai-action-btn"
                            onClick={() => handleSendMessage(action)}
                          >
                            <Sparkles size={12} className="kk-ai-action-sparkle" aria-hidden />
                            <span>{action}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}

              {loading && (
                <div className="kk-ai-msg kk-ai-msg-assistant kk-ai-msg-loading">
                  <div className="kk-ai-msg-avatar" aria-hidden="true">
                    <AiOrb size="sm" />
                  </div>
                  <div className="kk-ai-typing-card" aria-label="Asistenti po mendon...">
                    <span className="kk-ai-typing-dots">
                      <span className="kk-ai-typing-dot" />
                      <span className="kk-ai-typing-dot" />
                      <span className="kk-ai-typing-dot" />
                    </span>
                    <span className="kk-ai-typing-text">Këshilla AI po analizon kërkesën...</span>
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
                    aria-label="Shkruani pyetjen tuaj për ligj, taksa, kontrata, ARBK apo shërbime"
                    rows={1}
                    className="kk-aipage-textarea"
                    disabled={loading}
                  />
                  {!inputValue && !loading && <TypewriterHint phrases={TYPEWRITER_HINTS} />}
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
                    title="Fshi tekstin"
                    aria-label="Fshi tekstin e shkruar"
                  >
                    <X size={16} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleSendMessage()}
                  className="kk-aipage-send-btn"
                  disabled={!inputValue.trim() || loading}
                  aria-label="Dërgo pyetjen"
                >
                  <ArrowUp size={19} strokeWidth={2.5} />
                </button>
              </div>

              <div className="kk-aipage-footer-meta">
                <span className="kk-aipage-meta-hint">
                  <kbd>Enter</kbd> për të dërguar · <kbd>Shift</kbd>+<kbd>Enter</kbd> rresht i ri
                </span>
                <span className="kk-aipage-meta-disclaimer">
                  Përgjigjet janë orientuese. Për veprime zyrtare konsultohuni me ekspertët e licencuar në KeshillaKos.
                </span>
              </div>
            </div>
          </section>
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
