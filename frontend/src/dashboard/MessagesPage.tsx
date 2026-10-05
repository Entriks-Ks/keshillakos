import { collectionSummary } from '../api/pagination'
import KeshillaPagination from '../components/KeshillaPagination'
import { usePagination } from '../hooks/usePagination'
import { Fragment, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowLeft, MessageCircle, Send, UserRound } from 'lucide-react'
import {
  Alert,
  Badge,
  Button,
  buttonVariants,
  Card,
  Input,
  SearchField,
  Separator,
  Skeleton,
  toast,
} from '@heroui/react'
import {
  fetchConversations,
  fetchConversation,
  fetchMessages,
  markConversationRead,
  type ChatMessage,
  type ConversationItem,
} from '../api/chat'
import ProfileAvatar from '../components/ProfileAvatar'
import { useAuth } from '../auth/AuthContext'
import { useChatSocket } from '../hooks/useChatSocket'
import { getErrorMessage } from '../utils/errors'
import { providerPath } from '../utils/publicPaths'
import './Messages.css'

function sameDate(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function formatClock(iso?: string) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString('sq-AL', { hour: '2-digit', minute: '2-digit' })
}

function dayKey(iso: string) {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

function formatDay(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const now = new Date()
  if (sameDate(d, now)) return 'Sot'
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (sameDate(d, yesterday)) return 'Dje'
  return d.toLocaleDateString('sq-AL', {
    day: 'numeric',
    month: 'long',
    year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric',
  })
}

function formatListTime(iso?: string) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const now = new Date()
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  if (sameDay) {
    return d.toLocaleTimeString('sq-AL', { hour: '2-digit', minute: '2-digit' })
  }
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  const isYesterday =
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate()
  if (isYesterday) return 'Dje'
  return d.toLocaleDateString('sq-AL', { day: '2-digit', month: 'short' })
}

