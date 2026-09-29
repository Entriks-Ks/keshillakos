import type { CatalogCategory } from '../api/catalog'
import type { MarketplaceProvider } from '../api/providerProfiles'

type UnknownRecord = Record<string, unknown>

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function optionalText(value: unknown): string | undefined {
  return text(value) || undefined
}

function textList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map(text).filter(Boolean)
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

const MONGO_ID = /^[a-f\d]{24}$/i

/**
 * Coerces one `/api/providers` entry into a safe `MarketplaceProvider`.
 * Older API builds return the owner-profile shape (`publicProfile`, no `uid`/`categoryLabels`),
 * so every list field is forced to `string[]` and entries without a public `uid` are dropped.
 */
export function normalizeMarketplaceProvider(raw: unknown): MarketplaceProvider | null {
  if (!isRecord(raw)) return null
  const profile = isRecord(raw.publicProfile) ? raw.publicProfile : {}
  const uid = text(raw.uid)
  const name = text(raw.name) || text(profile.displayName)
  if (!uid || !name) return null

  const verification = isRecord(raw.verification)
    ? {
        identity: optionalText(raw.verification.identity),
        business: optionalText(raw.verification.business),
        qualification: optionalText(raw.verification.qualification),
      }
    : undefined
  const featured = isRecord(raw.featuredExpert) ? raw.featuredExpert : null
  const featuredUid = featured ? text(featured.uid) : ''
  const featuredName = featured ? text(featured.name) : ''

  return {
    id: text(raw.id) || text(raw._id) || uid,
    uid,
    providerType: raw.providerType === 'business' ? 'business' : 'individual',
    businessId: optionalText(raw.businessId),
    name,
    title: optionalText(raw.title) ?? optionalText(profile.title),
    photoUrl: optionalText(raw.photoUrl) ?? optionalText(profile.photoUrl),
    description: optionalText(raw.description)
      ?? optionalText(profile.shortDescription)
      ?? optionalText(profile.description)
      ?? optionalText(raw.experience),
    location: optionalText(raw.location),
    languages: textList(raw.languages),
    modes: textList(raw.modes).filter((mode): mode is 'online' | 'on_site' => mode === 'online' || mode === 'on_site'),
    categories: textList(raw.categories),
    categoryLabels: textList(raw.categoryLabels),
    specializations: textList(raw.specializations),
    yearsOfExperience: finiteNumber(raw.yearsOfExperience),
    experience: optionalText(raw.experience),
    verification,
    ratingAverage: finiteNumber(raw.ratingAverage) ?? 0,
    ratingCount: finiteNumber(raw.ratingCount) ?? 0,
    expertCount: finiteNumber(raw.expertCount),
    serviceCount: finiteNumber(raw.serviceCount) ?? 0,
    publicPhone: optionalText(raw.publicPhone) ?? optionalText(profile.publicPhone),
    publicEmail: optionalText(raw.publicEmail) ?? optionalText(profile.publicEmail),
    website: optionalText(raw.website),
    companyName: optionalText(raw.companyName),
    featuredExpert: featuredUid && featuredName
      ? {
          uid: featuredUid,
          name: featuredName,
          title: optionalText(featured?.title),
          photoUrl: optionalText(featured?.photoUrl),
        }
      : undefined,
    updatedAt: optionalText(raw.updatedAt),
    createdAt: optionalText(raw.createdAt),
  }
}

export function normalizeMarketplaceProviders(raw: unknown): MarketplaceProvider[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map(normalizeMarketplaceProvider)
    .filter((provider): provider is MarketplaceProvider => provider !== null)
}

type LabelSource = Pick<CatalogCategory, '_id' | 'stableId' | 'slug' | 'name'>

/**
 * Resolves `categories` (catalog `_id`, `stableId` or `slug`) to display labels and merges them
 * with labels the API already sent. Unresolved raw identifiers never become labels.
 */
export function withCategoryLabels(provider: MarketplaceProvider, catalog: LabelSource[]): MarketplaceProvider {
  const labelByKey = new Map<string, string>()
  for (const category of catalog) {
    const label = category.name?.sq || category.name?.en
    if (!label) continue
    for (const key of [category._id, category.stableId, category.slug]) {
      if (key) labelByKey.set(key.toLowerCase(), label)
    }
  }
  const categoryKeys = new Set(provider.categories.map((id) => id.toLowerCase()))
  const seen = new Set<string>()
  const labels: string[] = []
  const add = (label: string | undefined) => {
    if (!label) return
    const key = label.toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    labels.push(label)
  }
  for (const id of provider.categories) add(labelByKey.get(id.toLowerCase()))
  for (const label of provider.categoryLabels) {
    const lower = label.toLowerCase()
    if (MONGO_ID.test(label)) continue
    if (categoryKeys.has(lower)) {
      add(labelByKey.get(lower))
      continue
    }
    add(label)
  }
  return { ...provider, categoryLabels: labels }
}
