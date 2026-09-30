import type { ReactNode } from 'react'
import { Card } from '@heroui/react'
import './Settings.css'

export function SettingsSection({
  id,
  title,
  description,
  tone = 'default',
  children,
}: {
  id: string
  title: string
  description: string
  tone?: 'default' | 'danger'
  children: ReactNode
}) {
  const headingId = `${id}-title`
  return (
    <section className={`st-section${tone === 'danger' ? ' is-danger' : ''}`} aria-labelledby={headingId}>
      <header className="st-section-head">
        <h2 id={headingId}>{title}</h2>
        <p>{description}</p>
      </header>
      <Card className="st-card">
        <ul className="st-rows">{children}</ul>
      </Card>
    </section>
  )
}

export function SettingsRow({
  label,
  value,
  description,
  action,
  leading,
}: {
  label: ReactNode
  value?: ReactNode
  description?: ReactNode
  action?: ReactNode
  leading?: ReactNode
}) {
  return (
    <li className="st-row">
      {leading ? <span className="st-row-leading">{leading}</span> : null}
      <div className="st-row-copy">
        <span className="st-row-label">{label}</span>
        {value != null ? <span className="st-row-value">{value}</span> : null}
        {description ? <span className="st-row-desc">{description}</span> : null}
      </div>
      {action ? <div className="st-row-action">{action}</div> : null}
    </li>
  )
}
