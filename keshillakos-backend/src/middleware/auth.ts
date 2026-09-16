import type { NextFunction, Request, Response } from 'express'
import { firebaseVerifyIdToken } from '../services/firebaseAuth'
import { findUserByUid, toPublicUser } from '../services/userService'
import type { UserRole } from '../types/roles'

export type AuthUser = {
  uid: string
  email: string
  name: string
  role: UserRole
  headline: string
  bio: string
  location: string
  skills: string[]
  languages: string[]
  profilePhoto: string
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization
    if (!header?.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Mungon tokeni i autentifikimit' })
    }

    const idToken = header.slice('Bearer '.length).trim()
    const firebaseUser = await firebaseVerifyIdToken(idToken)
    const dbUser = await findUserByUid(firebaseUser.localId)
    const publicUser = toPublicUser({
      uid: firebaseUser.localId,
      email: firebaseUser.email || dbUser?.email || '',
      name: dbUser?.name || firebaseUser.displayName || 'User',
      role: dbUser?.role ?? 'user',
      headline: dbUser?.headline,
      bio: dbUser?.bio,
      location: dbUser?.location,
      skills: dbUser?.skills,
      languages: dbUser?.languages,
      profilePhoto: dbUser?.profilePhoto,
      createdAt: dbUser?.createdAt,
    })

    req.user = {
      uid: publicUser.uid,
      email: publicUser.email,
      name: publicUser.name,
      role: publicUser.role,
      headline: publicUser.headline || '',
      bio: publicUser.bio || '',
      location: publicUser.location || '',
      skills: publicUser.skills,
      languages: publicUser.languages,
      profilePhoto: publicUser.profilePhoto || '',
    }

    next()
  } catch (err) {
    return res.status(401).json({
      message: err instanceof Error ? err.message : 'Autentifikim i dështuar',
    })
  }
}

export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Mungon autentifikimi' })
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Nuk ke leje për këtë veprim' })
    }
    next()
  }
}
