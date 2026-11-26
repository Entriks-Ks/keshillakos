import { mergeMessages, replaceMessage, updateConversationPreview, mergeConversationSnapshots, updateConversation, updateConversationList, removeConversationFromList, nearHistoryBottom, prependedScrollTop, type ConversationUpdate } from '../chat/chatState'
import { useNotifications } from '../notifications/NotificationProvider'
import KeshillaPagination from '../components/KeshillaPagination'
import { usePagination } from '../hooks/usePagination'
import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { dateLocale } from '../i18n'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowDown, ArrowLeft, Check, MessageCircle, Phone, ShieldAlert, Trash2, Video } from 'lucide-react'
import { useCall } from '../calls/CallContext'
import {
  Alert,
  Button,
  buttonVariants,
  Card,
  SearchField,
  Separator,
  Skeleton,
  Spinner,
  toast,
  Tooltip,
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
import MessageBubble from '../chat/MessageBubble'
import MessageComposer from '../chat/MessageComposer'
import { routePath } from '../routes/routeMap'

/** Backend placeholder stored as the conversation preview after the latest message is deleted. */
const DELETED_MESSAGE_PREVIEW = 'Mesazhi u fshi'

function sameDate(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function dayKey(iso: string) {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

function formatDay(iso: string, t: TFunction) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const now = new Date()
  if (sameDate(d, now)) return t('home.today')
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (sameDate(d, yesterday)) return t('inbox.yesterday')
  return d.toLocaleDateString(dateLocale(), {
    day: 'numeric',
    month: 'long',
    year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric',
  })
}

function formatListTime(iso: string | undefined, t: TFunction) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const now = new Date()
  if (sameDate(d, now)) {
    return d.toLocaleTimeString(dateLocale(), { hour: '2-digit', minute: '2-digit' })
  }
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (sameDate(d, yesterday)) return t('inbox.yesterday')
  return d.toLocaleDateString(dateLocale(), { day: '2-digit', month: 'short' })
}

/** Messages from the same sender within this window are visually grouped. */
const GROUP_WINDOW_MS = 5 * 60 * 1000

type OutboxItem = { tempId: string; conversationId: string; body: string; createdAt: string; status: 'sending' | 'failed' }

function isCallMessage(message: ChatMessage) {
  return !message.deleted && (message.body.startsWith('📹') || message.body.startsWith('📞') || message.body.toLowerCase().includes('thirrj'))
}

/** Call summaries are stored by the backend in Albanian; map the known shapes to the UI language. */
function callTitle(body: string, mine: boolean, t: TFunction) {
  if (body.includes('humbur')) return mine ? t('inbox.missedOutgoing') : t('inbox.missedIncoming')
  const ended = body.match(/përfundoi \(([^)]+)\)/)
  if (ended) return t('inbox.callEnded', { duration: ended[1] })
  if (body.includes('refuzuar')) return t('inbox.callDeclined')
  if (body.includes('zënë')) return t('inbox.callBusy')
  return body.replace(/^[📹📞]\s*/u, '')
}

