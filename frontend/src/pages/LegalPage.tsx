import { NavLink } from 'react-router-dom'
import SiteFooter from '../components/SiteFooter'
import SiteNav from '../components/SiteNav'
import './LegalPage.css'

type LegalKind = 'terms' | 'privacy' | 'cookies'

type Section = { title: string; paragraphs: string[] }

const UPDATED = '23 shtator 2026'

const DOCUMENTS: Record<LegalKind, { kicker: string; title: string; lead: string; sections: Section[] }> = {
  terms: {
    kicker: 'Kushtet',
    title: 'Kushtet e përdorimit',
    lead: 'Këto kushte vlejnë kur përdor KëshillaKos për të gjetur një ofrues ose për të publikuar një shërbim.',
    sections: [
      {
        title: 'Çfarë është platforma',
        paragraphs: [
          'KëshillaKos të ndihmon të gjesh ofrues profesionalë në Kosovë dhe online, dhe u jep ofruesve një vend ku të publikojnë shërbimet e tyre.',
          'Ne nuk jemi palë e marrëveshjes mes teje dhe ofruesit. Çmimi, afati dhe cilësia e punës rakordohen drejtpërdrejt mes jush.',
        ],
      },
      {
        title: 'Llogaria',
        paragraphs: [
          'Për të dërguar kërkesa, mesazhe ose për të publikuar shërbime, të duhet një llogari me të dhëna të sakta.',
          'Ti e ruan fjalëkalimin. Na trego nëse dyshon se dikush tjetër e përdor llogarinë tënde.',
        ],
      },
      {
        title: 'Ofruesit dhe kompanitë',
        paragraphs: [
          'Kush publikon një shërbim është përgjegjës për përshkrimin, çmimin, licencat dhe punën që ofron.',
          'Profili, ofertat dhe vlerësimet publike shfaqen te përdoruesit që kërkojnë atë shërbim.',
        ],
      },
      {
        title: 'Si lejohet përdorimi',
        paragraphs: [
          'Mos dërgo spam, mashtrim, përmbajtje të paligjshme ose kërkesa që nuk kanë lidhje me një shërbim real.',
          'Mund ta pezullojmë llogarinë kur përdorimi thyen këto kushte ose rrezikon përdoruesit e tjerë.',
        ],
      },
      {
        title: 'Përgjegjësia',
        paragraphs: [
          'Platforma ofrohet siç është. Nuk garantojmë që një ofrues i caktuar është i lirë, i licencuar ose i përshtatshëm për rastin tënd.',
          'Para se të nisësh një punë, kontrollo vetë detajet me ofruesin.',
        ],
      },
    ],
  },
  privacy: {
    kicker: 'Privatësia',
    title: 'Politika e privatësisë',
    lead: 'Këtu shpjegohet çfarë të dhënash mbledh KëshillaKos, pse i përdor dhe kujt ia tregon.',
    sections: [
      {
        title: 'Çfarë mbledhim',
        paragraphs: [
          'Kur krijon llogari: emrin, email-in dhe fjalëkalimin. Mund të shtosh telefon, foto, përshkrim dhe qytet.',
          'Kur përdor platformën: kërkesat, mesazhet, oraret, vlerësimet dhe feedback-un që dërgon për KëshillaKos.',
          'Për vizitorët pa llogari ruajmë qytetin e zgjedhur në shfletues, që ofertat të filtrohen sipas vendit.',
        ],
      },
      {
        title: 'Pse i përdorim',
        paragraphs: [
          'Për të hapur llogarinë, për të të lidhur me ofruesin që zgjedh dhe për të mbajtur bisedën, kërkesën dhe vlerësimin.',
          'Feedback-u i shkon vetëm adminit, që të përmirësojmë platformën. Nuk e shesim listën e përdoruesve.',
        ],
      },
      {
        title: 'Kush i sheh',
        paragraphs: [
          'Ofruesi sheh kërkesën dhe mesazhin që i dërgon ti. Përdoruesit e tjerë shohin ofertat publike dhe vlerësimet e publikuara.',
          'Admini sheh llogaritë, kërkesat dhe feedback-un e platformës për të mbajtur shërbimin në rregull.',
        ],
      },
      {
        title: 'Sa ruhen dhe çfarë mund të kërkosh',
        paragraphs: [
          'I mbajmë sa kohë llogaria është aktive dhe sa na duhen për mesazhet, vlerësimet dhe sigurinë e platformës.',
          'Mund t’i përditësosh të dhënat nga profili. Për fshirje ose një kopje të të dhënave, na shkruaj nga feedback-u në fund të faqes.',
        ],
      },
    ],
  },
  cookies: {
    kicker: 'Cookies',
    title: 'Cookies dhe ruajtja lokale',
    lead: 'KëshillaKos nuk përdor cookies marketingu. Ruajmë vetëm çfarë duhet që hyrja dhe qyteti të mbahen mend.',
    sections: [
      {
        title: 'Çfarë ruhet në shfletues',
        paragraphs: [
          'Tokeni i hyrjes ruhet lokalisht pasi të kyçesh, që të mos e japësh fjalëkalimin në çdo faqe.',
          'Nëse nuk ke llogari dhe zgjedh një qytet, ai zgjedhje ruhet lokalisht që të shohësh oferta për atë vend.',
        ],
      },
      {
        title: 'Çfarë nuk përdorim',
        paragraphs: [
          'Nuk vendosim cookies për reklama dhe nuk ndjekim vizitat me mjete analitike të palëve të treta.',
          'Nuk ka banner pëlqimi sepse këto të dhëna janë të nevojshme për hyrjen dhe për filtrin e qytetit.',
        ],
      },
      {
        title: 'Si i fshin',
        paragraphs: [
          'Nga cilësimet e shfletuesit mund t’i fshish të dhënat e sajtit. Pas kësaj do të duhet të kyçesh përsëri dhe të zgjedhësh qytetin.',
          'Dalja nga llogaria e heq tokenin e hyrjes.',
        ],
      },
    ],
  },
}

const LINKS: { kind: LegalKind; to: string; label: string }[] = [
  { kind: 'terms', to: '/kushtet', label: 'Kushtet e përdorimit' },
  { kind: 'privacy', to: '/privatesia', label: 'Privatësia' },
  { kind: 'cookies', to: '/cookies', label: 'Cookies' },
]

export default function LegalPage({ kind }: { kind: LegalKind }) {
  const doc = DOCUMENTS[kind]

  return (
    <div className="tt-shell">
      <SiteNav />
      <main>
        <article className="tt-legal" aria-labelledby="legal-heading">
          <div className="tt-section-inner tt-legal-layout">
            <nav className="tt-legal-switch" aria-label="Dokumentet ligjore">
              {LINKS.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => `tt-legal-tab${isActive ? ' is-active' : ''}`}
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
            <header className="tt-legal-intro">
              <p className="tt-legal-kicker">{doc.kicker}</p>
              <h1 id="legal-heading">{doc.title}</h1>
              <p>{doc.lead}</p>
              <p className="tt-legal-updated">Përditësuar më {UPDATED}</p>
            </header>
            <ol className="tt-legal-list">
              {doc.sections.map((section, index) => (
                <li key={section.title}>
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <div>
                    <h2>{section.title}</h2>
                    {section.paragraphs.map((paragraph) => (
                      <p key={paragraph}>{paragraph}</p>
                    ))}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </article>
      </main>
      <SiteFooter />
    </div>
  )
}
