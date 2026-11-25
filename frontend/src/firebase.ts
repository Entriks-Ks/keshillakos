import { getApps, initializeApp, type FirebaseApp } from 'firebase/app'
import { GoogleAuthProvider, getAuth, type Auth } from 'firebase/auth'
import i18n from './i18n'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
}

export function isFirebaseConfigured() {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId)
}

let auth: Auth | undefined

function firebaseApp(): FirebaseApp {
  const existing = getApps()[0]
  if (existing) return existing
  if (!firebaseConfig.apiKey || !firebaseConfig.authDomain || !firebaseConfig.projectId) {
    throw new Error(i18n.t('system.google.firebaseNotConfigured'))
  }
  return initializeApp({
    apiKey: firebaseConfig.apiKey,
    authDomain: firebaseConfig.authDomain,
    projectId: firebaseConfig.projectId,
    messagingSenderId: firebaseConfig.messagingSenderId,
    appId: firebaseConfig.appId,
  })
}

export function firebaseAuth() {
  auth ??= getAuth(firebaseApp())
  return auth
}

export const googleProvider = new GoogleAuthProvider()
googleProvider.setCustomParameters({ prompt: 'select_account' })

export function mapFirebaseClientError(code: string) {
  switch (code) {
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return ''
    case 'auth/popup-blocked':
      return i18n.t('system.google.popupBlocked')
    case 'auth/unauthorized-domain':
      return i18n.t('system.google.unauthorizedDomain')
    case 'auth/account-exists-with-different-credential':
      return i18n.t('system.google.accountExists')
    case 'auth/operation-not-allowed':
      return i18n.t('system.google.notEnabled')
    case 'auth/network-request-failed':
      return i18n.t('system.google.network')
    default:
      return i18n.t('system.google.failed')
  }
}
