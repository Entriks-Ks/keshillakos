function photo(id: string) {
  return `https://images.unsplash.com/${id}?auto=format&fit=crop&w=640&h=800&q=80`
}

function subcategoryImage(slug: string) {
  return `/images/subcategories/${slug.replace(/\//g, '-')}.avif`
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
  'house-cleaning': subcategoryImage('house-cleaning'),
  'plumbing': subcategoryImage('plumbing'),
  'electrical-services': subcategoryImage('electrical-services'),
  'painting-and-renovation': subcategoryImage('painting-and-renovation'),
  'handyman': subcategoryImage('handyman'),
  'garden-maintenance': subcategoryImage('garden-maintenance'),
  'landscaping': subcategoryImage('landscaping'),
  'tree-services': subcategoryImage('tree-services'),
  'irrigation': subcategoryImage('irrigation'),
  'outdoor-cleaning': subcategoryImage('outdoor-cleaning'),
  'car-repair': subcategoryImage('car-repair'),
  'auto-diagnostics': subcategoryImage('auto-diagnostics'),
  'car-detailing': subcategoryImage('car-detailing'),
  'towing': subcategoryImage('towing'),
  'moving-and-delivery': subcategoryImage('moving-and-delivery'),
  'legal-consultation': subcategoryImage('legal-consultation'),
  'criminal-law': subcategoryImage('criminal-law'),
  'civil-and-family-law': subcategoryImage('civil-and-family-law'),
  'business-and-property-law': subcategoryImage('business-and-property-law'),
  'notary-and-document-services': subcategoryImage('notary-and-document-services'),
  'accounting': subcategoryImage('accounting'),
  'tax-consulting': subcategoryImage('tax-consulting'),
  'business-registration': subcategoryImage('business-registration'),
  'business-consulting': subcategoryImage('business-consulting'),
  'hr-and-recruitment': subcategoryImage('hr-and-recruitment'),
  'computer-and-phone-repair': subcategoryImage('computer-and-phone-repair'),
  'website-development': subcategoryImage('website-development'),
  'app-and-software-development': subcategoryImage('app-and-software-development'),
  'it-support': subcategoryImage('it-support'),
  'cybersecurity': subcategoryImage('cybersecurity'),
  'digital-marketing': subcategoryImage('digital-marketing'),
  'social-media-management': subcategoryImage('social-media-management'),
  'graphic-design-and-branding': subcategoryImage('graphic-design-and-branding'),
  'photography-and-videography': subcategoryImage('photography-and-videography'),
  'content-creation': subcategoryImage('content-creation'),
  'school-tutoring': subcategoryImage('school-tutoring'),
  'language-lessons': subcategoryImage('language-lessons'),
  'exam-preparation': subcategoryImage('exam-preparation'),
  'music-and-art-lessons': subcategoryImage('music-and-art-lessons'),
  'professional-training': subcategoryImage('professional-training'),
  'document-translation': subcategoryImage('document-translation'),
  'certified-translation': subcategoryImage('certified-translation'),
  'business-translation': subcategoryImage('business-translation'),
  'interpretation': subcategoryImage('interpretation'),
  'proofreading': subcategoryImage('proofreading'),
  'cv-writing': subcategoryImage('cv-writing'),
  'interview-preparation': subcategoryImage('interview-preparation'),
  'career-coaching': subcategoryImage('career-coaching'),
  'linkedin-branding': subcategoryImage('linkedin-branding'),
  'skills-development': subcategoryImage('skills-development'),
  'real-estate-agents': subcategoryImage('real-estate-agents'),
  'sales-and-rentals': subcategoryImage('sales-and-rentals'),
  'property-management': subcategoryImage('property-management'),
  'property-valuation': subcategoryImage('property-valuation'),
  'real-estate-consulting': subcategoryImage('real-estate-consulting'),
  'architecture': subcategoryImage('architecture'),
  'interior-design': subcategoryImage('interior-design'),
  'construction-engineering': subcategoryImage('construction-engineering'),
  '3d-modeling': subcategoryImage('3d-modeling'),
  'land-surveying': subcategoryImage('land-surveying'),
  'financial-consulting': subcategoryImage('financial-consulting'),
  'personal-budgeting': subcategoryImage('personal-budgeting'),
  'insurance-consulting': subcategoryImage('insurance-consulting'),
  'loans-and-financing': subcategoryImage('loans-and-financing'),
  'business-financial-planning': subcategoryImage('business-financial-planning'),
  'hairdressing': subcategoryImage('hairdressing'),
  'makeup-and-bridal-beauty': subcategoryImage('makeup-and-bridal-beauty'),
  'nails-and-beauty-treatments': subcategoryImage('nails-and-beauty-treatments'),
  'skincare': subcategoryImage('skincare'),
  'personal-styling': subcategoryImage('personal-styling'),
  'personal-training': subcategoryImage('personal-training'),
  'yoga-and-pilates': subcategoryImage('yoga-and-pilates'),
  'sports-coaching': subcategoryImage('sports-coaching'),
  'nutrition-and-wellness': subcategoryImage('nutrition-and-wellness'),
  'dance-and-martial-arts': subcategoryImage('dance-and-martial-arts'),
  'event-planning': subcategoryImage('event-planning'),
  'events-and-weddings/photography-and-videography':
    '/images/subcategories/photography-and-videography.avif',
  'catering-and-cakes': subcategoryImage('catering-and-cakes'),
  'decoration': subcategoryImage('decoration'),
  'djs-and-entertainment': subcategoryImage('djs-and-entertainment'),
  'babysitting': subcategoryImage('babysitting'),
  'elder-care': subcategoryImage('elder-care'),
  'home-care': subcategoryImage('home-care'),
  'pet-sitting': subcategoryImage('pet-sitting'),
  'pet-grooming-and-training': subcategoryImage('pet-grooming-and-training'),
  'property-assistance': subcategoryImage('property-assistance'),
  'document-assistance': subcategoryImage('document-assistance'),
  'relocation': subcategoryImage('relocation'),
  'business-setup': subcategoryImage('business-setup'),
  'vehicle-and-local-support': subcategoryImage('vehicle-and-local-support'),
  'personal-assistance': subcategoryImage('personal-assistance'),
  'travel-planning': subcategoryImage('travel-planning'),
  'personal-shopping': subcategoryImage('personal-shopping'),
  'home-organization': subcategoryImage('home-organization'),
  'tailoring': subcategoryImage('tailoring'),
  'general-consultation': subcategoryImage('general-consultation'),
  'professional-services': subcategoryImage('professional-services'),
  'home-services': subcategoryImage('home-services'),
  'personal-services': subcategoryImage('personal-services'),
  'business-services': subcategoryImage('business-services'),
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

export function catalogCategoryImage(slug?: string) {
  const src = (slug && CATEGORY_IMAGES[slug]) || DEFAULT_IMAGE
  return src.includes('images.unsplash.com') ? src.replace('w=640&h=800', 'w=1400&h=1000') : src
}

export function catalogImageForLabels(subcategory?: string, category?: string) {
  return catalogCardImage(toImageSlug(subcategory), toImageSlug(category) || undefined)
}
