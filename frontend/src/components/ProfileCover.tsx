import { useState, type CSSProperties } from 'react'
import { defaultCoverGlow, defaultCoverVariant } from './coverVariants'
import './ProfileCover.css'

type Props = {
  /** The account's own cover (already a usable URL). Empty means the default cover. */
  src?: string
  /** Account id (uid) that picks this account's default design. */
  seed: string
  className?: string
}

/**
 * Profile cover for public profiles and the profile editors.
 * The account's designed default always sits underneath, so there is never an empty box: it shows while a custom
 * cover loads (which then fades in), and stays if the custom image is missing or fails to load.
 */
export default function ProfileCover({ src, seed, className }: Props) {
  const glow = defaultCoverGlow(seed)
  const style = { '--kk-glow-x': `${glow.x}%`, '--kk-glow-y': `${glow.y}%`, '--kk-angle': `${glow.angle}deg` } as CSSProperties
  return (
    <div className={`kk-cover${className ? ` ${className}` : ''}`} data-variant={defaultCoverVariant(seed)} style={style}>
      <span className="kk-cover-art" aria-hidden />
      {/* Keyed by URL: a replaced cover starts fresh instead of inheriting the old image's loaded/failed state. */}
      {src ? <CoverImage key={src} src={src} /> : null}
    </div>
  )
}

function CoverImage({ src }: { src: string }) {
  const [state, setState] = useState<'loading' | 'loaded' | 'failed'>('loading')
  if (state === 'failed') return null
  return (
    <img
      className={`kk-cover-img${state === 'loaded' ? ' is-loaded' : ''}`}
      src={src}
      alt=""
      decoding="async"
      onLoad={() => setState('loaded')}
      onError={() => setState('failed')}
    />
  )
}
