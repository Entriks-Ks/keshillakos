import { Router } from 'express'
import { requireAuth, requireRole } from '../middleware/auth'
import {
  assertProviderCanMessageSeeker,
  getConversationForUser,
  listConversationsForUser,
  listMessages,
  markConversationRead,
  openOrGetConversation,
  sendMessage,
} from '../services/chatService'

const router = Router()

function paramId(value: string | string[]): string {
  return Array.isArray(value) ? value[0] : value
}

function statusOf(err: unknown) {
  if (err && typeof err === 'object' && 'status' in err && typeof (err as { status: unknown }).status === 'number') {
    return (err as { status: number }).status
  }
  return 400
}

router.get('/conversations', requireAuth, async (req, res) => {
  try {
    const conversations = await listConversationsForUser(req.user!.uid)
    return res.json({ conversations })
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
      const asProvider = roles.some((role) => role === 'provider' || role === 'company') && Boolean(seekerUid?.trim())
      const resolvedSeekerUid = asProvider ? seekerUid!.trim() : req.user!.uid
      const resolvedProviderUid = asProvider ? req.user!.uid : providerUid || ''

      if (asProvider) {
        await assertProviderCanMessageSeeker(resolvedProviderUid, resolvedSeekerUid)
      }

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
    const limit = req.query.limit ? Number(req.query.limit) : undefined
    const messages = await listMessages({
      conversationId: paramId(req.params.id),
      uid: req.user!.uid,
      before,
      limit,
    })
    return res.json({ messages })
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
