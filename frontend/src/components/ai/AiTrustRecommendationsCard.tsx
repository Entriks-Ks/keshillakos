import { useState, useEffect, useCallback, memo } from 'react'
import { Link } from 'react-router-dom'
import {
  Sparkles,
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
      setError('Nuk arritëm të ngarkojmë analizën nga AI.')
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
                <h3 className="kk-ai-recs-title">Siguri Maksimale e Profilit ({data.currentScore}%)</h3>
                <p className="kk-ai-recs-desc">
                  Urime! Profili juaj përmbush të gjitha standardet e larta të besueshmërisë në KëshillaKos.
                </p>
              </div>
            </div>
          </div>
        </div>
      )
    }
    return null
  }

  return (
    <div className={`kk-ai-recs-container ${compact ? 'is-compact' : ''} ${className}`}>
      {/* Header */}
      <div className="kk-ai-recs-head">
        <div className="kk-ai-recs-head-left">
          <div className="kk-ai-recs-badge-icon">
            <Sparkles size={20} />
          </div>
          <div className="kk-ai-recs-title-box">
            <div className="kk-ai-recs-eyebrow">
              <Sparkles size={11} />
              <span>Optimizim nga AI • Besueshmëria & Siguria</span>
            </div>
            <h3 className="kk-ai-recs-title">
              {isCompany || data.isCompany ? 'Këshilla AI për Kompaninë' : 'Këshilla AI për Ofruesin'}
            </h3>
            <p className="kk-ai-recs-desc">
              Hapa konkretë për ta bërë profilin më të sigurt për klientët dhe për të rritur vlerësimin në{' '}
              <strong className="text-emerald-500 font-bold">{data.potentialScore}%</strong>.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void loadData(true)}
          disabled={refreshing}
          className="kk-ai-recs-refresh-btn"
          title="Rifresko analizën me Gemini AI"
          aria-label="Rifresko analizën me AI"
        >
          <RotateCw size={14} className={refreshing ? 'animate-spin' : ''} />
          <span>{refreshing ? 'Duke analizuar...' : 'Rifresko me AI'}</span>
        </button>
      </div>

      {/* Score Gain Banner */}
      <div className="kk-ai-recs-banner">
        <div className="kk-ai-recs-score-group">
          <div className="kk-ai-recs-score-pill current">
            <span className="kk-ai-recs-pill-label">Pikët Aktuale</span>
            <span className="kk-ai-recs-pill-val">{data.currentScore}%</span>
          </div>

          <div className="kk-ai-recs-score-arrow">
            <ArrowRight size={16} />
          </div>

          <div className="kk-ai-recs-score-pill potential">
            <span className="kk-ai-recs-pill-label">Potenciali me AI</span>
            <span className="kk-ai-recs-pill-val">{data.potentialScore}%</span>
          </div>

          {data.potentialGain > 0 && (
            <div className="kk-ai-recs-gain-badge">
              <TrendingUp size={14} />
              <span>+{data.potentialGain}% rritje e sigurisë</span>
            </div>
          )}
        </div>

        {/* Visual Dual Progress Track */}
        <div className="kk-ai-recs-progress-bar">
          <div
            className="kk-ai-recs-progress-current"
            style={{ width: `${data.currentScore}%` }}
            title={`Pikët aktuale: ${data.currentScore}%`}
          />
          <div
            className="kk-ai-recs-progress-gain"
            style={{ width: `${data.potentialGain}%` }}
            title={`Rritje e mundshme: +${data.potentialGain}%`}
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
                          <span>Kritike</span>
                        </>
                      ) : isRecommended ? (
                        <span>E Rekomanduar</span>
                      ) : (
                        <span>Përmirësim</span>
                      )}
                    </span>

                    <span className="kk-ai-rec-impact-pill">{rec.impact}</span>
                  </div>

                  <h4 className="kk-ai-rec-title">{rec.title}</h4>
                  <p className="kk-ai-rec-desc">{rec.description}</p>
                </div>
              </div>

              <div className="kk-ai-rec-action-area">
                <Link to={rec.actionPath} className="kk-ai-rec-action-btn">
                  <span>{rec.actionLabel}</span>
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
