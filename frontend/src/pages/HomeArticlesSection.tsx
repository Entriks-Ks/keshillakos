import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Clock,
  Cookie,
  Scale,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'

export default function HomeArticlesSection() {
  const { t } = useTranslation()

  const featured = {
    id: 'terms',
    title: t('home.articleTermsTitle', 'Kushtet e Përdorimit dhe Marrëveshjet e Shërbimit'),
    desc: t(
      'home.articleTermsDesc',
      'Gjithçka që duhet të dini mbi angazhimin e profesionistëve, fushëveprimin e marrëveshjeve dhe mbrojtjen reciproke të të drejtave në Kosovë.',
    ),
    category: t('home.articleCatLegal', 'Ligjore & Rregullore'),
    readTime: '4 min',
    to: '/kushtet',
    highlights: [
      'Marrëveshje direkte me ofruesin e licencuar',
      'Transparencë e plotë mbi tarifat dhe oraret',
      'Mbrojtje e standardeve profesionale në Kosovë',
    ],
  }

  const secondaryArticles = [
    {
      id: 'privacy',
      title: t('home.articlePrivacyTitle', 'Privatësia & Mbrojtja e të Dhënave'),
      desc: t(
        'home.articlePrivacyDesc',
        'Si ruhen dhe mbrohen të dhënat tuaja sipas Ligjit për Mbrojtjen e të Dhënave Personale dhe standardeve evropiane.',
      ),
      category: t('home.articleCatPrivacy', 'Siguria & Privatësia'),
      readTime: '3 min',
      to: '/privatesia',
      icon: ShieldCheck,
      iconClass: 'is-privacy',
    },
    {
      id: 'ai',
      title: t('home.articleAiTitle', 'AI Asistenti & Përputhja e Inteligjencës'),
      desc: t(
        'home.articleAiDesc',
        'Mësoni si algoritmi ynë analizon nevojën tuaj specifike për të gjetur ekspertin më të kualifikuar në kohë reale.',
      ),
      category: t('home.articleCatAi', 'Inovacion & AI'),
      readTime: '2 min',
      to: '/ai-asistenti',
      icon: Sparkles,
      iconClass: 'is-ai',
    },
    {
      id: 'cookies',
      title: t('home.articleCookiesTitle', 'Transparenca & Rregullorja e Cookies'),
      desc: t(
        'home.articleCookiesDesc',
        'Informacione të qarta mbi mënyrën se si përdorim cookie-t për të ruajtur preferencat dhe sesionin tuaj të sigurt.',
      ),
      category: t('home.articleCatCookies', 'Transparencë'),
      readTime: '2 min',
      to: '/cookies',
      icon: Cookie,
      iconClass: 'is-cookies',
    },
  ]

  return (
    <section className="tt-section hm-articles" aria-labelledby="articles-heading">
      <div className="tt-section-inner">
        <div className="tt-section-head hm-articles-head">
          <div className="hm-kicker-badge">
            <BookOpen size={14} className="hm-kicker-icon" aria-hidden />
            <span>{t('home.articlesKicker')}</span>
          </div>
          <h2 id="articles-heading">{t('home.articlesTitle')}</h2>
          <p>{t('home.articlesLead')}</p>
        </div>

        {/* Bento Magazine Layout */}
        <div className="hm-articles-layout">
          {/* Main Featured Guide Card */}
          <article className="hm-article-featured">
            <div className="hm-featured-glow" aria-hidden />

            <div className="hm-featured-top">
              <div className="hm-featured-badge-row">
                <span className="hm-featured-tag">
                  <Sparkles size={13} aria-hidden />
                  {t('home.articlesFeaturedBadge')}
                </span>
                <span className="hm-article-time">
                  <Clock size={13} aria-hidden />
                  {featured.readTime} lexim
                </span>
              </div>

              <div className="hm-featured-header-row">
                <div className="hm-featured-icon">
                  <Scale size={28} aria-hidden />
                </div>
                <div className="hm-featured-verified-badge">
                  <CheckCircle2 size={13} aria-hidden />
                  <span>{t('home.articlesBadgeLegalVerified')}</span>
                </div>
              </div>

              <h3 className="hm-featured-title">
                <Link to={featured.to} className="hm-featured-title-link">
                  {featured.title}
                </Link>
              </h3>

              <p className="hm-featured-desc">{featured.desc}</p>

              <ul className="hm-featured-highlights" aria-label="Pikat kryesore">
                {featured.highlights.map((item) => (
                  <li key={item}>
                    <CheckCircle2 size={16} className="hm-highlight-check" aria-hidden />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="hm-featured-footer">
              <Link to={featured.to} className="hm-featured-btn">
                <span>{t('home.articlesReadFull')}</span>
                <ArrowRight size={16} aria-hidden />
              </Link>
            </div>
          </article>

          {/* Secondary Guides Stack */}
          <div className="hm-articles-stack">
            {secondaryArticles.map((item) => {
              const Icon = item.icon
              return (
                <article key={item.id} className="hm-article-card-row">
                  <div className={`hm-article-icon ${item.iconClass}`}>
                    <Icon size={22} aria-hidden />
                  </div>

                  <div className="hm-article-row-content">
                    <div className="hm-article-meta-row">
                      <span className="hm-article-tag">{item.category}</span>
                      <span className="hm-article-time">
                        <Clock size={12} aria-hidden />
                        {item.readTime}
                      </span>
                    </div>

                    <h3 className="hm-article-row-title">
                      <Link to={item.to} className="hm-article-title-link">
                        {item.title}
                      </Link>
                    </h3>

                    <p className="hm-article-row-desc">{item.desc}</p>

                    <div className="hm-article-row-footer">
                      <Link to={item.to} className="hm-article-action">
                        <span>{t('home.readMore')}</span>
                        <ArrowRight size={14} aria-hidden />
                      </Link>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        </div>

        {/* AI Regulations Banner Callout */}
        <div className="hm-articles-ai-bar">
          <div className="hm-ai-bar-left">
            <div className="hm-ai-bar-icon" aria-hidden>
              <Sparkles size={20} />
            </div>
            <div className="hm-ai-bar-copy">
              <strong>{t('home.articlesAiBannerTitle')}</strong>
              <p>{t('home.articlesAiBannerDesc')}</p>
            </div>
          </div>
          <Link to="/ai-asistenti" className="hm-ai-bar-cta">
            <span>{t('home.articlesAiBannerBtn')}</span>
            <ArrowRight size={15} aria-hidden />
          </Link>
        </div>
      </div>
    </section>
  )
}
