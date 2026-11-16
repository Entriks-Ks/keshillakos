import { Router } from 'express'
import { requireAuth } from '../middleware/auth'
import { generateLivekitToken, getLivekitConfig } from '../services/livekitService'
import {
  getCallById,
  getActiveCallForUser,
  listCallHistory,
  formatCallDoc,
} from '../services/callService'

const router = Router()

function statusOf(err: unknown) {
  if (
    err &&
    typeof err === 'object' &&
    'status' in err &&
    typeof (err as { status: unknown }).status === 'number'
  ) {
    return (err as { status: number }).status
  }
  return 400
}

/**
 * Generate a LiveKit access token for an active call.
 * Authenticated user must be caller or receiver.
 */
router.post('/token', requireAuth, async (req, res) => {
  try {
    const { callId } = req.body as { callId?: string }
    if (!callId || typeof callId !== 'string') {
      return res.status(400).json({ message: 'Mungon ID e thirrjes' })
    }

    const call = await getCallById(callId, req.user!.uid)
    if (call.status !== 'ringing' && call.status !== 'accepted') {
      return res.status(400).json({
        message: `Thirrja ka përfunduar ose është e pavlefshme (statusi: ${call.status})`,
      })
    }

    const token = await generateLivekitToken({
      roomName: call.roomName,
      identity: req.user!.uid,
      name: req.user!.name,
    })

    const { url } = getLivekitConfig()

    return res.json({
      token,
      roomName: call.roomName,
      livekitUrl: url,
    })
  } catch (err) {
    return res.status(statusOf(err)).json({
      message: err instanceof Error ? err.message : 'Dështoi gjenerimi i tokenit të LiveKit',
    })
  }
})

/**
 * Fetch current active call for the logged in user, if any.
 */
router.get('/active', requireAuth, async (req, res) => {
  try {
    const activeCall = await getActiveCallForUser(req.user!.uid)
    if (!activeCall) {
      return res.json({ activeCall: null })
    }
    const formatted = await formatCallDoc(activeCall, req.user!.uid)
    return res.json({ activeCall: formatted })
  } catch (err) {
    return res.status(statusOf(err)).json({
      message: err instanceof Error ? err.message : 'Gabim gjatë leximit të thirrjes aktive',
    })
  }
})

/**
 * Fetch call history for logged in user.
 */
router.get('/history', requireAuth, async (req, res) => {
  try {
    const page = Number(req.query.page) || 1
    const limit = Number(req.query.limit) || 20
    const history = await listCallHistory(req.user!.uid, page, limit)
    return res.json(history)
  } catch (err) {
    return res.status(statusOf(err)).json({
      message: err instanceof Error ? err.message : 'Nuk u ngarkua historiku i thirrjeve',
    })
  }
})

/**
 * Fetch single call by ID.
 */
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const callId = req.params.id as string
    const call = await getCallById(callId, req.user!.uid)
    const formatted = await formatCallDoc(call, req.user!.uid)
    return res.json({ call: formatted })
  } catch (err) {
    return res.status(statusOf(err)).json({
      message: err instanceof Error ? err.message : 'Thirrja nuk u gjet',
    })
  }
})

export default router
