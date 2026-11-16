function slugify(value = '') {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '')
}

function withSlug(label: string | undefined, id: string) {
  const slug = slugify(label)
  return slug && id ? `${slug}-${id}` : id
}

export function servicePath(service: { id: string; title?: string }) {
  return `/services/${withSlug(service.title, service.id)}`
}

export function providerPath(provider: { uid: string; name?: string }) {
  return `/providers/${withSlug(provider.name, provider.uid)}`
}

/** Resolves `slug-id` and legacy bare-id params. Handles MongoDB ObjectIds, Firebase UIDs, and slugs. */
export function idFromPublicParam(param = '') {
  if (!param) return ''
  const trimmed = param.trim()
  if (/^[a-f\d]{24}$/i.test(trimmed)) return trimmed

  const lastHyphen = trimmed.lastIndexOf('-')
  if (lastHyphen === -1) return trimmed

  const suffix = trimmed.slice(lastHyphen + 1)
  if (/^[a-f\d]{24}$/i.test(suffix) || suffix.length >= 16 || (suffix.length >= 4 && /\d/.test(suffix))) {
    return suffix
  }

  return trimmed
}
