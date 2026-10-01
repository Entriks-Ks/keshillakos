import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Card, Chip, ProgressBar, Separator, Skeleton } from '@heroui/react'
import { ArrowRight, Inbox } from 'lucide-react'
import type { ChatPeer, ConversationItem } from '../api/chat'
import type { ProfileCompletion } from '../api/profileCompletion'
import type { ServiceRequestItem } from '../api/requests'
import type { ServiceItem } from '../api/services'
import ProfileAvatar from '../components/ProfileAvatar'
import { formatServicePrice } from '../utils/serviceDiscovery'
import { formatAmount, formatWhen, REQUEST_STATUS, type ChipColor } from './requestDisplay'
import './UserOverview.css'

export type ActivityEntry = {
  id: string
  title: string
  detail: string
  at: string
  to: string
  peer?: ChatPeer
  status?: { label: string; color: ChipColor }
  unread?: number
  /** Bold row, e.g. a request that still needs a response. */
  emphasize?: boolean
}

export type OverviewStat = {
  label: string
  value: ReactNode
  hint: string
  to: string
  highlight?: boolean
}

export function timeGreeting(hour: number) {
  if (hour < 12) return 'Mirëmëngjes'
  if (hour < 18) return 'Mirëdita'
  return 'Mirëmbrëma'
}

export function SectionHead({ title, meta, action }: { title: string; meta?: ReactNode; action?: ReactNode }) {
  return (
    <Card.Header className="uo-card-head">
      <div className="uo-card-heading">
        <Card.Title className="uo-card-title">{title}</Card.Title>
        {meta}
      </div>
      {action}
    </Card.Header>
  )
}

export function TextLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="uo-link">
      {children}
      <ArrowRight size={14} aria-hidden />
    </Link>
  )
}

export function RowsSkeleton({ rows }: { rows: number }) {
  return (
    <ul className="uo-rows" aria-busy="true">
      {Array.from({ length: rows }).map((_, i) => (
        <li key={i} className="uo-row is-skeleton">
          <Skeleton className="uo-skel-avatar" />
          <span className="uo-row-copy">
            <Skeleton className="uo-skel-line is-wide" />
            <Skeleton className="uo-skel-line" />
          </span>
        </li>
      ))}
    </ul>
  )
}

export function EmptyBlock({ title, text, action }: { title: string; text: string; action?: ReactNode }) {
  return (
    <div className="uo-empty">
      <strong>{title}</strong>
      <p>{text}</p>
      {action}
    </div>
  )
}

export function conversationEntries(conversations: ConversationItem[], messagesPath: string): ActivityEntry[] {
  return conversations
    .filter((item) => item.lastMessageAt)
    .map((item) => ({
      id: `c-${item.id}`,
      title: item.peer.name,
      detail: item.lastMessagePreview || item.serviceTitle || 'Bisedë',
      at: item.lastMessageAt as string,
      to: `${messagesPath}?c=${item.id}`,
      peer: item.peer,
      unread: item.unread,
    }))
}

export function latestActivity(entries: ActivityEntry[], limit = 6) {
  return [...entries].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()).slice(0, limit)
}

function receivedRequestDetail(item: ServiceRequestItem) {
  const client = item.seekerName || 'Klienti'
  if (item.offer) {
    const amount = formatAmount(item.offer)
    return `Dërgove ofertë te ${client}${amount ? ` · ${amount}` : ''}`
  }
  switch (item.status) {
    case 'accepted':
      return `Pranove kërkesën e ${client}`
    case 'completed':
      return `Përfunduar me ${client}`
    case 'rejected':
      return `Refuzove kërkesën e ${client}`
    case 'withdrawn':
      return `${client} e tërhoqi kërkesën`
    default:
      return `Kërkesë nga ${client}`
  }
}

/** Latest received requests and conversations, for the expert and company overviews. */
export function inboxActivity(
  requests: ServiceRequestItem[],
  conversations: ConversationItem[],
  inboxPath: string,
  messagesPath: string,
): ActivityEntry[] {
  const fromRequests = requests.map((item) => ({
    id: `r-${item.id}`,
    title: item.need || item.serviceTitle || 'Kërkesë',
    detail: receivedRequestDetail(item),
    at: item.updatedAt || item.createdAt,
    to: inboxPath,
    status: REQUEST_STATUS[item.status] ?? { label: item.status, color: 'default' as const },
    emphasize: item.status === 'pending' || item.status === 'open',
  }))
  return latestActivity([...fromRequests, ...conversationEntries(conversations, messagesPath)])
}

