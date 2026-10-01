import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Card, Chip, Skeleton } from '@heroui/react'
import { BadgeCheck, Star } from 'lucide-react'
import { useProviderCardLink } from './providerCardUtils'
import './ProviderCard.css'

type CardShellProps = {
  href: string
  label: string
  media?: ReactNode
  mediaKind?: 'person' | 'company' | 'photo'
  children: ReactNode
  footer?: ReactNode
}

/** Shared frame for service, company and expert cards on /ofertat. */
export function CardShell({ href, label, media, mediaKind = 'person', children, footer }: CardShellProps) {
  const cardLink = useProviderCardLink(href)
  return (
    <Card
      className="pc-card is-clickable"
      onClick={cardLink.onClick}
      onKeyDown={cardLink.onKeyDown}
      role="link"
      tabIndex={0}
      aria-label={label}
    >
      <div className={`pc-main${media ? '' : ' no-media'}`}>
        {media ? <div className={`pc-media is-${mediaKind}`} aria-hidden>{media}</div> : null}
        <div className="pc-body">{children}</div>
      </div>
      {footer}
    </Card>
  )
}

export function CardTitle({ to, children, verified }: { to: string; children: ReactNode; verified?: string }) {
  return (
    <div className="pc-title-row">
      <h3 className="pc-name">
        <Link to={to} onClick={(e) => e.stopPropagation()}>{children}</Link>
      </h3>
      {verified ? (
        <Chip size="sm" variant="soft" color="accent" className="pc-verified">
          <BadgeCheck size={12} aria-hidden />
          <Chip.Label>{verified}</Chip.Label>
        </Chip>
      ) : null}
    </div>
  )
}

export function CardMeta({ children }: { children: ReactNode }) {
  return <ul className="pc-meta">{children}</ul>
}

export function RatingMeta({ average, count, href }: { average: number; count: number; href: string }) {
  if (count <= 0) return <li className="pc-rating is-empty">Ende pa vlerësime</li>
  return (
    <li className="pc-rating">
      <Star size={14} aria-hidden />
      <strong>{average.toFixed(1)}</strong>
      <Link to={`${href}#vleresimet`} onClick={(e) => e.stopPropagation()}>
        ({count} {count === 1 ? 'vlerësim' : 'vlerësime'})
      </Link>
    </li>
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
      {shown.map((item) => (
        <li key={item}>
          <Chip size="sm" variant="soft">
            <Chip.Label>{item}</Chip.Label>
          </Chip>
        </li>
      ))}
      {rest > 0 ? (
        <li>
          <Chip size="sm" variant="soft" className="pc-tag-more">
            <Chip.Label>+{rest}</Chip.Label>
          </Chip>
        </li>
      ) : null}
    </ul>
  )
}

export function CardSkeleton() {
  return (
    <Card className="pc-card pc-skeleton" aria-hidden>
      <div className="pc-main">
        <Skeleton className="pc-media is-person" />
        <div className="pc-body">
          <Skeleton className="pc-skel-line is-title" />
          <Skeleton className="pc-skel-line is-mid" />
          <Skeleton className="pc-skel-line is-wide" />
          <Skeleton className="pc-skel-line is-wide" />
        </div>
      </div>
      <div className="pc-skel-actions">
        <Skeleton className="pc-skel-button is-primary" />
        <Skeleton className="pc-skel-button" />
        <Skeleton className="pc-skel-button" />
        <Skeleton className="pc-skel-button" />
      </div>
    </Card>
  )
}
