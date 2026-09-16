import { SYSTEM_DOMAINS, type DomainDefinition } from '../data/domains'

export type SuggestedNeed = {
  id: string
  label: string
  labelDe: string
  examples: string[]
  keywords: string[]
}

function toSuggested(domain: DomainDefinition): SuggestedNeed {
  return {
    id: domain.id,
    label: domain.labelSq,
    labelDe: domain.labelDe,
    examples: domain.examples,
    keywords: domain.keywords,
  }
}

function normalize(text: string) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

export function suggestNeedsFromProblem(
  problem: string,
  domains: DomainDefinition[] = SYSTEM_DOMAINS,
  limit = 3,
): SuggestedNeed[] {
  const text = normalize(problem)
  if (text.length < 8) return []

  const scored = domains
    .filter((d) => d.id !== 'other')
    .map((domain) => {
      const score = domain.keywords.reduce((sum, keyword) => {
        const key = normalize(keyword)
        return text.includes(key) ? sum + (key.length > 8 ? 2 : 1) : sum
      }, 0)
      return { domain, score }
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)

  return scored.slice(0, limit).map((item) => toSuggested(item.domain))
}

export function matchesSuggestedNeed(
  haystack: string,
  needs: SuggestedNeed[],
  categoryId?: string,
): boolean {
  if (needs.length === 0) return false
  if (categoryId && needs.some((n) => n.id === categoryId)) return true

  const text = normalize(haystack)
  return needs.some((need) => {
    if (normalize(need.label).length > 2 && text.includes(normalize(need.label))) return true
    return need.keywords.some((keyword) => {
      const key = normalize(keyword)
      return key.length > 3 && text.includes(key)
    })
  })
}
