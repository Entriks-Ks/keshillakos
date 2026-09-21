function photo(id: string) {
  return `https://images.unsplash.com/${id}?auto=format&fit=crop&w=640&h=800&q=80`
}

const CATEGORY_IMAGES: Record<string, string> = {
  'home-and-property': photo('photo-1560518883-ce09059eeffa'),
  'gardening-and-outdoor': photo('photo-1416879595882-3373a0480b5b'),
  'auto-and-transportation': photo('photo-1486262715619-67b85e0b08d3'),
  'legal-services': photo('photo-1589829545856-d10d557cf95f'),
  'accounting-and-business': photo('photo-1554224155-6726b3ff858f'),
  'it-and-technology': photo('photo-1461749280684-dccba630e2f6'),
  'marketing-and-creative': photo('photo-1460925895917-afdab827c52f'),
  'education-and-tutoring': photo('photo-1503676260728-1c00da094a0b'),
  'translation-and-language': photo('photo-1524995997946-a1c2e315a42f'),
  'career-development': photo('photo-1586281380349-632531db7ed4'),
  'real-estate': photo('photo-1560518883-ce09059eeffa'),
  'architecture-and-engineering': photo('photo-1487958449943-2429e8be8625'),
  'finance-and-insurance': photo('photo-1579621970563-ebec7560ff3e'),
  'beauty-and-personal-care': photo('photo-1560066984-138dadb4c035'),
  'fitness-and-wellness': photo('photo-1571019614242-c5c5dee9f50b'),
  'events-and-weddings': photo('photo-1511795409834-ef04bbd61622'),
  'family-and-care': photo('photo-1476703993599-0035a21b17a9'),
  'diaspora-and-relocation': photo('photo-1436491865332-7a61a109cc05'),
  'personal-and-lifestyle': photo('photo-1488646953014-85cb44e25828'),
  'other-services': photo('photo-1521791136064-7986c2920216'),
}

