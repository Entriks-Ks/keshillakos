import type { ReactNode } from 'react'

type DashPageHeaderProps = {
  title: string
  description?: string
  actions?: ReactNode
  tone?: 'default' | 'hero'
}

export default function DashPageHeader({
  title,
  description,
  actions,
  tone = 'default',
}: DashPageHeaderProps) {
  return (
    <header className={`dash-page-head${tone === 'hero' ? ' is-hero' : ''}`}>
      <div className="dash-page-head-copy">
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
      {actions ? <div className="dash-page-head-actions">{actions}</div> : null}
    </header>
  )
}
