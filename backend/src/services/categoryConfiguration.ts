import type { ExtensionField } from '../models/Category'
import { COACHING_DISCLAIMER, FINANCE_REGULATORY_NOTICE, type DomainRequirement } from '../data/domains'
import { serviceOptionValues } from '../data/serviceOptions'

/** Handled by the universal service form — not category-specific extension validation. */
export const UNIVERSAL_DETAIL_KEYS = new Set([
  'deliveryModes',
  'supportLanguages',
  'crossBorder',
  'portfolioUrl',
  'references',
  'experience',
  'availabilityMode',
  'priceTo',
  'photos',
])

/** Hidden on the universal service form even if present on a domain category. */
export const REMOVED_FROM_UNIVERSAL_FORM = new Set(['languageFrom', 'languageTo', 'certifiedTranslation'])

export function categorySpecificExtensionFields(fields: ExtensionField[] = []) {
  return fields.filter((field) => !UNIVERSAL_DETAIL_KEYS.has(field.key))
}

export function universalFormExtensionFields(fields: ExtensionField[] = []) {
  return categorySpecificExtensionFields(fields).filter((field) => !REMOVED_FROM_UNIVERSAL_FORM.has(field.key))
}

// One-time import mapping for historical KeshillaKos rules. Runtime validation reads Category.extensionFields.
export function legacyExtensionFields(requirements: DomainRequirement[]): ExtensionField[] {
  const fields: ExtensionField[] = []
  for (const requirement of requirements) {
    switch (requirement) {
      case 'license_verification': fields.push({ key: 'licenseNumber', type: 'string', required: true }); break
      case 'documents_deadlines': fields.push({ key: 'serviceTypeDetail', type: 'string', required: true }, { key: 'documentsNote', type: 'string' }, { key: 'deadlineNote', type: 'string' }); break
      case 'audience_b2c_b2b': fields.push({ key: 'audience', type: 'string', required: true, allowedValues: serviceOptionValues('audience') }); break
      case 'delivery_mode': fields.push({ key: 'deliveryModes', type: 'stringArray', required: true, allowedValues: serviceOptionValues('delivery-mode') }); break
      case 'language_pair': fields.push({ key: 'languageFrom', type: 'string', required: true, allowedValues: serviceOptionValues('language') }, { key: 'languageTo', type: 'string', required: true, allowedValues: serviceOptionValues('language') }, { key: 'certifiedTranslation', type: 'boolean' }); break
      case 'offer_type_packages': fields.push({ key: 'offerType', type: 'string', required: true, allowedValues: serviceOptionValues('offer-type') }, { key: 'priceTo', type: 'number' }); break
      case 'portfolio_references': fields.push({ key: 'portfolioUrl', type: 'string', oneOfGroup: 'portfolio' }, { key: 'references', type: 'string', oneOfGroup: 'portfolio' }); break
      case 'regulatory_notice': fields.push({ key: 'regulatoryNotice', type: 'string', defaultValue: FINANCE_REGULATORY_NOTICE }); break
      case 'coaching_boundary': fields.push({ key: 'coachingDisclaimerAccepted', type: 'boolean', required: true, mustBeTrue: true }, { key: 'coachingDisclaimer', type: 'string', defaultValue: COACHING_DISCLAIMER }); break
      case 'cross_border_multilingual': fields.push({ key: 'crossBorder', type: 'boolean', defaultValue: true }, { key: 'supportLanguages', type: 'stringArray', required: true, allowedValues: serviceOptionValues('language') }); break
    }
  }
  return fields
}

export function validateExtensions(fields: ExtensionField[], raw: Record<string, unknown> = {}) {
  const allowed = new Set(fields.map((field) => field.key))
  for (const key of Object.keys(raw)) {
    if (!allowed.has(key) && !UNIVERSAL_DETAIL_KEYS.has(key)) {
      throw new Error(`Unsupported category field: ${key}`)
    }
  }
  const passthrough = Object.fromEntries(
    Object.entries(raw).filter(([key]) => UNIVERSAL_DETAIL_KEYS.has(key) && !allowed.has(key)),
  )
  const value: Record<string, unknown> = { ...Object.fromEntries(Object.entries(raw).filter(([key]) => allowed.has(key))) }
  const groups = new Map<string, string[]>()
  for (const field of fields) {
    let entry = value[field.key]
    if (entry === undefined && field.defaultValue !== undefined) entry = field.defaultValue
    if (typeof entry === 'string') entry = entry.trim() || undefined
    if (Array.isArray(entry) && field.type === 'stringArray') entry = [...new Set(entry.map((item) => typeof item === 'string' ? item.trim() : item).filter(Boolean))]
    if (entry === undefined || entry === null || (Array.isArray(entry) && entry.length === 0)) {
      if (field.required) throw new Error(`Required category field: ${field.key}`)
      delete value[field.key]
    } else {
      const validType = field.type === 'stringArray' ? Array.isArray(entry) && entry.every((item) => typeof item === 'string') : typeof entry === field.type
      if (!validType || (field.mustBeTrue && entry !== true) || (field.type === 'number' && (!Number.isFinite(entry) || Number(entry) < 0))) throw new Error(`Invalid category field: ${field.key}`)
      if (field.allowedValues && (Array.isArray(entry) ? entry.some((item) => !field.allowedValues!.includes(item)) : !field.allowedValues.includes(String(entry)))) throw new Error(`Invalid category field: ${field.key}`)
      value[field.key] = entry
    }
    if (field.oneOfGroup) groups.set(field.oneOfGroup, [...(groups.get(field.oneOfGroup) ?? []), field.key])
  }
  for (const [group, keys] of groups) if (!keys.some((key) => value[key] !== undefined)) throw new Error(`One field in ${group} is required`)
  return { ...value, ...passthrough }
}
