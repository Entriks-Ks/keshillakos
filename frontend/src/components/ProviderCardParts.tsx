import { Link } from 'react-router-dom'
import { Star } from 'lucide-react'
import type { MarketplaceProvider } from '../api/providerProfiles'
import './ProviderCard.css'

export function ProviderRating({ provider, profilePath }: { provider: MarketplaceProvider; profilePath: string }) {
  const count = provider.ratingCount ?? 0
  const average = provider.ratingAverage ?? 0


  return (
    <p className="pc-rating">
      <span className="pc-score">
        <Star size={13} aria-hidden />
        {average.toFixed(1)}
      </span>
      <Link to={`${profilePath}#vleresimet`} onClick={(e) => e.stopPropagation()}>
        {count} {count === 1 ? 'vlerësim' : 'vlerësime'}
      </Link>
    </p>
  )
}

export function ProviderDescription({
  text,
  expanded,
  onToggle,
}: {
  text: string
  expanded: boolean
  onToggle: () => void
}) {
  const long = text.length > 180
  return (
    <div className="pc-desc-wrap">
      <p className={`pc-desc${long && !expanded ? ' is-clamped' : ''}`}>{text}</p>
      {long ? (
        <button
          type="button"
          className="pc-read-more"
          onClick={(e) => {
            e.stopPropagation()
            onToggle()
          }}
        >
          {expanded ? 'Shiko më pak' : 'Lexo më shumë'}
        </button>
      ) : null}
    </div>
  )
}

export function ProviderTags({ items, max }: { items: string[]; max: number }) {
  if (!items.length) return null
  const shown = items.slice(0, max)
  const rest = items.length - shown.length
  return (
    <ul className="pc-tags" aria-label="Specializimet">
      {shown.map((item) => <li key={item}>{item}</li>)}
      {rest > 0 ? <li className="is-more">+{rest}</li> : null}
    </ul>
  )
}
