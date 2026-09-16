import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Send } from 'lucide-react'
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
  const [loadingList, setLoadingList] = useState(true)
  const [loadingThread, setLoadingThread] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [peerTyping, setPeerTyping] = useState(false)
  const bottomRef = useRef<HTMLDivElement | null>(null)
  const typingTimeout = useRef<number | null>(null)

  const socket = useChatSocket(Boolean(user))

  const active = useMemo(
    () => conversations.find((c) => c.id === activeId) || null,
    [conversations, activeId],
  )

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

  return (
    <div className="chat-page">
      <header className="chat-page-head">
        <div>
          <h1>Mesazhet</h1>
          <p className="muted">
            Chat real-time me ofruesit e shërbimeve
            {socket.connected ? ' · i lidhur' : ' · duke u lidhur...'}
          </p>
        </div>
      </header>

      {error ? <p className="error">{error}</p> : null}

      <div className="chat-layout">
        <aside className="chat-list">
          {loadingList ? <p className="muted">Duke u ngarkuar...</p> : null}
          {!loadingList && conversations.length === 0 ? (
            <p className="muted">
              Nuk ke ende biseda. Hap një shërbim dhe kliko “Dërgo mesazh”.
            </p>
          ) : null}
          <ul>
            {conversations.map((c) => {
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
                      <strong>
                        {c.peer.name}
                        {c.unread > 0 ? <span className="chat-unread">{c.unread}</span> : null}
                      </strong>
                      <span>{c.serviceTitle || c.peer.roleLabel || 'Bisedë'}</span>
                      <em>{c.lastMessagePreview || 'Nis bisedën'}</em>
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        </aside>

        <section className="chat-thread">
          {!activeId ? (
            <div className="chat-empty">
              <h2>Zgjidh një bisedë</h2>
              <p className="muted">Ose nis një të re nga faqja e shërbimit / profilit të ofruesit.</p>
            </div>
          ) : (
            <>
              <div className="chat-thread-head">
                <div className="profile-avatar-md" aria-hidden>
                  {mediaUrl(active?.peer.profilePhoto) ? (
                    <img src={mediaUrl(active?.peer.profilePhoto)} alt="" />
                  ) : (
                    <span>{(active?.peer.name || '?').slice(0, 1)}</span>
                  )}
                </div>
                <div>
                  <strong>{active?.peer.name || 'Bisedë'}</strong>
                  <span className="muted">
                    {active?.serviceTitle
                      ? `Për: ${active.serviceTitle}`
                      : active?.peer.roleLabel || 'Chat'}
                  </span>
                </div>
              </div>

              <div className="chat-messages">
                {loadingThread ? <p className="muted">Duke ngarkuar mesazhet...</p> : null}
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
                  placeholder="Shkruaj mesazhin..."
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
