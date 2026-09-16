import { useEffect, useState } from 'react'
import { mediaUrl } from '../api/auth'
import {
  fetchProviderSchedule,
  formatSlotDay,
  formatSlotTime,
  type AvailabilitySlot,
} from '../api/availability'
import type { MatchIntake } from '../api/match'
import type { ServiceItem } from '../api/services'
import { useAuth } from '../auth/AuthContext'
import RateProvider from './RateProvider'
import SendRequestButton from './SendRequestButton'

const DELIVERY_LABELS: Record<string, string> = {
  online: 'Online',
  physical: 'Fizikisht',
  group: 'Grup',
}

const AUDIENCE_LABELS: Record<string, string> = {
  b2c: 'Individë (B2C)',
  b2b: 'Kompani (B2B)',
  both: 'Individë & kompani',
}

const OFFER_LABELS: Record<string, string> = {
  package: 'Paketë shërbimi',
  project: 'Projekt',
  service: 'Shërbim',
}

function formatPrice(service: ServiceItem) {
  const from = service.priceFrom
  const to = service.details?.priceTo
  if (from == null && to == null) return null
  if (from != null && to != null) return `€${from} – €${to}`
  if (from != null) return `nga €${from}`
  return `deri €${to}`
}

type Props = {
  service: ServiceItem
}

