import { useTranslation } from 'react-i18next'
import { applyLanguage, LANGUAGES, type AppLanguage } from '../i18n'

export default function LanguageSwitcher() {
  const { i18n, t } = useTranslation()
  const current = (i18n.resolvedLanguage || i18n.language || 'sq').slice(0, 2)

  return (
    <div className="kk-lang" role="group" aria-label={t('lang.label')}>
      {LANGUAGES.map((language) => (
        <button
          key={language}
          type="button"
          className={current === language ? 'is-active' : undefined}
          aria-pressed={current === language}
          onClick={() => applyLanguage(language as AppLanguage)}
        >
          {language.toUpperCase()}
        </button>
      ))}
    </div>
  )
}
