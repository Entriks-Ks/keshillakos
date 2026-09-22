const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY

if (!FIREBASE_API_KEY) {
  console.warn('FIREBASE_API_KEY is not set')
}

type FirebaseAuthResponse = {
  idToken: string
  email: string
  localId: string
  refreshToken: string
  expiresIn: string
  displayName?: string
  error?: { message: string }
}

type AccountInfoResponse = {
  users?: Array<{
    localId: string
    email?: string
    displayName?: string
    photoUrl?: string
  }>
  error?: { message: string }
}

async function postFirebase<T>(path: string, body: Record<string, unknown>): Promise<T> {
  if (!FIREBASE_API_KEY) {
    throw new Error('FIREBASE_API_KEY is missing')
  }

  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/${path}?key=${FIREBASE_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  )

  const data = (await res.json()) as T & { error?: { message: string } }
  if (!res.ok || data.error) {
    throw new Error(mapFirebaseError(data.error?.message || 'AUTH_ERROR'))
  }
  return data
}

function mapFirebaseError(code: string) {
  switch (code) {
    case 'EMAIL_EXISTS':
      return 'Ky email është i regjistruar tashmë'
    case 'EMAIL_NOT_FOUND':
    case 'INVALID_PASSWORD':
    case 'INVALID_LOGIN_CREDENTIALS':
      return 'Email ose fjalëkalim i gabuar'
    case 'WEAK_PASSWORD : Password should be at least 6 characters':
    case 'WEAK_PASSWORD':
      return 'Fjalëkalimi duhet të ketë të paktën 6 karaktere'
    case 'INVALID_EMAIL':
      return 'Email i pavlefshëm'
    case 'TOO_MANY_ATTEMPTS_TRY_LATER':
      return 'Shumë tentativa. Provo më vonë'
    case 'INVALID_ID_TOKEN':
    case 'INVALID_IDP_RESPONSE':
      return 'Hyrja me Google dështoi. Provo sërish.'
    default:
      return code.replace(/_/g, ' ')
  }
}

export async function firebaseSignUp(email: string, password: string, name: string) {
  const data = await postFirebase<FirebaseAuthResponse>('accounts:signUp', {
    email,
    password,
    displayName: name,
    returnSecureToken: true,
  })
  return data
}

export async function firebaseSignIn(email: string, password: string) {
  const data = await postFirebase<FirebaseAuthResponse>('accounts:signInWithPassword', {
    email,
    password,
    returnSecureToken: true,
  })
  return data
}

export async function firebaseVerifyIdToken(idToken: string) {
  const data = await postFirebase<AccountInfoResponse>('accounts:lookup', { idToken })
  const user = data.users?.[0]
  if (!user) throw new Error('Token i pavlefshëm')
  return user
}

export async function firebaseChangePassword(idToken: string, newPassword: string) {
  const data = await postFirebase<FirebaseAuthResponse>('accounts:update', {
    idToken,
    password: newPassword,
    returnSecureToken: true,
  })
  return data
}

export async function firebaseUpdateDisplayName(idToken: string, displayName: string) {
  const data = await postFirebase<FirebaseAuthResponse>('accounts:update', {
    idToken,
    displayName,
    returnSecureToken: true,
  })
  return data
}
