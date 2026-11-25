import { useState, useEffect, useCallback, memo } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation, Trans } from 'react-i18next'
import {
  RotateCw,
  TrendingUp,
  Scale,
  Briefcase,
  GraduationCap,
  Clock,
  Star,
  Users,
  ShieldCheck,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  type LucideIcon,
  BadgeCheck,
} from 'lucide-react'
import {
  fetchProviderTrustRecommendations,
  type ProviderTrustRecommendationsResponse,
  type TrustRecommendation,
} from '../../api/aiChat'
import './AiTrustRecommendationsCard.css'

interface AiTrustRecommendationsCardProps {
  providerUid?: string
  isCompany?: boolean
  className?: string
  compact?: boolean
}

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  license: Scale,
  services: Briefcase,
  experience: GraduationCap,
  availability: Clock,
  reputation: Star,
  team: Users,
  profile: ShieldCheck,
}

export const AiTrustRecommendationsCard = memo(function AiTrustRecommendationsCard({
  providerUid,
  isCompany = false,
  className = '',
  compact = false,
}: AiTrustRecommendationsCardProps) {
  const { t } = useTranslation()
  const [data, setData] = useState<ProviderTrustRecommendationsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError(null)

    try {
      const response = await fetchProviderTrustRecommendations(providerUid, {
        refresh: isRefresh,
      })
      setData(response)
    } catch (err) {
      console.warn('Could not load AI trust recommendations:', err)
      setError('ai.recs.loadError')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [providerUid])

  useEffect(() => {
    void loadData(false)
  }, [loadData])

  if (loading && !data) {
    return (
      <div className={`kk-ai-recs-container kk-ai-recs-loading ${className}`}>
        <div className="kk-ai-recs-skel-header">
          <div className="kk-ai-recs-skel-icon" />
          <div className="kk-ai-recs-skel-lines">
            <div className="kk-ai-recs-skel-line" style={{ width: '40%' }} />
            <div className="kk-ai-recs-skel-line" style={{ width: '70%' }} />
          </div>
        </div>
        <div className="kk-ai-recs-skel-card" />
        <div className="kk-ai-recs-skel-card" />
      </div>
    )
  }

  if (error && !data) {
    return null
  }

  if (!data || data.recommendations.length === 0) {
    if (data && data.currentScore >= 95) {
      return (
        <div className={`kk-ai-recs-container kk-ai-recs-max ${className}`}>
          <div className="kk-ai-recs-head">
            <div className="kk-ai-recs-head-left">
              <div className="kk-ai-recs-badge-icon status-max">
                <CheckCircle2 size={22} />
              </div>
              <div>
                <h3 className="kk-ai-recs-title">{t('ai.recs.maxTitle', { score: data.currentScore })}</h3>
                <p className="kk-ai-recs-desc">{t('ai.recs.maxDesc')}</p>
              </div>
            </div>
          </div>
        </div>
      )
    }
    return null
  }

  const companyView = isCompany || data.isCompany
  // Backend recommendation copy is Albanian only; translate known ids and fall back to its text.
  const recText = (rec: TrustRecommendation, field: 'title' | 'description' | 'action') => {
    const fallback = field === 'action' ? rec.actionLabel : rec[field]
    const variant = rec.id === 'verify_license' && data.isCompany && field !== 'action' ? `${field}Company` : field
    return t(`ai.recs.items.${rec.id}.${variant}`, { defaultValue: fallback })
  }

  return (
    <div className={`kk-ai-recs-container ${compact ? 'is-compact' : ''} ${className}`}>
      {/* Header */}
      <div className="kk-ai-recs-head">
        <div className="kk-ai-recs-head-left">
          <div className="kk-ai-recs-badge-icon">
            <ShieldCheck size={20} />
          </div>
          <div className="kk-ai-recs-title-box">
            <div className="kk-ai-recs-eyebrow">
              <BadgeCheck size={11} />
              <span>{t('ai.recs.eyebrow')}</span>
            </div>
            <h3 className="kk-ai-recs-title">
              {companyView ? t('ai.recs.titleCompany') : t('ai.recs.titleProvider')}
            </h3>
            <p className="kk-ai-recs-desc">
              <Trans
                i18nKey="ai.recs.desc"
                values={{ score: data.potentialScore }}
                components={{ strong: <strong className="text-emerald-500 font-bold" /> }}
              />
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void loadData(true)}
          disabled={refreshing}
          className="kk-ai-recs-refresh-btn"
          title={t('ai.recs.refreshTitle')}
          aria-label={t('ai.recs.refreshAria')}
        >
          <RotateCw size={14} className={refreshing ? 'animate-spin' : ''} />
          <span>{refreshing ? t('ai.recs.analyzing') : t('ai.recs.refresh')}</span>
        </button>
      </div>

      {/* Score Gain Banner */}
      <div className="kk-ai-recs-banner">
        <div className="kk-ai-recs-score-group">
          <div className="kk-ai-recs-score-pill current">
            <span className="kk-ai-recs-pill-label">{t('ai.recs.current')}</span>
            <span className="kk-ai-recs-pill-val">{data.currentScore}%</span>
          </div>

          <div className="kk-ai-recs-score-arrow">
            <ArrowRight size={16} />
          </div>

          <div className="kk-ai-recs-score-pill potential">
            <span className="kk-ai-recs-pill-label">{t('ai.recs.potential')}</span>
            <span className="kk-ai-recs-pill-val">{data.potentialScore}%</span>
          </div>

          {data.potentialGain > 0 && (
            <div className="kk-ai-recs-gain-badge">
              <TrendingUp size={14} />
              <span>{t('ai.recs.gain', { gain: data.potentialGain })}</span>
            </div>
          )}
        </div>

        {/* Visual Dual Progress Track */}
        <div className="kk-ai-recs-progress-bar">
          <div
            className="kk-ai-recs-progress-current"
            style={{ width: `${data.currentScore}%` }}
            title={t('ai.recs.currentTitle', { score: data.currentScore })}
          />
          <div
            className="kk-ai-recs-progress-gain"
            style={{ width: `${data.potentialGain}%` }}
            title={t('ai.recs.gainTitle', { gain: data.potentialGain })}
          />
        </div>
      </div>

      {/* AI Strategic Insight Quote */}
      {data.aiInsight && (
        <div className="kk-ai-recs-insight-quote">
          <div className="kk-ai-recs-insight-icon">
            <Lightbulb size={17} />
          </div>
          <p className="kk-ai-recs-insight-text">{data.aiInsight}</p>
        </div>
      )}

      {/* Recommendations Cards List */}
      <div className="kk-ai-recs-list">
        {data.recommendations.map((rec: TrustRecommendation) => {
          const Icon = CATEGORY_ICONS[rec.category] || ShieldCheck
          const isCritical = rec.priority === 'critical'
          const isRecommended = rec.priority === 'recommended'

          return (
            <div key={rec.id} className={`kk-ai-rec-card priority-${rec.priority}`}>
              <div className="kk-ai-rec-left">
                <div className={`kk-ai-rec-icon-wrap priority-${rec.priority}`}>
                  <Icon size={18} />
                </div>

                <div className="kk-ai-rec-body">
                  <div className="kk-ai-rec-top-row">
                    <span className={`kk-ai-rec-priority-tag priority-${rec.priority}`}>
                      {isCritical ? (
                        <>
                          <AlertTriangle size={11} />
                          <span>{t('ai.recs.priority.critical')}</span>
                        </>
                      ) : isRecommended ? (
                        <span>{t('ai.recs.priority.recommended')}</span>
                      ) : (
                        <span>{t('ai.recs.priority.optional')}</span>
                      )}
                    </span>

                    <span className="kk-ai-rec-impact-pill">
                      {typeof rec.impactPoints === 'number'
                        ? t('ai.recs.impact', { count: rec.impactPoints })
                        : rec.impact}
                    </span>
                  </div>

                  <h4 className="kk-ai-rec-title">{recText(rec, 'title')}</h4>
                  <p className="kk-ai-rec-desc">{recText(rec, 'description')}</p>
                </div>
              </div>

              <div className="kk-ai-rec-action-area">
                <Link to={rec.actionPath} className="kk-ai-rec-action-btn">
                  <span>{recText(rec, 'action')}</span>
                  <ArrowRight size={14} />
                </Link>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
})
