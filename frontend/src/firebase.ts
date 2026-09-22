import { getApps, initializeApp, type FirebaseApp } from 'firebase/app'
import { GoogleAuthProvider, getAuth, type Auth } from 'firebase/auth'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined,
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
    throw new Error('Firebase nuk është i konfiguruar')
  }
  return initializeApp({
    apiKey: firebaseConfig.apiKey,
    authDomain: firebaseConfig.authDomain,
    projectId: firebaseConfig.projectId,
    storageBucket: firebaseConfig.storageBucket,
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
      return 'Lejo dritaren popup për Google dhe provo sërish'
    case 'auth/unauthorized-domain':
      return 'Ky domain nuk është i autorizuar në Firebase. Shto localhost te Authorized domains.'
    case 'auth/account-exists-with-different-credential':
      return 'Ky email është i regjistruar me fjalëkalim. Hyr me email.'
    case 'auth/operation-not-allowed':
      return 'Hyrja me Google nuk është e aktivizuar në Firebase'
    case 'auth/network-request-failed':
      return 'Nuk u lidh me Google. Kontrollo internetin.'
    default:
      return 'Hyrja me Google dështoi'
  }
}
