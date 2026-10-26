import { useState, useEffect, useRef, useCallback, type KeyboardEvent } from 'react'
import {
  Sparkles,
  Bot,
  User,
  Send,
  RotateCcw,
  Briefcase,
  Scale,
  Calculator,
  Building,
  ShieldCheck,
  CreditCard,
  ArrowRight,
  Info,
} from 'lucide-react'
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
  suggestedActions?: string[]
  recommendedEntities?: RecommendedEntity[]
}

const STORAGE_KEY = 'kk_ai_chat_session'

const POPULAR_TOPICS = [
  {
    id: 'arbk',
    icon: Briefcase,
    title: 'Hapja e Biznesit (ARBK)',
    desc: 'Statuti, Sh.p.k., certifikata dhe dokumentet e nevojshme',
    prompt: 'Si hapet një biznes në Kosovë (Sh.p.k.) dhe cilat janë procedurat hap pas hapi në ARBK?',
  },
  {
    id: 'lawyer',
    icon: Scale,
    title: 'Avokatë & Kontrata Pune',
    desc: 'Ligji i punës në Kosovë, kontratat dhe zgjidhja e mosmarrëveshjeve',
    prompt: 'Çfarë duhet të përmbajë një kontratë pune e rregullt sipas Ligjit të Punës në Kosovë?',
  },
  {
    id: 'atk',
    icon: Calculator,
    title: 'Taksa & Kontabiliteti (ATK)',
    desc: 'Pragu i TVSH-së (30k€), 10% TAK, deklarimi mujor në EDI',
    prompt: 'Më shpjego sistemin e taksave në Kosovë: kur regjistrohet TVSH dhe si llogaritet tatimi në korporata?',
  },
  {
    id: 'notary',
    icon: Building,
    title: 'Prona & Shërbime Noteriale',
    desc: 'Kontratat e shitblerjes, verifikimi në Kadastër dhe akti noterial',
    prompt: 'Si bëhet verifikimi ligjor i një prone dhe cilat janë tarifat e noterit për shitblerje në Kosovë?',
  },
  {
    id: 'plans',
    icon: CreditCard,
    title: 'Planet në KeshillaKos',
    desc: 'Plani Standard dhe Pro me 0% komision për ofruesit',
    prompt: 'Cilat janë përfitimet e Planit Pro në KeshillaKos dhe sa kushton anëtarësimi?',
  },
  {
    id: 'become-expert',
    icon: ShieldCheck,
    title: 'Regjistrohu si Ekspert',
    desc: 'Si të ofrosh shërbime profesionale dhe të marrësh klientë',
    prompt: 'Si mund të regjistrohem si ekspert i verifikuar në platformën KeshillaKos?',
  },
]

