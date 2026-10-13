import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { uiText } from '../i18n'
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
    lead: 'Këto kushte vlejnë kur përdor KLAW për të gjetur një ofrues ose për të publikuar një shërbim.',
    sections: [
      {
        title: 'Çfarë është platforma',
        paragraphs: [
          'KLAW të ndihmon të gjesh ofrues profesionalë në Kosovë dhe online, dhe u jep ofruesve një vend ku të publikojnë shërbimet e tyre.',
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
    lead: 'Këtu shpjegohet çfarë të dhënash mbledh KLAW, pse i përdor dhe kujt ia tregon.',
    sections: [
      {
        title: 'Çfarë mbledhim',
        paragraphs: [
          'Kur krijon llogari: emrin, email-in dhe fjalëkalimin. Mund të shtosh telefon, foto, përshkrim dhe qytet.',
          'Kur përdor platformën: kërkesat, mesazhet, oraret, vlerësimet dhe feedback-un që dërgon për KLAW.',
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
    lead: 'KLAW nuk përdor cookies marketingu. Ruajmë vetëm çfarë duhet që hyrja dhe qyteti të mbahen mend.',
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
  { kind: 'terms', to: '/kushtet', label: 'terms' },
  { kind: 'privacy', to: '/privatesia', label: 'privacy' },
  { kind: 'cookies', to: '/cookies', label: 'cookies' },
]

const COPY: Record<string, [string, string]> = {
  'Çfarë është platforma': ['What the platform is', 'Was die Plattform ist'],
  'KLAW të ndihmon të gjesh ofrues profesionalë në Kosovë dhe online, dhe u jep ofruesve një vend ku të publikojnë shërbimet e tyre.': ['KLAW helps you find professional providers in Kosovo and online, and gives providers a place to publish their services.', 'KLAW hilft dir, professionelle Anbieter im Kosovo und online zu finden, und gibt Anbietern einen Ort, ihre Dienste zu veröffentlichen.'],
  'Ne nuk jemi palë e marrëveshjes mes teje dhe ofruesit. Çmimi, afati dhe cilësia e punës rakordohen drejtpërdrejt mes jush.': ['We are not a party to the agreement between you and the provider. Price, timing, and quality are agreed directly between you.', 'Wir sind nicht Teil der Vereinbarung zwischen dir und dem Anbieter. Preis, Frist und Qualität vereinbart ihr direkt.'],
  'Llogaria': ['Account', 'Konto'],
  'Për të dërguar kërkesa, mesazhe ose për të publikuar shërbime, të duhet një llogari me të dhëna të sakta.': ['To send requests, messages, or publish services, you need an account with accurate details.', 'Um Anfragen und Nachrichten zu senden oder Dienste zu veröffentlichen, brauchst du ein Konto mit richtigen Angaben.'],
  'Ti e ruan fjalëkalimin. Na trego nëse dyshon se dikush tjetër e përdor llogarinë tënde.': ['You keep your password. Tell us if you think someone else is using your account.', 'Du bewahrst dein Passwort. Sag uns Bescheid, wenn du glaubst, dass jemand anders dein Konto nutzt.'],
  'Ofruesit dhe kompanitë': ['Providers and companies', 'Anbieter und Unternehmen'],
  'Kush publikon një shërbim është përgjegjës për përshkrimin, çmimin, licencat dhe punën që ofron.': ['Whoever publishes a service is responsible for the description, price, licenses, and the work offered.', 'Wer einen Dienst veröffentlicht, ist für Beschreibung, Preis, Lizenzen und die angebotene Arbeit verantwortlich.'],
  'Profili, ofertat dhe vlerësimet publike shfaqen te përdoruesit që kërkojnë atë shërbim.': ['The profile, offers, and public ratings are shown to people looking for that service.', 'Profil, Angebote und öffentliche Bewertungen sehen Personen, die diesen Dienst suchen.'],
  'Si lejohet përdorimi': ['Allowed use', 'Zulässige Nutzung'],
  'Mos dërgo spam, mashtrim, përmbajtje të paligjshme ose kërkesa që nuk kanë lidhje me një shërbim real.': ['Do not send spam, fraud, illegal content, or requests unrelated to a real service.', 'Sende keinen Spam, Betrug, illegale Inhalte oder Anfragen ohne Bezug zu einem echten Dienst.'],
  'Mund ta pezullojmë llogarinë kur përdorimi thyen këto kushte ose rrezikon përdoruesit e tjerë.': ['We may suspend the account when use breaks these terms or puts other users at risk.', 'Wir können das Konto sperren, wenn die Nutzung diese Bedingungen bricht oder andere Nutzer gefährdet.'],
  'Përgjegjësia': ['Liability', 'Haftung'],
  'Platforma ofrohet siç është. Nuk garantojmë që një ofrues i caktuar është i lirë, i licencuar ose i përshtatshëm për rastin tënd.': ['The platform is provided as is. We do not guarantee that a given provider is available, licensed, or right for your case.', 'Die Plattform wird bereitgestellt, wie sie ist. Wir garantieren nicht, dass ein Anbieter frei, lizenziert oder passend für deinen Fall ist.'],
  'Para se të nisësh një punë, kontrollo vetë detajet me ofruesin.': ['Before you start work, check the details yourself with the provider.', 'Prüfe die Details selbst mit dem Anbieter, bevor du eine Arbeit beginnst.'],
  'Çfarë mbledhim': ['What we collect', 'Was wir erheben'],
  'Kur krijon llogari: emrin, email-in dhe fjalëkalimin. Mund të shtosh telefon, foto, përshkrim dhe qytet.': ['When you create an account: name, email, and password. You can add a phone, photo, description, and city.', 'Beim Konto: Name, E-Mail und Passwort. Du kannst Telefon, Foto, Beschreibung und Stadt ergänzen.'],
  'Kur përdor platformën: kërkesat, mesazhet, oraret, vlerësimet dhe feedback-un që dërgon për KLAW.': ['When you use the platform: requests, messages, schedules, ratings, and the feedback you send about KLAW.', 'Bei der Nutzung: Anfragen, Nachrichten, Termine, Bewertungen und das Feedback, das du an KLAW sendest.'],
  'Për vizitorët pa llogari ruajmë qytetin e zgjedhur në shfletues, që ofertat të filtrohen sipas vendit.': ['For visitors without an account we store the chosen city in the browser so offers can be filtered by place.', 'Für Besucher ohne Konto speichern wir die gewählte Stadt im Browser, damit Angebote nach Ort gefiltert werden.'],
  'Pse i përdorim': ['Why we use it', 'Warum wir sie nutzen'],
  'Për të hapur llogarinë, për të të lidhur me ofruesin që zgjedh dhe për të mbajtur bisedën, kërkesën dhe vlerësimin.': ['To open the account, connect you with the provider you choose, and keep the conversation, request, and rating.', 'Um das Konto zu öffnen, dich mit dem gewählten Anbieter zu verbinden und Gespräch, Anfrage und Bewertung zu behalten.'],
  'Feedback-u i shkon vetëm adminit, që të përmirësojmë platformën. Nuk e shesim listën e përdoruesve.': ['Feedback goes only to the admin so we can improve the platform. We do not sell the user list.', 'Feedback geht nur an den Admin, damit wir die Plattform verbessern. Wir verkaufen die Nutzerliste nicht.'],
  'Kush i sheh': ['Who sees it', 'Wer sie sieht'],
  'Ofruesi sheh kërkesën dhe mesazhin që i dërgon ti. Përdoruesit e tjerë shohin ofertat publike dhe vlerësimet e publikuara.': ['The provider sees the request and message you send. Other users see public offers and published ratings.', 'Der Anbieter sieht die Anfrage und die Nachricht, die du sendest. Andere Nutzer sehen öffentliche Angebote und veröffentlichte Bewertungen.'],
  'Admini sheh llogaritë, kërkesat dhe feedback-un e platformës për të mbajtur shërbimin në rregull.': ['The admin sees accounts, requests, and platform feedback in order to keep the service in order.', 'Der Admin sieht Konten, Anfragen und Plattform-Feedback, um den Dienst in Ordnung zu halten.'],
  'Sa ruhen dhe çfarë mund të kërkosh': ['How long we keep it and what you can ask', 'Wie lange wir sie behalten und was du verlangen kannst'],
  'I mbajmë sa kohë llogaria është aktive dhe sa na duhen për mesazhet, vlerësimet dhe sigurinë e platformës.': ['We keep them while the account is active and as long as we need them for messages, ratings, and platform security.', 'Wir behalten sie, solange das Konto aktiv ist und wir sie für Nachrichten, Bewertungen und die Sicherheit der Plattform brauchen.'],
  'Mund t’i përditësosh të dhënat nga profili. Për fshirje ose një kopje të të dhënave, na shkruaj nga feedback-u në fund të faqes.': ['You can update your details from the profile. For deletion or a copy of your data, write to us from the feedback form at the bottom of the page.', 'Du kannst deine Angaben im Profil aktualisieren. Für Löschung oder eine Kopie der Daten schreib uns über das Feedback unten auf der Seite.'],
  'Çfarë ruhet në shfletues': ['What is stored in the browser', 'Was im Browser gespeichert wird'],
  'Tokeni i hyrjes ruhet lokalisht pasi të kyçesh, që të mos e japësh fjalëkalimin në çdo faqe.': ['The sign-in token is stored locally after you log in, so you do not enter the password on every page.', 'Das Anmelde-Token wird lokal gespeichert, nachdem du dich anmeldest, damit du das Passwort nicht auf jeder Seite eingibst.'],
  'Nëse nuk ke llogari dhe zgjedh një qytet, ai zgjedhje ruhet lokalisht që të shohësh oferta për atë vend.': ['If you have no account and choose a city, that choice is stored locally so you see offers for that place.', 'Wenn du kein Konto hast und eine Stadt wählst, wird diese Wahl lokal gespeichert, damit du Angebote für diesen Ort siehst.'],
  'Çfarë nuk përdorim': ['What we do not use', 'Was wir nicht nutzen'],
  'Nuk vendosim cookies për reklama dhe nuk ndjekim vizitat me mjete analitike të palëve të treta.': ['We do not set advertising cookies and we do not track visits with third-party analytics.', 'Wir setzen keine Werbe-Cookies und verfolgen Besuche nicht mit Analysewerkzeugen Dritter.'],
  'Nuk ka banner pëlqimi sepse këto të dhëna janë të nevojshme për hyrjen dhe për filtrin e qytetit.': ['There is no consent banner because this data is needed for sign-in and the city filter.', 'Es gibt kein Einwilligungsbanner, weil diese Daten für die Anmeldung und den Stadtfilter nötig sind.'],
  'Si i fshin': ['How to delete them', 'Wie du sie löschst'],
  'Nga cilësimet e shfletuesit mund t’i fshish të dhënat e sajtit. Pas kësaj do të duhet të kyçesh përsëri dhe të zgjedhësh qytetin.': ['From the browser settings you can delete the site data. After that you will need to sign in again and choose the city.', 'In den Browser-Einstellungen kannst du die Website-Daten löschen. Danach musst du dich neu anmelden und die Stadt wählen.'],
  'Dalja nga llogaria e heq tokenin e hyrjes.': ['Signing out removes the sign-in token.', 'Beim Abmelden wird das Anmelde-Token entfernt.'],
}

function tr(sq: string) {
  const pair = COPY[sq]
  return pair ? uiText(sq, pair[0], pair[1]) : sq
}

function legalSections(kind: LegalKind): Section[] {
  return DOCUMENTS[kind].sections.map((section) => ({
    title: tr(section.title),
    paragraphs: section.paragraphs.map(tr),
  }))
}

function linkLabel(kind: string) {
  if (kind === 'privacy') return uiText('Privatësia', 'Privacy', 'Datenschutz')
  if (kind === 'cookies') return 'Cookies'
  return uiText('Kushtet e përdorimit', 'Terms of use', 'Nutzungsbedingungen')
}

export default function LegalPage({ kind }: { kind: LegalKind }) {
  const { i18n } = useTranslation()
  void i18n.language
  const title = linkLabel(kind)
  const kicker = kind === 'privacy' ? uiText('Privatësia', 'Privacy', 'Datenschutz') : kind === 'cookies' ? 'Cookies' : uiText('Kushtet', 'Terms', 'Bedingungen')
  const lead = kind === 'privacy'
    ? uiText('Këtu shpjegohet çfarë të dhënash mbledh KLAW, pse i përdor dhe kujt ia tregon.', 'This explains what data KLAW collects, why it is used, and who sees it.', 'Hier steht, welche Daten KLAW erhebt, warum sie genutzt werden und wer sie sieht.')
    : kind === 'cookies'
      ? uiText('KLAW nuk përdor cookies marketingu. Ruajmë vetëm çfarë duhet që hyrja dhe qyteti të mbahen mend.', 'KLAW does not use marketing cookies. We only store what is needed to remember sign-in and city.', 'KLAW nutzt keine Marketing-Cookies. Wir speichern nur, was Anmeldung und Stadt merkt.')
      : uiText('Këto kushte vlejnë kur përdor KLAW për të gjetur një ofrues ose për të publikuar një shërbim.', 'These terms apply when you use KLAW to find a provider or publish a service.', 'Diese Bedingungen gelten, wenn du KLAW nutzt, um einen Anbieter zu finden oder einen Dienst zu veröffentlichen.')

  return (
    <div className="tt-shell">
      <SiteNav />
      <main>
        <article className="tt-legal" aria-labelledby="legal-heading">
          <div className="tt-section-inner tt-legal-layout">
            <nav className="tt-legal-switch" aria-label={uiText('Dokumentet ligjore', 'Legal documents', 'Rechtliche Dokumente')}>
              {LINKS.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => `tt-legal-tab${isActive ? ' is-active' : ''}`}
                >
                  {linkLabel(item.label)}
                </NavLink>
              ))}
            </nav>
            <header className="tt-legal-intro">
              <p className="tt-legal-kicker">{kicker}</p>
              <h1 id="legal-heading">{title}</h1>
              <p>{lead}</p>
              <p className="tt-legal-updated">{uiText('Përditësuar më', 'Updated', 'Aktualisiert am')} {UPDATED}</p>
            </header>
            <ol className="tt-legal-list">
              {legalSections(kind).map((section, index) => (
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
