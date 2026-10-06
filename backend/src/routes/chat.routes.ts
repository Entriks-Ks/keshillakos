import { chatUnreadCount } from '../services/chatUnreadService'
import { paginationInput, validatePagination } from '../services/pagination'
import { Router } from 'express'
import { requireAuth, requireRole } from '../middleware/auth'
import {
  assertParticipant,
  getConversationForUser,
  listConversationsForUser,
  listMessages,
  markConversationRead,
  openOrGetConversation,
  sendMessage,
} from '../services/chatService'
import { chatAvailability, reportChatUser, setChatBlock } from '../services/chatSafetyService'
import { chatRequestContext } from '../services/chatContextService'

const router = Router()
router.use(validatePagination)

function paramId(value: string | string[]): string {
  return Array.isArray(value) ? value[0] : value
}

function statusOf(err: unknown) {
  if (err && typeof err === 'object' && 'status' in err && typeof (err as { status: unknown }).status === 'number') {
    return (err as { status: number }).status
  }
  return 400
}

router.get('/unread-count', requireAuth, async (req, res) => {
  try { res.setHeader('Cache-Control', 'private, no-store'); return res.json({ unreadCount: await chatUnreadCount(req.user!.uid) }) }
  catch (error) { return res.status(500).json({ message: 'Nuk u ngarkuan mesazhet e palexuara' }) }
})

router.get('/conversations', requireAuth, async (req, res) => {
  try {
    const conversations = await listConversationsForUser(req.user!.uid, paginationInput(req.query, 20), typeof req.query.q === "string" ? req.query.q : "")
    return res.json({ conversations, pagination: conversations.pagination, summary: conversations.summary })
  } catch (err) {
    return res.status(500).json({
      message: err instanceof Error ? err.message : 'Nuk u ngarkuan bisedat',
    })
  }
})

router.post(
  '/conversations',
  requireAuth,
  requireRole('user', 'provider', 'company', 'admin'),
  async (req, res) => {
    try {
      const { providerUid, seekerUid, serviceId, serviceTitle, initialMessage } = req.body as {
        providerUid?: string
        seekerUid?: string
        serviceId?: string
        serviceTitle?: string
        initialMessage?: string
      }

      const roles = req.user!.roles
      if (seekerUid !== undefined && typeof seekerUid !== 'string') return res.status(400).json({ message: 'Përdoruesi është i pavlefshëm' })
      if (providerUid !== undefined && typeof providerUid !== 'string') return res.status(400).json({ message: 'Ofruesi është i pavlefshëm' })
      if (initialMessage !== undefined && typeof initialMessage !== 'string') return res.status(400).json({ message: 'Mesazhi është i pavlefshëm' })
      const asProvider = roles.some((role) => role === 'provider' || role === 'company') && Boolean(seekerUid?.trim())
      const resolvedSeekerUid = asProvider ? seekerUid!.trim() : req.user!.uid
      const resolvedProviderUid = asProvider ? req.user!.uid : providerUid || ''

      const result = await openOrGetConversation({
        seekerUid: resolvedSeekerUid,
        providerUid: resolvedProviderUid,
        serviceId,
        serviceTitle,
        initialMessage,
        senderUid: req.user!.uid,
      })

      return res.status(201).json(result)
    } catch (err) {
      return res.status(statusOf(err)).json({
        message: err instanceof Error ? err.message : 'Nuk u hap biseda',
      })
    }
  },
)

router.get('/conversations/:id/details', requireAuth, async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'private, no-store')
    const conversation = await assertParticipant(paramId(req.params.id), req.user!.uid)
    const peerUid = req.user!.uid === conversation.seekerUid ? conversation.providerUid : conversation.seekerUid
    const [availability, requestContext] = await Promise.all([chatAvailability(req.user!.uid, peerUid), chatRequestContext(conversation)])
    return res.json({ ...availability, requestContext })
  } catch (error) { return res.status(statusOf(error)).json({ message: error instanceof Error ? error.message : 'Gabim' }) }
})

router.post('/conversations/:id/block', requireAuth, async (req, res) => {
  try {
    if (typeof req.body.blocked !== 'boolean') return res.status(400).json({ message: 'Zgjedhja është e pavlefshme' })
    const conversation = await assertParticipant(paramId(req.params.id), req.user!.uid)
    return res.json(await setChatBlock(conversation, req.user!.uid, req.body.blocked))
  } catch (error) { return res.status(statusOf(error)).json({ message: error instanceof Error ? error.message : 'Gabim' }) }
})

router.post('/conversations/:id/report', requireAuth, async (req, res) => {
  try {
    const conversation = await assertParticipant(paramId(req.params.id), req.user!.uid)
    await reportChatUser(conversation, req.user!.uid, req.body.reason)
    return res.status(201).json({ ok: true })
  } catch (error) { return res.status(statusOf(error)).json({ message: error instanceof Error ? error.message : 'Gabim' }) }
})

router.get('/conversations/:id', requireAuth, async (req, res) => {
  try {
    const conversation = await getConversationForUser(paramId(req.params.id), req.user!.uid)
    return res.json({ conversation })
  } catch (err) {
    return res.status(statusOf(err)).json({
      message: err instanceof Error ? err.message : 'Nuk u ngarkua biseda',
    })
  }
})

router.get('/conversations/:id/messages', requireAuth, async (req, res) => {
  try {
    const before = typeof req.query.before === 'string' ? req.query.before : undefined
    const { page, limit } = paginationInput(req.query, 50)
    const messages = await listMessages({
      conversationId: paramId(req.params.id),
      uid: req.user!.uid,
      before,
      page,
      limit,
    })
    return res.json({ messages, pagination: messages.pagination })
  } catch (err) {
    return res.status(statusOf(err)).json({
      message: err instanceof Error ? err.message : 'Nuk u ngarkuan mesazhet',
    })
  }
})

router.post('/conversations/:id/messages', requireAuth, async (req, res) => {
  try {
    const { body } = req.body as { body?: string }
    const message = await sendMessage({
      conversationId: paramId(req.params.id),
      senderUid: req.user!.uid,
      body: body || '',
    })
    return res.status(201).json({ message })
  } catch (err) {
    return res.status(statusOf(err)).json({
      message: err instanceof Error ? err.message : 'Mesazhi nuk u dërgua',
    })
  }
})

router.post('/conversations/:id/read', requireAuth, async (req, res) => {
  try {
    const conversation = await markConversationRead(paramId(req.params.id), req.user!.uid)
    return res.json({ conversation })
  } catch (err) {
    return res.status(statusOf(err)).json({
      message: err instanceof Error ? err.message : 'Nuk u shënua si i lexuar',
    })
  }
})

export default router