function HeadAction({ label, isDisabled, onPress, children }: { label: string; isDisabled?: boolean; onPress: () => void; children: ReactNode }) {
  return (
    <Tooltip delay={400} closeDelay={0}>
      <Button isIconOnly variant="ghost" className="msg-head-btn" aria-label={label} isDisabled={isDisabled} onPress={onPress}>
        {children}
      </Button>
      <Tooltip.Content placement="bottom">{label}</Tooltip.Content>
    </Tooltip>
  )
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
  const [outbox, setOutbox] = useState<OutboxItem[]>([])
  const [away, setAway] = useState<{ conversationId: string; anchorId: string | null } | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const renderedRef = useRef<{ conversationId: string; lastId: string | null }>({ conversationId: '', lastId: null })
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
  const inputRef = useRef<HTMLTextAreaElement | null>(null)
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
      toast.success(t('inbox.editSuccess'))
      cancelEdit()
    } catch (err) {
      toast.danger(getErrorMessage(err) || t('inbox.editError'))
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
      handleMessageUpdated(updated, isLatest ? DELETED_MESSAGE_PREVIEW : undefined)
      toast.success(t('inbox.deleteSuccess'))
      setDeleteTarget(null)
    } catch (err) {
      toast.danger(getErrorMessage(err) || t('inbox.deleteError'))
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
      toast.success(t('inbox.chatDeleteSuccess'))
      setDeleteChatTarget(null)
    } catch (err) {
      toast.danger(getErrorMessage(err) || t('inbox.chatDeleteError'))
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
      toast.info(t('inbox.chatDeletedRemote'))
    }
  }), [socket.onConversationDeleted, setSearchParams, t])

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
    // Messages that arrive while the thread is open get a short entrance; history loads do not.
    const lastId = messages[messages.length - 1]?.id ?? null
    const seen = renderedRef.current
    if (seen.conversationId === activeId && seen.lastId && lastId && lastId !== seen.lastId) {
      const from = messages.findIndex(message => message.id === seen.lastId)
      if (from >= 0) {
        for (const message of messages.slice(from + 1)) {
          if (message.senderUid !== user?.uid) history.querySelector(`[data-mid="${CSS.escape(message.id)}"]`)?.classList.add('is-new')
        }
      }
    }
    renderedRef.current = { conversationId: activeId, lastId }
  }, [activeId, messages, peerTyping, loadingThread, outbox, user?.uid])

  // Focus the composer on thread open, but don't pop the on-screen keyboard on touch devices.
  useEffect(() => {
    if (activeId && window.matchMedia('(pointer: fine)').matches) inputRef.current?.focus()
  }, [activeId])

  // Mobile browsers shrink the visual viewport for the keyboard; size the page to it so the composer stays visible.
  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) return
    const root = document.documentElement
    const sync = () => root.style.setProperty('--msg-viewport-h', `${Math.round(viewport.height)}px`)
    sync()
    viewport.addEventListener('resize', sync)
    return () => {
      viewport.removeEventListener('resize', sync)
      root.style.removeProperty('--msg-viewport-h')
    }
  }, [])

  function selectConversation(id: string) {
    setSearchParams(id ? { c: id } : {})
  }

  async function deliver(item: OutboxItem) {
    setSending(true)
    socket.emitTyping(item.conversationId, false)
    const result = await socket.sendMessage(item.conversationId, item.body)
    if (!result.ok || !result.message) {
      setOutbox(items => items.map(entry => entry.tempId === item.tempId ? { ...entry, status: 'failed' } : entry))
      toast.danger(result.error ? getErrorMessage(new Error(result.error)) : t('inbox.sendError'))
    } else {
      const sent = result.message
      saveMessages(sent.conversationId, [sent])
      setOutbox(items => items.filter(entry => entry.tempId !== item.tempId))
      applyUpdate({ conversationId: sent.conversationId, senderUid: sent.senderUid, lastMessageAt: sent.createdAt, lastMessagePreview: sent.body.slice(0, 140) })
    }
    setSending(false)
  }

  /** Sends optimistically: the bubble shows at once and resolves to sent or failed. */
  function onSend() {
    if (!activeId || !draft.trim() || sending || messagingDisabled) return
    const item: OutboxItem = {
      tempId: `pending-${crypto.randomUUID()}`,
      conversationId: activeId,
      body: draft.trim(),
      createdAt: new Date().toISOString(),
      status: 'sending',
    }
    setError('')
    setDraft('')
    setAway(null)
    followBottomRef.current = true
    setOutbox(items => [...items, item])
    void deliver(item)
  }

  function retrySend(item: OutboxItem) {
    if (sending || messagingDisabled) return
    followBottomRef.current = true
    setOutbox(items => items.map(entry => entry.tempId === item.tempId ? { ...entry, status: 'sending' } : entry))
    void deliver({ ...item, status: 'sending' })
  }

  function discardSend(item: OutboxItem) {
    setOutbox(items => items.filter(entry => entry.tempId !== item.tempId))
  }

  function loadOlder() {
    if (loadingHistory || !activeId || messages.length === 0) return
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
  }

  /** ArrowUp in an empty composer edits your latest message. */
  function editLastMessage() {
    if (messagingDisabled) return false
    const last = [...messages].reverse().find(message => message.senderUid === user?.uid && !message.deleted && !isCallMessage(message))
    if (!last) return false
    startEdit(last)
    return true
  }

  function copyMessage(body: string) {
    void navigator.clipboard.writeText(body)
      .then(() => toast.success(t('inbox.copied')))
      .catch(() => toast.danger(t('inbox.copyError')))
  }

  function jumpToLatest() {
    const history = historyRef.current
    if (!history) return
    followBottomRef.current = true
    smoothFollowRef.current = true
    setAway(null)
    history.scrollTo({ top: history.scrollHeight, behavior: 'smooth' })
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

  const myUid = user?.uid
  const activeOutbox = outbox.filter(item => item.conversationId === activeId && !(item.status === 'sending' && messages.slice(-20).some(message =>
    message.senderUid === myUid && message.body === item.body && Date.parse(message.createdAt) >= Date.parse(item.createdAt) - 30_000)))
  const isAway = away?.conversationId === activeId
  const anchorIndex = isAway && away?.anchorId ? messages.findIndex(message => message.id === away.anchorId) : -1
  const unseenCount = anchorIndex >= 0 ? messages.slice(anchorIndex + 1).filter(message => message.senderUid !== myUid).length : 0
  const peerOnline = Boolean(active?.peer.uid && socket.connected && presence.get(active.peer.uid)?.online)
  const peerAvatar = <ProfileAvatar src={active?.peer.profilePhoto} seed={active?.peer.uid} alt="" size={28} />
  const callsDisabled = messagingDisabled || callStage !== 'idle' || !active?.peer.uid || active.peer.uid === user?.uid
  const lastMessage = messages[messages.length - 1]
  const outboxJoinsLast = Boolean(lastMessage && lastMessage.senderUid === myUid && !isCallMessage(lastMessage) && activeOutbox[0]
    && dayKey(lastMessage.createdAt) === dayKey(activeOutbox[0].createdAt)
    && Date.parse(activeOutbox[0].createdAt) - Date.parse(lastMessage.createdAt) < GROUP_WINDOW_MS)

  function startCall(callType: 'video' | 'audio') {
    if (!active?.peer.uid || !activeId) return
    void initiateCall({ conversationId: activeId, receiverUid: active.peer.uid, peerName: active.peer.name, peerPhoto: active.peer.profilePhoto, callType })
  }

  const listSummary = totalUnread > 0
    ? t('inbox.unreadSummary', { count: totalUnread })
    : t('inbox.conversationCount', { count: conversations.length })

  return (
    <div className={`msg-page${activeId ? ' has-active' : ''}`}>
      <Card className="msg-shell">
        <aside className="msg-list" aria-label={t('inbox.listLabel')}>
          <div className="msg-list-head">
            <div className="msg-list-title">
              <h1>{t('dash.messages')}</h1>
              {!loadingList ? <span>{listSummary}</span> : null}
            </div>
            <span
              className={`msg-conn${socket.connected ? ' is-online' : ''}`}
              role="status"
              title={socket.connected ? t('inbox.connected') : t('inbox.connecting')}
            >
            </span>
          </div>

          <div className="msg-list-search">
            <SearchField aria-label={t('inbox.search')} value={listQuery} onChange={setListQuery} fullWidth>
              <SearchField.Group>
                <SearchField.SearchIcon />
                <SearchField.Input placeholder={t('inbox.searchPlaceholder')} />
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
                <strong>{t('inbox.emptyTitle')}</strong>
                <p>{t('inbox.emptyText')}</p>
                <Link to={routePath('services')} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                  {t('home.seeOffers')}
                </Link>
              </div>
            ) : filteredConversations.length === 0 ? (
              <p className="msg-list-note">{t('inbox.noResults', { query: listQuery })}</p>
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
                            {c.lastMessageAt ? <time dateTime={c.lastMessageAt}>{formatListTime(c.lastMessageAt, t)}</time> : null}
                          </span>
                          <span className="msg-item-context">{c.serviceTitle || c.peer.roleLabel || t('inbox.conversation')}</span>
                          <span className="msg-item-preview-row">
                            <span className="msg-item-preview">{c.lastMessagePreview === DELETED_MESSAGE_PREVIEW ? t('inbox.deletedPreview') : c.lastMessagePreview || t('inbox.startConversation')}</span>
                            {c.unread > 0 && (
                              <span
                                className={`msg-item-unread${c.unread > 1 ? ' is-count' : ''}`}
                                aria-label={t('inbox.unreadMessages', { count: c.unread })}
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
                        aria-label={t('inbox.deleteChatWith', { name: c.peer.name })}
                        title={t('inbox.deleteChat')}
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

        <section className="msg-thread" aria-label={active ? t('inbox.threadWith', { name: active.peer.name }) : t('inbox.thread')}>
          {!activeId ? (
            <div className="msg-thread-placeholder">
              <span className="msg-empty-icon is-lg" aria-hidden>
                <MessageCircle size={26} />
              </span>
              {!loadingList && conversations.length === 0 ? (
                <>
                  <h2>{t('inbox.placeholderEmptyTitle')}</h2>
                  <p>{t('inbox.placeholderEmptyText')}</p>
                </>
              ) : (
                <>
                  <h2>{t('inbox.selectTitle')}</h2>
                  <p>{t('inbox.selectText')}</p>
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
                    aria-label={t('inbox.back')}
                    onPress={() => selectConversation('')}
                  >
                    <ArrowLeft size={20} />
                  </Button>
                  <span className="msg-head-avatar">
                    <ProfileAvatar src={active?.peer.profilePhoto} seed={active?.peer.uid} alt="" size={42} />
                    {peerOnline ? <span className="msg-presence-dot" aria-hidden /> : null}
                  </span>
                  <div className="msg-thread-meta">
                    <strong className="msg-thread-name">
                      {active?.peer.uid && active.peer.roleLabel !== 'Admin' ? <Link to={providerPath(active.peer)}>{active.peer.name}</Link> : active?.peer.name || t('inbox.conversation')}
                    </strong>
                    {peerTyping && !messagingDisabled ? (
                      <span className="msg-thread-status is-typing">
                        {t('inbox.typing')}
                        <span className="msg-typing-dots" aria-hidden><i /><i /><i /></span>
                      </span>
                    ) : (
                      <span className={`msg-thread-status${peerOnline ? ' is-online' : ''}`}>
                        {(active?.peer.uid && socket.connected ? presenceLabel(presence.get(active.peer.uid), t, dateLocale()) : '') || (active?.serviceTitle
                          ? t('inbox.regarding', { title: active.serviceTitle })
                          : active?.peer.roleLabel || t('dash.chat'))}
                      </span>
                    )}
                  </div>
                  <div className="msg-head-actions" role="toolbar" aria-label={t('inbox.calls')}>
                    <HeadAction label={t('inbox.startVideo')} isDisabled={callsDisabled} onPress={() => startCall('video')}>
                      <Video size={19} aria-hidden />
                    </HeadAction>
                    <HeadAction label={t('inbox.startAudio')} isDisabled={callsDisabled} onPress={() => startCall('audio')}>
                      <Phone size={18} aria-hidden />
                    </HeadAction>
                    <span className="msg-head-divider" aria-hidden />
                    <ConversationActions
                      conversationId={activeId}
                      onAvailability={socket.onAvailability}
                      onDetails={setChatDetails}
                      onDeleteConversation={() => {
                        if (active) setDeleteChatTarget(active)
                      }}
                    />
                  </div>
                </header>
                {currentDetails?.requestContext && <div className="msg-request-context">
                  <div><span>{t('req.serviceRequest')}</span><strong>{currentDetails.requestContext.title}</strong><span>{t('req.statusLine')}: {t(REQUEST_STATUS[currentDetails.requestContext.status as keyof typeof REQUEST_STATUS]?.label || (currentDetails.requestContext.status === 'cancelled' ? 'status.cancelled' : currentDetails.requestContext.status))}</span></div>
                  <Link to={`${getDashboardPath(user?.role || 'user')}/${user?.role === 'provider' || user?.role === 'company' ? active?.seekerUid === user?.uid ? 'my-requests' : 'inbox' : 'requests'}`} className="uo-link">{t('inbox.viewRequest')}</Link>
                </div>}
              </div>

              <div className="msg-history-wrap">
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
                    const nowAway = !nearBottom && !smoothFollowRef.current
                    if (nowAway !== isAway) setAway(nowAway ? { conversationId: activeId, anchorId: messages[messages.length - 1]?.id ?? null } : null)
                    if (history.scrollTop < 200 && hasOlderMessages && !loadingHistory && !loadingThread && history.scrollHeight > history.clientHeight) loadOlder()
                  }}>
                  <div className="msg-stream" key={activeId}>
                    {!loadingThread && messages.length > 0 && hasOlderMessages ? (
                      <div className="msg-older">
                        {loadingHistory ? (
                          <span className="msg-older-loading" role="status"><Spinner size="sm" color="current" />{t('inbox.loadingOlder')}</span>
                        ) : (
                          <Button size="sm" variant="ghost" className="msg-older-btn" onPress={loadOlder}>{t('inbox.loadOlder')}</Button>
                        )}
                      </div>
                    ) : null}

                    {!loadingThread && messages.length > 0 && !hasOlderMessages ? (
                      <div className="msg-intro">
                        <ProfileAvatar src={active?.peer.profilePhoto} seed={active?.peer.uid} alt="" size={56} />
                        <strong>{active?.peer.name}</strong>
                        {active?.serviceTitle ? <span>{t('inbox.regarding', { title: active.serviceTitle })}</span> : active?.peer.roleLabel ? <span>{active.peer.roleLabel}</span> : null}
                        <small>{t('inbox.conversationStart')}</small>
                      </div>
                    ) : null}

                    {loadingThread ? (
                      <div className="msg-history-loading" role="status" aria-label={t('inbox.loadingMessages')}>
                        <Skeleton className="msg-skel-bubble" />
                        <Skeleton className="msg-skel-bubble is-tall" />
                        <Skeleton className="msg-skel-bubble is-mine" />
                        <Skeleton className="msg-skel-bubble is-mine is-short" />
                        <Skeleton className="msg-skel-bubble is-short" />
                      </div>
                    ) : messages.length === 0 && activeOutbox.length === 0 ? (
                      <div className="msg-empty">
                        <span className="msg-head-avatar is-lg">
                          <ProfileAvatar src={active?.peer.profilePhoto} seed={active?.peer.uid} alt="" size={72} />
                          {peerOnline ? <span className="msg-presence-dot" aria-hidden /> : null}
                        </span>
                        <h3>
                          <Trans i18nKey="inbox.startWith" values={{ name: active?.peer.name ?? '' }} components={{ strong: <strong /> }} />
                        </h3>
                        {!messagingDisabled ? (
                          <>
                            <p>{t('inbox.emptyHint')}</p>
                            <div className="msg-starters">
                              {(['greeting', 'thanks', 'time'] as const).map(key => (
                                <Button
                                  key={key}
                                  size="sm"
                                  variant="outline"
                                  className="msg-starter"
                                  onPress={() => {
                                    setDraft(t(`inbox.starters.${key}`))
                                    inputRef.current?.focus()
                                  }}
                                >
                                  {t(`inbox.starters.${key}`)}
                                </Button>
                              ))}
                            </div>
                          </>
                        ) : null}
                      </div>
                    ) : (
                      messages.map((m, index) => {
                        const mine = m.senderUid === myUid
                        const previous = messages[index - 1]
                        const next = messages[index + 1]
                        const day = dayKey(m.createdAt)
                        const showDay = index === 0 || day !== dayKey(previous.createdAt)
                        const isCall = isCallMessage(m)
                        const joins = (a?: ChatMessage, b?: ChatMessage) => Boolean(a && b && a.senderUid === b.senderUid
                          && dayKey(a.createdAt) === dayKey(b.createdAt) && !isCallMessage(a) && !isCallMessage(b)
                          && Math.abs(Date.parse(b.createdAt) - Date.parse(a.createdAt)) < GROUP_WINDOW_MS)
                        const editing = editingId === m.id && !m.deleted
                        return (
                          <Fragment key={m.id}>
                            {showDay && day ? (
                              <div className="msg-day" role="separator">
                                <span>{formatDay(m.createdAt, t)}</span>
                              </div>
                            ) : null}
                            <MessageBubble
                              id={m.id}
                              body={m.body}
                              createdAt={m.createdAt}
                              mine={mine}
                              deleted={m.deleted}
                              edited={Boolean(m.editedAt)}
                              groupStart={showDay || !joins(previous, m)}
                              groupEnd={next ? !joins(m, next) : !(mine && outboxJoinsLast)}
                              avatar={peerAvatar}
                              call={isCall ? {
                                title: callTitle(m.body, mine, t),
                                missed: m.body.includes('humbur'),
                                video: m.body.startsWith('📹') || m.body.toLowerCase().includes('video'),
                              } : null}
                              selected={selectedId === m.id}
                              onSelect={() => setSelectedId(current => current === m.id ? null : m.id)}
                              onCopy={!m.deleted && !isCall ? () => copyMessage(m.body) : undefined}
                              canEdit={mine && !m.deleted && !messagingDisabled && !isCall}
                              canDelete={mine && !m.deleted}
                              onEdit={() => startEdit(m)}
                              onDelete={() => setDeleteTarget(m)}
                              editor={editing ? (
                                <form
                                  className="msg-edit"
                                  onSubmit={(event) => { event.preventDefault(); void saveEdit(m) }}
                                >
                                  <span className="msg-edit-header">{t('inbox.editMessage')}</span>
                                  <textarea
                                    className="msg-edit-input"
                                    value={editDraft}
                                    placeholder={t('inbox.editPlaceholder')}
                                    onChange={(event) => setEditDraft(event.target.value)}
                                    onKeyDown={(event) => {
                                      if (event.key === 'Escape') { event.preventDefault(); cancelEdit() }
                                      if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void saveEdit(m) }
                                    }}
                                    maxLength={4000}
                                    rows={Math.min(8, Math.max(2, editDraft.split('\n').length))}
                                    aria-label={t('inbox.editMessage')}
                                    disabled={savingEdit}
                                    autoFocus
                                    onFocus={(event) => { const end = event.currentTarget.value.length; event.currentTarget.setSelectionRange(end, end) }}
                                  />
                                  <div className="msg-edit-actions">
                                    <span className="msg-edit-hint">{t('inbox.editHint')}</span>
                                    <div className="msg-edit-buttons">
                                      <Button size="sm" variant="ghost" isDisabled={savingEdit} onPress={cancelEdit}>
                                        {t('notifications.cancel')}
                                      </Button>
                                      <Button size="sm" variant="primary" type="submit" isPending={savingEdit} isDisabled={savingEdit || !editDraft.trim()}>
                                        <Check size={14} aria-hidden />
                                        {t('inbox.save')}
                                      </Button>
                                    </div>
                                  </div>
                                </form>
                              ) : undefined}
                            />
                          </Fragment>
                        )
                      })
                    )}

                    {!loadingThread ? activeOutbox.map((item, index) => (
                      <MessageBubble
                        key={item.tempId}
                        id={item.tempId}
                        body={item.body}
                        createdAt={item.createdAt}
                        mine
                        groupStart={index === 0 ? !outboxJoinsLast : false}
                        groupEnd={index === activeOutbox.length - 1}
                        delivery={item.status}
                        onRetry={item.status === 'failed' && !sending ? () => retrySend(item) : undefined}
                        onDiscard={item.status === 'failed' ? () => discardSend(item) : undefined}
                      />
                    )) : null}

                    {peerTyping && !messagingDisabled ? (
                      <div className="msg-row is-peer is-group-start is-group-end msg-typing-row" aria-live="polite">
                        <div className="msg-row-avatar" aria-hidden>{peerAvatar}</div>
                        <div className="msg-typing" role="status" aria-label={t('inbox.typing')}>
                          <span />
                          <span />
                          <span />
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>

                {isAway && !loadingThread ? (
                  <Button
                    variant="secondary"
                    className={`msg-jump${unseenCount > 0 ? ' has-unseen' : ''}`}
                    aria-label={unseenCount > 0 ? t('inbox.newMessages', { count: unseenCount }) : t('inbox.jumpToLatest')}
                    onPress={jumpToLatest}
                  >
                    {unseenCount > 0 ? <span className="msg-jump-count">{t('inbox.newMessages', { count: unseenCount })}</span> : null}
                    <ArrowDown size={18} aria-hidden />
                  </Button>
                ) : null}
              </div>

              {messagingDisabled ? (
                <div className="msg-composer-blocked" role="status">
                  <ShieldAlert size={16} aria-hidden />
                  <span>{currentDetails?.blockedByMe ? t('inbox.blockedByMe') : t('inbox.blocked')}</span>
                </div>
              ) : (
                <MessageComposer
                  value={draft}
                  onChange={onDraftChange}
                  onSubmit={onSend}
                  onEditLast={editLastMessage}
                  sending={sending}
                  disabled={messagingDisabled}
                  placeholder={active?.peer.name ? t('inbox.composerPlaceholder', { name: active.peer.name }) : t('inbox.composerPlaceholderAnon')}
                  inputRef={inputRef}
                />
              )}
            </>
          )}
        </section>
      </Card>
      <ConfirmActionDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void confirmDelete()}
        title={t('inbox.deleteMessageTitle')}
        confirmLabel={t('inbox.deleteMessage')}
        pending={deleting}
      >
        <div className="msg-delete-dialog-content">
          <p className="msg-delete-desc">
            {t('inbox.deleteMessageDesc')}
          </p>
          {deleteTarget && (
            <div className="msg-delete-quote">
              <span className="msg-delete-quote-label">{t('inbox.deleteMessageQuote')}</span>
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
        title={deleteChatTarget?.peer?.name ? t('inbox.deleteChatTitle', { name: deleteChatTarget.peer.name }) : t('inbox.deleteChatTitleAnon')}
        confirmLabel={t('inbox.deleteChat')}
        pending={deletingChat}
      >
        <div className="msg-delete-dialog-content">
          <p className="msg-delete-desc">
            {t('inbox.deleteChatDesc')}
          </p>
        </div>
      </ConfirmActionDialog>
    </div>
  )
}
