import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  ArrowUpRight,
  BadgeCheck,
  BriefcaseBusiness,
  Building2,
  MapPin,
  Star,
  Tag,
  UserRound,
  Video,
  type LucideIcon,
} from 'lucide-react'
import ProfileAvatar from '../components/ProfileAvatar'
import type { MarketplaceTab } from '../utils/serviceDiscovery'

/** One real offer shown in the hero deck. */
export type DeckItem = {
  id: string
  href: string
  kind: MarketplaceTab
  title: string
  subtitle?: string
  price?: string | null
  location?: string
  online?: boolean
  verified?: boolean
  rating: { average: number; count: number }
  /** Logo or portrait next to the title (experts, companies). */
  avatar?: { photo?: string; seed: string; company: boolean }
  /** Who offers it (services). */
  owner?: { name: string; photo?: string; seed: string; company: boolean }
}

const KIND_ICONS: Record<MarketplaceTab, LucideIcon> = {
  services: BriefcaseBusiness,
  companies: Building2,
  experts: UserRound,
}

const KIND_KEYS: Record<MarketplaceTab, string> = {
  services: 'offers.kindServices',
  companies: 'offers.kindCompanies',
  experts: 'offers.kindExperts',
}

/** Fanned positions: front card, then two peeking out behind it. */
const POSES = [
  { x: 0, y: 0, r: 0, s: 1, o: 1 },
  { x: 34, y: -26, r: 4, s: 0.93, o: 0.92 },
  { x: 64, y: -50, r: 8, s: 0.86, o: 0.6 },
]
const HIDDEN_POSE = { x: 84, y: -66, r: 11, s: 0.8, o: 0 }

function prefersReducedMotion() {
  return typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
}

