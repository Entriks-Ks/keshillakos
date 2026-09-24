import { Link } from 'react-router-dom'
import { BadgeCheck, MessageCircle, ShieldCheck, Users } from 'lucide-react'
import SiteFooter from '../components/SiteFooter'
import SiteNav from '../components/SiteNav'
import './AboutPage.css'

const STEPS = [
  {
    title: 'Përshkruaj nevojën',
    text: 'Kërko drejtpërdrejt kur e di shërbimin, ose nis matching me disa hapa kur nuk je i sigurt.',
  },
  {
    title: 'Shiko përputhjet',
    text: 'Të gjejmë ofrues lokalë ose online që përputhen me rastin, gjuhën dhe mënyrën e punës.',
  },
  {
    title: 'Bisedo dhe rezervo',
    text: 'Dërgo mesazh ose kërkesë kur je gati — pa thirrje të papritura.',
  },
]

const VALUES = [
  {
    title: 'Ofrues me profil të qartë',
    text: 'Shërbimet publike, vlerësimet dhe detajet e kontaktit janë të dukshme para se të nisësh bisedën.',
    icon: BadgeCheck,
  },
  {
    title: 'Ti kontrollon kontaktin',
    text: 'Asnjë ndërmjetësim i detyruar. Ti vendos kur dhe me kë flet.',
    icon: MessageCircle,
  },
  {
    title: 'Për Kosovën dhe diasporën',
    text: 'Shërbime fizike në qytetin tënd, ose online kur puna mund të bëhet nga kudo.',
    icon: Users,
  },
]

export default function AboutPage() {
  return (
    <div className="tt-shell">
      <SiteNav />

      <main>
        <section className="tt-section tt-about-page" aria-labelledby="about-heading">
          <div className="tt-section-inner">
            <header className="tt-about-intro">
              <p className="tt-about-kicker">Rreth nesh</p>
              <h1 id="about-heading">Një vend për të gjetur ndihmën <em>profesionale</em> që të duhet.</h1>
              <p>
                KëshillaKos lidh njerëzit në Kosovë dhe diasporë me ofrues profesionalë —
                nga çështjet ligjore dhe kontabiliteti, te IT, marketingu, përkthimi dhe shërbimet e përditshme.
              </p>
            </header>

            <div className="tt-about-story">
              <div>
                <h2>Çfarë bëjmë</h2>
                <p>
                  Shumë njerëz e dinë se u duhet ndihmë, por jo se cilin profesionist të zgjedhin.
                  Ne e bëjmë këtë hap më të thjeshtë: përshkruan nevojën me fjalët e tua dhe sheh ofrues
                  që përputhen me rastin, qytetin dhe mënyrën e punës.
                </p>
                <p>
                  Platforma është e hapur edhe për profesionistët. Nëse ofron një shërbim, publikon profilin,
                  orarin dhe ofertat — klientët të gjejnë ty, jo anasjelltas.
                </p>
              </div>
              <aside className="tt-about-aside" aria-label="Si e përdorin njerëzit">
                <ShieldCheck size={22} aria-hidden />
                <h2>Për klientë dhe ofrues</h2>
                <p>Klientët kërkojnë dhe rezervojnë. Ofruesit dhe kompanitë publikojnë shërbimet e tyre.</p>
                <Link to="/ofertat">Shiko ofertat</Link>
              </aside>
            </div>
          </div>
        </section>

        <section className="tt-about-block" aria-labelledby="about-how-heading">
          <div className="tt-section-inner">
            <h2 id="about-how-heading">Si funksionon</h2>
            <div className="tt-about-grid">
              {STEPS.map((item, index) => (
                <article key={item.title} className="tt-about-card">
                  <span>{index + 1}</span>
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="tt-about-block" aria-labelledby="about-values-heading">
          <div className="tt-section-inner">
            <h2 id="about-values-heading">Pse ekziston KëshillaKos</h2>
            <div className="tt-about-grid">
              {VALUES.map((item) => {
                const Icon = item.icon
                return (
                  <article key={item.title} className="tt-about-card">
                    <Icon size={22} aria-hidden />
                    <h3>{item.title}</h3>
                    <p>{item.text}</p>
                  </article>
                )
              })}
            </div>
          </div>
        </section>

        <section className="tt-about-block tt-about-end" aria-labelledby="about-cta-heading">
          <div className="tt-section-inner tt-about-end-inner">
            <div>
              <h2 id="about-cta-heading">Gati të gjesh ofruesin e duhur?</h2>
              <p>Nis nga ballina, ose publiko shërbimin tënd nëse je profesionist.</p>
            </div>
            <div className="tt-about-end-actions">
              <Link to="/" className="tt-about-btn">Fillo kërkimin</Link>
              <Link to="/register" className="tt-about-btn is-quiet">Bëhu ofrues</Link>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}
