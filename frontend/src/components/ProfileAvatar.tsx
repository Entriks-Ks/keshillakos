import type { CSSProperties } from 'react'
import { Avatar } from '@heroui/react'
import { mediaUrl } from '../api/media'
import './ProfileAvatar.css'

export type ProfileAvatarSize = 'sm' | 'md' | 'lg' | 'fill' | number

const DEFAULT_AVATARS = ['blue', 'purple', 'red', 'green', 'orange', 'indigo', 'rose', 'sky', 'emerald']

/** Same seed always maps to the same color, so a profile keeps its avatar everywhere. */
function defaultAvatarUrl(seed?: string | null) {
  let hash = 0
  for (const char of seed ?? '') hash = (hash * 31 + char.charCodeAt(0)) | 0
  return `/avatars/${DEFAULT_AVATARS[Math.abs(hash) % DEFAULT_AVATARS.length]}.jpg`
}

type ProfileAvatarProps = Omit<Avatar['Props'], 'children' | 'size' | 'color' | 'variant'> & {
  /** Stored `/media/...` path, absolute URL or `blob:` preview. */
  src?: string | null
  alt?: string
  /** Stable id (uid) that picks the default avatar color. */
  seed?: string | null
  /** `fill` stretches to the parent frame and inherits its border radius. */
  size?: ProfileAvatarSize
  /** `contain` keeps logos uncropped. */
  fit?: 'cover' | 'contain'
}

/**
 * Profile photo or company logo. When the image is missing or fails to load, HeroUI's
 * fallback shows one of the colored HeroUI default avatars instead of initials or icons.
 */
export default function ProfileAvatar({
  src,
  alt = '',
  seed,
  size = 'md',
  fit = 'cover',
  className,
  style,
  ...props
}: ProfileAvatarProps) {
  const url = mediaUrl(src)
  const isPreset = size === 'sm' || size === 'md' || size === 'lg'
  const classes = [
    'kk-avatar',
    size === 'fill' ? 'kk-avatar--fill' : null,
    typeof size === 'number' ? 'kk-avatar--custom' : null,
    fit === 'contain' ? 'kk-avatar--contain' : null,
    className,
  ]
    .filter(Boolean)
    .join(' ')
  const sizeStyle: CSSProperties | undefined =
    typeof size === 'number' ? { width: size, height: size, ...style } : style

  return (
    <Avatar size={isPreset ? size : undefined} className={classes} style={sizeStyle} {...props}>
      <Avatar.Image src={url || undefined} alt={alt} />
      <Avatar.Fallback>
        <img className="kk-avatar__default" src={defaultAvatarUrl(seed)} alt="" draggable={false} />
      </Avatar.Fallback>
    </Avatar>
  )
}
