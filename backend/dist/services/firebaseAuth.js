"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.firebaseSignUp = firebaseSignUp;
exports.firebaseSignIn = firebaseSignIn;
exports.firebaseVerifyIdToken = firebaseVerifyIdToken;
exports.firebaseChangePassword = firebaseChangePassword;
exports.firebaseUpdateDisplayName = firebaseUpdateDisplayName;
const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY;
if (!FIREBASE_API_KEY) {
    console.warn('FIREBASE_API_KEY is not set');
}
async function postFirebase(path, body) {
    if (!FIREBASE_API_KEY) {
        throw new Error('FIREBASE_API_KEY is missing');
    }
    const res = await fetch(`https://identitytoolkit.googleapis.com/v1/${path}?key=${FIREBASE_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    const data = (await res.json());
    if (!res.ok || data.error) {
        throw new Error(mapFirebaseError(data.error?.message || 'AUTH_ERROR'));
    }
    return data;
}
function mapFirebaseError(code) {
    switch (code) {
        case 'EMAIL_EXISTS':
            return 'Ky email është i regjistruar tashmë';
        case 'EMAIL_NOT_FOUND':
        case 'INVALID_PASSWORD':
        case 'INVALID_LOGIN_CREDENTIALS':
            return 'Email ose fjalëkalim i gabuar';
        case 'WEAK_PASSWORD : Password should be at least 6 characters':
        case 'WEAK_PASSWORD':
            return 'Fjalëkalimi duhet të ketë të paktën 6 karaktere';
        case 'INVALID_EMAIL':
            return 'Email i pavlefshëm';
        case 'TOO_MANY_ATTEMPTS_TRY_LATER':
            return 'Shumë tentativa. Provo më vonë';
        case 'INVALID_ID_TOKEN':
        case 'INVALID_IDP_RESPONSE':
            return 'Hyrja me Google dështoi. Provo sërish.';
        default:
            return code.replace(/_/g, ' ');
    }
}
async function firebaseSignUp(email, password, name) {
    const data = await postFirebase('accounts:signUp', {
        email,
        password,
        displayName: name,
        returnSecureToken: true,
    });
    return data;
}
async function firebaseSignIn(email, password) {
    const data = await postFirebase('accounts:signInWithPassword', {
        email,
        password,
        returnSecureToken: true,
    });
    return data;
}
async function firebaseVerifyIdToken(idToken) {
    const data = await postFirebase('accounts:lookup', { idToken });
    const user = data.users?.[0];
    if (!user)
        throw new Error('Token i pavlefshëm');
    return user;
}
async function firebaseChangePassword(idToken, newPassword) {
    const data = await postFirebase('accounts:update', {
        idToken,
        password: newPassword,
        returnSecureToken: true,
    });
    return data;
}
async function firebaseUpdateDisplayName(idToken, displayName) {
    const data = await postFirebase('accounts:update', {
        idToken,
        displayName,
        returnSecureToken: true,
    });
    return data;
}
//# sourceMappingURL=firebaseAuth.js.map