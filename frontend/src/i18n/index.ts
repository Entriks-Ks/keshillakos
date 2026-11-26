import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import de from './locales/de'
import en from './locales/en'
import sq from './locales/sq'
import { initialLocale, setActiveLocale } from '../routes/routeMap'

export const LANGUAGES = ['sq', 'en', 'de'] as const
export type AppLanguage = (typeof LANGUAGES)[number]

const STORAGE_KEY = 'kk-lang'

export function readLanguage(): AppLanguage {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'sq' || saved === 'en' || saved === 'de') return saved
  } catch {
    /* Storage can be blocked. */
  }
  return 'sq'
}

export function catalogLanguage(language?: string): 'sq' | 'en' {
  return (language || i18n.language || 'sq').toLowerCase().startsWith('sq') ? 'sq' : 'en'
}

/** UI copy. Catalog names stay sq/en; German uses the English catalog label. */
export function uiText(sq: string, en: string, de: string) {
  const language = (i18n.language || 'sq').toLowerCase()
  if (language.startsWith('de')) return de
  if (language.startsWith('en')) return en
  return sq
}

/** BCP-47 locale for Intl date/number formatting in the active UI language. */
export function dateLocale(language?: string) {
  const current = (language || i18n.language || 'sq').toLowerCase()
  if (current.startsWith('de')) return 'de-DE'
  if (current.startsWith('en')) return 'en-GB'
  return 'sq-AL'
}

export function applyLanguage(language: AppLanguage) {
  setActiveLocale(language)
  document.documentElement.lang = language
  try {
    localStorage.setItem(STORAGE_KEY, language)
  } catch {
    /* The document language still switches. */
  }
  void i18n.changeLanguage(language)
}

/** A localised URL (/en/..., /de/..., Albanian slugs) decides the language; dashboards and old URLs keep the saved one. */
const startLanguage: AppLanguage = typeof window === 'undefined' ? 'sq' : initialLocale(window.location.pathname, readLanguage())
setActiveLocale(startLanguage)
if (typeof document !== 'undefined') document.documentElement.lang = startLanguage

void i18n.use(initReactI18next).init({
  resources: {
    sq: { translation: sq },
    en: { translation: en },
    de: { translation: de },
  },
  lng: startLanguage,
  fallbackLng: 'sq',
  interpolation: { escapeValue: false },
})

i18n.on('languageChanged', (language) => {
  if (language === 'sq' || language === 'en' || language === 'de') {
    setActiveLocale(language)
    document.documentElement.lang = language
  }
})

export default i18n