export function ActivityRows({ entries }: { entries: ActivityEntry[] }) {
  return (
    <ul className="uo-rows">
      {entries.map((entry) => (
        <li key={entry.id}>
          <Link to={entry.to} className={`uo-row${entry.unread || entry.emphasize ? ' is-unread' : ''}`}>
            {entry.peer ? (
              <ProfileAvatar src={entry.peer.profilePhoto} seed={entry.peer.uid} size={36} alt="" />
            ) : (
              <span className="uo-row-icon" aria-hidden>
                <Inbox size={16} />
              </span>
            )}
            <span className="uo-row-copy">
              <strong>{entry.title}</strong>
              <span>{entry.detail}</span>
            </span>
            <span className="uo-row-end">
              {entry.status ? (
                <Chip size="sm" variant="soft" color={entry.status.color}>
                  <Chip.Label>{entry.status.label}</Chip.Label>
                </Chip>
              ) : entry.unread ? (
                <span className="uo-unread" aria-label={`${entry.unread} të palexuara`}>
                  {entry.unread}
                </span>
              ) : null}
              <time dateTime={entry.at}>{formatWhen(entry.at)}</time>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}

/** Active services first, then newest. */
export function ServiceRows({ services, limit = 3 }: { services: ServiceItem[]; limit?: number }) {
  const recent = [...services]
    .sort((a, b) => Number(b.active) - Number(a.active) || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit)
  return (
    <ul className="uo-rows">
      {recent.map((service) => {
        const price = formatServicePrice(service)
        return (
          <li key={service.id}>
            <div className="uo-row is-static">
              <span className="uo-row-copy">
                <strong>{service.title}</strong>
                <span>{[service.categoryLabel || service.category, price].filter(Boolean).join(' · ')}</span>
              </span>
              <Chip size="sm" variant="soft" color={service.active ? 'success' : 'default'}>
                <Chip.Label>{service.active ? 'Aktiv' : 'Joaktiv'}</Chip.Label>
              </Chip>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

export function StatsStrip({ stats, loading }: { stats: OverviewStat[]; loading: boolean }) {
  return (
    <Card className="uo-card uo-stats">
      <ul className="uo-stats-list" aria-label="Statistika">
        {stats.map((stat) => (
          <li key={stat.label}>
            <Link to={stat.to} className="uo-stat">
              <span className="uo-stat-label">{stat.label}</span>
              {loading ? (
                <Skeleton className="uo-skel-value" />
              ) : (
                <strong className={`uo-stat-value${stat.highlight ? ' is-highlight' : ''}`}>{stat.value}</strong>
              )}
              {loading ? <Skeleton className="uo-skel-line" /> : <span className="uo-stat-hint">{stat.hint}</span>}
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  )
}

export function ProfileSetupCard({ completion, to }: { completion: ProfileCompletion; to: string }) {
  const percent = Math.max(0, Math.min(100, Math.round(completion.overallPercent ?? 0)))
  const missing = completion.section.missingRequired
  const shown = missing.slice(0, 4)

  return (
    <Card className="uo-card">
      <SectionHead title="Plotëso profilin" meta={<span className="uo-card-meta is-strong">{percent}%</span>} />
      <Card.Content className="uo-card-body uo-setup">
        <ProgressBar aria-label="Plotësimi i profilit" value={percent} className="uo-progress">
          <ProgressBar.Track>
            <ProgressBar.Fill />
          </ProgressBar.Track>
        </ProgressBar>
        {shown.length > 0 ? (
          <div className="uo-missing">
            <span>Mungojnë:</span>
            {shown.map((field) => (
              <Chip key={field.key} size="sm" variant="soft">
                <Chip.Label>{field.label}</Chip.Label>
              </Chip>
            ))}
            {missing.length > shown.length ? <span>+{missing.length - shown.length}</span> : null}
          </div>
        ) : null}
        <Separator />
        <TextLink to={to}>Përditëso profilin</TextLink>
      </Card.Content>
    </Card>
  )
}
