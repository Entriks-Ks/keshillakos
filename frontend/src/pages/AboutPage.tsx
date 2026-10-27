import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  Eye,
  Globe,
  Layers,
  MessageSquareLock,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  UserPlus,
} from 'lucide-react'
import SiteFooter from '../components/SiteFooter'
import SiteNav from '../components/SiteNav'
import AboutHeroVisual from './AboutHeroVisual'
import AboutPlatformPreview from './AboutPlatformPreview'
import './AboutPage.css'

export default function AboutPage() {
  const { t, i18n } = useTranslation()

  useEffect(() => {
    document.title = t('about.metaTitle')
  }, [t, i18n.language])

  return (
    <div className="tt-shell tt-home">
      <SiteNav />

      <main className="ab">
        {/* HERO SECTION */}
        <section className="ab-hero" aria-labelledby="about-hero-heading">
          <div className="tt-section-inner ab-hero-grid">
            <div className="ab-hero-copy">
              <div className="ab-kicker-badge">
                <Sparkles size={14} className="ab-kicker-icon" aria-hidden />
                <span>{t('about.kicker')}</span>
              </div>

              <h1 id="about-hero-heading" className="ab-hero-title">
                {t('about.title')}
                <span className="ab-title-gradient">{t('about.titleEm')}</span>
              </h1>

              <p className="ab-lead">{t('about.lead')}</p>

              <div className="ab-actions">
                <Link to="/ofertat" className="ab-btn ab-btn-primary">
                  <span>{t('about.ctaExplore')}</span>
                  <ArrowRight size={18} aria-hidden />
                </Link>
                <Link to="/ai-asistenti" className="ab-btn ab-btn-ai">
                  <Sparkles size={16} aria-hidden />
                  <span>{t('about.ctaAi')}</span>
                </Link>
                <Link to="/register" className="ab-btn ab-btn-ghost">
                  <span>{t('about.ctaBecome')}</span>
                </Link>
              </div>

              {/* Trust highlights under Hero CTAs */}
              <div className="ab-hero-pills" aria-label="Karakteristikat kryesore">
                <div className="ab-hero-pill">
                  <BadgeCheck size={16} className="ab-pill-icon" aria-hidden />
                  <span>{t('about.pillVerified')}</span>
                </div>
                <div className="ab-hero-pill">
                  <Globe size={16} className="ab-pill-icon" aria-hidden />
                  <span>{t('about.pillDiaspora')}</span>
                </div>
                <div className="ab-hero-pill">
                  <ShieldCheck size={16} className="ab-pill-icon" aria-hidden />
                  <span>{t('about.pillCalm')}</span>
                </div>
              </div>
            </div>

            {/* Original 3D-Style Animated Visual */}
            <div className="ab-hero-visual-col">
              <AboutHeroVisual />
            </div>
          </div>
        </section>

        {/* OUR STORY SECTION */}
        <section className="ab-story-section" aria-labelledby="about-story-heading">
          <div className="tt-section-inner">
            <div className="ab-section-head">
              <p className="ab-kicker">{t('about.storyKicker')}</p>
              <h2 id="about-story-heading">{t('about.storyTitle')}</h2>
              <p className="ab-section-lead">{t('about.storyLead')}</p>
            </div>

            <div className="ab-story-grid">
              {/* Authentic Narrative Text */}
              <div className="ab-story-narrative">
                <p>{t('about.storyP1')}</p>
                <p>{t('about.storyP2')}</p>
                <blockquote className="ab-story-quote">
                  <p>{t('about.storyQuote')}</p>
                </blockquote>
              </div>

              {/* Real Problem Solved Comparison */}
              <div className="ab-story-contrast">
                <div className="ab-contrast-card is-before">
                  <div className="ab-contrast-header">
                    <span className="ab-contrast-tag">{t('about.beforeTitle')}</span>
                  </div>
                  <ul className="ab-contrast-list">
                    <li>{t('about.before1')}</li>
                    <li>{t('about.before2')}</li>
                    <li>{t('about.before3')}</li>
                  </ul>
                </div>

                <div className="ab-contrast-card is-after">
                  <div className="ab-contrast-header">
                    <span className="ab-contrast-tag">{t('about.afterTitle')}</span>
                  </div>
                  <ul className="ab-contrast-list">
                    <li>{t('about.after1')}</li>
                    <li>{t('about.after2')}</li>
                    <li>{t('about.after3')}</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* MISSION & VISION IN TWO ELEGANT CARDS */}
        <section className="ab-mv-section" aria-labelledby="about-mv-heading">
          <div className="tt-section-inner">
            <div className="ab-section-head">
              <p className="ab-kicker">{t('about.mvKicker')}</p>
              <h2 id="about-mv-heading">{t('about.mvTitle')}</h2>
            </div>

            <div className="ab-mv-cards">
              {/* Mission Card */}
              <article className="ab-mv-card is-mission">
                <div className="ab-mv-card-header">
                  <div className="ab-mv-icon-wrap" aria-hidden>
                    <Target size={24} />
                  </div>
                  <span className="ab-mv-tag">{t('about.missionTag')}</span>
                </div>
                <h3>{t('about.missionTitle')}</h3>
                <p>{t('about.missionText')}</p>
              </article>

              {/* Vision Card */}
              <article className="ab-mv-card is-vision">
                <div className="ab-mv-card-header">
                  <div className="ab-mv-icon-wrap" aria-hidden>
                    <Eye size={24} />
                  </div>
                  <span className="ab-mv-tag">{t('about.visionTag')}</span>
                </div>
                <h3>{t('about.visionTitle')}</h3>
                <p>{t('about.visionText')}</p>
              </article>
            </div>

            {/* Core Values Grid */}
            <div className="ab-values-block" aria-labelledby="about-values-heading">
              <div className="ab-values-head">
                <h3 id="about-values-heading">{t('about.valuesTitle')}</h3>
                <p>{t('about.valuesLead')}</p>
              </div>

              <div className="ab-values-grid">
                <div className="ab-value-card">
                  <div className="ab-value-icon">
                    <ShieldCheck size={22} aria-hidden />
                  </div>
                  <h4>{t('about.valTrustTitle')}</h4>
                  <p>{t('about.valTrustText')}</p>
                </div>

                <div className="ab-value-card">
                  <div className="ab-value-icon">
                    <Layers size={22} aria-hidden />
                  </div>
                  <h4>{t('about.valSimplicityTitle')}</h4>
                  <p>{t('about.valSimplicityText')}</p>
                </div>

                <div className="ab-value-card">
                  <div className="ab-value-icon">
                    <CheckCircle2 size={22} aria-hidden />
                  </div>
                  <h4>{t('about.valUsefulnessTitle')}</h4>
                  <p>{t('about.valUsefulnessText')}</p>
                </div>

                <div className="ab-value-card">
                  <div className="ab-value-icon">
                    <MessageSquareLock size={22} aria-hidden />
                  </div>
                  <h4>{t('about.valRespectTitle')}</h4>
                  <p>{t('about.valRespectText')}</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* INTERACTIVE PLATFORM PREVIEW */}
        <AboutPlatformPreview />

        {/* FINAL CTA SECTION */}
        <section className="ab-end-section" aria-labelledby="about-cta-heading">
          <div className="tt-section-inner">
            <div className="ab-end-shell">
              <div className="ab-end-glow" aria-hidden />

              <div className="ab-end-head">
                <h2 id="about-cta-heading">{t('about.ctaSectionTitle')}</h2>
                <p>{t('about.ctaSectionLead')}</p>
              </div>

              <div className="ab-end-grid">
                {/* Client / Business Card */}
                <div className="ab-cta-card">
                  <div className="ab-cta-card-top">
                    <div className="ab-cta-card-icon">
                      <Search size={22} aria-hidden />
                    </div>
                    <h3>{t('about.ctaClientTitle')}</h3>
                    <p>{t('about.ctaClientText')}</p>
                  </div>
                  <div className="ab-cta-card-action">
                    <Link to="/ofertat" className="ab-cta-action-btn is-primary">
                      <span>{t('about.ctaClientBtn')}</span>
                      <ArrowRight size={16} aria-hidden />
                    </Link>
                  </div>
                </div>

                {/* Professional / Provider Card */}
                <div className="ab-cta-card is-featured">
                  <div className="ab-cta-card-top">
                    <div className="ab-cta-card-icon is-featured-icon">
                      <UserPlus size={22} aria-hidden />
                    </div>
                    <h3>{t('about.ctaProviderTitle')}</h3>
                    <p>{t('about.ctaProviderText')}</p>
                  </div>
                  <div className="ab-cta-card-action">
                    <Link to="/register" className="ab-cta-action-btn is-accent">
                      <span>{t('about.ctaProviderBtn')}</span>
                      <ArrowRight size={16} aria-hidden />
                    </Link>
                    <Link to="/planet" className="ab-cta-ghost-link">
                      {t('about.ctaProviderPlans')}
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}
