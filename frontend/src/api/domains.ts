import api from './auth'
import type { DomainDefinition } from '../data/domains'

export async function fetchDomains() {
  const { data } = await api.get<{ domains: DomainDefinition[] }>('/api/domains')
  return data.domains
}

export async function createCustomDomain(payload: {
  labelSq: string
  labelDe: string
  examples?: string[]
  keywords?: string[]
}) {
  const { data } = await api.post<{ domain: DomainDefinition }>('/api/domains', payload)
  return data.domain
}
