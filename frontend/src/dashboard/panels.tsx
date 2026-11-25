import KeshillaPagination from '../components/KeshillaPagination'
import { usePagination } from '../hooks/usePagination'
import { useEffect, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation()
  const { page, setPage, pagination, receivePagination } = usePagination()
  const [revision, setRevision] = useState(0)
  const [providers, setProviders] = useState<RateableProvider[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    fetchRateableProviders({ page, limit: 20 })
      .then((items) => {
        if (!cancelled) { setProviders(items); receivePagination(items.pagination) }
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
  }, [page, revision])

  return (
    <section className="provider-section">
      <DashPageHeader
        title={t('dashUi.rateTitle')}
        description={t('dashUi.rateLead')}
      />

      {loading ? <p className="muted">{t('notifications.loading')}</p> : null}
      {error ? <p className="error">{error}</p> : null}
      {!loading && providers.length === 0 ? (
        <p className="muted">{t('dashUi.rateEmpty')}</p>
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
              onRated={() => {
                setRevision((value) => value + 1)
              }}
            />
          </li>
        ))}
      </ul>
      <KeshillaPagination pagination={pagination} onPageChange={setPage} isDisabled={loading} />
    </section>
  )
}

export function AdminDomainsPanel() {
  const { t } = useTranslation()
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
      toast.success(t('dashUi.domainCreated'))
    } catch (err) {
      toast.danger(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="provider-section">
      <DashPageHeader
        title={t('dashUi.domainsTitle')}
        description={t('dashUi.domainsLead')}
      />

      <ul className="domain-admin-list">
        {domains.map((d) => (
          <li key={d.id}>
            <strong>{d.labelSq}</strong>
            <span>
              {d.labelDe}
              {' · '}{d.system ? t('dashUi.domainSystem') : t('dashUi.domainCustom')}
            </span>
          </li>
        ))}
      </ul>

      <form onSubmit={onSubmit} className="service-form">
        <label>
          {t('dashUi.nameSq')}
          <input value={labelSq} onChange={(e) => setLabelSq(e.target.value)} required />
        </label>
        <label>
          {t('dashUi.nameDe')}
          <input value={labelDe} onChange={(e) => setLabelDe(e.target.value)} />
        </label>
        <label className="full">
          {t('dashUi.examples')}
          <input value={examples} onChange={(e) => setExamples(e.target.value)} />
        </label>
        <label className="full">
          {t('dashUi.keywords')}
          <input value={keywords} onChange={(e) => setKeywords(e.target.value)} />
        </label>
        {error ? <p className="error full">{error}</p> : null}
        <button type="submit" className="full" disabled={submitting}>
          {submitting ? t('dashUi.creating') : t('dashUi.createDomain')}
        </button>
      </form>
    </section>
  )
}
