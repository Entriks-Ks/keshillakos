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

/** Resolves `slug-id` and legacy bare-id params. MongoDB ids and Firebase uids never contain hyphens. */
export function idFromPublicParam(param = '') {
  return param.slice(param.lastIndexOf('-') + 1)
}