export default function AiChatPage() {
  const [inputValue, setInputValue] = useState('')
  const [loading, setLoading] = useState(false)

  const [messages, setMessages] = useState<ChatMessageItem[]>(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY)
      if (saved) return JSON.parse(saved)
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
    scrollToBottom(false)
  }, [scrollToBottom])

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

    const userMessage: ChatMessageItem = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
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
        suggestedActions: response.suggestedActions,
        recommendedEntities: response.recommendedEntities,
      }

      setMessages((prev) => [...prev, botMessage])
    } catch (err) {
      const errorMessage: ChatMessageItem = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content:
          'Ndodhi një gabim gjatë lidhjes me asistentin. Ju lutem provoni sërish ose zgjidhni një nga pyetjet e sugjeruara.',
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

  return (
    <div className="kk-aipage-root">
      <SiteNav />

      <main className="kk-aipage-main">
        {/* Hero Section */}
        <div className="kk-aipage-hero">
          <div className="kk-aipage-badge">
            <Sparkles size={14} />
            <span>Këshilla AI • Fuqizuar me Gemini AI</span>
          </div>
          <h1 className="kk-aipage-title">Asistenti Yt Inteligjent për Kosovën</h1>
          <p className="kk-aipage-lead">
            Merr përgjigje të menjëhershme për hapat ligjorë, hapjen e biznesit në ARBK, taksat në ATK dhe gjej shërbimet e ekspertët e duhur në KeshillaKos.
          </p>
        </div>

        {/* Main Chat Layout */}
        <div className="kk-aipage-layout">
          {/* Sidebar */}
          <aside className="kk-aipage-sidebar">
            <div className="kk-aipage-sidecard">
              <h2 className="kk-aipage-sidehead">Temat Kryesore</h2>
              <div className="kk-aipage-topic-list">
                {POPULAR_TOPICS.map((topic) => {
                  const Icon = topic.icon
                  return (
                    <button
                      key={topic.id}
                      type="button"
                      className="kk-aipage-topic-btn"
                      onClick={() => handleSendMessage(topic.prompt)}
                    >
                      <Icon size={18} className="kk-aipage-topic-icon" />
                      <div>
                        <span className="kk-aipage-topic-title">{topic.title}</span>
                        <span className="kk-aipage-topic-desc">{topic.desc}</span>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="kk-aipage-info-box">
              <h3 className="kk-aipage-info-title">
                <Info size={16} />
                <span>Pse Këshilla AI?</span>
              </h3>
              <p className="kk-aipage-info-text">
                Këshilla AI analizon legjislacionin dhe procedurat standarde në Republikën e Kosovës, si dhe lidhet drejtpërdrejt me katalogun e ekspertëve të licencuar në KeshillaKos.
              </p>
            </div>
          </aside>

          {/* Chat Panel */}
          <section className="kk-aipage-chat-panel">
            {/* Chat Head */}
            <div className="kk-aipage-chat-head">
              <div className="kk-aipage-chat-identity">
                <div className="kk-aipage-chat-avatar">
                  <Bot size={22} />
                  <span className="kk-aipage-chat-online" />
                </div>
                <div>
                  <h2 className="kk-aipage-chat-name">Këshilla AI</h2>
                  <p className="kk-aipage-chat-status">Online dhe gati për t&apos;ju ndihmuar</p>
                </div>
              </div>

              <div className="kk-aipage-chat-tools">
                {messages.length > 0 && (
                  <button
                    type="button"
                    onClick={handleResetChat}
                    className="kk-aipage-reset-btn"
                    title="Pastro bisedën"
                  >
                    <RotateCcw size={14} />
                    <span>Pastro</span>
                  </button>
                )}
              </div>
            </div>

            {/* Chat Messages stream */}
            <div className="kk-aipage-messages">
              {messages.length === 0 ? (
                <div className="kk-aipage-welcome-state">
                  <div className="kk-aipage-welcome-avatar">
                    <Sparkles size={28} />
                  </div>
                  <h3 className="kk-aipage-welcome-title">Si mund t&apos;ju ndihmoj sot?</h3>
                  <p className="kk-aipage-welcome-text">
                    Zgjidhni një nga pyetjet e mëposhtme ose shkruani lirisht kërkesën tuaj në kutinë e tekstit:
                  </p>

                  <div className="kk-aipage-quick-grid">
                    <button
                      type="button"
                      className="kk-aipage-quick-card"
                      onClick={() => handleSendMessage('Si hapet një biznes në Kosovë (Sh.p.k.)?')}
                    >
                      <span>🏢 Hapja e një Sh.p.k. në ARBK</span>
                      <ArrowRight size={15} />
                    </button>
                    <button
                      type="button"
                      className="kk-aipage-quick-card"
                      onClick={() => handleSendMessage('Më duhet një avokat në Prishtinë për kontratë')}
                    >
                      <span>⚖️ Gjej Avokat në Prishtinë</span>
                      <ArrowRight size={15} />
                    </button>
                    <button
                      type="button"
                      className="kk-aipage-quick-card"
                      onClick={() => handleSendMessage('Cilat janë normat e TVSH-së dhe taksave në Kosovë?')}
                    >
                      <span>📊 Taksat & ATK (TVSH 18%)</span>
                      <ArrowRight size={15} />
                    </button>
                    <button
                      type="button"
                      className="kk-aipage-quick-card"
                      onClick={() => handleSendMessage('Çfarë përfitimesh ka Plani Pro në KeshillaKos?')}
                    >
                      <span>💳 Planet Pro për Ekspertë</span>
                      <ArrowRight size={15} />
                    </button>
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
                        {msg.role === 'user' ? <User size={16} /> : <Bot size={17} />}
                      </div>
                      <div className="kk-ai-msg-bubble">
                        <FormattedAiMessage content={msg.content} />
                      </div>
                    </div>

                    {/* Recommendation cards */}
                    {msg.recommendedEntities && msg.recommendedEntities.length > 0 && (
                      <div className="kk-ai-cards-container">
                        {msg.recommendedEntities.map((item) => (
                          <AiRecommendedCard key={item.id} item={item} />
                        ))}
                      </div>
                    )}

                    {/* Action buttons */}
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

              {/* Loading Indicator */}
              {loading && (
                <div className="kk-ai-msg kk-ai-msg-assistant">
                  <div className="kk-ai-msg-avatar">
                    <Bot size={17} />
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

            {/* Input Bar */}
            <div className="kk-aipage-chat-footer">
              <div className="kk-aipage-input-box">
                <textarea
                  ref={textareaRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Shkruani pyetjen tuaj për ligj, taksa, kontrata, ekspertë..."
                  rows={2}
                  className="kk-aipage-textarea"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => handleSendMessage()}
                  className="kk-aipage-send-btn"
                  disabled={!inputValue.trim() || loading}
                  aria-label="Dërgo pyetjen"
                >
                  <Send size={18} />
                </button>
              </div>

              <div className="kk-aipage-footer-meta">
                <span>Enter për të dërguar • Shift+Enter për rresht të ri</span>
                <span>Këshilla AI është informative. Për çështje zyrtare, konsultohuni me ekspertët tanë.</span>
              </div>
            </div>
          </section>
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
