/** Hide raw catalog/mongo ids that leak into public card copy. */
export function looksLikeCatalogId(value: string): boolean {
  const text = value.trim()
  if (!text) return true
  if (/^[a-f\d]{24}$/i.test(text)) return true
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)) return true
  return false
}

export function humanLabels(values: Array<string | null | undefined>, knownIds: string[] = []): string[] {
  const idSet = new Set(knownIds.filter(Boolean).map((id) => id.trim().toLowerCase()))
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of values) {
    const value = (raw || '').trim()
    if (!value) continue
    if (idSet.has(value.toLowerCase()) || looksLikeCatalogId(value)) continue
    const key = value.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(value)
  }
  return out
}