export default function MessagesPage() {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const activeId = searchParams.get('c') || ''

  const activeIdRef = useRef(activeId)
  activeIdRef.current = activeId
  const [conversations, setConversations] = useState<ConversationItem[]>([])
  const [totalUnread, setTotalUnread] = useState(0)
  const [listRevision, setListRevision] = useState(0)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const [listQuery, setListQuery] = useState('')
  const { page, setPage, pagination, receivePagination } = usePagination(listQuery)
  const [activeConversation, setActiveConversation] = useState<ConversationItem | null>(null)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [hasOlderMessages, setHasOlderMessages] = useState(true)
  const [loadingList, setLoadingList] = useState(true)
  const [loadingThread, setLoadingThread] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [peerTyping, setPeerTyping] = useState(false)
  const preserveHistoryScroll = useRef(false)
  const bottomRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const typingTimeout = useRef<number | null>(null)
  const didAutoSelect = useRef(false)

  const socket = useChatSocket(Boolean(user))

  const active = useMemo(
    () => conversations.find((c) => c.id === activeId) || (activeConversation?.id === activeId ? activeConversation : null),
    [conversations, activeId, activeConversation],
  )

  const filteredConversations = conversations

  useEffect(() => {
    let cancelled = false
    setLoadingList(true)
    fetchConversations({ page, limit: 20, q: listQuery })
      .then((items) => {
        if (!cancelled) { setConversations(items); setTotalUnread(collectionSummary(items).unread ?? 0); receivePagination(items.pagination) }
      })
      .catch((err) => {
        if (!cancelled) setError(getErrorMessage(err))
      })
      .finally(() => {
        if (!cancelled) setLoadingList(false)
      })
    return () => {
      cancelled = true
    }
  }, [page, listQuery, listRevision])

  useEffect(() => {
    if (didAutoSelect.current || loadingList || activeId || conversations.length === 0) return
    if (pagination.total <= 5) {
      didAutoSelect.current = true
      setSearchParams({ c: conversations[0].id }, { replace: true })
    }
  }, [loadingList, activeId, conversations, pagination.total, setSearchParams])

  useEffect(() => {
    if (!activeId || !socket.connected) return

    let cancelled = false
    setLoadingThread(true)
    setHasOlderMessages(true)
    void fetchConversation(activeId).then(setActiveConversation).catch(() => undefined)
    setPeerTyping(false)

    void (async () => {
      try {
        const joined = await socket.joinConversation(activeId)
        if (cancelled) return
        if (joined.ok && joined.messages) {
          setMessages(joined.messages)
          setHasOlderMessages(joined.pagination ? joined.pagination.total > joined.messages.length : joined.messages.length === 50)
        } else {
          const fallback = await fetchMessages(activeId)
          if (!cancelled) { setMessages(fallback); setHasOlderMessages(fallback.pagination.total > fallback.length) }
        }
        await markConversationRead(activeId)
        setListRevision((value) => value + 1)
        setConversations((prev) =>
          prev.map((c) => (c.id === activeId ? { ...c, unread: 0 } : c)),
        )
      } catch (err) {
        if (!cancelled) setError(getErrorMessage(err))
      } finally {
        if (!cancelled) setLoadingThread(false)
      }
    })()

    return () => {
      cancelled = true
      socket.leaveConversation(activeId)
    }
  }, [activeId, socket.connected, socket.joinConversation, socket.leaveConversation])

  useEffect(() => {
    return socket.onMessageNew((message) => {
      if (message.conversationId !== activeId) return

      setMessages((prev) => {
        if (prev.some((m) => m.id === message.id)) return prev
        return [...prev, message]
      })
      setConversations((prev) =>
        prev.map((c) =>
          c.id === message.conversationId
            ? {
                ...c,
                lastMessageAt: message.createdAt,
                lastMessagePreview: message.body.slice(0, 140),
                unread: 0,
              }
            : c,
        ),
      )
      void markConversationRead(message.conversationId)
      setListRevision((value) => value + 1)
    })
  }, [activeId, socket.onMessageNew])

  useEffect(() => {
    return socket.onConversationUpdated(() => {
      // New messages can move a conversation between pages; let the server reorder it.
      setListRevision((value) => value + 1)
    })
  }, [socket.onConversationUpdated])

  useEffect(() => {
    return socket.onTyping((event) => {
      if (event.conversationId !== activeId || event.uid === user?.uid) return
      setPeerTyping(event.isTyping)
    })
  }, [activeId, socket.onTyping, user?.uid])

  useEffect(() => {
    if (preserveHistoryScroll.current) { preserveHistoryScroll.current = false; return }
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, peerTyping])

  useEffect(() => {
    if (activeId) inputRef.current?.focus()
  }, [activeId])

  function selectConversation(id: string) {
    setSearchParams(id ? { c: id } : {})
  }

  async function onSend(e: FormEvent) {
    e.preventDefault()
    if (!activeId || !draft.trim() || sending) return
    const body = draft.trim()
    setSending(true)
    setError('')
    setDraft('')
    socket.emitTyping(activeId, false)

    const result = await socket.sendMessage(activeId, body)
    if (!result.ok || !result.message) {
      setDraft(body)
      toast.danger(result.error || 'Mesazhi nuk u dërgua')
    } else {
      setMessages((prev) => {
        if (prev.some((m) => m.id === result.message!.id)) return prev
        return [...prev, result.message!]
      })
      setConversations((prev) => {
        const next = prev.map((c) =>
          c.id === activeId
            ? {
                ...c,
                lastMessageAt: result.message!.createdAt,
                lastMessagePreview: result.message!.body.slice(0, 140),
              }
            : c,
        )
        return [...next].sort((a, b) => {
          const at = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0
          const bt = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0
          return bt - at
        })
      })
    }
    setSending(false)
    inputRef.current?.focus()
  }

  function onDraftChange(value: string) {
    setDraft(value)
    if (!activeId) return
    socket.emitTyping(activeId, true)
    if (typingTimeout.current) window.clearTimeout(typingTimeout.current)
    typingTimeout.current = window.setTimeout(() => {
      socket.emitTyping(activeId, false)
    }, 1200)
  }

  const listSummary = totalUnread > 0
    ? `${totalUnread} të palexuara`
    : `${conversations.length} ${conversations.length === 1 ? 'bisedë' : 'biseda'}`

  return (
    <div className={`msg-page${activeId ? ' has-active' : ''}`}>
      <Card className="msg-shell">
        <aside className="msg-list" aria-label="Bisedat">
          <div className="msg-list-head">
            <div className="msg-list-title">
              <h1>Mesazhet</h1>
              {!loadingList ? <span>{listSummary}</span> : null}
            </div>
            <span
              className={`msg-conn${socket.connected ? ' is-online' : ''}`}
              role="status"
              title={socket.connected ? 'Online' : 'Duke u lidhur'}
            >
              <span className="msg-conn-dot" aria-hidden />
              <span className="msg-conn-label">{socket.connected ? 'Online' : 'Duke u lidhur'}</span>
            </span>
          </div>

          <div className="msg-list-search">
            <SearchField aria-label="Kërko bisedë" value={listQuery} onChange={setListQuery} fullWidth>
              <SearchField.Group>
                <SearchField.SearchIcon />
                <SearchField.Input placeholder="Kërko bisedë..." />
                <SearchField.ClearButton />
              </SearchField.Group>
            </SearchField>
          </div>

          <Separator />

          <div className="msg-list-body">
            {error ? (
              <Alert status="danger" className="msg-alert">
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Description>{error}</Alert.Description>
                </Alert.Content>
              </Alert>
            ) : null}

            {loadingList ? (
              <ul className="msg-items" aria-hidden>
                {[0, 1, 2, 3, 4].map((i) => (
                  <li key={i} className="msg-item is-skeleton">
                    <Skeleton className="msg-skel-avatar" />
                    <span className="msg-item-body">
                      <Skeleton className="msg-skel-line" />
                      <Skeleton className="msg-skel-line is-wide" />
                    </span>
                  </li>
                ))}
              </ul>
            ) : conversations.length === 0 ? (
              <div className="msg-list-empty">
                <span className="msg-empty-icon" aria-hidden>
                  <MessageCircle size={20} />
                </span>
                <strong>Ende pa biseda</strong>
                <p>Hap një ofertë dhe kliko “Dërgo mesazh”.</p>
                <Link to="/ofertat" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                  Shiko ofertat
                </Link>
              </div>
            ) : filteredConversations.length === 0 ? (
              <p className="msg-list-note">Asnjë rezultat për “{listQuery}”.</p>
            ) : (
              <ul className="msg-items">
                {filteredConversations.map((c) => {
                  const isActive = c.id === activeId
                  return (
                    <li key={c.id}>
                      <button
                        type="button"
                        className={`msg-item${isActive ? ' is-active' : ''}${c.unread > 0 ? ' has-unread' : ''}`}
                        aria-current={isActive ? 'true' : undefined}
                        onClick={() => selectConversation(c.id)}
                      >
                        <Badge.Anchor className="msg-item-avatar">
                          <ProfileAvatar src={c.peer.profilePhoto} seed={c.peer.uid} alt="" size={44} />
                          {c.unread > 0 ? (
                            <Badge color="accent" size="sm" aria-label={`${c.unread} mesazhe të palexuara`}>
                              <Badge.Label>{c.unread > 9 ? '9+' : c.unread}</Badge.Label>
                            </Badge>
                          ) : null}
                        </Badge.Anchor>
                        <span className="msg-item-body">
                          <span className="msg-item-row">
                            <strong>{c.peer.name}</strong>
                            {c.lastMessageAt ? <time dateTime={c.lastMessageAt}>{formatListTime(c.lastMessageAt)}</time> : null}
                          </span>
                          <span className="msg-item-context">{c.serviceTitle || c.peer.roleLabel || 'Bisedë'}</span>
                          <span className="msg-item-preview">{c.lastMessagePreview || 'Nis bisedën'}</span>
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
          <KeshillaPagination pagination={pagination} onPageChange={setPage} isDisabled={loadingList} />
        </aside>

        <section className="msg-thread" aria-label={active ? `Biseda me ${active.peer.name}` : 'Biseda'}>
          {!activeId ? (
            <div className="msg-thread-placeholder">
              <span className="msg-empty-icon is-lg" aria-hidden>
                <MessageCircle size={26} />
              </span>
              {!loadingList && conversations.length === 0 ? (
                <>
                  <h2>Bisedat shfaqen këtu</h2>
                  <p>Kur të nisësh një bisedë me një ekspert ose kompani, do ta gjesh në këtë faqe.</p>
                </>
              ) : (
                <>
                  <h2>Zgjidh një bisedë</h2>
                  <p>Zgjidh dikë nga lista për të vazhduar bisedën.</p>
                </>
              )}
            </div>
          ) : (
            <>
              <header className="msg-thread-head">
                <Button
                  isIconOnly
                  variant="ghost"
                  className="msg-back"
                  aria-label="Kthehu te bisedat"
                  onPress={() => selectConversation('')}
                >
                  <ArrowLeft size={20} />
                </Button>
                <ProfileAvatar src={active?.peer.profilePhoto} seed={active?.peer.uid} alt="" size={40} />
                <div className="msg-thread-meta">
                  <strong>{active?.peer.name || 'Bisedë'}</strong>
                  <span className={peerTyping ? 'is-typing' : undefined}>
                    {peerTyping
                      ? 'Po shkruan...'
                      : active?.serviceTitle
                        ? `Për: ${active.serviceTitle}`
                        : active?.peer.roleLabel || 'Chat'}
                  </span>
                </div>
                {active?.peer.uid ? (
                  <Link
                    to={providerPath(active.peer)}
                    className={`${buttonVariants({ variant: 'outline', size: 'sm' })} msg-profile`}
                    aria-label="Shiko profilin"
                  >
                    <UserRound size={16} aria-hidden />
                    <span>Shiko profilin</span>
                  </Link>
                ) : null}
              </header>

              <div className="msg-history">
                {!loadingThread && messages.length > 0 && hasOlderMessages ? <Button size="sm" variant="outline" isPending={loadingHistory} onPress={() => {
                  setLoadingHistory(true)
                  const conversationId = activeId
                  fetchMessages(conversationId, { before: messages[0].createdAt, limit: 50 }).then((older) => {
                    if (activeIdRef.current !== conversationId) return
                    setHasOlderMessages(older.pagination.total > older.length)
                    preserveHistoryScroll.current = true
                    setMessages((current) => [...older.filter((item) => !current.some((message) => message.id === item.id)), ...current])
                  }).catch((error: unknown) => setError(getErrorMessage(error))).finally(() => setLoadingHistory(false))
                }}>Shfaq mesazhet e mëparshme</Button> : null}
                {loadingThread ? (
                  <div className="msg-history-loading" aria-label="Duke ngarkuar mesazhet">
                    <Skeleton className="msg-skel-bubble" />
                    <Skeleton className="msg-skel-bubble is-mine" />
                    <Skeleton className="msg-skel-bubble is-short" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="msg-history-empty">
                    <span className="msg-empty-icon" aria-hidden>
                      <MessageCircle size={20} />
                    </span>
                    <p>
                      Nis bisedën me <strong>{active?.peer.name}</strong>
                    </p>
                  </div>
                ) : (
                  messages.map((m, index) => {
                    const mine = m.senderUid === user?.uid
                    const day = dayKey(m.createdAt)
                    const showDay = index === 0 || day !== dayKey(messages[index - 1].createdAt)
                    return (
                      <Fragment key={m.id}>
                        {showDay && day ? (
                          <div className="msg-day" role="separator">
                            <span>{formatDay(m.createdAt)}</span>
                          </div>
                        ) : null}
                        <div className={`msg-bubble${mine ? ' is-mine' : ''}`}>
                          <p>{m.body}</p>
                          <time dateTime={m.createdAt}>{formatClock(m.createdAt)}</time>
                        </div>
                      </Fragment>
                    )
                  })
                )}
                {peerTyping ? (
                  <div className="msg-typing" aria-live="polite" aria-label="Po shkruan">
                    <span />
                    <span />
                    <span />
                  </div>
                ) : null}
                <div ref={bottomRef} />
              </div>

              <form className="msg-composer" onSubmit={onSend}>
                <Input
                  ref={inputRef}
                  value={draft}
                  onChange={(e) => onDraftChange(e.target.value)}
                  placeholder={`Shkruaj mesazh për ${active?.peer.name || 'ta'}...`}
                  aria-label="Mesazhi"
                  maxLength={4000}
                  disabled={sending}
                  fullWidth
                  className="msg-input"
                />
                <Button
                  type="submit"
                  variant="primary"
                  isIconOnly
                  className="msg-send"
                  isDisabled={sending || !draft.trim()}
                  aria-label="Dërgo"
                >
                  <Send size={18} />
                </Button>
              </form>
            </>
          )}
        </section>
      </Card>
    </div>
  )
}

