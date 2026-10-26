import { useState, useEffect, memo } from 'react'
import { Modal, Button } from '@heroui/react'
import {
  ShieldCheck,
  Shield,
  AlertCircle,
  Sparkles,
  ChevronRight,
  CheckCircle2,
  Lock,
  Scale,
  Star,
  Briefcase,
  GraduationCap,
  Clock,
  type LucideIcon,
} from 'lucide-react'
import { fetchProviderTrustScore, type ProviderTrustScore } from '../../api/aiChat'
import './AiTrustBadge.css'

interface AiTrustBadgeProps {
  providerUid: string
  providerName?: string
  compact?: boolean
  className?: string
}

const FACTOR_ICONS: Record<string, LucideIcon> = {
  license: Scale,
  reputation: Star,
  services: Briefcase,
  experience: GraduationCap,
  availability: Clock,
}

export const AiTrustBadge = memo(function AiTrustBadge({
  providerUid,
  providerName,
  compact = false,
  className = '',
}: AiTrustBadgeProps) {
  const [data, setData] = useState<ProviderTrustScore | null>(null)
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)

  useEffect(() => {
    if (!providerUid) return

    let isMounted = true
    setLoading(true)

    fetchProviderTrustScore(providerUid)
      .then((score) => {
        if (isMounted) setData(score)
      })
      .catch((err) => {
        console.warn('Could not fetch AI trust score:', err)
      })
      .finally(() => {
        if (isMounted) setLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [providerUid])

  if (loading && !data) {
    return (
      <div className={`kk-ai-trust-compact ${className}`} style={{ opacity: 0.65 }}>
        <ShieldCheck size={15} className="animate-pulse" />
        <span>Duke llogaritur sigurinë nga AI...</span>
      </div>
    )
  }

  if (!data) {
    return null
  }

  const isVeryHigh = data.overallScore >= 90
  const isHigh = data.overallScore >= 75
  const levelClass = isVeryHigh ? 'level-very-high' : isHigh ? 'level-high' : 'level-moderate'
  const Icon = isVeryHigh ? ShieldCheck : isHigh ? Shield : AlertCircle

  // SVG Radial progress calculations (r = 36)
  const radius = 36
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (data.overallScore / 100) * circumference

  return (
    <>
      {compact ? (
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className={`kk-ai-trust-compact ${levelClass} ${className}`}
          title="Kliko për të parë analizën e plotë të sigurisë nga AI"
          aria-label={`Vlerësimi i Sigurisë nga AI: ${data.overallScore}%`}
        >
          <Icon size={15} className="kk-ai-trust-compact-icon" />
          <span className="kk-ai-trust-compact-score">{data.overallScore}%</span>
          <span className="kk-ai-trust-compact-label">Siguri e Punës</span>
        </button>
      ) : (
        <div
          role="button"
          tabIndex={0}
          onClick={() => setModalOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              setModalOpen(true)
            }
          }}
          className={`kk-ai-trust-card ${className}`}
          title="Kliko për të parë faktorët e vlerësimit nga AI"
          aria-label={`Vlerësimi i Sigurisë: ${data.overallScore}%`}
        >
          <div className="kk-ai-trust-card-left">
            <div className="kk-ai-trust-badge-circle">
              <span className="kk-ai-trust-circle-num">{data.overallScore}</span>
              <span className="kk-ai-trust-circle-pct">%</span>
            </div>

            <div className="kk-ai-trust-card-texts">
              <div className="kk-ai-trust-card-title-row">
                <Sparkles size={14} className="text-emerald-500" />
                <h4 className="kk-ai-trust-card-title">Siguria e Punës: {data.safetyLabel}</h4>
              </div>
              <p className="kk-ai-trust-card-subtitle">
                Vlerësuar nga AI në bazë të kërkesave, licencës dhe shërbimeve të postuara
              </p>
            </div>
          </div>

          <div className="kk-ai-trust-card-btn">
            <span>Analiza e AI</span>
            <ChevronRight size={15} />
          </div>
        </div>
      )}

      {/* HeroUI Portaled Modal Dialog */}
      <Modal isOpen={modalOpen} onOpenChange={setModalOpen}>
        <Modal.Backdrop isDismissable>
          <Modal.Container size="md" placement="center">
            <Modal.Dialog
              className="kk-ai-trust-dialog"
              aria-label={`Vlerësimi i Sigurisë • ${data.providerName || providerName}`}
            >
              <Modal.CloseTrigger />
              
              <Modal.Header className="kk-ai-modal-header">
                <div className="kk-ai-modal-header-left">
                  <div className="kk-ai-modal-badge-icon">
                    <ShieldCheck size={24} />
                  </div>
                  <div className="kk-ai-modal-title-area">
                    <div className="kk-ai-modal-eyebrow">
                      <Sparkles size={12} />
                      <span>Këshilla AI • Analizë e Verifikuar</span>
                    </div>
                    <h3 className="kk-ai-modal-main-title">
                      Vlerësimi i Sigurisë • {data.providerName || providerName}
                    </h3>
                  </div>
                </div>
              </Modal.Header>

              <Modal.Body className="kk-ai-modal-body">
                {/* Score Hero Box with Radial Gauge */}
                <div className="kk-ai-hero-score-box">
                  <div className="kk-ai-radial-gauge-container">
                    <svg className="kk-ai-radial-svg" viewBox="0 0 88 88" aria-hidden="true">
                      <circle
                        className="kk-ai-radial-bg"
                        cx="44"
                        cy="44"
                        r={radius}
                        fill="none"
                        strokeWidth="7"
                      />
                      <circle
                        className="kk-ai-radial-meter"
                        cx="44"
                        cy="44"
                        r={radius}
                        fill="none"
                        strokeWidth="7"
                        strokeDasharray={circumference}
                        strokeDashoffset={strokeDashoffset}
                      />
                    </svg>
                    <div className="kk-ai-radial-center">
                      <span className="kk-ai-radial-number">{data.overallScore}</span>
                      <span className="kk-ai-radial-pct">% Siguri</span>
                    </div>
                  </div>

                  <div className="kk-ai-hero-score-texts">
                    <div className="kk-ai-hero-level-pill">
                      <CheckCircle2 size={14} />
                      <span>{data.safetyLabel}</span>
                    </div>
                    <p className="kk-ai-hero-summary-quote">{data.aiSummary}</p>
                  </div>
                </div>

                {/* 5 Factors Breakdown */}
                <div className="kk-ai-factors-section">
                  <div className="kk-ai-section-header">
                    <h4 className="kk-ai-section-title">Zbërthimi i Vlerësimit sipas AI</h4>
                    <span className="kk-ai-section-hint">Pesha totale: 100 pikë</span>
                  </div>

                  <div className="kk-ai-factors-grid">
                    {data.factors.map((factor) => {
                      const FactorIcon = FACTOR_ICONS[factor.key] || Shield
                      return (
                        <div key={factor.key} className="kk-ai-factor-card">
                          <div className="kk-ai-factor-top">
                            <div className="kk-ai-factor-title-group">
                              <div className={`kk-ai-factor-icon-wrap status-${factor.status}`}>
                                <FactorIcon size={16} />
                              </div>
                              <span className="kk-ai-factor-name">{factor.title}</span>
                            </div>

                            <div className="kk-ai-factor-metrics">
                              <span className="kk-ai-factor-score-pill">
                                {factor.score}/{factor.maxScore} pikë
                              </span>
                              <span className="kk-ai-factor-pct">{factor.percentage}%</span>
                            </div>
                          </div>

                          {/* Progress Bar */}
                          <div className="kk-ai-factor-progress-track">
                            <div
                              className={`kk-ai-factor-progress-fill status-${factor.status}`}
                              style={{ width: `${factor.percentage}%` }}
                            />
                          </div>

                          <p className="kk-ai-factor-detail-text">{factor.detail}</p>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Key Guarantees Grid */}
                {data.highlights && data.highlights.length > 0 && (
                  <div className="kk-ai-guarantees-section">
                    <div className="kk-ai-section-header">
                      <h4 className="kk-ai-section-title">Garancitë Kryesore</h4>
                    </div>
                    <div className="kk-ai-guarantees-grid">
                      {data.highlights.map((item, idx) => (
                        <div key={idx} className="kk-ai-guarantee-card">
                          <CheckCircle2 size={16} className="kk-ai-guarantee-icon" />
                          <span>{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Modal.Body>

              <Modal.Footer className="kk-ai-modal-footer">
                <div className="kk-ai-modal-footer-disclaimer">
                  <Lock size={14} className="flex-shrink-0 text-emerald-500" />
                  <span>
                    Vlerësim i paanshëm nga AI bazuar në licencë, kërkesa dhe shërbimet e postuara.
                  </span>
                </div>

                <Button
                  variant="primary"
                  className="kk-ai-modal-confirm-btn"
                  onPress={() => setModalOpen(false)}
                >
                  U kuptua
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </>
  )
})

