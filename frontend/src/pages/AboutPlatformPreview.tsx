import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  Calendar,
  Check,
  Clock,
  FileText,
  MapPin,
  Scale,
  Calculator,
  Sparkles,
  UserCheck,
  Video,
} from 'lucide-react'

type TabKey = 'legal' | 'accounting' | 'ai'

export default function AboutPlatformPreview() {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<TabKey>('legal')
  const [selectedSlot, setSelectedSlot] = useState(0)
  const [deliveryMode, setDeliveryMode] = useState<'office' | 'online'>('online')
  const [activeAiSample, setActiveAiSample] = useState(0)

  const aiSamples = [
    {
      query: t('about.aiSample1'),
      category: t('about.tabAccounting'),
      sub: t('about.accSub3') + ' & ' + t('about.accSub2'),
      matchRate: '98%',
      specialists: 4,
    },
    {
      query: t('about.aiSample2'),
      category: t('about.tabLegal'),
      sub: t('about.legalSub4') + ' & ' + t('about.legalSub1'),
      matchRate: '99%',
      specialists: 6,
    },
    {
      query: t('about.aiSample3'),
      category: t('about.tabLegal'),
      sub: t('about.legalSub5') + ' (Diasporë)',
      matchRate: '97%',
      specialists: 3,
    },
  ]

  const slots = ['Sot · 14:30', 'Nesër · 10:00', 'E Premte · 16:00']

  return (
    <section className="ab-preview" aria-labelledby="about-preview-heading">
      <div className="tt-section-inner">
        <div className="ab-preview-header">
          <p className="ab-kicker">{t('about.previewKicker')}</p>
          <h2 id="about-preview-heading">{t('about.previewTitle')}</h2>
          <p className="ab-section-lead">{t('about.previewLead')}</p>

          {/* Interactive Tab Switcher */}
          <div className="ab-tabs" role="tablist" aria-label={t('about.previewTitle')}>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'legal'}
              aria-controls="tab-panel-legal"
              id="tab-legal"
              className={`ab-tab-btn ${activeTab === 'legal' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('legal')}
            >
              <Scale size={18} aria-hidden />
              <span>{t('about.tabLegal')}</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'accounting'}
              aria-controls="tab-panel-accounting"
              id="tab-accounting"
              className={`ab-tab-btn ${activeTab === 'accounting' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('accounting')}
            >
              <Calculator size={18} aria-hidden />
              <span>{t('about.tabAccounting')}</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'ai'}
              aria-controls="tab-panel-ai"
              id="tab-ai"
              className={`ab-tab-btn ${activeTab === 'ai' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('ai')}
            >
              <Sparkles size={18} aria-hidden />
              <span>{t('about.tabAi')}</span>
            </button>
          </div>
        </div>

        {/* Tab Panels */}
        <div className="ab-preview-content">
          {/* TAB 1: Legal Services */}
          {activeTab === 'legal' && (
            <div
              id="tab-panel-legal"
              role="tabpanel"
              aria-labelledby="tab-legal"
              className="ab-panel-grid"
            >
              <div className="ab-panel-info">
                <h3>{t('about.tabLegal')}</h3>
                <p>{t('about.legalDesc')}</p>

                <div className="ab-sub-chips" aria-label="Nënkategoritë ligjore">
                  <span className="ab-sub-chip">{t('about.legalSub1')}</span>
                  <span className="ab-sub-chip">{t('about.legalSub2')}</span>
                  <span className="ab-sub-chip">{t('about.legalSub3')}</span>
                  <span className="ab-sub-chip">{t('about.legalSub4')}</span>
                  <span className="ab-sub-chip">{t('about.legalSub5')}</span>
                </div>

                <div className="ab-panel-cta-wrap">
                  <Link to="/ofertat" className="ab-preview-link">
                    <span>{t('about.legalCardAction')}</span>
                    <ArrowRight size={16} aria-hidden />
                  </Link>
                </div>
              </div>

              {/* Simulated Interactive Card */}
              <div className="ab-sim-card">
                <div className="ab-sim-badge-row">
                  <span className="ab-badge-primary">
                    <BadgeCheck size={14} />
                    {t('about.legalCardBadge')}
                  </span>
                  <span className="ab-badge-mode">
                    <Video size={13} />
                    Video & Zyrë
                  </span>
                </div>

                <h4 className="ab-sim-title">{t('about.legalCardTitle')}</h4>

                <div className="ab-sim-meta">
                  <span>
                    <MapPin size={14} />
                    {t('about.legalCardMeta')}
                  </span>
                  <span>
                    <Clock size={14} />
                    45 minuta
                  </span>
                </div>

                <ul className="ab-sim-features">
                  <li>
                    <Check size={14} className="ab-check-icon" />
                    <span>{t('about.legalCardFeature1')}</span>
                  </li>
                  <li>
                    <Check size={14} className="ab-check-icon" />
                    <span>{t('about.legalCardFeature2')}</span>
                  </li>
                </ul>

                {/* Interactive slot picker preview */}
                <div className="ab-sim-slots">
                  <span className="ab-slots-label">
                    <Calendar size={14} />
                    Zgjidh orarin e lirë:
                  </span>
                  <div className="ab-slots-row">
                    {slots.map((slot, idx) => (
                      <button
                        key={slot}
                        type="button"
                        className={`ab-slot-pill ${selectedSlot === idx ? 'is-selected' : ''}`}
                        onClick={() => setSelectedSlot(idx)}
                      >
                        {slot}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="ab-sim-footer">
                  <span className="ab-sim-price">Nga €40</span>
                  <Link to="/ofertat" className="ab-sim-btn">
                    Rezervo Konsultë
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Accounting & Business */}
          {activeTab === 'accounting' && (
            <div
              id="tab-panel-accounting"
              role="tabpanel"
              aria-labelledby="tab-accounting"
              className="ab-panel-grid"
            >
              <div className="ab-panel-info">
                <h3>{t('about.tabAccounting')}</h3>
                <p>{t('about.accDesc')}</p>

                <div className="ab-sub-chips" aria-label="Nënkategoritë e kontabilitetit">
                  <span className="ab-sub-chip">{t('about.accSub1')}</span>
                  <span className="ab-sub-chip">{t('about.accSub2')}</span>
                  <span className="ab-sub-chip">{t('about.accSub3')}</span>
                  <span className="ab-sub-chip">{t('about.accSub4')}</span>
                  <span className="ab-sub-chip">{t('about.accSub5')}</span>
                </div>

                <div className="ab-panel-cta-wrap">
                  <Link to="/ofertat" className="ab-preview-link">
                    <span>{t('about.accCardAction')}</span>
                    <ArrowRight size={16} aria-hidden />
                  </Link>
                </div>
              </div>

              {/* Simulated Interactive Card */}
              <div className="ab-sim-card">
                <div className="ab-sim-badge-row">
                  <span className="ab-badge-primary">
                    <Building2 size={14} />
                    {t('about.accCardBadge')}
                  </span>
                  <div className="ab-delivery-toggle">
                    <button
                      type="button"
                      className={`ab-toggle-btn ${deliveryMode === 'office' ? 'is-active' : ''}`}
                      onClick={() => setDeliveryMode('office')}
                    >
                      Në Zyrë
                    </button>
                    <button
                      type="button"
                      className={`ab-toggle-btn ${deliveryMode === 'online' ? 'is-active' : ''}`}
                      onClick={() => setDeliveryMode('online')}
                    >
                      Online
                    </button>
                  </div>
                </div>

                <h4 className="ab-sim-title">{t('about.accCardTitle')}</h4>

                <div className="ab-sim-meta">
                  <span>
                    <MapPin size={14} />
                    {t('about.accCardMeta')}
                  </span>
                  <span>
                    <FileText size={14} />
                    Paketë e Plotë
                  </span>
                </div>

                <ul className="ab-sim-features">
                  <li>
                    <Check size={14} className="ab-check-icon" />
                    <span>{t('about.accCardFeature1')}</span>
                  </li>
                  <li>
                    <Check size={14} className="ab-check-icon" />
                    <span>{t('about.accCardFeature2')}</span>
                  </li>
                </ul>

                <div className="ab-sim-footer">
                  <span className="ab-sim-price">Pako Fillestare</span>
                  <Link to="/ofertat" className="ab-sim-btn">
                    Shiko Ofertën
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Këshilla AI Matching */}
          {activeTab === 'ai' && (
            <div
              id="tab-panel-ai"
              role="tabpanel"
              aria-labelledby="tab-ai"
              className="ab-panel-grid"
            >
              <div className="ab-panel-info">
                <h3>{t('about.tabAi')}</h3>
                <p>{t('about.aiDesc')}</p>

                <div className="ab-ai-samples-group">
                  <span className="ab-samples-title">{t('about.aiPromptLabel')}</span>
                  <div className="ab-samples-list">
                    {aiSamples.map((sample, idx) => (
                      <button
                        key={sample.query}
                        type="button"
                        className={`ab-sample-btn ${activeAiSample === idx ? 'is-active' : ''}`}
                        onClick={() => setActiveAiSample(idx)}
                      >
                        <Sparkles size={14} aria-hidden />
                        <span>“{sample.query}”</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="ab-panel-cta-wrap">
                  <Link to="/ai-asistenti" className="ab-preview-link">
                    <span>{t('about.aiAction')}</span>
                    <ArrowRight size={16} aria-hidden />
                  </Link>
                </div>
              </div>

              {/* Simulated AI Response Card */}
              <div className="ab-sim-card ab-sim-ai-card">
                <div className="ab-ai-head-badge">
                  <Sparkles size={16} />
                  <span>{t('about.aiResponsePrefix')}</span>
                </div>

                <div className="ab-ai-bubble-user">
                  <p>“{aiSamples[activeAiSample].query}”</p>
                </div>

                <div className="ab-ai-bubble-assistant">
                  <div className="ab-ai-match-header">
                    <span className="ab-match-pill">
                      <UserCheck size={14} />
                      {aiSamples[activeAiSample].matchRate} përputhje
                    </span>
                    <span className="ab-match-count">
                      {aiSamples[activeAiSample].specialists} ekspertë të disponueshëm
                    </span>
                  </div>

                  <div className="ab-ai-matched-cat">
                    <strong>{aiSamples[activeAiSample].category}</strong>
                    <span>{aiSamples[activeAiSample].sub}</span>
                  </div>

                  <p className="ab-ai-advice-hint">
                    Kemi identifikuar specialistët e licencuar që mbulojnë këtë fushë në Kosovë dhe
                    me konsultim online nga diaspora.
                  </p>
                </div>

                <div className="ab-sim-footer">
                  <Link to="/ai-asistenti" className="ab-sim-btn is-full">
                    <Sparkles size={16} />
                    {t('about.aiAction')}
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
