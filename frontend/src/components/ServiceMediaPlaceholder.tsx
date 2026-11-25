import { ImageIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import './ServiceMediaPlaceholder.css'

type Props = {
  compact?: boolean
}

export default function ServiceMediaPlaceholder({ compact = false }: Props) {
  const { t } = useTranslation()
  return (
    <div className={`kk-media-empty${compact ? ' is-compact' : ''}`} role="img" aria-label={t('system.media.noPhoto')}>
      <ImageIcon size={compact ? 18 : 28} strokeWidth={1.6} aria-hidden />
      <span>{t('system.media.noPhoto')}</span>
    </div>
  )
}
