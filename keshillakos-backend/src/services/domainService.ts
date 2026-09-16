import { SYSTEM_DOMAINS, type DomainDefinition } from '../data/domains'
import { CustomCategory } from '../models/CustomCategory'

function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
}

export async function listAllDomains(): Promise<DomainDefinition[]> {
  const custom = await CustomCategory.find({ active: true }).sort({ createdAt: -1 }).lean()
  const customDomains: DomainDefinition[] = custom.map((item) => ({
    id: item.slug,
    labelSq: item.labelSq,
    labelDe: item.labelDe,
    examples: item.examples ?? [],
    keywords: item.keywords ?? [],
    requirements: [],
    system: false,
  }))

  // Keep "other" last; insert custom before it
  const systemWithoutOther = SYSTEM_DOMAINS.filter((d) => d.id !== 'other')
  const other = SYSTEM_DOMAINS.find((d) => d.id === 'other')
  return [...systemWithoutOther, ...customDomains, ...(other ? [other] : [])]
}

export async function findDomainById(id: string): Promise<DomainDefinition | null> {
  const system = SYSTEM_DOMAINS.find((d) => d.id === id)
  if (system) return system

  const custom = await CustomCategory.findOne({ slug: id, active: true }).lean()
  if (!custom) return null

  return {
    id: custom.slug,
    labelSq: custom.labelSq,
    labelDe: custom.labelDe,
    examples: custom.examples ?? [],
    keywords: custom.keywords ?? [],
    requirements: [],
    system: false,
  }
}

export async function createCustomDomain(input: {
  labelSq: string
  labelDe: string
  examples?: string[]
  keywords?: string[]
  createdByUid: string
}) {
  const base = slugify(input.labelSq) || slugify(input.labelDe) || `custom-${Date.now()}`
  let slug = base
  let i = 1
  while (await CustomCategory.exists({ slug })) {
    slug = `${base}-${i++}`
  }

  const doc = await CustomCategory.create({
    slug,
    labelSq: input.labelSq.trim(),
    labelDe: input.labelDe.trim() || input.labelSq.trim(),
    examples: (input.examples ?? []).map((e) => e.trim()).filter(Boolean),
    keywords: (input.keywords ?? []).map((k) => k.trim().toLowerCase()).filter(Boolean),
    createdByUid: input.createdByUid,
    active: true,
  })

  return {
    id: doc.slug,
    labelSq: doc.labelSq,
    labelDe: doc.labelDe,
    examples: doc.examples,
    keywords: doc.keywords,
    requirements: [] as const,
    system: false,
  }
}
