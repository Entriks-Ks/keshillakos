import type { NextFunction, Request, Response } from 'express'
import { firebaseVerifyIdToken } from '../services/firebaseAuth'
import { findUserByUid, toPublicUser } from '../services/userService'
import type { UserRole } from '../types/roles'

export type AuthUser = {
  uid: string
  email: string
  name: string
  firstName?: string
  lastName?: string
  phone?: string
  locale?: string
  country?: string
  city?: string
  verification?: import('../models/User').UserDoc['verification']
  privacy?: import('../models/User').UserDoc['privacy']
  role: UserRole
  roles: UserRole[]
  requestedRole?: UserRole
  accountStatus: 'active' | 'suspended' | 'closed'
  headline: string
  bio: string
  location: string
  savedLocation?: import('../services/userService').SavedLocation
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
      roles: dbUser?.roles,
      requestedRole: dbUser?.requestedRole,
      firstName: dbUser?.firstName,
      lastName: dbUser?.lastName,
      phone: dbUser?.phone,
      locale: dbUser?.locale,
      country: dbUser?.country,
      city: dbUser?.city,
      verification: dbUser?.verification,
      privacy: dbUser?.privacy,
      accountStatus: dbUser?.accountStatus,
      headline: dbUser?.headline,
      bio: dbUser?.bio,
      location: dbUser?.location,
      savedLocation: dbUser?.savedLocation,
      skills: dbUser?.skills,
      languages: dbUser?.languages,
      profilePhoto: dbUser?.profilePhoto,
      createdAt: dbUser?.createdAt,
    })

    if (publicUser.accountStatus !== 'active') {
      return res.status(403).json({ message: 'Llogaria nuk është aktive' })
    }

    req.user = {
      uid: publicUser.uid,
      email: publicUser.email,
      name: publicUser.name,
      firstName: publicUser.firstName,
      lastName: publicUser.lastName,
      phone: publicUser.phone,
      locale: publicUser.locale,
      country: publicUser.country,
      city: publicUser.city,
      verification: publicUser.verification,
      privacy: publicUser.privacy,
      role: publicUser.role,
      roles: publicUser.roles ?? ['user'],
      requestedRole: publicUser.requestedRole,
      accountStatus: publicUser.accountStatus ?? 'active',
      headline: publicUser.headline || '',
      bio: publicUser.bio || '',
      location: publicUser.location || '',
      savedLocation: publicUser.savedLocation,
      skills: publicUser.skills ?? [],
      languages: publicUser.languages ?? [],
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
    if (!roles.some((role) => req.user!.roles.includes(role))) {
      return res.status(403).json({ message: 'Nuk ke leje për këtë veprim' })
    }
    next()
  }
}
