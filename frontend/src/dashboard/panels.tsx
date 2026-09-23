import { useEffect, useState, type FormEvent } from 'react'
import { toast } from '@heroui/react'
import { createCustomDomain, fetchDomains } from '../api/domains'
import {
  fetchRateableProviders,
  type RateableProvider,
} from '../api/ratings'
import RateProvider from '../components/RateProvider'
import ProviderServicesPanel from './ProviderServicesPanel'
import { type DomainDefinition } from '../data/domains'
import { getErrorMessage } from '../utils/errors'
import DashPageHeader from './DashPageHeader'

export { ProviderServicesPanel }
export { default as CompanyExpertsPanel } from './CompanyExpertsPanel'

export function UserRateProvidersPanel() {
  const [providers, setProviders] = useState<RateableProvider[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    fetchRateableProviders()
      .then((items) => {
        if (!cancelled) setProviders(items)
      })
      .catch((err) => {
        if (!cancelled) setError(getErrorMessage(err))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <section className="provider-section">
      <DashPageHeader
        title="Si ishte shërbimi?"
        description="Këtu shfaqen ofruesit me të cilët ke përfunduar një bashkëpunim. Zgjidh yjet dhe, nëse do, shto një koment."
      />

      {loading ? <p className="muted">Duke u ngarkuar…</p> : null}
      {error ? <p className="error">{error}</p> : null}
      {!loading && providers.length === 0 ? (
        <p className="muted">
          Nuk ke ende një shërbim të përfunduar. Kur ofruesi ta shënojë kërkesën si të përfunduar, mund ta vlerësosh këtu.
        </p>
      ) : null}

      <ul className="rate-provider-list">
        {providers.map((provider) => (
          <li key={provider.providerId || provider.providerUid}>
            <div>
              <strong>{provider.providerName}</strong>
              <span className="muted">{provider.titles.slice(0, 2).join(' · ')}</span>
            </div>
            <RateProvider
              providerUid={provider.providerUid}
              providerName={provider.providerName}
              providerId={provider.providerId}
              interaction={provider.interaction}
              initialAverage={provider.average}
              initialCount={provider.count}
              onRated={(stats) => {
                setProviders((prev) =>
                  prev
                    .map((p) =>
                      p.providerUid === stats.providerUid
                        ? { ...p, average: stats.average, count: stats.count, interaction: undefined }
                        : p,
                    )
                    .filter((p) => p.providerUid !== stats.providerUid || Boolean(p.interaction)),
                )
              }}
            />
          </li>
        ))}
      </ul>
    </section>
  )
}

export function AdminDomainsPanel() {
  const [domains, setDomains] = useState<DomainDefinition[]>([])
  const [labelSq, setLabelSq] = useState('')
  const [labelDe, setLabelDe] = useState('')
  const [examples, setExamples] = useState('')
  const [keywords, setKeywords] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetchDomains().then(setDomains).catch(() => undefined)
  }, [])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const domain = await createCustomDomain({
        labelSq,
        labelDe: labelDe || labelSq,
        examples: examples
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        keywords: keywords
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      })
      setDomains((prev) => {
        const withoutOther = prev.filter((d) => d.id !== 'other')
        const other = prev.find((d) => d.id === 'other')
        return [...withoutOther, domain, ...(other ? [other] : [])]
      })
      setLabelSq('')
      setLabelDe('')
      setExamples('')
      setKeywords('')
      toast.success('Kategoria e re u krijua (Ekspertë të tjerë / custom).')
    } catch (err) {
      toast.danger(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="provider-section">
      <DashPageHeader
        title="Kategori"
        description="Sistemi ka domenet bazë. Këtu shto kategori të reja kur del një shërbim që nuk hyn te ato ekzistuese."
      />

      <ul className="domain-admin-list">
        {domains.map((d) => (
          <li key={d.id}>
            <strong>{d.labelSq}</strong>
            <span>
              {d.labelDe}
              {d.system ? ' · sistem' : ' · custom'}
            </span>
          </li>
        ))}
      </ul>

      <form onSubmit={onSubmit} className="service-form">
        <label>
          Emri (SQ)
          <input value={labelSq} onChange={(e) => setLabelSq(e.target.value)} required />
        </label>
        <label>
          Emri (DE)
          <input value={labelDe} onChange={(e) => setLabelDe(e.target.value)} />
        </label>
        <label className="full">
          Shembuj (ndarë me presje)
          <input value={examples} onChange={(e) => setExamples(e.target.value)} />
        </label>
        <label className="full">
          Keywords (ndarë me presje)
          <input value={keywords} onChange={(e) => setKeywords(e.target.value)} />
        </label>
        {error ? <p className="error full">{error}</p> : null}
        <button type="submit" className="full" disabled={submitting}>
          {submitting ? 'Duke krijuar...' : 'Krijo kategori të re'}
        </button>
      </form>
    </section>
  )
}
