import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router-dom'
import { applyLanguage, LANGUAGES, type AppLanguage } from '../i18n'
import { KEEP_SCROLL_STATE, switchLocaleUrl } from '../routes/routeMap'

export default function LanguageSwitcher() {
  const { i18n, t } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()
  const current = (i18n.resolvedLanguage || i18n.language || 'sq').slice(0, 2)

  function choose(language: AppLanguage) {
    // Public pages: same page, same id/filters/hash, in the new language's URL. Dashboards are language-neutral.
    const target = switchLocaleUrl(location.pathname, location.search, location.hash, language)
    applyLanguage(language)
    if (target && target !== `${location.pathname}${location.search}${location.hash}`) {
      const state = typeof location.state === 'object' && location.state !== null ? location.state : {}
      navigate(target, { state: { ...state, ...KEEP_SCROLL_STATE } })
    }
  }

  return (
    <div className="kk-lang" role="group" aria-label={t('lang.label')}>
      {LANGUAGES.map((language) => (
        <button
          key={language}
          type="button"
          className={current === language ? 'is-active' : undefined}
          aria-pressed={current === language}
          onClick={() => choose(language as AppLanguage)}
        >
          {language.toUpperCase()}
        </button>
      ))}
    </div>
  )
}
