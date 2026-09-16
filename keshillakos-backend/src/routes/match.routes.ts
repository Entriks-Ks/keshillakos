import { Router } from 'express'
import { matchExperts } from '../services/matchService'
import type { MatchIntake } from '../types/match'

const router = Router()

const AUDIENCES = new Set(['individual', 'business'])
const LANGUAGES = new Set(['Albanian', 'German', 'English'])
const URGENCIES = new Set(['today', 'this_week', 'flexible'])
const CONTACTS = new Set(['chat', 'phone', 'email'])

router.post('/', async (req, res) => {
  try {
    const body = req.body as Partial<MatchIntake>

    if (!body.need?.trim() || body.need.trim().length < 4) {
      return res.status(400).json({ message: 'Përshkruaj për çfarë ke nevojë për ndihmë' })
    }
    if (!body.audience || !AUDIENCES.has(body.audience)) {
      return res.status(400).json({ message: 'Zgjidh: Individual ose Business' })
    }
    if (!body.location?.trim()) {
      return res.status(400).json({ message: 'Zgjidh lokacionin' })
    }
    if (!body.language || !LANGUAGES.has(body.language)) {
      return res.status(400).json({ message: 'Zgjidh gjuhën' })
    }
    if (!body.urgency || !URGENCIES.has(body.urgency)) {
      return res.status(400).json({ message: 'Zgjidh urgjencën' })
    }
    if (!body.contact || !CONTACTS.has(body.contact)) {
      return res.status(400).json({ message: 'Zgjidh si të kontaktojnë ekspertët' })
    }

    const intake: MatchIntake = {
      need: body.need.trim(),
      audience: body.audience,
      location: body.location.trim(),
      language: body.language,
      urgency: body.urgency,
      budget: body.budget?.trim() || undefined,
      contact: body.contact,
    }

    const result = await matchExperts(intake)
    return res.json({ intake, ...result })
  } catch (err) {
    return res.status(500).json({
      message: err instanceof Error ? err.message : 'Matching dështoi',
    })
  }
})

export default router
