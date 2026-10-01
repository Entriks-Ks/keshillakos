import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Alert, Button, buttonVariants, Card, Label, TextArea, TextField } from '@heroui/react'
import { BadgeCheck, ExternalLink, MessageSquareReply, Star } from 'lucide-react'
import { fetchProviderRatings, respondToRating, type RatingItem } from '../api/ratings'
import ProfileAvatar from '../components/ProfileAvatar'
import { formatReviewDate, ratingBuckets, ratingWord, StarRow } from '../components/ratingUi'
import { getErrorMessage } from '../utils/errors'
import { RowsSkeleton, SectionHead } from './OverviewParts'
import './UserRequests.css'
import './DashboardSections.css'

export default function ProviderRatingsPanel({
  providerUid,
  audience = 'provider',
}: {
  providerUid: string
  audience?: 'provider' | 'company'
}) {
  const [average, setAverage] = useState(0)
  const [count, setCount] = useState(0)
  const [ratings, setRatings] = useState<RatingItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [replyId, setReplyId] = useState('')
  const [replyText, setReplyText] = useState('')
  const [replyError, setReplyError] = useState('')
  const [replying, setReplying] = useState(false)

  const reload = useCallback(() => {
    setLoading(true)
    setError('')
    setReloadKey((n) => n + 1)
  }, [])

  useEffect(() => {
    let cancelled = false
    fetchProviderRatings(providerUid)
      .then((data) => {
        if (cancelled) return
        setAverage(data.stats.average)
        setCount(data.stats.count)
        setRatings(data.ratings)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(getErrorMessage(err))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [providerUid, reloadKey])

  const buckets = useMemo(() => ratingBuckets(ratings.map((item) => item.score)), [ratings])

  async function onReply(e: FormEvent, id: string) {
    e.preventDefault()
    if (!replyText.trim()) return
    setReplying(true)
    setReplyError('')
    try {
      await respondToRating(id, replyText.trim())
      setRatings((prev) => prev.map((item) => (item.id === id ? { ...item, response: replyText.trim() } : item)))
      setReplyId('')
      setReplyText('')
    } catch (err) {
      setReplyError(getErrorMessage(err))
    } finally {
      setReplying(false)
    }
  }

  function closeReply() {
    setReplyId('')
    setReplyText('')
    setReplyError('')
  }

  return (
    <section className="uo ds">
      <header className="uo-head">
        <div className="uo-head-copy">
          <h1>Vlerësimet</h1>
          <p>
            {audience === 'company'
              ? 'Vlerësimet që klientët kanë lënë për kompaninë dhe ekspertët e saj pas punës së përfunduar.'
              : 'Vlerësimet që klientët kanë lënë pas punës së përfunduar me ty. Mund t’u përgjigjesh drejtpërdrejt.'}
          </p>
        </div>
        <Link to={`/providers/${providerUid}#vleresimet`} className={`${buttonVariants({ variant: 'outline' })} uo-primary`}>
          <ExternalLink size={16} aria-hidden />
          Shiko te profili publik
        </Link>
      </header>

      {error ? (
        <Alert status="danger" className="uo-alert">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>Vlerësimet nuk u ngarkuan</Alert.Title>
            <Alert.Description>{error}</Alert.Description>
          </Alert.Content>
          <Button size="sm" variant="outline" onPress={reload}>
            Provo përsëri
          </Button>
        </Alert>
      ) : loading ? (
        <Card className="uo-card">
          <Card.Content className="uo-card-body ds-pad-top">
            <RowsSkeleton rows={3} />
          </Card.Content>
        </Card>
      ) : ratings.length === 0 ? (
        <Card className="uo-card ur-empty">
          <span className="ur-empty-icon" aria-hidden>
            <Star size={22} />
          </span>
          <h2>Ende pa vlerësime</h2>
          <p>
            {audience === 'company'
              ? 'Pasi kompania të përfundojë një kërkesë ose takim, klienti mund të lërë yje dhe koment. Vlerësimet shfaqen këtu dhe në profilin publik.'
              : 'Pasi të përfundosh një kërkesë ose takim, klienti mund të lërë yje dhe koment. Vlerësimet shfaqen këtu dhe në profilin tënd publik.'}
          </p>
        </Card>
      ) : (
        <>
          {count > 0 ? (
            <Card className="uo-card ds-rating-summary">
              <div className="ds-rating-score">
                <strong className="ds-rating-num">{average.toFixed(1)}</strong>
                <div className="ds-rating-copy">
                  <StarRow value={average} size={16} label={`${average.toFixed(1)} nga 5 yje`} />
                  <span className="ds-rating-word">{ratingWord(average, count)}</span>
                  <span className="ds-muted">
                    {count} {count === 1 ? 'vlerësim publik' : 'vlerësime publike'}
                  </span>
                </div>
              </div>
              <ul className="ds-rating-bars" aria-label="Shpërndarja e vlerësimeve">
                {buckets.map((bucket) => (
                  <li key={bucket.stars}>
                    <span className="ds-rating-bar-label">
                      {bucket.stars}
                      <Star size={11} aria-hidden />
                    </span>
                    <span className="ds-rating-bar">
                      <em style={{ width: `${bucket.pct}%` }} />
                    </span>
                    <span className="ds-rating-bar-pct">{bucket.pct}%</span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          <Card className="uo-card ur-card">
            <SectionHead title="Të gjitha vlerësimet" meta={<span className="uo-card-meta">{ratings.length}</span>} />
            <ul className="ur-list ds-divided">
              {ratings.map((item) => (
                <li key={item.id} className="ur-item">
                  <ProfileAvatar seed={item.raterUid} size={36} alt="" />
                  <div className="ur-main">
                    <div className="ur-top">
                      <div className="ur-titles">
                        <h3 className="ur-title">{item.raterName}</h3>
                        <p className="ur-sub">
                          <time dateTime={item.createdAt}>{formatReviewDate(item.createdAt)}</time>
                          {item.providerName ? (
                            <>
                              <span aria-hidden>·</span>
                              <span>{item.providerName}</span>
                            </>
                          ) : null}
                        </p>
                      </div>
                      <StarRow value={item.score} size={14} label={`${item.score} nga 5 yje`} />
                    </div>

                    <p className={`ds-review-origin${item.verified ? ' is-verified' : ''}`}>
                      {item.verified ? <BadgeCheck size={14} aria-hidden /> : null}
                      {item.verified ? 'Punë e përfunduar në KëshillaKos' : 'Klient në KëshillaKos'}
                    </p>

                    {item.comment?.trim() ? (
                      <p className="ur-need ds-review-text">{item.comment}</p>
                    ) : (
                      <p className="ur-message">Pa koment, vetëm yje.</p>
                    )}

                    {item.response ? (
                      <div className="ur-response">
                        <div className="ur-response-head">
                          <span className="ur-response-label">Përgjigja jote</span>
                        </div>
                        <p>{item.response}</p>
                      </div>
                    ) : replyId === item.id ? (
                      <form className="ds-reply" onSubmit={(e) => void onReply(e, item.id)}>
                        <TextField fullWidth value={replyText} onChange={setReplyText} isDisabled={replying} isRequired>
                          <Label>Përgjigju klientit</Label>
                          <TextArea rows={3} maxLength={2000} placeholder="Faleminderit për feedback-un…" />
                        </TextField>
                        {replyError ? <p className="ds-error">{replyError}</p> : null}
                        <div className="ds-actions">
                          <Button type="button" variant="outline" size="sm" onPress={closeReply} isDisabled={replying}>
                            Anulo
                          </Button>
                          <Button type="submit" variant="primary" size="sm" isPending={replying} isDisabled={!replyText.trim()}>
                            {replying ? 'Duke dërguar…' : 'Dërgo përgjigjen'}
                          </Button>
                        </div>
                      </form>
                    ) : (
                      <div className="ur-foot">
                        <span />
                        <Button
                          variant="outline"
                          size="sm"
                          onPress={() => {
                            setReplyId(item.id)
                            setReplyText('')
                            setReplyError('')
                          }}
                        >
                          <MessageSquareReply size={14} aria-hidden />
                          Përgjigju
                        </Button>
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}
    </section>
  )
}
