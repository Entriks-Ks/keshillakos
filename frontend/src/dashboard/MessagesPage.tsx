import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowLeft, MessageCircle, Search, Send } from 'lucide-react'
import { Button } from '@heroui/react'
import {
  fetchConversations,
  fetchMessages,
  markConversationRead,
  type ChatMessage,
  type ConversationItem,
} from '../api/chat'
import { mediaUrl } from '../api/auth'
import { useAuth } from '../auth/AuthContext'
import { useChatSocket } from '../hooks/useChatSocket'
import { getErrorMessage } from '../utils/errors'

function formatTime(iso?: string) {
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
  return d.toLocaleString('sq-AL', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function MessagesPage() {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const activeId = searchParams.get('c') || ''

  const [conversations, setConversations] = useState<ConversationItem[]>([])
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const [listQuery, setListQuery] = useState('')
  const [loadingList, setLoadingList] = useState(true)
  const [loadingThread, setLoadingThread] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [peerTyping, setPeerTyping] = useState(false)
  const bottomRef = useRef<HTMLDivElement | null>(null)
  const typingTimeout = useRef<number | null>(null)
  const didAutoSelect = useRef(false)

  const socket = useChatSocket(Boolean(user))

  const active = useMemo(
    () => conversations.find((c) => c.id === activeId) || null,
    [conversations, activeId],
  )

  const filteredConversations = useMemo(() => {
    const q = listQuery.trim().toLowerCase()
    if (!q) return conversations
    return conversations.filter((c) => {
      const haystack = [c.peer.name, c.peer.roleLabel, c.serviceTitle, c.lastMessagePreview]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(q)
    })
  }, [conversations, listQuery])

  useEffect(() => {
    let cancelled = false
    setLoadingList(true)
    fetchConversations()
      .then((items) => {
        if (!cancelled) setConversations(items)
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
  }, [])

  // With few conversations, open the first one automatically so the screen isn't empty.
  useEffect(() => {
    if (didAutoSelect.current || loadingList || activeId || conversations.length === 0) return
    if (conversations.length <= 5) {
      didAutoSelect.current = true
      setSearchParams({ c: conversations[0].id }, { replace: true })
    }
  }, [loadingList, activeId, conversations, setSearchParams])

  useEffect(() => {
    if (!activeId || !socket.connected) return

    let cancelled = false
    setLoadingThread(true)
    setPeerTyping(false)

    void (async () => {
      try {
        const joined = await socket.joinConversation(activeId)
        if (cancelled) return
        if (joined.ok && joined.messages) {
          setMessages(joined.messages)
        } else {
          const fallback = await fetchMessages(activeId)
          if (!cancelled) setMessages(fallback)
        }
        await markConversationRead(activeId)
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
    })
  }, [activeId, socket.onMessageNew])

  useEffect(() => {
    return socket.onConversationUpdated((event) => {
      setConversations((prev) => {
        const exists = prev.some((c) => c.id === event.conversationId)
        if (!exists) {
          void fetchConversations().then(setConversations).catch(() => undefined)
          return prev
        }

        const next = prev.map((c) =>
          c.id === event.conversationId
            ? {
                ...c,
                lastMessageAt: event.lastMessageAt,
                lastMessagePreview: event.lastMessagePreview,
                unread:
                  event.conversationId === activeId || event.senderUid === user?.uid
                    ? event.conversationId === activeId
                      ? 0
                      : c.unread
                    : c.unread + 1,
              }
            : c,
        )

        return [...next].sort((a, b) => {
          const at = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0
          const bt = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0
          return bt - at
        })
      })
    })
  }, [activeId, socket.onConversationUpdated, user?.uid])

  useEffect(() => {
    return socket.onTyping((event) => {
      if (event.conversationId !== activeId || event.uid === user?.uid) return
      setPeerTyping(event.isTyping)
    })
  }, [activeId, socket.onTyping, user?.uid])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, peerTyping])

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
      setError(result.error || 'Mesazhi nuk u dërgua')
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

  const peerPhoto = mediaUrl(active?.peer.profilePhoto)

  return (
    <div className={`chat-page${activeId ? ' has-active' : ''}`}>
      <header className="chat-page-head">
        <div>
          <h1>Mesazhet</h1>
          <p className="muted">
            {conversations.length === 0
              ? 'Nis një bisedë nga oferta ose profili i ofruesit.'
              : `${conversations.length} ${conversations.length === 1 ? 'bisedë' : 'biseda'} aktive`}
          </p>
        </div>
        <span className={`chat-conn${socket.connected ? ' is-online' : ''}`}>
          <span className="chat-conn-dot" aria-hidden />
          {socket.connected ? 'Online' : 'Duke u lidhur'}
        </span>
      </header>

      {error ? <p className="error">{error}</p> : null}

      <div className="chat-layout">
        <aside className="chat-list">
          <div className="chat-list-top">
            <div className="chat-list-title">
              <strong>Bisedat</strong>
              <span>{conversations.length}</span>
            </div>
            {conversations.length > 1 ? (
              <label className="chat-list-search">
                <Search size={15} aria-hidden />
                <input
                  value={listQuery}
                  onChange={(e) => setListQuery(e.target.value)}
                  placeholder="Kërko person..."
                  aria-label="Kërko bisedë"
                />
              </label>
            ) : null}
          </div>

          {loadingList ? <p className="muted chat-pad">Duke u ngarkuar...</p> : null}

          {!loadingList && conversations.length === 0 ? (
            <div className="chat-list-empty">
              <MessageCircle size={22} aria-hidden />
              <p>Ende pa biseda</p>
              <span>Hap një ofertë dhe kliko “Dërgo mesazh”.</span>
              <Link to="/ofertat" className="chat-empty-link">
                Shiko ofertat
              </Link>
            </div>
          ) : null}

          {!loadingList && conversations.length > 0 && filteredConversations.length === 0 ? (
            <p className="muted chat-pad">Asnjë rezultat për “{listQuery}”.</p>
          ) : null}

          <ul className="chat-people">
            {filteredConversations.map((c) => {
              const photo = mediaUrl(c.peer.profilePhoto)
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    className={`chat-list-item${c.id === activeId ? ' is-active' : ''}`}
                    onClick={() => selectConversation(c.id)}
                  >
                    <div className="profile-avatar-sm" aria-hidden>
                      {photo ? <img src={photo} alt="" /> : <span>{c.peer.name.slice(0, 1)}</span>}
                    </div>
                    <div className="chat-list-meta">
                      <div className="chat-list-row">
                        <strong>{c.peer.name}</strong>
                        {c.lastMessageAt ? <time>{formatTime(c.lastMessageAt)}</time> : null}
                      </div>
                      <span>{c.serviceTitle || c.peer.roleLabel || 'Bisedë'}</span>
                      <em>{c.lastMessagePreview || 'Nis bisedën'}</em>
                    </div>
                    {c.unread > 0 ? <span className="chat-unread">{c.unread}</span> : null}
                  </button>
                </li>
              )
            })}
          </ul>
        </aside>

        <section className="chat-thread">
          {!activeId ? (
            <div className="chat-empty">
              <span className="chat-empty-icon" aria-hidden>
                <MessageCircle size={24} />
              </span>
              <h2>Zgjidh një person</h2>
              <p className="muted">Zgjidh një bisedë majtas për të vazhduar chat-in.</p>
            </div>
          ) : (
            <>
              <div className="chat-thread-head">
                <button
                  type="button"
                  className="chat-back"
                  onClick={() => selectConversation('')}
                  aria-label="Kthehu te lista"
                >
                  <ArrowLeft size={18} />
                </button>
                <div className="profile-avatar-md" aria-hidden>
                  {peerPhoto ? (
                    <img src={peerPhoto} alt="" />
                  ) : (
                    <span>{(active?.peer.name || '?').slice(0, 1)}</span>
                  )}
                </div>
                <div className="chat-thread-meta">
                  <strong>{active?.peer.name || 'Bisedë'}</strong>
                  <span>
                    {active?.serviceTitle
                      ? `Për: ${active.serviceTitle}`
                      : active?.peer.roleLabel || 'Chat'}
                  </span>
                </div>
                {active?.peer.uid ? (
                  <Link to={`/providers/${active.peer.uid}`} className="chat-profile-link">
                    Profili
                  </Link>
                ) : null}
              </div>

              <div className="chat-messages">
                {loadingThread ? <p className="muted">Duke ngarkuar mesazhet...</p> : null}
                {!loadingThread && messages.length === 0 ? (
                  <div className="chat-thread-empty">
                    <p>
                      Nis bisedën me <strong>{active?.peer.name}</strong>.
                    </p>
                  </div>
                ) : null}
                {messages.map((m) => {
                  const mine = m.senderUid === user?.uid
                  return (
                    <div key={m.id} className={`chat-bubble${mine ? ' is-mine' : ''}`}>
                      <p>{m.body}</p>
                      <time>{formatTime(m.createdAt)}</time>
                    </div>
                  )
                })}
                {peerTyping ? <p className="chat-typing">Po shkruan...</p> : null}
                <div ref={bottomRef} />
              </div>

              <form className="chat-composer" onSubmit={onSend}>
                <input
                  value={draft}
                  onChange={(e) => onDraftChange(e.target.value)}
                  placeholder={`Mesazh për ${active?.peer.name || 'ta'}...`}
                  maxLength={4000}
                  disabled={sending}
                />
                <Button type="submit" variant="primary" isDisabled={sending || !draft.trim()}>
                  <Send size={16} />
                  Dërgo
                </Button>
              </form>
            </>
          )}
        </section>
      </div>
    </div>
  )
}
