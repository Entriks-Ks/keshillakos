import { useEffect, useRef, useState } from 'react'
import {
  BadgeCheck,
  Calendar,
  Calculator,
  CheckCircle2,
  Clock,
  Scale,
  Sparkles,
  TrendingUp,
} from 'lucide-react'

export default function HomeHeroVisual() {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [tilt, setTilt] = useState({ x: 0, y: 0 })
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (prefersReducedMotion || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
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
        transform: `perspective(1100px) rotateX(${tilt.y * -7}deg) rotateY(${tilt.x * 9}deg)`,
      }

  return (
    <div
      ref={containerRef}
      className="hm-visual-wrapper"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      role="img"
      aria-label="Vizual modern që paraqet shërbimet juridike, kontabilitetin dhe përputhjen me Këshilla AI"
    >
      <div className="hm-visual-glow" aria-hidden />

      <div className="hm-visual-scene" style={transformStyle}>
        {/* Isometric grid ground plane */}
        <div className="hm-visual-grid" aria-hidden />

        {/* Central Luminous Core Shield */}
        <div className="hm-visual-core" aria-hidden>
          <div className="hm-core-ring hm-core-ring-1" />
          <div className="hm-core-ring hm-core-ring-2" />
          <div className="hm-core-shield">
            <Sparkles size={28} className="hm-core-sparkle" />
          </div>
        </div>

        {/* Floating Card 1: Top Right - Legal Advisory */}
        <div className="hm-card-3d hm-card-legal">
          <div className="hm-card-top">
            <div className="hm-icon-box hm-icon-legal">
              <Scale size={18} />
            </div>
            <div className="hm-card-info">
              <strong className="hm-card-title">Këshillim Juridik</strong>
              <span className="hm-card-sub">E Drejta Civile & Biznes</span>
            </div>
          </div>
          <div className="hm-card-bottom">
            <span className="hm-badge-verified">
              <BadgeCheck size={13} />
              I Licencuar
            </span>
            <span className="hm-status-online">
              <span className="hm-live-dot" />
              Prishtinë · Online
            </span>
          </div>
        </div>

        {/* Floating Card 2: Bottom Left - Accounting & Finance */}
        <div className="hm-card-3d hm-card-acc">
          <div className="hm-card-top">
            <div className="hm-icon-box hm-icon-acc">
              <Calculator size={18} />
            </div>
            <div className="hm-card-info">
              <strong className="hm-card-title">Kontabilitet & Biznes</strong>
              <span className="hm-card-sub">Regjistrim ARBK & ATK</span>
            </div>
          </div>
          <div className="hm-sparkline-row">
            <svg viewBox="0 0 140 32" fill="none" className="hm-sparkline-svg">
              <path
                d="M4 26 C 25 24, 45 28, 65 16 C 85 4, 105 14, 136 4"
                stroke="#38bdf8"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              <path
                d="M4 26 C 25 24, 45 28, 65 16 C 85 4, 105 14, 136 4 L 136 32 L 4 32 Z"
                fill="url(#accSparkGrad)"
                opacity="0.3"
              />
              <defs>
                <linearGradient id="accSparkGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#38bdf8" />
                  <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
                </linearGradient>
              </defs>
            </svg>
            <span className="hm-trend-label">
              <TrendingUp size={12} />
              +100% Pajtueshmëri
            </span>
          </div>
        </div>

        {/* Floating Card 3: Bottom Right - Këshilla AI Matcher */}
        <div className="hm-card-3d hm-card-ai">
          <div className="hm-card-top">
            <div className="hm-icon-box hm-icon-ai">
              <Sparkles size={18} />
            </div>
            <div className="hm-card-info">
              <strong className="hm-card-title">Këshilla AI</strong>
              <span className="hm-card-badge-ai">Matching Inteligjent</span>
            </div>
          </div>
          <div className="hm-ai-mini-preview">
            <div className="hm-ai-bars" aria-hidden>
              <span />
              <span />
              <span />
              <span />
              <span />
            </div>
            <p className="hm-ai-query">“Pyetje: Hapje e degës në Kosovë”</p>
          </div>
        </div>

        {/* Floating Card 4: Top Left - Booking & Calendar */}
        <div className="hm-card-3d hm-card-calendar">
          <div className="hm-card-top">
            <div className="hm-icon-box hm-icon-cal">
              <Calendar size={18} />
            </div>
            <div className="hm-card-info">
              <strong className="hm-card-title">Caktim Takimesh</strong>
              <span className="hm-card-sub">Orar i Drejtpërdrejtë</span>
            </div>
          </div>
          <div className="hm-cal-bottom">
            <span className="hm-cal-tag">
              <Clock size={12} />
              Konsultë 45 min
            </span>
            <span className="hm-cal-check">
              <CheckCircle2 size={13} />
              Konfirmim i shpejtë
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
