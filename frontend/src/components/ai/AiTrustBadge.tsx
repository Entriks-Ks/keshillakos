import { useState, useEffect, memo } from 'react'
import { Modal, Button } from '@heroui/react'
import { useTranslation } from 'react-i18next'
import {
  ShieldCheck,
  Shield,
  AlertCircle,
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
  const { t } = useTranslation()
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
        <span>{t('ai.trust.loading')}</span>
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
  // The backend sends Albanian labels; translate the known enum/keys and fall back to its text.
  const safetyLabel = t(`ai.trust.level.${data.safetyLevel}`, { defaultValue: data.safetyLabel })
  const name = data.providerName || providerName || ''

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
          title={t('ai.trust.compactTitle')}
          aria-label={t('ai.trust.compactAria', { score: data.overallScore })}
        >
          <Icon size={15} className="kk-ai-trust-compact-icon" />
          <span className="kk-ai-trust-compact-score">{data.overallScore}%</span>
          <span className="kk-ai-trust-compact-label">{t('ai.trust.compactLabel')}</span>
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
          title={t('ai.trust.cardTitle')}
          aria-label={t('ai.trust.cardAria', { score: data.overallScore })}
        >
          <div className="kk-ai-trust-card-top">
            <div className="kk-ai-trust-card-left">
              <div className="kk-ai-trust-badge-circle">
                <span className="kk-ai-trust-circle-num">{data.overallScore}</span>
                <span className="kk-ai-trust-circle-pct">%</span>
              </div>

              <div className="kk-ai-trust-card-texts">
                <div className="kk-ai-trust-card-title-row">
                  <ShieldCheck size={13} className="kk-ai-trust-sparkle" />
                  <h4 className="kk-ai-trust-card-title">{t('ai.trust.title')}</h4>
                  <span className={`kk-ai-trust-level-pill ${levelClass}`}>{safetyLabel}</span>
                </div>
                <p className="kk-ai-trust-card-subtitle">{t('ai.trust.subtitle')}</p>
              </div>
            </div>

            <div className="kk-ai-trust-card-btn">
              <span>{t('ai.trust.analysis')}</span>
              <ChevronRight size={14} />
            </div>
          </div>

          <div className="kk-ai-trust-card-cta">
            <span>{t('ai.trust.viewFull')}</span>
            <ChevronRight size={14} />
          </div>
        </div>
      )}

      {/* HeroUI Portaled Modal Dialog */}
      <Modal isOpen={modalOpen} onOpenChange={setModalOpen}>
        <Modal.Backdrop isDismissable>
          <Modal.Container size="md" placement="center">
            <Modal.Dialog
              className="kk-ai-trust-dialog"
              aria-label={t('ai.trust.modalTitle', { name })}
            >
              <Modal.CloseTrigger />
              
              <Modal.Header className="kk-ai-modal-header">
                <div className="kk-ai-modal-header-left">
                  <div className="kk-ai-modal-badge-icon">
                    <ShieldCheck size={24} />
                  </div>
                  <div className="kk-ai-modal-title-area">
                    <div className="kk-ai-modal-eyebrow">
                      <ShieldCheck size={12} />
                      <span>{t('ai.trust.eyebrow')}</span>
                    </div>
                    <h3 className="kk-ai-modal-main-title">{t('ai.trust.modalTitle', { name })}</h3>
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
                      <span className="kk-ai-radial-pct">{t('ai.trust.pctSafety')}</span>
                    </div>
                  </div>

                  <div className="kk-ai-hero-score-texts">
                    <div className="kk-ai-hero-level-pill">
                      <CheckCircle2 size={14} />
                      <span>{safetyLabel}</span>
                    </div>
                    <p className="kk-ai-hero-summary-quote">{data.aiSummary}</p>
                  </div>
                </div>

                {/* 5 Factors Breakdown */}
                <div className="kk-ai-factors-section">
                  <div className="kk-ai-section-header">
                    <h4 className="kk-ai-section-title">{t('ai.trust.breakdown')}</h4>
                    <span className="kk-ai-section-hint">{t('ai.trust.totalWeight')}</span>
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
                              <span className="kk-ai-factor-name">
                                {t(`ai.trust.factors.${factor.key}`, { defaultValue: factor.title })}
                              </span>
                            </div>

                            <div className="kk-ai-factor-metrics">
                              <span className="kk-ai-factor-score-pill">
                                {t('ai.trust.factorPoints', { score: factor.score, max: factor.maxScore })}
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
                      <h4 className="kk-ai-section-title">{t('ai.trust.guarantees')}</h4>
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
                  <span>{t('ai.trust.disclaimer')}</span>
                </div>

                <Button
                  variant="primary"
                  className="kk-ai-modal-confirm-btn"
                  onPress={() => setModalOpen(false)}
                >
                  {t('ai.trust.gotIt')}
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </>
  )
})