export default function ServiceCard({ service }: Props) {
  const { user } = useAuth()
  const [expanded, setExpanded] = useState(false)
  const [schedule, setSchedule] = useState<AvailabilitySlot[]>([])
  const details = service.details || {}
  const provider = service.provider
  const photo = mediaUrl(provider?.profilePhoto)
  const price = formatPrice(service)

  useEffect(() => {
    let cancelled = false
    fetchProviderSchedule(service.providerUid)
      .then((data) => {
        if (!cancelled) setSchedule(data.slots.slice(0, 8))
      })
      .catch(() => {
        if (!cancelled) setSchedule([])
      })
    return () => {
      cancelled = true
    }
  }, [service.providerUid])

  const freeSlots = schedule.filter((s) => s.status === 'open')
  const busySlots = schedule.filter((s) => s.status === 'held' || s.status === 'booked')

  const intakeDefaults: Pick<
    MatchIntake,
    'need' | 'location' | 'language' | 'urgency' | 'contact'
  > = {
    need: `${service.title} — ${service.subcategory}`,
    location: service.location || 'Online',
    language: 'Albanian',
    urgency: 'flexible',
    contact: 'chat',
  }

  const detailRows: Array<{ label: string; value: string }> = []
  if (details.serviceTypeDetail) {
    detailRows.push({ label: 'Lloji', value: details.serviceTypeDetail })
  }
  if (details.offerType) {
    detailRows.push({
      label: 'Oferta',
      value: OFFER_LABELS[details.offerType] || details.offerType,
    })
  }
  if (details.audience) {
    detailRows.push({
      label: 'Audienca',
      value: AUDIENCE_LABELS[details.audience] || details.audience,
    })
  }
  if (details.deliveryModes?.length) {
    detailRows.push({
      label: 'Mënyra',
      value: details.deliveryModes.map((m) => DELIVERY_LABELS[m] || m).join(', '),
    })
  }
  if (details.languageFrom && details.languageTo) {
    detailRows.push({
      label: 'Gjuhët',
      value: `${details.languageFrom} → ${details.languageTo}${
        details.certifiedTranslation ? ' · i certifikuar' : ''
      }`,
    })
  }
  if (details.supportLanguages?.length) {
    detailRows.push({ label: 'Mbështetje', value: details.supportLanguages.join(', ') })
  }
  if (details.licenseNumber) {
    detailRows.push({
      label: 'Licenca',
      value: `${details.licenseNumber}${details.licenseVerified ? ' · e verifikuar' : ''}`,
    })
  }
  if (details.documentsNote) {
    detailRows.push({ label: 'Dokumente', value: details.documentsNote })
  }
  if (details.deadlineNote) {
    detailRows.push({ label: 'Afatet', value: details.deadlineNote })
  }
  if (details.portfolioUrl) {
    detailRows.push({ label: 'Portfolio', value: details.portfolioUrl })
  }
  if (details.references) {
    detailRows.push({ label: 'Referenca', value: details.references })
  }

  return (
    <article className="service-card">
      <header className="service-card-head">
        <div>
          <p className="service-card-kicker">
            {service.categoryLabel || service.category}
            {service.subcategory ? ` · ${service.subcategory}` : ''}
          </p>
          <h3>{service.title}</h3>
        </div>
        {price ? <span className="service-card-price">{price}</span> : null}
      </header>

      <ul className="service-card-chips">
        <li>{service.location}</li>
        {details.deliveryModes?.slice(0, 2).map((mode) => (
          <li key={mode}>{DELIVERY_LABELS[mode] || mode}</li>
        ))}
        {details.crossBorder ? <li>Diaspora / cross-border</li> : null}
        {freeSlots.length > 0 ? (
          <li className="chip-open">{freeSlots.length} orë të lira</li>
        ) : null}
        {busySlots.length > 0 ? <li>{busySlots.length} orë të zëna</li> : null}
      </ul>

      <p className={`service-card-desc${expanded ? ' is-expanded' : ''}`}>{service.description}</p>

      {(detailRows.length > 0 || details.regulatoryNotice || details.coachingDisclaimerAccepted) && (
        <button
          type="button"
          className="ghost service-card-toggle"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? 'Fshih detajet' : 'Shiko më shumë detaje'}
        </button>
      )}

      {expanded ? (
        <div className="service-card-details">
          <dl>
            {detailRows.map((row) => (
              <div key={row.label}>
                <dt>{row.label}</dt>
                <dd>
                  {row.label === 'Portfolio' && row.value.startsWith('http') ? (
                    <a href={row.value} target="_blank" rel="noreferrer">
                      {row.value}
                    </a>
                  ) : (
                    row.value
                  )}
                </dd>
              </div>
            ))}
          </dl>
          {details.regulatoryNotice ? (
            <p className="service-card-notice">{details.regulatoryNotice}</p>
          ) : null}
          {details.coachingDisclaimerAccepted ? (
            <p className="service-card-notice">
              Coaching ≠ terapi / trajtim mjekësor.
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="service-card-provider">
        <div className="profile-avatar-md" aria-hidden>
          {photo ? <img src={photo} alt="" /> : <span>{(provider?.name || service.providerName).slice(0, 1)}</span>}
        </div>
        <div className="service-card-provider-info">
          <strong>{provider?.name || service.providerName}</strong>
          <span>
            {provider?.roleLabel || 'Ofrues'}
            {provider?.headline ? ` · ${provider.headline}` : ''}
          </span>
          <span>
            ★{' '}
            {provider && provider.ratingCount > 0
              ? `${provider.ratingAverage.toFixed(1)} (${provider.ratingCount})`
              : 'pa vlerësime'}
            {provider?.location ? ` · ${provider.location}` : ''}
          </span>
          {provider?.skills && provider.skills.length > 0 ? (
            <span className="service-card-skills">{provider.skills.slice(0, 5).join(' · ')}</span>
          ) : null}
          {provider?.languages && provider.languages.length > 0 ? (
            <span>Gjuhë: {provider.languages.join(', ')}</span>
          ) : null}
          {provider?.bio && expanded ? <p className="service-card-bio">{provider.bio}</p> : null}
        </div>
      </div>

      {schedule.length > 0 ? (
        <div className="service-card-slots">
          <p className="provider-details-label">Oraret e ofruesit</p>
          <div className="slot-time-grid slot-time-grid-compact">
            {schedule.map((slot) => {
              const free = slot.status === 'open'
              return (
                <span
                  key={slot.id}
                  className={`slot-time-chip${free ? ' is-free' : ' is-busy'}`}
                  title={`${formatSlotDay(slot.startAt)} ${formatSlotTime(slot.startAt)}`}
                >
                  <strong>{formatSlotTime(slot.startAt)}</strong>
                  <em>{free ? 'I lirë' : 'I zënë'}</em>
                </span>
              )
            })}
          </div>
        </div>
      ) : null}

      <div className="service-card-actions">
        <RateProvider
          providerUid={service.providerUid}
          providerName={provider?.name || service.providerName}
          initialAverage={provider?.ratingAverage ?? 0}
          initialCount={provider?.ratingCount ?? 0}
          compact
        />
        {user?.role === 'user' || user?.role === 'admin' || !user ? (
          <SendRequestButton
            providerUid={service.providerUid}
            providerName={provider?.name || service.providerName}
            serviceId={service.id}
            serviceTitle={service.title}
            intake={intakeDefaults}
          />
        ) : null}
      </div>
    </article>
  )
}
