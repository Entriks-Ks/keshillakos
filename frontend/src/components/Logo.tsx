import { type SVGProps } from 'react'

export interface LogoMarkProps extends SVGProps<SVGSVGElement> {
  size?: number | string
  className?: string
  variant?: 'color' | 'white' | 'monochrome' | 'app'
}

/**
 * Official keshillohu Concept 17 symbol:
 * Interlaced ribbon loop with dimensional blue shading and deep navy anchor.
 * Evokes the question that opens everything into guidance, clarity, and resolve.
 */
export function LogoMark({
  size = 32,
  className = '',
  variant = 'color',
  style,
  ...props
}: LogoMarkProps) {
  if (variant === 'app') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 512 512"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        aria-hidden="true"
        style={{ flexShrink: 0, display: 'block', borderRadius: '22%', overflow: 'hidden', ...style }}
        {...props}
      >
        <defs>
          <radialGradient id="kk-app-glow" cx="50%" cy="50%" r="55%">
            <stop offset="0%" stopColor="#1d3278" />
            <stop offset="65%" stopColor="#080e2a" />
            <stop offset="100%" stopColor="#030514" />
          </radialGradient>
        </defs>
        <rect width="512" height="512" rx="114" fill="url(#kk-app-glow)" />
        <image
          href="/brand/keshillohu-glyph.png"
          x="156"
          y="76"
          width="200"
          height="360"
          preserveAspectRatio="xMidYMid meet"
        />
      </svg>
    )
  }

  const glyphSrc = variant === 'monochrome'
    ? '/brand/keshillohu-monochrome.png'
    : '/brand/keshillohu-glyph.png'

  // Glyph natural aspect ratio is 455:824 (~0.552)
  const numericHeight = typeof size === 'number' ? size : parseFloat(String(size)) || 32
  const calcWidth = typeof size === 'number' ? Math.round(numericHeight * (455 / 824)) : undefined

  return (
    <svg
      width={calcWidth ?? size}
      height={size}
      viewBox="0 0 455 824"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`kk-logo-mark ${className}`.trim()}
      aria-hidden="true"
      style={{ flexShrink: 0, display: 'block', ...style }}
      {...props}
    >
      <image
        href={glyphSrc}
        x="0"
        y="0"
        width="455"
        height="824"
        preserveAspectRatio="xMidYMid meet"
      />
    </svg>
  )
}

export interface LogoWordmarkProps extends SVGProps<SVGSVGElement> {
  height?: number | string
  className?: string
  variant?: 'auto' | 'light' | 'white'
}

/**
 * Official keshillohu Concept 17 wordmark:
 * Crisp, geometric lowercase lettering matching the master identity.
 * Automatically adapts between deep brand navy in light mode and pure white in dark mode.
 */
export function LogoWordmark({
  height = 22,
  className = '',
  variant = 'auto',
  style,
  ...props
}: LogoWordmarkProps) {
  // Wordmark natural aspect ratio is 488:88 (~5.545)
  const numericHeight = typeof height === 'number' ? height : parseFloat(String(height)) || 22
  const calcWidth = typeof height === 'number' ? Math.round(numericHeight * (488 / 88)) : undefined

  return (
    <svg
      width={calcWidth}
      height={height}
      viewBox="0 0 488 88"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`kk-logo-wordmark ${className}`.trim()}
      aria-hidden="true"
      style={{ display: 'block', height, width: calcWidth ?? 'auto', flexShrink: 0, ...style }}
      {...props}
    >
      {variant === 'white' ? (
        <image
          href="/brand/keshillohu-wordmark-white.png"
          x="0"
          y="0"
          width="488"
          height="88"
          preserveAspectRatio="xMidYMid meet"
        />
      ) : variant === 'light' ? (
        <image
          href="/brand/keshillohu-wordmark.png"
          x="0"
          y="0"
          width="488"
          height="88"
          preserveAspectRatio="xMidYMid meet"
        />
      ) : (
        <>
          <image
            href="/brand/keshillohu-wordmark.png"
            x="0"
            y="0"
            width="488"
            height="88"
            preserveAspectRatio="xMidYMid meet"
            className="kk-wordmark-light"
          />
          <image
            href="/brand/keshillohu-wordmark-white.png"
            x="0"
            y="0"
            width="488"
            height="88"
            preserveAspectRatio="xMidYMid meet"
            className="kk-wordmark-dark"
          />
        </>
      )}
    </svg>
  )
}

export interface LogoProps {
  markSize?: number | string
  wordmarkHeight?: number | string
  showText?: boolean
  className?: string
  textClassName?: string
  variant?: 'color' | 'white' | 'monochrome'
}

/**
 * Combined logo (Concept 17 Symbol + Wordmark).
 */
export function Logo({
  markSize = 34,
  wordmarkHeight,
  showText = true,
  className = '',
  textClassName = '',
  variant = 'color',
}: LogoProps) {
  const resolvedWordmarkHeight =
    wordmarkHeight ?? (typeof markSize === 'number' ? Math.round(markSize * 0.65) : 22)

  return (
    <span
      className={`kk-brand-lockup ${className}`.trim()}
      style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}
    >
      <LogoMark size={markSize} variant={variant} />
      {showText && (
        <LogoWordmark
          height={resolvedWordmarkHeight}
          className={textClassName}
          variant={variant === 'white' ? 'white' : 'auto'}
        />
      )}
    </span>
  )
}

export interface LogoImageProps {
  height?: number | string
  variant?: 'light' | 'dark'
  className?: string
  alt?: string
}

/**
 * Standalone raster horizontal logo (Concept 17 master crop with alpha transparency).
 */
export function LogoImage({
  height = 32,
  variant = 'light',
  className = '',
  alt = 'keshillohu',
}: LogoImageProps) {
  const src = variant === 'dark'
    ? '/brand/keshillohu-logo-dark.png'
    : '/brand/keshillohu-logo-light.png'
  return (
    <img
      src={src}
      alt={alt}
      height={height}
      className={`kk-logo-image ${className}`.trim()}
      style={{ height, width: 'auto', display: 'block', objectFit: 'contain' }}
    />
  )
}

export default Logo
