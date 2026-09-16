export type DomainRequirement =
  | 'license_verification'
  | 'documents_deadlines'
  | 'audience_b2c_b2b'
  | 'delivery_mode'
  | 'language_pair'
  | 'offer_type_packages'
  | 'portfolio_references'
  | 'regulatory_notice'
  | 'coaching_boundary'
  | 'cross_border_multilingual'

export type DomainDefinition = {
  id: string
  labelSq: string
  labelDe: string
  examples: string[]
  keywords: string[]
  requirements: DomainRequirement[]
  system: boolean
}

/** Core KëshillaKos domains — problem-oriented taxonomy */
export const SYSTEM_DOMAINS: DomainDefinition[] = [
  {
    id: 'law',
    labelSq: 'Ligj',
    labelDe: 'Recht',
    examples: [
      'Kontrata',
      'Hapje biznesi',
      'E drejta e punës',
      'E drejta familjare',
      'E drejta e pronës',
    ],
    keywords: [
      'ligj',
      'avokat',
      'kontrata',
      'hapje biznesi',
      'hapjen e biznesit',
      'e drejta e punes',
      'e drejta familjare',
      'prona',
      'noter',
      'gjykat',
      'padia',
      'licenca',
    ],
    requirements: ['license_verification'],
    system: true,
  },
  {
    id: 'tax-accounting',
    labelSq: 'Taksa / Kontabilitet',
    labelDe: 'Steuern / Buchhaltung',
    examples: [
      'Deklarata tatimore',
      'Pagat',
      'Kontabilitet',
      'Tatime të kompanisë',
    ],
    keywords: [
      'tatim',
      'tatime',
      'kontabil',
      'pagat',
      'deklarat',
      'tvsh',
      'bilanc',
      'fatura',
      'atke',
      'taksa',
    ],
    requirements: ['documents_deadlines'],
    system: true,
  },
  {
    id: 'business-founding',
    labelSq: 'Biznes / Themelim',
    labelDe: 'Unternehmen / Gründung',
    examples: ['Business Plan', 'Strategji', 'Financim', 'Procese biznesi'],
    keywords: [
      'biznes',
      'themelim',
      'hapje biznesi',
      'hapjen e biznesit',
      'business plan',
      'strategji',
      'financim',
      'start-up',
      'startup',
      'shpk',
      'kompani',
      'konsulent',
      'consulting',
    ],
    requirements: ['audience_b2c_b2b'],
    system: true,
  },
  {
    id: 'career',
    labelSq: 'Karrierë',
    labelDe: 'Karriere / Beruf',
    examples: ['CV', 'Application', 'Career', 'Interview preparation'],
    keywords: [
      'karriere',
      'cv',
      'aplikim',
      'application',
      'interviste',
      'interview',
      'pune',
      'punekos',
      'profesion',
    ],
    requirements: [],
    system: true,
  },
  {
    id: 'education',
    labelSq: 'Edukim / Mësime private',
    labelDe: 'Bildung / Nachhilfe',
    examples: ['Matematikë', 'Gjuhë', 'Provime', 'Kurse'],
    keywords: [
      'mesim',
      'mësues',
      'matematik',
      'provim',
      'kurs',
      'edukim',
      'nachhilfe',
      'tutor',
      'shkolle',
    ],
    requirements: ['delivery_mode'],
    system: true,
  },
  {
    id: 'languages',
    labelSq: 'Gjuhë / Përkthim',
    labelDe: 'Sprachen / Übersetzung',
    examples: [
      'Shqip',
      'Gjermanisht',
      'Anglisht',
      'Përkthime të noterizuara/certifikuara',
    ],
    keywords: [
      'perkthim',
      'përkthim',
      'gjuhe',
      'gjuhë',
      'shqip',
      'gjermanisht',
      'anglisht',
      'noterizuar',
      'certifikuar',
      'translator',
      'ubersetzung',
    ],
    requirements: ['language_pair'],
    system: true,
  },
  {
    id: 'it',
    labelSq: 'IT / Teknologji',
    labelDe: 'IT / Technologie',
    examples: ['Website', 'Software', 'Cybersecurity', 'IT Support'],
    keywords: [
      'it',
      'website',
      'softuer',
      'software',
      'cyber',
      'siguri',
      'aplikacion',
      'programim',
      'web',
      'tech',
      'teknologji',
    ],
    requirements: ['offer_type_packages'],
    system: true,
  },
  {
    id: 'marketing',
    labelSq: 'Marketing / Media',
    labelDe: 'Marketing / Medien',
    examples: ['Social Media', 'Branding', 'Video', 'SEO', 'Content'],
    keywords: [
      'marketing',
      'social media',
      'brand',
      'branding',
      'video',
      'seo',
      'content',
      'reklama',
      'media',
    ],
    requirements: ['portfolio_references'],
    system: true,
  },
  {
    id: 'finance',
    labelSq: 'Financa',
    labelDe: 'Finanzen',
    examples: ['Financial planning', 'Insurance', 'Loans'],
    keywords: [
      'financ',
      'sigurim',
      'insurance',
      'kredi',
      'loan',
      'investim',
      'planifikim financiar',
    ],
    requirements: ['regulatory_notice'],
    system: true,
  },
  {
    id: 'coaching',
    labelSq: 'Coaching',
    labelDe: 'Coaching',
    examples: ['Business coaching', 'Career coaching', 'Organization'],
    keywords: [
      'coaching',
      'coach',
      'mentor',
      'organizim',
      'karriere coaching',
      'business coaching',
    ],
    requirements: ['coaching_boundary'],
    system: true,
  },
  {
    id: 'diaspora',
    labelSq: 'Shërbime Diaspora',
    labelDe: 'Diaspora-Service',
    examples: ['Dokumente', 'Administratë', 'Hapje biznesi', 'Ndihmë me prona'],
    keywords: [
      'diaspora',
      'gjermani',
      'zvicer',
      'austri',
      'dokumente',
      'administrate',
      'prona',
      'jashte kosoves',
      'cross-border',
      'ambasade',
    ],
    requirements: ['cross_border_multilingual'],
    system: true,
  },
  {
    id: 'other',
    labelSq: 'Ekspertë të tjerë',
    labelDe: 'Weitere Experten',
    examples: ['Shërbime të tjera që nuk hyjnë te kategoritë ekzistuese'],
    keywords: ['tjeter', 'tjetër', 'other', 'sonstige'],
    requirements: [],
    system: true,
  },
]

export const COACHING_DISCLAIMER =
  'Coaching ≠ terapi / trajtim mjekësor. Ky ofrim nuk është shërbim psikologjik apo mjekësor.'

export const FINANCE_REGULATORY_NOTICE =
  'Disa shërbime financiare janë të rregulluara. Kontrollo licencën dhe kufizimet ligjore para se të ofrosh këshilla financiare.'
