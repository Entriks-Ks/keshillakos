import axios from 'axios'
import i18n from '../i18n'
import { API_GENERIC_ERROR_KEY, API_NETWORK_ERROR_KEY, apiErrorTranslation } from './apiErrorMessages'

/** Translates a known backend message into the active language; unknown messages pass through. */
function localizeMessage(message: string) {
  const known = apiErrorTranslation(message)
  return known ? i18n.t(known.key, known.params) : message
}

export function getErrorMessage(err: unknown) {
  if (axios.isAxiosError(err)) {
    const msg = err.response?.data?.message
    if (typeof msg === 'string' && msg.trim()) return localizeMessage(msg)
    if (!err.response) return i18n.t(API_NETWORK_ERROR_KEY)
  }
  if (err instanceof Error && err.message) return localizeMessage(err.message)
  return i18n.t(API_GENERIC_ERROR_KEY)
}
