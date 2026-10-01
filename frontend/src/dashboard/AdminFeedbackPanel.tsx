import { useEffect, useState } from 'react'
import { Alert, Button, Card, Chip, toast } from '@heroui/react'
import { fetchPlatformFeedback, markPlatformFeedbackRead, type PlatformFeedbackItem } from '../api/feedback'
import ProfileAvatar from '../components/ProfileAvatar'
import { getErrorMessage } from '../utils/errors'
import { EmptyBlock, RowsSkeleton, SectionHead } from './OverviewParts'
import './UserOverview.css'
import './DashboardSections.css'
import './AdminDashboard.css'

function formatDate(value: string) {
  try {
    return new Date(value).toLocaleString('sq-AL', { dateStyle: 'medium', timeStyle: 'short' })
  } catch {
    return value
  }
}

export default function AdminFeedbackPanel() {
  const [items, setItems] = useState<PlatformFeedbackItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState('')

  async function load() {
    setLoading(true)
    try {
      setItems(await fetchPlatformFeedback())
      setError('')
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  async function onRead(id: string) {
    setBusyId(id)
    try {
      const updated = await markPlatformFeedbackRead(id)
      setItems((current) => current.map((item) => (item.id === id ? updated : item)))
      toast.success('U shënua si i lexuar.')
    } catch (err) {
      toast.danger(getErrorMessage(err))
    } finally {
      setBusyId('')
    }
  }

  const fresh = items.filter((item) => item.status === 'new').length

  return (
    <section className="uo ds ad">
      <header className="uo-head"><div className="uo-head-copy"><h1>Feedback</h1><p>Mesazhet që vizitorët dhe përdoruesit dërgojnë për KëshillaKos nga fundi i faqes.</p></div></header>
      {error ? <Alert status="danger" className="uo-alert"><Alert.Indicator /><Alert.Content><Alert.Title>Feedback nuk u ngarkua</Alert.Title><Alert.Description>{error}</Alert.Description></Alert.Content></Alert> : null}
      <Card className="uo-card">
        <SectionHead title="Mesazhet" meta={!loading ? <span className="uo-card-meta">{fresh === 1 ? '1 i palexuar' : `${fresh} të palexuar`}</span> : null} />
        {loading ? <Card.Content className="uo-card-body"><RowsSkeleton rows={4} /></Card.Content> : !error && items.length === 0 ? <EmptyBlock title="Ende nuk ka feedback" text="Mesazhet e dërguara nga platforma do të shfaqen këtu." /> : null}
        {!loading && items.length > 0 ? <ul className="ad-feedback-list">
            {items.map((item) => (
              <li key={item.id}>
                <ProfileAvatar seed={item.email || item.id} size={40} alt="" />
                <div className="ad-feedback-main">
                  <div className="ad-feedback-head"><strong>{item.name || 'Pa emër'}</strong>{item.status === 'new' ? <Chip size="sm" variant="soft" color="accent"><Chip.Label>E re</Chip.Label></Chip> : null}</div>
                  <span>{item.email} · <time dateTime={item.createdAt}>{formatDate(item.createdAt)}</time></span>
                  <p>{item.message}</p>
                {item.status === 'new' ? (
                  <div className="ad-feedback-actions">
                    <Button size="sm" variant="outline" isPending={busyId === item.id} onPress={() => void onRead(item.id)}>
                      {busyId === item.id ? 'Duke ruajtur…' : 'Shëno si të lexuar'}
                    </Button>
                  </div>
                ) : null}
                </div>
              </li>
            ))}
          </ul> : null}
      </Card>
    </section>
  )
}
