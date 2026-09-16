export type DomainRequirement =
  | "license_verification"
  | "documents_deadlines"
  | "audience_b2c_b2b"
  | "delivery_mode"
  | "language_pair"
  | "offer_type_packages"
  | "portfolio_references"
  | "regulatory_notice"
  | "coaching_boundary"
  | "cross_border_multilingual";

// Values are supplied by /api/domains; no browser-side category catalog.
export type DomainDefinition = {
  id: string;
  labelSq: string;
  labelDe: string;
  labels?: Record<string, string>;
  guidelines?: Record<string, string>;
  examples: string[];
  keywords: string[];
  requirements: DomainRequirement[];
  system: boolean;
  categoryRef?: string;
  portal?: string;
  version?: number;
};

export const LANGUAGE_OPTIONS = [
  "Shqip",
  "Gjermanisht",
  "Anglisht",
  "Turqisht",
  "Frëngjisht",
] as const;

export const DELIVERY_MODES = [
  { id: "online", label: "Online" },
  { id: "physical", label: "Fizikisht" },
  { id: "group", label: "Grup" },
] as const;

export const AUDIENCE_OPTIONS = [
  { id: "b2c", label: "B2C — individ" },
  { id: "b2b", label: "B2B — kompani" },
  { id: "both", label: "B2C dhe B2B" },
] as const;

export const OFFER_TYPES = [
  { id: "package", label: "Service Package" },
  { id: "project", label: "Project" },
  { id: "service", label: "Shërbim i thjeshtë" },
] as const;

export function domainRequires(
  domain: DomainDefinition | null | undefined,
  requirement: DomainRequirement,
) {
  return domain?.requirements.includes(requirement) ?? false;
}
