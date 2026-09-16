import { Router } from 'express'
import fs from 'fs'
import multer from 'multer'
import path from 'path'
import { requireAuth } from '../middleware/auth'
import {
  firebaseChangePassword,
  firebaseSignIn,
  firebaseSignUp,
  firebaseUpdateDisplayName,
} from '../services/firebaseAuth'
import {
  findUserByUid,
  updateOwnProfile,
  updateProfilePhoto,
  upsertUser,
} from '../services/userService'
import { isPublicRole } from '../types/roles'

const router = Router()

const uploadsRoot = path.resolve(process.cwd(), 'uploads')
const profilesDir = path.join(uploadsRoot, 'profiles')
fs.mkdirSync(profilesDir, { recursive: true })

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, profilesDir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || '.jpg'
      const safeExt = ['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext) ? ext : '.jpg'
      cb(null, `${req.user!.uid}${safeExt}`)
    },
  }),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      cb(new Error('Ngarko vetëm foto (JPG, PNG, WEBP)'))
      return
    }
    cb(null, true)
  },
})

function publicUser(user: {
  uid: string
  email: string
  name: string
  role: string
  headline?: string
  bio?: string
  location?: string
  skills?: string[]
  languages?: string[]
  profilePhoto?: string
}) {
  return {
    uid: user.uid,
    email: user.email,
    name: user.name,
    role: user.role,
    headline: user.headline || '',
    bio: user.bio || '',
    location: user.location || '',
    skills: user.skills ?? [],
    languages: user.languages ?? [],
    profilePhoto: user.profilePhoto || '',
  }
}

router.post('/register', async (req, res) => {
  try {
    const { email, password, name, role } = req.body as {
      email?: string
      password?: string
      name?: string
      role?: string
    }

    if (!email?.trim() || !password || !name?.trim()) {
      return res.status(400).json({ message: 'Emri, email dhe fjalëkalimi janë të detyrueshme' })
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Fjalëkalimi duhet të ketë të paktën 6 karaktere' })
    }

    const selectedRole = role ?? 'user'
    if (!isPublicRole(selectedRole)) {
      return res.status(400).json({
        message: 'Roli duhet të jetë user, provider ose company. Admin nuk krijohet nga regjistrimi.',
      })
    }

    const auth = await firebaseSignUp(email.trim(), password, name.trim())
    const user = await upsertUser({
      uid: auth.localId,
      email: auth.email,
      name: name.trim(),
      role: selectedRole,
      updateName: true,
    })

    return res.status(201).json({
      token: auth.idToken,
      user: publicUser(user),
    })
  } catch (err) {
    return res.status(400).json({
      message: err instanceof Error ? err.message : 'Regjistrimi dështoi',
    })
  }
})

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body as { email?: string; password?: string }

    if (!email?.trim() || !password) {
      return res.status(400).json({ message: 'Email dhe fjalëkalimi janë të detyrueshme' })
    }

    const auth = await firebaseSignIn(email.trim(), password)
    const existing = await findUserByUid(auth.localId)
    const user = await upsertUser({
      uid: auth.localId,
      email: auth.email,
      name: existing?.name || auth.displayName || email.split('@')[0] || 'User',
      updateName: !existing,
    })

    return res.json({
      token: auth.idToken,
      user: publicUser(user),
    })
  } catch (err) {
    return res.status(401).json({
      message: err instanceof Error ? err.message : 'Hyrja dështoi',
    })
  }
})

router.post('/change-password', requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body as {
      currentPassword?: string
      newPassword?: string
    }

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        message: 'Fjalëkalimi aktual dhe ai i ri janë të detyrueshme',
      })
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        message: 'Fjalëkalimi i ri duhet të ketë të paktën 6 karaktere',
      })
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({
        message: 'Fjalëkalimi i ri duhet të jetë i ndryshëm nga ai aktual',
      })
    }

    const email = req.user!.email
    if (!email) {
      return res.status(400).json({ message: 'Mungon email i llogarisë' })
    }

    const signedIn = await firebaseSignIn(email, currentPassword)
    if (signedIn.localId !== req.user!.uid) {
      return res.status(403).json({ message: 'Nuk lejohet ndryshimi i fjalëkalimit' })
    }

    const updated = await firebaseChangePassword(signedIn.idToken, newPassword)

    return res.json({
      message: 'Fjalëkalimi u ndryshua me sukses',
      token: updated.idToken,
    })
  } catch (err) {
    return res.status(400).json({
      message: err instanceof Error ? err.message : 'Ndryshimi i fjalëkalimit dështoi',
    })
  }
})

router.patch('/me', requireAuth, async (req, res) => {
  try {
    const { name, headline, bio, location, skills, languages } = req.body as {
      name?: string
      headline?: string
      bio?: string
      location?: string
      skills?: string[]
      languages?: string[]
    }

    const user = await updateOwnProfile(req.user!.uid, {
      name,
      headline,
      bio,
      location,
      skills,
      languages,
    })

    if (name?.trim() && name.trim() !== req.user!.name) {
      const header = req.headers.authorization
      const idToken = header?.startsWith('Bearer ') ? header.slice(7).trim() : ''
      if (idToken) {
        try {
          await firebaseUpdateDisplayName(idToken, name.trim())
        } catch {
          // Mongo is source of truth; Firebase displayName sync is best-effort
        }
      }
    }

    return res.json({ user: publicUser(user) })
  } catch (err) {
    return res.status(400).json({
      message: err instanceof Error ? err.message : 'Përditësimi i profilit dështoi',
    })
  }
})

router.post('/me/photo', requireAuth, (req, res) => {
  upload.single('photo')(req, res, async (err) => {
    try {
      if (err) {
        const message =
          err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE'
            ? 'Fotoja duhet të jetë më e vogël se 2MB'
            : err instanceof Error
              ? err.message
              : 'Ngarkimi i fotos dështoi'
        return res.status(400).json({ message })
      }

      if (!req.file) {
        return res.status(400).json({ message: 'Zgjidh një foto për profilin' })
      }

      const profilePhoto = `/uploads/profiles/${req.file.filename}`
      const user = await updateProfilePhoto(req.user!.uid, profilePhoto)
      return res.json({ user: publicUser(user) })
    } catch (error) {
      return res.status(400).json({
        message: error instanceof Error ? error.message : 'Ngarkimi i fotos dështoi',
      })
    }
  })
})

router.get('/me', requireAuth, async (req, res) => {
  return res.json({ user: req.user })
})

export default router
