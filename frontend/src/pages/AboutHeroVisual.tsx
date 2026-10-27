import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  BadgeCheck,
  Calculator,
  Globe,
  Scale,
  Sparkles,
  TrendingUp,
} from 'lucide-react'

export default function AboutHeroVisual() {
  const { t } = useTranslation()
  const stageRef = useRef<HTMLDivElement | null>(null)
  const [tilt, setTilt] = useState({ x: 0, y: 0 })
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setPrefersReducedMotion(mq.matches)
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (prefersReducedMotion || !stageRef.current) return
    const rect = stageRef.current.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1
    const y = ((e.clientY - rect.top) / rect.height) * 2 - 1
    setTilt({
      x: Math.max(-1, Math.min(1, x)),
      y: Math.max(-1, Math.min(1, y)),
    })
  }

  function handleMouseLeave() {
    setTilt({ x: 0, y: 0 })
  }

  const transformStyle = prefersReducedMotion
    ? undefined
    : {
        transform: `perspective(1200px) rotateX(${tilt.y * -8}deg) rotateY(${tilt.x * 10}deg)`,
      }

  return (
    <div
      ref={stageRef}
      className="ab-visual-stage"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      role="img"
      aria-label="Vizual 3D interaktiv që përfaqëson këshillimin ligjor, kontabilitetin dhe asistentin inteligjent Këshilla AI"
    >
      {/* Ambient background glows */}
      <div className="ab-visual-ambient" aria-hidden />

      {/* 3D Transform Container */}
      <div className="ab-visual-scene" style={transformStyle}>
        {/* Isometric grid ground plane */}
        <div className="ab-visual-grid" aria-hidden />

        {/* Central 3D Knowledge Beacon & Gyroscope Rings */}
        <div className="ab-visual-beacon" aria-hidden>
          <svg
            className="ab-visual-gyro"
            viewBox="0 0 500 500"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <linearGradient id="gyroGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.8" />
                <stop offset="50%" stopColor="#0a21c0" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#818cf8" stopOpacity="0.8" />
              </linearGradient>
              <linearGradient id="gyroGrad2" x1="100%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.7" />
                <stop offset="100%" stopColor="#4f46e5" stopOpacity="0.2" />
              </linearGradient>
              <radialGradient id="coreGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.9" />
                <stop offset="40%" stopColor="#2563eb" stopOpacity="0.5" />
                <stop offset="70%" stopColor="#0a21c0" stopOpacity="0.2" />
                <stop offset="100%" stopColor="#050a44" stopOpacity="0" />
              </radialGradient>
              <filter id="glowFilter" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="10" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Connecting data conduits to cards */}
            <path
              d="M250 250 Q160 180 100 120"
              stroke="url(#gyroGrad1)"
              strokeWidth="2"
              strokeDasharray="6 6"
              className="ab-path-flow"
            />
            <path
              d="M250 250 Q360 170 410 110"
              stroke="url(#gyroGrad1)"
              strokeWidth="2"
              strokeDasharray="6 6"
              className="ab-path-flow"
            />
            <path
              d="M250 250 Q150 330 90 380"
              stroke="url(#gyroGrad2)"
              strokeWidth="2"
              strokeDasharray="6 6"
              className="ab-path-flow"
            />
            <path
              d="M250 250 Q360 340 420 370"
              stroke="url(#gyroGrad2)"
              strokeWidth="2"
              strokeDasharray="6 6"
              className="ab-path-flow"
            />

            {/* Concentric orbital rings */}
            <ellipse
              cx="250"
              cy="250"
              rx="210"
              ry="95"
              stroke="url(#gyroGrad1)"
              strokeWidth="1.5"
              className="ab-ring ab-ring-1"
            />
            <ellipse
              cx="250"
              cy="250"
              rx="170"
              ry="75"
              stroke="url(#gyroGrad2)"
              strokeWidth="1.2"
              strokeDasharray="8 6"
              className="ab-ring ab-ring-2"
            />
            <ellipse
              cx="250"
              cy="250"
              rx="125"
              ry="55"
              stroke="#38bdf8"
              strokeWidth="1.5"
              strokeOpacity="0.6"
              className="ab-ring ab-ring-3"
            />

            {/* Glowing core sphere */}
            <circle cx="250" cy="250" r="54" fill="url(#coreGlow)" filter="url(#glowFilter)" />
            <circle cx="250" cy="250" r="28" fill="#1e3a8a" stroke="#60a5fa" strokeWidth="2" />
            <circle cx="242" cy="242" r="8" fill="#93c5fd" fillOpacity="0.8" />
          </svg>

          {/* Central Beacon Sparkle Badge */}
          <div className="ab-beacon-badge">
            <Sparkles size={20} className="ab-sparkle-spin" />
            <span>KeshillaKos</span>
          </div>
        </div>

        {/* Floating 3D Card 1: Top-Right (Legal Services) */}
        <div className="ab-card-3d ab-card-legal">
          <div className="ab-card-header">
            <div className="ab-card-icon ab-icon-legal">
              <Scale size={18} />
            </div>
            <div className="ab-card-meta">
              <span className="ab-card-title">{t('about.heroCardLegal')}</span>
              <span className="ab-card-sub">{t('about.heroCardLegalSub')}</span>
            </div>
          </div>
          <div className="ab-card-footer">
            <span className="ab-tag-verified">
              <BadgeCheck size={14} />
              {t('about.heroCardLegalBadge')}
            </span>
            <span className="ab-status-dot">
              <span className="ab-dot" />
              {t('about.heroCardLegalCity')}
            </span>
          </div>
        </div>

        {/* Floating 3D Card 2: Bottom-Left (Accounting & Business) */}
        <div className="ab-card-3d ab-card-acc">
          <div className="ab-card-header">
            <div className="ab-card-icon ab-icon-acc">
              <Calculator size={18} />
            </div>
            <div className="ab-card-meta">
              <span className="ab-card-title">{t('about.heroCardAcc')}</span>
              <span className="ab-card-sub">{t('about.heroCardAccSub')}</span>
            </div>
          </div>
          {/* Mini Sparkline Chart */}
          <div className="ab-card-chart">
            <svg viewBox="0 0 160 38" fill="none" className="ab-sparkline">
              <path
                d="M4 32 C 30 28, 45 34, 70 20 C 95 6, 120 18, 156 4"
                stroke="#38bdf8"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              <path
                d="M4 32 C 30 28, 45 34, 70 20 C 95 6, 120 18, 156 4 L 156 38 L 4 38 Z"
                fill="url(#sparkGrad)"
                opacity="0.3"
              />
              <defs>
                <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#38bdf8" />
                  <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
                </linearGradient>
              </defs>
            </svg>
            <span className="ab-chart-stat">
              <TrendingUp size={12} />
              {t('about.heroCardAccStat')}
            </span>
          </div>
        </div>

        {/* Floating 3D Card 3: Bottom-Right (Këshilla AI Matcher) */}
        <div className="ab-card-3d ab-card-ai">
          <div className="ab-card-header">
            <div className="ab-card-icon ab-icon-ai">
              <Sparkles size={18} />
            </div>
            <div className="ab-card-meta">
              <span className="ab-card-title">{t('about.heroCardAi')}</span>
              <span className="ab-card-badge-ai">{t('about.heroCardAiStatus')}</span>
            </div>
          </div>
          <div className="ab-ai-preview">
            <div className="ab-ai-waveform" aria-hidden>
              <span />
              <span />
              <span />
              <span />
              <span />
            </div>
            <p className="ab-ai-prompt">{t('about.heroCardAiPrompt')}</p>
          </div>
        </div>

        {/* Floating 3D Card 4: Top-Left (Diaspora & Cross-Border) */}
        <div className="ab-card-3d ab-card-diaspora">
          <div className="ab-card-header">
            <div className="ab-card-icon ab-icon-diaspora">
              <Globe size={18} />
            </div>
            <div className="ab-card-meta">
              <span className="ab-card-title">{t('about.heroCardDiaspora')}</span>
              <span className="ab-card-sub">{t('about.heroCardDiasporaSub')}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
