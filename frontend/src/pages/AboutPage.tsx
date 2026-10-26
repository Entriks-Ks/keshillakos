import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowRight, BadgeCheck, MessageCircle, ShieldCheck, Users } from 'lucide-react'
import SiteFooter from '../components/SiteFooter'
import SiteNav from '../components/SiteNav'
import './AboutPage.css'

const STEPS = [
  { title: 'about.step1', text: 'about.step1Text' },
  { title: 'about.step2', text: 'about.step2Text' },
  { title: 'about.step3', text: 'about.step3Text' },
]

const VALUES = [
  { title: 'about.value1', text: 'about.value1Text', icon: BadgeCheck },
  { title: 'about.value2', text: 'about.value2Text', icon: MessageCircle },
  { title: 'about.value3', text: 'about.value3Text', icon: Users },
]

export default function AboutPage() {
  const { t } = useTranslation()
  return (
    <div className="tt-shell tt-home">
      <SiteNav />

      <main className="ab">
        <section className="ab-hero" aria-labelledby="about-heading">
          <div className="tt-section-inner ab-hero-grid">
            <div className="ab-hero-copy">
              <p className="ab-kicker">{t('about.kicker')}</p>
              <h1 id="about-heading">
                {t('about.title')}
                <em>{t('about.titleEm')}</em>
              </h1>
              <p className="ab-lead">{t('about.lead')}</p>
              <div className="ab-actions">
                <Link to="/ofertat" className="ab-btn">{t('about.offers')}</Link>
                <Link to="/register" className="ab-btn is-quiet">{t('about.become')}</Link>
              </div>
            </div>

            <div className="ab-stage">
              <img
                src="/images/hero/desktop-1440.webp"
                srcSet="/images/hero/desktop-960.webp 960w, /images/hero/desktop-1440.webp 1440w"
                sizes="(max-width: 900px) 100vw, 640px"
                alt=""
                width={1440}
                height={810}
              />
              <ul className="ab-pills" aria-label={t('about.pills')}>
                <li>{t('about.pill1')}</li>
                <li>{t('about.pill2')}</li>
                <li>{t('about.pill3')}</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="ab-how" aria-labelledby="about-how-heading">
          <div className="tt-section-inner">
            <div className="ab-how-panel">
              <h2 id="about-how-heading">{t('about.how')}</h2>
              <ol className="ab-steps">
                {STEPS.map((item, index) => (
                  <li key={item.title}>
                    <span>{String(index + 1).padStart(2, '0')}</span>
                    <h3>{t(item.title)}</h3>
                    <p>{t(item.text)}</p>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        <section className="ab-board" aria-labelledby="about-story-heading">
          <div className="tt-section-inner ab-bento">
            <article className="ab-story">
              <h2 id="about-story-heading">{t('about.story')}</h2>
              <p>{t('about.story1')}</p>
              <p>{t('about.story2')}</p>
            </article>

            {VALUES.map((item) => {
              const Icon = item.icon
              return (
                <article key={item.title} className="ab-tile">
                  <Icon size={20} aria-hidden />
                  <h3>{t(item.title)}</h3>
                  <p>{t(item.text)}</p>
                </article>
              )
            })}

            <aside className="ab-aside" aria-label={t('about.asideLabel')}>
              <ShieldCheck size={22} aria-hidden />
              <h2>{t('about.aside')}</h2>
              <p>{t('about.asideText')}</p>
              <Link to="/ofertat">{t('about.offers')}</Link>
            </aside>
          </div>
        </section>

        <section className="ab-end" aria-labelledby="about-cta-heading">
          <div className="tt-section-inner ab-end-inner">
            <div className="ab-end-copy">
              <h2 id="about-cta-heading">{t('about.cta')}</h2>
              <p>{t('about.ctaLead')}</p>
            </div>
            <div className="ab-end-choices">
              <Link to="/" className="ab-choice">
                <div className="ab-choice-body">
                  <span className="ab-choice-title">{t('about.start')}</span>
                  <small className="ab-choice-hint">{t('about.startHint')}</small>
                </div>
                <span className="ab-choice-arrow" aria-hidden>
                  <ArrowRight size={18} />
                </span>
              </Link>
              <Link to="/register" className="ab-choice is-quiet">
                <div className="ab-choice-body">
                  <span className="ab-choice-title">{t('about.become')}</span>
                  <small className="ab-choice-hint">{t('about.publish')}</small>
                </div>
                <span className="ab-choice-arrow" aria-hidden>
                  <ArrowRight size={18} />
                </span>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}
