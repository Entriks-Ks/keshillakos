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

// Values are supplied by /api/domains; no browser-side category catalog.
export type DomainDefinition = {
  id: string
  labelSq: string
  labelDe: string
  labels?: Record<string, string>
  guidelines?: Record<string, string>
  examples: string[]
  keywords: string[]
  requirements: DomainRequirement[]
  system: boolean
  categoryRef?: string
  portal?: string
  version?: number
}

export function domainRequires(
  domain: DomainDefinition | null | undefined,
  requirement: DomainRequirement,
) {
  return domain?.requirements.includes(requirement) ?? false
}
