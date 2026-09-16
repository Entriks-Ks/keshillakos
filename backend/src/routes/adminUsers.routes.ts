import { Router } from 'express'
import { requireAuth, requireRole } from '../middleware/auth'
import { firebaseSignUp } from '../services/firebaseAuth'
import {
  countUsersByRole,
  deleteUserByUid,
  listUsers,
  updateUserByUid,
  upsertUser,
} from '../services/userService'
import { isUserRole, ROLE_LABELS, ROLES } from '../types/roles'

const router = Router()

router.use(requireAuth, requireRole('admin'))

router.get('/meta', async (_req, res) => {
  try {
    const counts = await countUsersByRole()
    return res.json({
      roles: ROLES.map((id) => ({ id, label: ROLE_LABELS[id] })),
      counts,
    })
  } catch (err) {
    return res.status(500).json({
      message: err instanceof Error ? err.message : 'Nuk u ngarkuan statistikat',
    })
  }
})

router.get('/', async (req, res) => {
  try {
    const role = typeof req.query.role === 'string' ? req.query.role : undefined
    const q = typeof req.query.q === 'string' ? req.query.q : undefined

    if (role && !isUserRole(role)) {
      return res.status(400).json({ message: 'Roli i filtrit nuk është i vlefshëm' })
    }

    const users = await listUsers({
      role: role && isUserRole(role) ? role : undefined,
      q,
    })
    return res.json({ users })
  } catch (err) {
    return res.status(500).json({
      message: err instanceof Error ? err.message : 'Nuk u ngarkuan përdoruesit',
    })
  }
})

router.post('/', async (req, res) => {
  try {
    const { name, email, password, role } = req.body as {
      name?: string
      email?: string
      password?: string
      role?: string
    }

    if (!name?.trim() || !email?.trim() || !password) {
      return res.status(400).json({
        message: 'Emri, email dhe fjalëkalimi janë të detyrueshme',
      })
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Fjalëkalimi duhet të ketë të paktën 6 karaktere' })
    }

    if (!isUserRole(role)) {
      return res.status(400).json({ message: 'Zgjidh një rol të vlefshëm' })
    }

    const auth = await firebaseSignUp(email.trim(), password, name.trim())
    // Force role on create (including admin)
    await upsertUser({
      uid: auth.localId,
      email: auth.email,
      name: name.trim(),
      role,
    })
    const saved = await updateUserByUid(auth.localId, {
      name: name.trim(),
      email: auth.email,
      role,
    })

    return res.status(201).json({ user: saved })
  } catch (err) {
    return res.status(400).json({
      message: err instanceof Error ? err.message : 'Krijimi i përdoruesit dështoi',
    })
  }
})

router.patch('/:uid', async (req, res) => {
  try {
    const { name, email, role } = req.body as {
      name?: string
      email?: string
      role?: string
    }

    if (role !== undefined && !isUserRole(role)) {
      return res.status(400).json({ message: 'Roli nuk është i vlefshëm' })
    }

    if (req.params.uid === req.user!.uid && role && role !== 'admin') {
      return res.status(400).json({
        message: 'Nuk mund ta heqësh rolin admin nga llogaria jote',
      })
    }

    const user = await updateUserByUid(req.params.uid, {
      name,
      email,
      role: role && isUserRole(role) ? role : undefined,
    })

    return res.json({ user })
  } catch (err) {
    return res.status(400).json({
      message: err instanceof Error ? err.message : 'Përditësimi dështoi',
    })
  }
})

router.delete('/:uid', async (req, res) => {
  try {
    if (req.params.uid === req.user!.uid) {
      return res.status(400).json({ message: 'Nuk mund ta fshish llogarinë tënde' })
    }

    await deleteUserByUid(req.params.uid)
    return res.json({ ok: true })
  } catch (err) {
    return res.status(400).json({
      message: err instanceof Error ? err.message : 'Fshirja dështoi',
    })
  }
})

export default router