const SUBCATEGORY_IMAGES: Record<string, string> = {
  'house-cleaning': photo('photo-1581578731548-c64695cc6952'),
  'plumbing': photo('photo-1504148455328-c376907d081c'),
  'electrical-services': photo('photo-1621905251189-08b45d6a269e'),
  'painting-and-renovation': photo('photo-1589939705384-5185137a7f0f'),
  'handyman': photo('photo-1504148455328-c376907d081c'),
  'garden-maintenance': photo('photo-1416879595882-3373a0480b5b'),
  'landscaping': photo('photo-1558904541-efa843a96f01'),
  'tree-services': photo('photo-1542273917363-3b1817f69a2d'),
  'irrigation': photo('photo-1416879595882-3373a0480b5b'),
  'outdoor-cleaning': photo('photo-1558904541-efa843a96f01'),
  'car-repair': photo('photo-1486262715619-67b85e0b08d3'),
  'auto-diagnostics': photo('photo-1492144534655-ae79c964c9d7'),
  'car-detailing': photo('photo-1601362840469-51e4d8d58785'),
  'towing': photo('photo-1449965408869-eaa3f722e40d'),
  'moving-and-delivery': photo('photo-1600518464441-9154a4dea21b'),
  'legal-consultation': photo('photo-1589829545856-d10d557cf95f'),
  'criminal-law': photo('photo-1450101499163-c8848c66ca85'),
  'civil-and-family-law': photo('photo-1476703993599-0035a21b17a9'),
  'business-and-property-law': photo('photo-1521791136064-7986c2920216'),
  'notary-and-document-services': photo('photo-1450101499163-c8848c66ca85'),
  'accounting': photo('photo-1554224155-6726b3ff858f'),
  'tax-consulting': photo('photo-1554224154-26032ffc0d07'),
  'business-registration': photo('photo-1454165804606-c3d57bc86b40'),
  'business-consulting': photo('photo-1600880292203-757bb62b4baf'),
  'hr-and-recruitment': photo('photo-1521737711867-e3b97375f902'),
  'computer-and-phone-repair': photo('photo-1518770660439-4636190af475'),
  'website-development': photo('photo-1461749280684-dccba630e2f6'),
  'app-and-software-development': photo('photo-1512941937669-90a1b58e7e9c'),
  'it-support': photo('photo-1558494949-ef010cbdcc31'),
  'cybersecurity': photo('photo-1550751827-4bd374c3f58b'),
  'digital-marketing': photo('photo-1460925895917-afdab827c52f'),
  'social-media-management': photo('photo-1611162617474-5b21e879e113'),
  'graphic-design-and-branding': photo('photo-1561070791-2526d30994b5'),
  'photography-and-videography': photo('photo-1542038784456-1ea8e935640e'),
  'content-creation': photo('photo-1516321318423-f06f85e504b3'),
  'school-tutoring': photo('photo-1503676260728-1c00da094a0b'),
  'language-lessons': photo('photo-1546410531-bb4caa6b424d'),
  'exam-preparation': photo('photo-1434030216411-0b793f4b4173'),
  'music-and-art-lessons': photo('photo-1511379938547-c1f69419868d'),
  'professional-training': photo('photo-1524178232363-1fb2b075b655'),
  'document-translation': photo('photo-1455390582262-044cdead277a'),
  'certified-translation': photo('photo-1524995997946-a1c2e315a42f'),
  'business-translation': photo('photo-1521791136064-7986c2920216'),
  'interpretation': photo('photo-1573497019940-1c28c88b4f3e'),
  'proofreading': photo('photo-1455390582262-044cdead277a'),
  'cv-writing': photo('photo-1586281380349-632531db7ed4'),
  'interview-preparation': photo('photo-1565688534245-05d6b5be184a'),
  'career-coaching': photo('photo-1551836022-d5d88e9218df'),
  'linkedin-branding': photo('photo-1611944212129-29977ae1398c'),
  'skills-development': photo('photo-1516321318423-f06f85e504b3'),
  'real-estate-agents': photo('photo-1560518883-ce09059eeffa'),
  'sales-and-rentals': photo('photo-1582407947304-fd86f028f716'),
  'property-management': photo('photo-1486406146926-c627a92ad1ab'),
  'property-valuation': photo('photo-1560518883-ce09059eeffa'),
  'real-estate-consulting': photo('photo-1560520653-9e0e4c89eb11'),
  'architecture': photo('photo-1487958449943-2429e8be8625'),
  'interior-design': photo('photo-1618221195710-dd6b41faaea6'),
  'construction-engineering': photo('photo-1503387762-592deb58ef4e'),
  '3d-modeling': photo('photo-1581091226825-a6a2a5aee158'),
  'land-surveying': photo('photo-1541888946425-d81bb19240f5'),
  'financial-consulting': photo('photo-1579621970563-ebec7560ff3e'),
  'personal-budgeting': photo('photo-1554224155-6726b3ff858f'),
  'insurance-consulting': photo('photo-1450101499163-c8848c66ca85'),
  'loans-and-financing': photo('photo-1553729459-efe14ef6055d'),
  'business-financial-planning': photo('photo-1460925895917-afdab827c52f'),
  'hairdressing': photo('photo-1560066984-138dadb4c035'),
  'makeup-and-bridal-beauty': photo('photo-1487412947147-5cebf100ffc2'),
  'nails-and-beauty-treatments': photo('photo-1604654894610-df63bc536371'),
  'skincare': photo('photo-1570172619644-dfd03ed5d881'),
  'personal-styling': photo('photo-1483985988355-763728e1935b'),
  'personal-training': photo('photo-1571019614242-c5c5dee9f50b'),
  'yoga-and-pilates': photo('photo-1544367567-0f2fcb009e0b'),
  'sports-coaching': photo('photo-1517836357463-d25dfeac3438'),
  'nutrition-and-wellness': photo('photo-1490645935967-10de6ba17061'),
  'dance-and-martial-arts': photo('photo-1508700115892-45ecd05ae2ad'),
  'event-planning': photo('photo-1511795409834-ef04bbd61622'),
  'events-and-weddings/photography-and-videography': photo('photo-1519741497674-611481863552'),
  'catering-and-cakes': photo('photo-1555244162-803834f70033'),
  'decoration': photo('photo-1464366400600-7168b8af9bc3'),
  'djs-and-entertainment': photo('photo-1511795409834-ef04bbd61622'),
  'babysitting': photo('photo-1476703993599-0035a21b17a9'),
  'elder-care': photo('photo-1576091160399-112ba8d25d1d'),
  'home-care': photo('photo-1576091160399-112ba8d25d1d'),
  'pet-sitting': photo('photo-1450778869180-41d0601e046e'),
  'pet-grooming-and-training': photo('photo-1516734212186-a967f81ad0d7'),
  'property-assistance': photo('photo-1560518883-ce09059eeffa'),
  'document-assistance': photo('photo-1450101499163-c8848c66ca85'),
  'relocation': photo('photo-1436491865332-7a61a109cc05'),
  'business-setup': photo('photo-1454165804606-c3d57bc86b40'),
  'vehicle-and-local-support': photo('photo-1449965408869-eaa3f722e40d'),
  'personal-assistance': photo('photo-1522202176988-66273c2fd55f'),
  'travel-planning': photo('photo-1488646953014-85cb44e25828'),
  'personal-shopping': photo('photo-1483985988355-763728e1935b'),
  'home-organization': photo('photo-1556912173-46c336c7fd55'),
  'tailoring': photo('photo-1556905055-8f358a7a47b2'),
  'general-consultation': photo('photo-1521791136064-7986c2920216'),
  'professional-services': photo('photo-1600880292203-757bb62b4baf'),
  'home-services': photo('photo-1560518883-ce09059eeffa'),
  'personal-services': photo('photo-1522202176988-66273c2fd55f'),
  'business-services': photo('photo-1454165804606-c3d57bc86b40'),
}

const DEFAULT_IMAGE = CATEGORY_IMAGES['other-services']

export function catalogCardImage(subcategorySlug: string, categorySlug?: string) {
  const keyed = categorySlug ? SUBCATEGORY_IMAGES[`${categorySlug}/${subcategorySlug}`] : undefined
  return keyed
    ?? SUBCATEGORY_IMAGES[subcategorySlug]
    ?? (categorySlug ? CATEGORY_IMAGES[categorySlug] : undefined)
    ?? DEFAULT_IMAGE
}

function toImageSlug(value?: string) {
  return (value || '')
    .trim()
    .toLowerCase()
    .replace(/[ëéê]/g, 'e')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export function catalogImageForLabels(subcategory?: string, category?: string) {
  return catalogCardImage(toImageSlug(subcategory), toImageSlug(category) || undefined)
}