/** Animated number. Screen readers only get the final value. */
export function CountUp({ value, duration = 700 }: { value: number; duration?: number }) {
  const [shown, setShown] = useState(() => (prefersReducedMotion() ? value : 0))
  const current = useRef(shown)

  useEffect(() => {
    if (prefersReducedMotion()) {
      current.current = value
      setShown(value)
      return
    }
    const from = current.current
    if (from === value) return
    let frame = 0
    const start = performance.now()
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - progress, 3)
      const next = Math.round(from + (value - from) * eased)
      current.current = next
      setShown(next)
      if (progress < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [value, duration])

  return (
    <>
      <span aria-hidden>{shown}</span>
      <span className="of-sr">{value}</span>
    </>
  )
}

/** Example searches that roll through the empty search field. */
export function SearchHints({ prefix, phrases }: { prefix: string; phrases: string[] }) {
  const [index, setIndex] = useState(0)
  if (phrases.length === 0) return null
  const phrase = phrases[index % phrases.length]
  return (
    <span className="of-search-hint" aria-hidden>
      <span className="of-search-hint-prefix">{prefix}</span>
      <span className="of-search-hint-window">
        <span
          key={`${index}-${phrase}`}
          className="of-search-hint-phrase"
          onAnimationEnd={() => setIndex((value) => (value + 1) % phrases.length)}
        >
          {phrase}
        </span>
      </span>
    </span>
  )
}

function DeckCard({
  item,
  front,
  leaving,
  style,
}: {
  item: DeckItem
  front: boolean
  leaving: boolean
  style: CSSProperties
}) {
  const { t } = useTranslation()
  const KindIcon = KIND_ICONS[item.kind]
  const className = `of-deck-card${front ? ' is-front' : ''}${leaving ? ' is-leaving' : ''}`
  return (
    <Link
      to={item.href}
      className={className}
      style={style}
      tabIndex={front ? undefined : -1}
      aria-hidden={front ? undefined : true}
      draggable={false}
    >
      {item.price ? (
        <span className="of-deck-sticker" aria-hidden>
          <Tag size={14} />
          {item.price}
        </span>
      ) : null}

      <span className="of-deck-card-top">
        <span className="of-deck-kind">
          <KindIcon size={13} aria-hidden />
          {t(KIND_KEYS[item.kind])}
        </span>
        {item.verified ? (
          <span className="of-deck-verified">
            <BadgeCheck size={14} aria-hidden />
            {t('offers.verified')}
          </span>
        ) : null}
      </span>

      <span className="of-deck-head">
        {item.avatar ? (
          <span className={`of-deck-avatar is-lg${item.avatar.company ? ' is-company' : ''}`} aria-hidden>
            <ProfileAvatar
              src={item.avatar.photo}
              seed={item.avatar.seed}
              size="fill"
              fit={item.avatar.company ? 'contain' : 'cover'}
            />
          </span>
        ) : null}
        <span className="of-deck-head-copy">
          <strong className="of-deck-title">{item.title}</strong>
          {item.subtitle ? <span className="of-deck-sub">{item.subtitle}</span> : null}
        </span>
      </span>

      {item.location || item.online || item.price ? (
        <span className="of-deck-meta">
          {item.price ? (
            <span className="of-sr">{item.price}</span>
          ) : null}
          {item.location ? (
            <span>
              <MapPin size={13} aria-hidden />
              {item.location}
            </span>
          ) : null}
          {item.online ? (
            <span>
              <Video size={13} aria-hidden />
              Online
            </span>
          ) : null}
        </span>
      ) : null}

      <span className="of-deck-foot">
        {item.owner ? (
          <span className="of-deck-owner">
            <span className={`of-deck-avatar${item.owner.company ? ' is-company' : ''}`} aria-hidden>
              <ProfileAvatar
                src={item.owner.photo}
                seed={item.owner.seed}
                size="fill"
                fit={item.owner.company ? 'contain' : 'cover'}
              />
            </span>
            <span className="of-deck-owner-name">{item.owner.name}</span>
          </span>
        ) : null}
        <span className={`of-deck-rating${item.rating.count > 0 ? '' : ' is-empty'}`}>
          {item.rating.count > 0 ? (
            <>
              <Star size={13} aria-hidden />
              <b>{item.rating.average.toFixed(1)}</b>
              <span>({item.rating.count})</span>
            </>
          ) : (
            t('offers.noRatings')
          )}
        </span>
        <span className="of-deck-go" aria-hidden>
          <ArrowUpRight size={16} />
        </span>
      </span>
    </Link>
  )
}

/**
 * Hero showcase: a fanned 3D deck of real offers that shuffles itself.
 * The active dot's fill animation drives the timing, so hovering or keyboard
 * focus pauses it and reduced motion stops it.
 */
export function OfferDeck({ items }: { items: DeckItem[] }) {
  const { t } = useTranslation()
  const stageRef = useRef<HTMLDivElement>(null)
  const [state, setState] = useState({ index: 0, prev: -1 })
  const itemsKey = items.map((item) => item.id).join('|')
  const [syncedKey, setSyncedKey] = useState(itemsKey)
  if (itemsKey !== syncedKey) {
    setSyncedKey(itemsKey)
    setState({ index: 0, prev: -1 })
  }

  const count = items.length
  const index = count > 0 ? state.index % count : 0

  function go(next: number) {
    if (count < 2) return
    const target = ((next % count) + count) % count
    setState((current) => (current.index === target ? current : { index: target, prev: current.index % count }))
  }

  function tilt(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== 'mouse') return
    const stage = stageRef.current
    if (!stage) return
    const rect = stage.getBoundingClientRect()
    const x = (event.clientX - rect.left) / rect.width - 0.5
    const y = (event.clientY - rect.top) / rect.height - 0.5
    stage.style.setProperty('--ry', `${(x * 16 - 8).toFixed(2)}deg`)
    stage.style.setProperty('--rx', `${(4 - y * 12).toFixed(2)}deg`)
  }

  function resetTilt() {
    stageRef.current?.style.removeProperty('--ry')
    stageRef.current?.style.removeProperty('--rx')
  }

  if (count === 0) {
    return (
      <div className="of-deck is-empty" aria-hidden>
        <div className="of-deck-stage">
          <div className="of-deck-orbit">
            <span />
            <span />
          </div>
          <div className="of-deck-tilt">
            {POSES.map((pose, rel) => (
              <span
                key={rel}
                className="of-deck-card is-ghost"
                style={{
                  '--tx': `${pose.x}px`,
                  '--ty': `${pose.y}px`,
                  '--rot': `${pose.r}deg`,
                  '--sc': pose.s,
                  '--op': pose.o,
                  zIndex: 10 - rel,
                } as CSSProperties}
              >
                <span className="of-deck-ghost-line is-short" />
                <span className="of-deck-ghost-line is-title" />
                <span className="of-deck-ghost-line" />
                <span className="of-deck-ghost-line is-mid" />
              </span>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <section className="of-deck" aria-roledescription="carousel" aria-label={t('offers.deckLabel')}>
      <p className="of-deck-live">
        <span className="of-deck-live-dot" aria-hidden />
        {t('offers.liveNow')}
      </p>

      <div className="of-deck-stage" ref={stageRef} onPointerMove={tilt} onPointerLeave={resetTilt}>
        <div className="of-deck-orbit" aria-hidden>
          <span />
          <span />
        </div>
        <div className="of-deck-tilt">
          {items.map((item, i) => {
            const rel = (i - index + count) % count
            const pose = POSES[rel] ?? HIDDEN_POSE
            const style = {
              '--tx': `${pose.x}px`,
              '--ty': `${pose.y}px`,
              '--rot': `${pose.r}deg`,
              '--sc': pose.s,
              '--op': pose.o,
              zIndex: 10 - rel,
            } as CSSProperties
            return (
              <DeckCard
                key={item.id}
                item={item}
                front={rel === 0}
                leaving={i === state.prev && i !== index}
                style={style}
              />
            )
          })}
          {/* With fewer than three offers, glass blanks keep the fan full */}
          {POSES.slice(count).map((pose, k) => (
            <span
              key={`filler-${k}`}
              className="of-deck-card is-ghost is-filler"
              aria-hidden
              style={{
                '--tx': `${pose.x}px`,
                '--ty': `${pose.y}px`,
                '--rot': `${pose.r}deg`,
                '--sc': pose.s,
                '--op': pose.o,
                zIndex: 10 - count - k,
              } as CSSProperties}
            />
          ))}
        </div>
      </div>

      {count > 1 ? (
        <div className="of-deck-nav">
          <span className="of-deck-counter" aria-hidden>
            <b>{String(index + 1).padStart(2, '0')}</b> / {String(count).padStart(2, '0')}
          </span>
          <div className="of-deck-dots">
            {items.map((item, i) => (
              <button
                key={item.id}
                type="button"
                className={`of-deck-dot${i === index ? ' is-active' : ''}`}
                aria-label={t('offers.deckGoto', { n: i + 1, title: item.title })}
                aria-current={i === index ? 'true' : undefined}
                onClick={() => go(i)}
              >
                <span className="of-deck-dot-bar">
                  {i === index ? <span className="of-deck-dot-fill" onAnimationEnd={() => go(index + 1)} /> : null}
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  )
}
