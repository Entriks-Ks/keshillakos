import { ImageIcon } from 'lucide-react'
import './ServiceMediaPlaceholder.css'

type Props = {
  compact?: boolean
}

export default function ServiceMediaPlaceholder({ compact = false }: Props) {
  return (
    <div className={`kk-media-empty${compact ? ' is-compact' : ''}`} role="img" aria-label="Nuk ka foto">
      <ImageIcon size={compact ? 18 : 28} strokeWidth={1.6} aria-hidden />
      <span>Nuk ka foto</span>
    </div>
  )
}
