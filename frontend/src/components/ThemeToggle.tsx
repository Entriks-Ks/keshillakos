import { Moon, Sun } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

const STORAGE_KEY = 'kk-theme'

type Theme = 'light' | 'dark'

function readTheme(): Theme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
}

export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    /* Private mode can block storage; the attribute still switches the page. */
  }
}

export default function ThemeToggle() {
  const { t } = useTranslation()
  const [theme, setTheme] = useState<Theme>('light')

  useEffect(() => {
    setTheme(readTheme())
  }, [])

  const dark = theme === 'dark'

  return (
    <button
      type="button"
      className="kk-theme-toggle"
      aria-pressed={dark}
      aria-label={dark ? t('nav.light') : t('nav.dark')}
      onClick={() => {
        const next: Theme = dark ? 'light' : 'dark'
        applyTheme(next)
        setTheme(next)
      }}
    >
      {dark ? <Sun size={18} aria-hidden /> : <Moon size={18} aria-hidden />}
    </button>
  )
}
