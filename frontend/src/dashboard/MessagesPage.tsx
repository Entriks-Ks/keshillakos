import { mergeMessages, replaceMessage, updateConversationPreview, mergeConversationSnapshots, updateConversation, updateConversationList, removeConversationFromList, nearHistoryBottom, prependedScrollTop, type ConversationUpdate } from '../chat/chatState'
import { useNotifications } from '../notifications/NotificationProvider'
import KeshillaPagination from '../components/KeshillaPagination'
import { usePagination } from '../hooks/usePagination'
import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Check, MessageCircle, Pencil, Phone, Send, Trash2, Video } from 'lucide-react'
import { useCall } from '../calls/CallContext'
import {
  Alert,
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
  editChatMessage,
  deleteChatMessage,
  deleteConversation,
  type ChatMessage,
  type ConversationItem,
} from '../api/chat'
import ProfileAvatar from '../components/ProfileAvatar'
import { useAuth } from '../auth/AuthContext'
import { useChatSocket } from '../hooks/useChatSocket'
import { getErrorMessage } from '../utils/errors'
import { providerPath } from '../utils/publicPaths'
import './Messages.css'
import ConversationActions from '../chat/ConversationActions'
import ConfirmActionDialog from '../components/ConfirmActionDialog'
import { useChatPresence, presenceLabel } from '../chat/useChatPresence'
import type { ChatDetails } from '../api/chat'
import { REQUEST_STATUS } from './requestDisplay'
import { getDashboardPath } from '../utils/dashboardPath'

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
  const { t } = useTranslation()
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const activeId = searchParams.get('c') || ''

  const activeIdRef = useRef(activeId)
  activeIdRef.current = activeId
  const [conversations, setConversations] = useState<ConversationItem[]>([])
  const { messageUnreadCount: totalUnread } = useNotifications()
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
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<ChatMessage | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteChatTarget, setDeleteChatTarget] = useState<ConversationItem | null>(null)
  const [deletingChat, setDeletingChat] = useState(false)
  const [chatDetails, setChatDetails] = useState<(ChatDetails & { conversationId: string }) | null>(null)
  const historyRef = useRef<HTMLDivElement | null>(null)
  const followBottomRef = useRef(true)
  const smoothFollowRef = useRef(false)
  const restoreScrollRef = useRef<number | 'bottom' | null>(null)
  const prependAnchorRef = useRef<{ top: number; height: number } | null>(null)
  const threadsRef = useRef(new Map<string, { messages: ChatMessage[]; hasOlder: boolean; hydrated?: boolean; scrollTop?: number }>())
  const conversationCacheRef = useRef(new Map<string, ConversationItem>())
  const pendingEventsRef = useRef(new Map<string, ConversationUpdate[]>())
  const pendingMetadataRef = useRef(new Set<string>())
  const metadataRequestsRef = useRef(new Map<string, Promise<ConversationItem>>())
  const conversationVersionsRef = useRef(new Map<string, number>())
  const mountedRef = useRef(true)
  const previouslyConnectedRef = useRef(false)
  const listScopeRef = useRef({ page, listQuery })
  listScopeRef.current = { page, listQuery }
  const inputRef = useRef<HTMLInputElement | null>(null)
  const typingTimeout = useRef<number | null>(null)
  const didAutoSelect = useRef(false)

  const socket = useChatSocket(Boolean(user), user?.uid)
  const presence = useChatPresence(socket, [...conversations.map(c => c.id), ...(activeId ? [activeId] : [])])
  const { initiateCall, stage: callStage } = useCall()

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  function getMetadata(id: string) {
    const pending = metadataRequestsRef.current.get(id)
    if (pending) return pending
    const request = fetchConversation(id).finally(() => { metadataRequestsRef.current.delete(id) })
    metadataRequestsRef.current.set(id, request)
    return request
  }

  function saveMessages(id: string, incoming: ChatMessage[]) {
    const cached = threadsRef.current.get(id) ?? { messages: [], hasOlder: true }
    const next = mergeMessages(cached.messages, incoming)
    if (next === cached.messages) return
    threadsRef.current.set(id, { ...cached, messages: next })
    if (activeIdRef.current === id) setMessages(next)
  }

  function storeUpdatedMessage(updated: ChatMessage) {
    const cached = threadsRef.current.get(updated.conversationId)
    if (!cached) return
    const next = replaceMessage(cached.messages, updated)
    if (next === cached.messages) return
    threadsRef.current.set(updated.conversationId, { ...cached, messages: next })
    if (activeIdRef.current === updated.conversationId) setMessages(next)
  }

  function applyPreview(conversationId: string, preview: string) {
    const cached = conversationCacheRef.current.get(conversationId)
    if (cached && cached.lastMessagePreview !== preview) {
      const updated = { ...cached, lastMessagePreview: preview }
      conversationCacheRef.current.set(conversationId, updated)
      conversationVersionsRef.current.set(conversationId, (conversationVersionsRef.current.get(conversationId) ?? 0) + 1)
      if (activeIdRef.current === conversationId) setActiveConversation(updated)
    }
    setConversations(previous => updateConversationPreview(previous, conversationId, preview))
  }

  function handleMessageUpdated(updated: ChatMessage, lastMessagePreview?: string) {
    storeUpdatedMessage(updated)
    if (lastMessagePreview !== undefined) applyPreview(updated.conversationId, lastMessagePreview)
    if (updated.deleted) setEditingId(current => (current === updated.id ? null : current))
  }

  function startEdit(message: ChatMessage) {
    setEditingId(message.id)
    setEditDraft(message.body)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditDraft('')
  }

  async function saveEdit(message: ChatMessage) {
    const body = editDraft.trim()
    if (!body || savingEdit) return
    if (body === message.body) { cancelEdit(); return }
    setSavingEdit(true)
    try {
      const updated = await editChatMessage(message.conversationId, message.id, body)
      const isLatest = messages[messages.length - 1]?.id === message.id
      handleMessageUpdated(updated, isLatest ? updated.body.slice(0, 140) : undefined)
      toast.success('Mesazhi u ndryshua me sukses')
      cancelEdit()
    } catch (err) {
      toast.danger(getErrorMessage(err) || 'Mesazhi nuk u ndryshua')
    } finally {
      setSavingEdit(false)
    }
  }

  async function confirmDelete() {
    const target = deleteTarget
    if (!target || deleting) return
    setDeleting(true)
    try {
      const updated = await deleteChatMessage(target.conversationId, target.id)
      const isLatest = messages[messages.length - 1]?.id === target.id
      handleMessageUpdated(updated, isLatest ? 'Mesazhi u fshi' : undefined)
      toast.success('Mesazhi u fshi')
      setDeleteTarget(null)
    } catch (err) {
      toast.danger(getErrorMessage(err) || 'Mesazhi nuk u fshi')
    } finally {
      setDeleting(false)
    }
  }

  async function confirmDeleteChat() {
    const target = deleteChatTarget
    if (!target || deletingChat) return
    setDeletingChat(true)
    try {
      await deleteConversation(target.id)
      setConversations(previous => removeConversationFromList(previous, target.id))
      threadsRef.current.delete(target.id)
      conversationCacheRef.current.delete(target.id)
      conversationVersionsRef.current.delete(target.id)

      if (activeIdRef.current === target.id) {
        setMessages([])
        setActiveConversation(null)
        setSearchParams({}, { replace: true })
      }
      toast.success('Biseda u fshi me sukses')
      setDeleteChatTarget(null)
    } catch (err) {
      toast.danger(getErrorMessage(err) || 'Biseda nuk u fshi')
    } finally {
      setDeletingChat(false)
    }
  }

  function applyUpdate(event: ConversationUpdate) {
    const viewedId = activeIdRef.current
    const visible = document.visibilityState === 'visible'
    const cached = conversationCacheRef.current.get(event.conversationId)
    if (cached) {
      const updated = updateConversation(cached, event, user?.uid || '', viewedId, visible)
      if (updated === cached) return
      conversationCacheRef.current.set(event.conversationId, updated)
      conversationVersionsRef.current.set(event.conversationId, (conversationVersionsRef.current.get(event.conversationId) ?? 0) + 1)
      setConversations(previous => updateConversationList(previous, event, user?.uid || '', viewedId, visible))
      if (viewedId === event.conversationId) setActiveConversation(updated)
      return
    }
    // A new/off-page thread needs only its own metadata, never a list refresh.
    const pending = pendingEventsRef.current.get(event.conversationId) ?? []
    pendingEventsRef.current.set(event.conversationId, [...pending, event])
    if (pendingMetadataRef.current.has(event.conversationId)) return
    pendingMetadataRef.current.add(event.conversationId)
    void getMetadata(event.conversationId).then(conversation => {
      if (!mountedRef.current) return
      for (const update of pendingEventsRef.current.get(event.conversationId) ?? []) {
        conversation = updateConversation(conversation, update, user?.uid || '', activeIdRef.current, document.visibilityState === 'visible')
      }
      conversationCacheRef.current.set(conversation.id, conversation)
      conversationVersionsRef.current.set(conversation.id, (conversationVersionsRef.current.get(conversation.id) ?? 0) + 1)
      if (listScopeRef.current.page === 1 && !listScopeRef.current.listQuery) setConversations(previous => previous.some(row => row.id === conversation.id) ? previous : [...previous, conversation])
      if (activeIdRef.current === conversation.id) setActiveConversation(conversation)
    }).catch(() => undefined).finally(() => {
      pendingMetadataRef.current.delete(event.conversationId)
      pendingEventsRef.current.delete(event.conversationId)
    })
  }

  const active = useMemo(
    () => conversations.find((c) => c.id === activeId) || (activeConversation?.id === activeId ? activeConversation : null),
    [conversations, activeId, activeConversation],
  )

  const filteredConversations = conversations
  const currentDetails = chatDetails?.conversationId === activeId ? chatDetails : null
  const messagingDisabled = Boolean(currentDetails?.messagingBlocked)
  useEffect(() => { if (messagingDisabled) setPeerTyping(false) }, [messagingDisabled])

  useEffect(() => {
    let cancelled = false
    const versions = new Map(conversationVersionsRef.current)
    setLoadingList(true)
    fetchConversations({ page, limit: 20, q: listQuery })
      .then((items) => {
        if (!cancelled) {
          const rows = items.map(item => {
            const live = conversationCacheRef.current.get(item.id)
            const changed = conversationVersionsRef.current.get(item.id) !== versions.get(item.id)
            const resolved = live && changed ? live : item.id === activeIdRef.current && document.visibilityState === 'visible' && changed ? { ...item, unread: 0 } : item.id === activeIdRef.current && document.visibilityState === 'visible' && changed ? { ...item, unread: 0 } : item
            conversationCacheRef.current.set(item.id, resolved)
            return resolved
          })
          setConversations(rows); receivePagination(items.pagination)
        }
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
  }, [page, listQuery])

  useEffect(() => {
    if (!socket.connected) return
    if (!previouslyConnectedRef.current) { previouslyConnectedRef.current = true; return }
    // Reconcile missed events only after a reconnect; keep the rendered list and thread intact.
    let cancelled = false
    const scope = listScopeRef.current
    const versions = new Map(conversationVersionsRef.current)
    void fetchConversations({ page: scope.page, limit: 20, q: scope.listQuery }).then(items => {
      if (cancelled || scope.page !== listScopeRef.current.page || scope.listQuery !== listScopeRef.current.listQuery) return
      const rows = items.map(item => {
        const live = conversationCacheRef.current.get(item.id)
        const changed = conversationVersionsRef.current.get(item.id) !== versions.get(item.id)
        const resolved = live && changed ? live : item.id === activeIdRef.current && document.visibilityState === 'visible' && changed ? { ...item, unread: 0 } : item
        conversationCacheRef.current.set(item.id, resolved)
        return resolved
      })
      setConversations(current => mergeConversationSnapshots(current, rows))
      receivePagination(items.pagination)
    }).catch(() => undefined)
    return () => { cancelled = true }
  }, [socket.connected])

  useEffect(() => {
    if (didAutoSelect.current || loadingList || activeId || conversations.length === 0) return
    if (pagination.total <= 5) {
      didAutoSelect.current = true
      setSearchParams({ c: conversations[0].id }, { replace: true })
    }
  }, [loadingList, activeId, conversations, pagination.total, setSearchParams])

  // Switching back to a cached thread restores it before paint; socket sync stays quiet.
  useLayoutEffect(() => {
    if (!activeId) return
    const cached = threadsRef.current.get(activeId)
    setMessages(cached?.messages ?? [])
    setHasOlderMessages(cached?.hasOlder ?? true)
    setLoadingThread(!cached)
    setPeerTyping(false)
    setEditingId(null)
    setDeleteTarget(null)
    setActiveConversation(conversationCacheRef.current.get(activeId) ?? null)
    restoreScrollRef.current = cached?.scrollTop ?? 'bottom'
    followBottomRef.current = cached?.scrollTop === undefined
    smoothFollowRef.current = false
    prependAnchorRef.current = null
  }, [activeId])

  useEffect(() => {
    if (!activeId || !socket.connected) return
    let cancelled = false
    const cached = conversationCacheRef.current.get(activeId)
    if (!cached) void getMetadata(activeId).then(conversation => {
      if (cancelled) return
      const live = conversationCacheRef.current.get(activeId)
      const resolved = live ?? (document.visibilityState === 'visible' ? { ...conversation, unread: 0 } : conversation)
      conversationCacheRef.current.set(activeId, resolved)
      setActiveConversation(resolved)
    }).catch(() => undefined)
    void (async () => {
      try {
        const joined = await socket.joinConversation(activeId)
        if (cancelled) return
        const snapshot = joined.ok && joined.messages ? joined.messages : await fetchMessages(activeId)
        if (cancelled) return
        const thread = threadsRef.current.get(activeId)
        const hasOlder = thread?.hydrated ? thread.hasOlder : (joined.pagination ? joined.pagination.total > snapshot.length : 'pagination' in snapshot ? (snapshot.pagination as { total: number }).total > snapshot.length : snapshot.length === 50)
        threadsRef.current.set(activeId, { messages: thread?.messages ?? [], hasOlder, hydrated: true, scrollTop: thread?.scrollTop })
        saveMessages(activeId, snapshot)
        setHasOlderMessages(hasOlder)
        if (document.visibilityState === 'visible') {
          if (!joined.ok) await markConversationRead(activeId)
          clearLocalUnread(activeId)
        }
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

  function clearLocalUnread(id: string) {
    conversationVersionsRef.current.set(id, (conversationVersionsRef.current.get(id) ?? 0) + 1)
    const cached = conversationCacheRef.current.get(id)
    if (cached?.unread) conversationCacheRef.current.set(id, { ...cached, unread: 0 })
    setConversations(previous => {
      const existing = previous.find(row => row.id === id)
      return existing?.unread ? previous.map(row => row.id === id ? { ...row, unread: 0 } : row) : previous
    })
  }

  useEffect(() => {
    const visible = () => {
      if (document.visibilityState === 'visible' && activeIdRef.current) clearLocalUnread(activeIdRef.current)
    }
    document.addEventListener('visibilitychange', visible)
    return () => document.removeEventListener('visibilitychange', visible)
  }, [])

  useEffect(() => socket.onMessageNew(message => {
    saveMessages(message.conversationId, [message])
  }), [socket.onMessageNew])

  useEffect(() => socket.onMessageUpdated(event => {
    handleMessageUpdated(event.message, event.lastMessagePreview)
  }), [socket.onMessageUpdated])

  useEffect(() => socket.onConversationUpdated(applyUpdate), [socket.onConversationUpdated, user?.uid, page, listQuery])

  useEffect(() => socket.onConversationDeleted(event => {
    const deletedId = event.conversationId
    setConversations(previous => removeConversationFromList(previous, deletedId))
    threadsRef.current.delete(deletedId)
    conversationCacheRef.current.delete(deletedId)
    conversationVersionsRef.current.delete(deletedId)

    if (activeIdRef.current === deletedId) {
      setMessages([])
      setActiveConversation(null)
      setSearchParams({}, { replace: true })
      toast.info('Kjo bisedë u fshi')
    }
  }), [socket.onConversationDeleted, setSearchParams])

  useEffect(() => {
    return socket.onTyping((event) => {
      if (event.conversationId !== activeId || event.uid === user?.uid) return
      setPeerTyping(event.isTyping)
    })
  }, [activeId, socket.onTyping, user?.uid])

  useLayoutEffect(() => {
    const history = historyRef.current
    if (!history || loadingThread) return
    const restore = restoreScrollRef.current
    const prepend = prependAnchorRef.current
    if (restore !== null) {
      history.scrollTop = restore === 'bottom' ? history.scrollHeight : restore
      restoreScrollRef.current = null
      followBottomRef.current = nearHistoryBottom(history.scrollTop, history.scrollHeight, history.clientHeight)
    } else if (prepend) {
      history.scrollTop = prependedScrollTop(prepend.top, prepend.height, history.scrollHeight)
      prependAnchorRef.current = null
    } else if (followBottomRef.current) {
      smoothFollowRef.current = true
      history.scrollTo({ top: history.scrollHeight, behavior: 'smooth' })
    }
  }, [activeId, messages, peerTyping, loadingThread])

  useEffect(() => {
    if (activeId) inputRef.current?.focus()
  }, [activeId])

  function selectConversation(id: string) {
    setSearchParams(id ? { c: id } : {})
  }

  async function onSend(e: FormEvent) {
    e.preventDefault()
    if (!activeId || !draft.trim() || sending || messagingDisabled) return
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
      saveMessages(result.message.conversationId, [result.message])
      applyUpdate({ conversationId: result.message.conversationId, senderUid: result.message.senderUid, lastMessageAt: result.message.createdAt, lastMessagePreview: result.message.body.slice(0, 140) })
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
              title={socket.connected ? 'Lidhur' : 'Duke u lidhur'}
            >
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
                    <li key={c.id} className="msg-item-row-wrapper">
                      <button
                        type="button"
                        className={`msg-item${isActive ? ' is-active' : ''}${c.unread > 0 ? ' has-unread' : ''}`}
                        aria-current={isActive ? 'true' : undefined}
                        onClick={() => selectConversation(c.id)}
                      >
                        <span className="msg-item-avatar">
                          <ProfileAvatar src={c.peer.profilePhoto} seed={c.peer.uid} alt="" size={44} />
                        </span>
                        <span className="msg-item-body">
                          <span className="msg-item-row">
                            <strong>{c.peer.name}</strong>
                            {c.lastMessageAt ? <time dateTime={c.lastMessageAt}>{formatListTime(c.lastMessageAt)}</time> : null}
                          </span>
                          <span className="msg-item-context">{c.serviceTitle || c.peer.roleLabel || 'Bisedë'}</span>
                          <span className="msg-item-preview-row">
                            <span className="msg-item-preview">{c.lastMessagePreview || 'Nis bisedën'}</span>
                            {c.unread > 0 && (
                              <span
                                className={`msg-item-unread${c.unread > 1 ? ' is-count' : ''}`}
                                aria-label={`${c.unread} mesazhe të palexuara`}
                              >
                                {c.unread > 1 ? (c.unread > 99 ? '99+' : c.unread) : null}
                              </span>
                            )}
                          </span>
                        </span>
                      </button>
                      <button
                        type="button"
                        className="msg-item-del-btn"
                        aria-label={`Fshi bisedën me ${c.peer.name}`}
                        title="Fshi bisedën"
                        onClick={(e) => {
                          e.stopPropagation()
                          setDeleteChatTarget(c)
                        }}
                      >
                        <Trash2 size={15} />
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
              <div className="msg-thread-heading">
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
                    <strong>{active?.peer.uid && active.peer.roleLabel !== 'Admin' ? <Link to={providerPath(active.peer)}>{active.peer.name}</Link> : active?.peer.name || 'Bisedë'}</strong>
                    <span className={peerTyping ? 'is-typing' : undefined}>
                      {peerTyping && !messagingDisabled
                        ? 'Po shkruan...'
                        : (active?.peer.uid && socket.connected ? presenceLabel(presence.get(active.peer.uid)) : '') || (active?.serviceTitle
                          ? `Për: ${active.serviceTitle}`
                          : active?.peer.roleLabel || 'Chat')}
                    </span>
                  </div>
                  <div className="msg-call-actions" role="toolbar" aria-label="Thirrje">
                    <Button
                      isIconOnly
                      variant="ghost"
                      className="msg-call-btn"
                      aria-label="Nis video thirrje"
                      isDisabled={messagingDisabled || callStage !== 'idle' || !active?.peer.uid || active.peer.uid === user?.uid}
                      onPress={() => {
                        if (active?.peer.uid && activeId) {
                          void initiateCall({
                            conversationId: activeId,
                            receiverUid: active.peer.uid,
                            peerName: active.peer.name,
                            peerPhoto: active.peer.profilePhoto,
                            callType: 'video',
                          })
                        }
                      }}
                    >
                      <Video size={19} />
                    </Button>
                    <Button
                      isIconOnly
                      variant="ghost"
                      className="msg-call-btn"
                      aria-label="Nis thirrje zanore"
                      isDisabled={messagingDisabled || callStage !== 'idle' || !active?.peer.uid || active.peer.uid === user?.uid}
                      onPress={() => {
                        if (active?.peer.uid && activeId) {
                          void initiateCall({
                            conversationId: activeId,
                            receiverUid: active.peer.uid,
                            peerName: active.peer.name,
                            peerPhoto: active.peer.profilePhoto,
                            callType: 'audio',
                          })
                        }
                      }}
                    >
                      <Phone size={18} />
                    </Button>
                  </div>
                  <ConversationActions
                    conversationId={activeId}
                    onAvailability={socket.onAvailability}
                    onDetails={setChatDetails}
                    onDeleteConversation={() => {
                      if (active) setDeleteChatTarget(active)
                    }}
                  />
                </header>
                {currentDetails?.requestContext && <div className="msg-request-context">
                  <div><span>{t('req.serviceRequest')}</span><strong>{currentDetails.requestContext.title}</strong><span>{t('req.statusLine')}: {t(REQUEST_STATUS[currentDetails.requestContext.status as keyof typeof REQUEST_STATUS]?.label || (currentDetails.requestContext.status === 'cancelled' ? 'status.cancelled' : currentDetails.requestContext.status))}</span></div>
                  <Link to={`${getDashboardPath(user?.role || 'user')}/${user?.role === 'provider' || user?.role === 'company' ? active?.seekerUid === user?.uid ? 'my-requests' : 'inbox' : 'requests'}`} className="uo-link">Shiko kërkesën</Link>
                </div>}
                {currentDetails?.messagingBlocked && <p className="msg-blocked-note" role="status">{currentDetails.blockedByMe ? 'E ke bllokuar këtë përdorues. Zhbllokoje nga menuja për të dërguar mesazhe.' : 'Mesazhet nuk janë të disponueshme për këtë bisedë.'}</p>}
              </div>

              <div className="msg-history" ref={historyRef}
                onWheel={() => { smoothFollowRef.current = false }}
                onTouchStart={() => { smoothFollowRef.current = false }}
                onPointerDown={() => { smoothFollowRef.current = false }}
                onKeyDown={() => { smoothFollowRef.current = false }}
                onScroll={event => {
                  const history = event.currentTarget
                  const nearBottom = nearHistoryBottom(history.scrollTop, history.scrollHeight, history.clientHeight)
                  followBottomRef.current = smoothFollowRef.current || nearBottom
                  if (nearBottom) smoothFollowRef.current = false
                  const cached = threadsRef.current.get(activeId)
                  if (cached) cached.scrollTop = history.scrollTop
                }}>
                {!loadingThread && messages.length > 0 && hasOlderMessages ? <Button size="sm" variant="outline" isPending={loadingHistory} onPress={() => {
                  setLoadingHistory(true)
                  const conversationId = activeId
                  fetchMessages(conversationId, { before: messages[0].createdAt, limit: 50 }).then((older) => {
                    if (activeIdRef.current !== conversationId) return
                    setHasOlderMessages(older.pagination.total > older.length)
                    const history = historyRef.current
                    if (history) prependAnchorRef.current = { top: history.scrollTop, height: history.scrollHeight }
                    const cached = threadsRef.current.get(conversationId)
                    if (cached) cached.hasOlder = older.pagination.total > older.length
                    saveMessages(conversationId, older)
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
                    const editing = editingId === m.id && !m.deleted
                    const canEdit = mine && !m.deleted && !messagingDisabled
                    const canDelete = mine && !m.deleted
                    const day = dayKey(m.createdAt)
                    const showDay = index === 0 || day !== dayKey(messages[index - 1].createdAt)
                    return (
                      <Fragment key={m.id}>
                        {showDay && day ? (
                          <div className="msg-day" role="separator">
                            <span>{formatDay(m.createdAt)}</span>
                          </div>
                        ) : null}
                        <div className={`msg-bubble-row${mine ? ' is-mine' : ''}`}>
                          {(canEdit || canDelete) && !editing ? (
                            <div className="msg-bubble-actions" role="toolbar" aria-label="Veprimet e mesazhit">
                              {canEdit ? (
                                <button
                                  type="button"
                                  className="msg-action"
                                  aria-label="Ndrysho mesazhin"
                                  title="Ndrysho mesazhin"
                                  onClick={() => startEdit(m)}
                                >
                                  <Pencil size={14} />
                                </button>
                              ) : null}
                              <button
                                type="button"
                                className="msg-action is-danger"
                                aria-label="Fshi mesazhin"
                                title="Fshi mesazhin"
                                onClick={() => setDeleteTarget(m)}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          ) : null}
                          <div className={`msg-bubble${mine ? ' is-mine' : ''}${m.deleted ? ' is-deleted' : ''}${editing ? ' is-editing' : ''}`}>
                            {m.deleted ? (
                              <div className="msg-deleted-content">
                                <Trash2 size={13} className="msg-deleted-icon" />
                                <p className="msg-deleted-text">{mine ? 'E keni fshirë këtë mesazh' : 'Ky mesazh u fshi'}</p>
                              </div>
                            ) : editing ? (
                              <form
                                className="msg-edit"
                                onSubmit={(event) => { event.preventDefault(); void saveEdit(m) }}
                              >
                                <div className="msg-edit-header">
                                  <Pencil size={13} className="msg-edit-icon" />
                                  <span>Ndrysho mesazhin</span>
                                </div>
                                <textarea
                                  className="msg-edit-input"
                                  value={editDraft}
                                  placeholder="Shkruaj mesazhin e përditësuar..."
                                  onChange={(event) => setEditDraft(event.target.value)}
                                  onKeyDown={(event) => {
                                    if (event.key === 'Escape') { event.preventDefault(); cancelEdit() }
                                    if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void saveEdit(m) }
                                  }}
                                  maxLength={4000}
                                  rows={Math.min(8, Math.max(2, editDraft.split('\n').length))}
                                  aria-label="Ndrysho mesazhin"
                                  disabled={savingEdit}
                                  autoFocus
                                  onFocus={(event) => { const end = event.currentTarget.value.length; event.currentTarget.setSelectionRange(end, end) }}
                                />
                                <div className="msg-edit-actions">
                                  <span className="msg-edit-hint">Enter për ruajtje · Shift+Enter për rresht të ri · Esc për anulim</span>
                                  <div className="msg-edit-buttons">
                                    <Button size="sm" variant="outline" isDisabled={savingEdit} onPress={cancelEdit}>
                                      Anulo
                                    </Button>
                                    <Button size="sm" variant="primary" type="submit" isPending={savingEdit} isDisabled={savingEdit || !editDraft.trim()}>
                                      <Check size={14} />
                                      Ruaj
                                    </Button>
                                  </div>
                                </div>
                              </form>
                            ) : (
                              <p>{m.body}</p>
                            )}
                            <span className="msg-meta">
                              {m.editedAt && !m.deleted && !editing ? <span className="msg-edited">ndryshuar</span> : null}
                              <time dateTime={m.createdAt}>{formatClock(m.createdAt)}</time>
                            </span>
                          </div>
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

              </div>

              <form className="msg-composer" onSubmit={onSend}>
                <Input
                  ref={inputRef}
                  value={draft}
                  onChange={(e) => onDraftChange(e.target.value)}
                  placeholder={`Shkruaj mesazh për ${active?.peer.name || 'ta'}...`}
                  aria-label="Mesazhi"
                  maxLength={4000}
                  disabled={sending || messagingDisabled}
                  fullWidth
                  className="msg-input"
                />
                <Button
                  type="submit"
                  variant="primary"
                  isIconOnly
                  className="msg-send"
                  isDisabled={sending || messagingDisabled || !draft.trim()}
                  aria-label="Dërgo"
                >
                  <Send size={18} />
                </Button>
              </form>
            </>
          )}
        </section>
      </Card>
      <ConfirmActionDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void confirmDelete()}
        title="Fshi mesazhin?"
        confirmLabel="Fshi mesazhin"
        pending={deleting}
      >
        <div className="msg-delete-dialog-content">
          <p className="msg-delete-desc">
            Mesazhi do të fshihet për të dy palët. Ky veprim nuk mund të kthehet mbrapsht.
          </p>
          {deleteTarget && (
            <div className="msg-delete-quote">
              <span className="msg-delete-quote-label">Mesazhi që do të fshihet:</span>
              <p className="msg-delete-quote-body">
                "{deleteTarget.body.length > 200 ? `${deleteTarget.body.slice(0, 200)}...` : deleteTarget.body}"
              </p>
            </div>
          )}
        </div>
      </ConfirmActionDialog>

      <ConfirmActionDialog
        isOpen={Boolean(deleteChatTarget)}
        onClose={() => setDeleteChatTarget(null)}
        onConfirm={() => void confirmDeleteChat()}
        title={`Fshi bisedën me ${deleteChatTarget?.peer?.name || 'këtë përdorues'}?`}
        confirmLabel="Fshi bisedën"
        pending={deletingChat}
      >
        <div className="msg-delete-dialog-content">
          <p className="msg-delete-desc">
            A jeni të sigurt që dëshironi të fshini këtë bisedë? Të gjitha mesazhet në këtë bisedë do të fshihen përgjithmonë. Ky veprim nuk mund të kthehet mbrapsht.
          </p>
        </div>
      </ConfirmActionDialog>
    </div>
  )
}
