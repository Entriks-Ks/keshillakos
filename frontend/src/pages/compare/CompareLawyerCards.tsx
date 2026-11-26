import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Award,
  BadgeCheck,
  Briefcase,
  Calendar,
  Check,
  ClipboardCheck,
  Clock,
  Coins,
  ExternalLink,
  Globe,
  GraduationCap,
  MapPin,
  Trophy,
  Video,
  X,
} from 'lucide-react'
import { Chip, Skeleton } from '@heroui/react'
import type { ProviderComparisonItem } from '../../api/providers'
import ProfileAvatar from '../../components/ProfileAvatar'
import { RatingMeta } from '../../components/ProviderCardParts'
import SendRequestButton from '../../components/SendRequestButton'
import StartChatButton from '../../components/StartChatButton'
import type { I18nText, LawyerVerdict } from '../../utils/compareAnalyzer'
import { humanLabels } from '../../utils/displayLabels'
import { formatServicePrice } from '../../utils/serviceDiscovery'
import BadgeIcon from './BadgeIcon'
import {
  LAWYER_COLORS,
  firstName,
  formatDateLocale,
  intakeFor,
  isVerifiedLawyer,
  lawyerHasOnline,
  minServicePrice,
  profileUrlFor,
  publishedLanguages,
  sortedOpenSlots,
  type CompareAdvantages,
} from './compareShared'
import './CompareLawyerCards.css'

/** Specialisations shown before the "+N more" toggle. */
const SPEC_PREVIEW = 5

type Translate = (key: string, params?: Record<string, string | number>) => string

type CardsProps = {
  items: ProviderComparisonItem[]
  verdicts: Record<string, LawyerVerdict>
  tx: (value: I18nText) => string
  spotlightUid: string
  highlightDiff: boolean
  advantages: CompareAdvantages
  /** The page's intent pills ("what matters most"), rendered in this section's header. */
  intentFilter: ReactNode
  onRemove: (uid: string) => void
}

/**
 * Phone & tablet comparison: one card per lawyer in a swipeable, snap-scrolling track.
 * Cards share their section rows through CSS subgrid, so a given criterion sits at the same
 * height in every card: swiping between lawyers keeps the reader on the same line.
 * A sticky selector shows which lawyer(s) are on screen; on phones a sticky bar keeps the
 * booking/chat actions of the lawyer in view one tap away.
 */
export default function CompareLawyerCards({
  items,
  verdicts,
  tx,
  spotlightUid,
  highlightDiff,
  advantages,
  intentFilter,
  onRemove,
}: CardsProps) {
  const { t } = useTranslation()
  const translate: Translate = (key, params) => t(key, params)
  const trackRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState<number[]>([0])
  const [expandedSpecs, setExpandedSpecs] = useState<Record<string, boolean>>({})

  const active = Math.min(visible[0] ?? 0, Math.max(0, items.length - 1))
  const activeItem = items[active]

  /** A card counts as on screen when its centre is inside the track's visible box. */
  const measure = useCallback(() => {
    const track = trackRef.current
    if (!track) return
    const box = track.getBoundingClientRect()
    const next: number[] = []
    Array.from(track.children).forEach((child, index) => {
      const rect = child.getBoundingClientRect()
      const centre = rect.left + rect.width / 2
      if (centre >= box.left && centre <= box.right) next.push(index)
    })
    if (next.length) setVisible((prev) => (prev.join() === next.join() ? prev : next))
  }, [])

  useEffect(() => {
    const track = trackRef.current
    if (!track) return
    let frame = 0
    const schedule = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(measure)
    }
    track.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    schedule()
    return () => {
      cancelAnimationFrame(frame)
      track.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
    }
  }, [measure, items.length])

  const scrollToIndex = useCallback((index: number) => {
    const track = trackRef.current
    const card = track?.children[index] as HTMLElement | undefined
    if (!track || !card) return
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const padding = parseFloat(getComputedStyle(track).paddingLeft) || 0
    track.scrollTo({ left: card.offsetLeft - padding, behavior: reduceMotion ? 'auto' : 'smooth' })
  }, [])

  // Picking an intent ("cheapest", "fastest"...) brings its winning lawyer into view.
  useEffect(() => {
    if (!spotlightUid) return
    const index = items.findIndex((item) => item.uid === spotlightUid)
    if (index >= 0) scrollToIndex(index)
  }, [spotlightUid, items, scrollToIndex])

  return (
    <section
      className="kk-mcmp"
      aria-labelledby="mcmp-heading"
      data-cols={items.length}
      style={{ '--cols': items.length } as CSSProperties}
    >
      <div className="kk-mcmp-head">
        <span className="kk-verdict-tag">
          <ClipboardCheck size={13} aria-hidden />
          <span>{t('compareUi.verdict.tag')}</span>
        </span>
        <h2 id="mcmp-heading" className="kk-mcmp-title">
          {t('compareUi.cards.title')}
        </h2>
        <p className="kk-mcmp-lead">{t('compareUi.cards.lead')}</p>
        {intentFilter}
      </div>

      <div className="kk-mcmp-selector" role="group" aria-label={t('compareUi.cards.selector')}>
        {items.map((item, index) => {
          const isOnScreen = visible.includes(index)
          return (
            <button
              key={item.uid}
              type="button"
              className={`kk-mcmp-chip${isOnScreen ? ' is-visible' : ''}${item.uid === spotlightUid ? ' is-spotlight' : ''}`}
              aria-current={isOnScreen ? 'true' : undefined}
              onClick={() => scrollToIndex(index)}
              style={{ '--lawyer': LAWYER_COLORS[index] } as CSSProperties}
            >
              <span className="kk-mcmp-chip-avatar">
                <ProfileAvatar
                  src={item.profile?.photoUrl || item.provider.profilePhoto}
                  seed={item.uid}
                  size="fill"
                  alt=""
                />
              </span>
              <span className="kk-mcmp-chip-name">{firstName(item)}</span>
              {item.uid === spotlightUid ? <Trophy size={12} className="kk-mcmp-chip-trophy" aria-hidden /> : null}
            </button>
          )
        })}
      </div>

      <div
        ref={trackRef}
        className="kk-mcmp-track"
        role="region"
        aria-label={t('compareUi.table.label')}
        tabIndex={0}
      >
        {items.map((item, index) => (
          <LawyerCard
            key={item.uid}
            item={item}
            index={index}
            total={items.length}
            verdict={verdicts[item.uid]}
            tx={tx}
            t={translate}
            isSpotlight={item.uid === spotlightUid}
            highlightDiff={highlightDiff}
            advantages={advantages}
            specsExpanded={Boolean(expandedSpecs[item.uid])}
            onToggleSpecs={() =>
              setExpandedSpecs((prev) => ({ ...prev, [item.uid]: !prev[item.uid] }))
            }
            onRemove={onRemove}
          />
        ))}
      </div>

      {/* Phones: the actions of the lawyer on screen stay one tap away */}
      {activeItem ? (
        <div
          className="kk-mcmp-actionbar"
          style={{ '--lawyer': LAWYER_COLORS[active] } as CSSProperties}
        >
          <span className="kk-mcmp-actionbar-who">
            <span className="kk-mcmp-actionbar-avatar">
              <ProfileAvatar
                src={activeItem.profile?.photoUrl || activeItem.provider.profilePhoto}
                seed={activeItem.uid}
                size="fill"
                alt=""
              />
            </span>
            <span className="kk-mcmp-actionbar-text">
              <strong>{activeItem.provider.name}</strong>
              <small>{t('compareUi.cards.position', { index: active + 1, total: items.length })}</small>
            </span>
          </span>
          <div className="kk-mcmp-actionbar-btns" key={activeItem.uid}>
            <StartChatButton
              providerUid={activeItem.uid}
              providerName={activeItem.provider.name}
              hideGuestHint
              label={t('compareUi.cards.chat')}
              className="kk-mcmp-chat-btn"
            />
            <SendRequestButton
              providerUid={activeItem.uid}
              providerName={activeItem.provider.name}
              intake={intakeFor(activeItem, translate)}
              compact
              ctaLabel={t('compareUi.cards.book')}
            />
          </div>
        </div>
      ) : null}
    </section>
  )
}

type CardProps = {
  item: ProviderComparisonItem
  index: number
  total: number
  verdict: LawyerVerdict | undefined
  tx: (value: I18nText) => string
  t: Translate
  isSpotlight: boolean
  highlightDiff: boolean
  advantages: CompareAdvantages
  specsExpanded: boolean
  onToggleSpecs: () => void
  onRemove: (uid: string) => void
}

function AdvantageBadge({ show, label, hint }: { show: boolean; label: string; hint: string }) {
  if (!show) return null
  return (
    <span className="kk-advantage-badge" title={hint}>
      {label}
    </span>
  )
}

/** Section label on the left, the criterion's headline value on the right. */
function SectionLabel({ icon, label, value }: { icon: ReactNode; label: string; value?: ReactNode }) {
  return (
    <div className="kk-mcard-label">
      <h3>
        {icon}
        <span>{label}</span>
      </h3>
      {value ? <span className="kk-mcard-value">{value}</span> : null}
    </div>
  )
}

function LawyerCard({
  item,
  index,
  total,
  verdict,
  tx,
  t,
  isSpotlight,
  highlightDiff,
  advantages,
  specsExpanded,
  onToggleSpecs,
  onRemove,
}: CardProps) {
  const name = item.provider.name
  const profileUrl = profileUrlFor(item)
  const specs = humanLabels(
    [...(item.profile?.specializations || []), ...(item.profile?.categoryLabels || [])],
    item.profile?.categories || [],
  )
  const hiddenSpecs = Math.max(0, specs.length - SPEC_PREVIEW)
  const shownSpecs = specsExpanded ? specs : specs.slice(0, SPEC_PREVIEW)
  const years = item.profile?.yearsOfExperience
  const bio = item.profile?.about || item.provider.bio
  const work = item.profile?.workExperience || []
  const edu = item.profile?.education || []
  const minPrice = minServicePrice(item)
  const slots = sortedOpenSlots(item)
  const published = publishedLanguages(item)
  const languages = published.length ? published : [t('compareUi.defaultLanguage')]
  const leads = (key: keyof CompareAdvantages) => highlightDiff && advantages[key] === item.uid

  return (
    <article
      className={`kk-mcard${isSpotlight ? ' is-spotlight' : ''}`}
      style={{ '--lawyer': LAWYER_COLORS[index] } as CSSProperties}
      aria-label={`${t('compareUi.cards.position', { index: index + 1, total })}: ${name}`}
    >
      {/* 1. Identity */}
      <header className="kk-mcard-head">
        <Link to={profileUrl} className="kk-mcard-avatar" tabIndex={-1} aria-hidden>
          <ProfileAvatar
            src={item.profile?.photoUrl || item.provider.profilePhoto}
            seed={item.uid}
            size="fill"
            alt=""
          />
        </Link>
        <div className="kk-mcard-id">
          <Link to={profileUrl} className="kk-mcard-name">
            {name}
          </Link>
          <span className="kk-mcard-role">
            {item.profile?.title || item.provider.headline || t('compareUi.lawyerFallback')}
          </span>
          <ul className="kk-mcard-meta">
            <RatingMeta
              average={item.provider.ratingAverage || 0}
              count={item.provider.ratingCount || 0}
              href={profileUrl}
            />
            {item.provider.location ? (
              <li>
                <MapPin size={12} aria-hidden />
                <span>{item.provider.location}</span>
              </li>
            ) : null}
            {isVerifiedLawyer(item) ? (
              <li>
                <Chip size="sm" variant="soft" color="success">
                  <BadgeCheck size={12} aria-hidden />
                  <Chip.Label>{t('compare.verified')}</Chip.Label>
                </Chip>
              </li>
            ) : null}
            {leads('bestRatingUid') ? (
              <li>
                <AdvantageBadge show label={t('compareUi.adv.topRating')} hint={t('compareUi.adv.topRatingHint')} />
              </li>
            ) : null}
          </ul>
        </div>
        <button
          type="button"
          className="kk-mcard-remove"
          onClick={() => onRemove(item.uid)}
          aria-label={t('compareUi.removeNamed', { name })}
          title={t('compareUi.removeNamed', { name })}
        >
          <X size={15} aria-hidden />
        </button>
      </header>

      {/* 2. Verdict */}
      <section className="kk-mcard-sec kk-mcard-verdict">
        {verdict ? (
          <>
            <div className="kk-mcard-verdict-tags">
              {isSpotlight ? (
                <span className="kk-verdict-crown">
                  <Trophy size={12} aria-hidden /> {t('compareUi.verdict.bestMatch')}
                </span>
              ) : null}
              <span className={`kk-verdict-badge is-${verdict.badge.tone}`}>
                <BadgeIcon name={verdict.badge.iconName} size={13} />
                <span>{tx(verdict.badge.label)}</span>
              </span>
            </div>
            <p className="kk-mcard-bestfor">
              <span>{t('compareUi.verdict.bestFor')}</span> {tx(verdict.bestForSummary)}
            </p>
            <p className="kk-mcard-text">{tx(verdict.scenarioDescription)}</p>
            {verdict.keyStrengths.length ? (
              <ul className="kk-mcard-checks">
                {verdict.keyStrengths.map((strength, sIdx) => (
                  <li key={sIdx}>
                    <Check size={13} aria-hidden />
                    <span>{tx(strength)}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        ) : null}
      </section>

      {/* 3. Specialisation */}
      <section className="kk-mcard-sec">
        <SectionLabel icon={<Briefcase size={14} aria-hidden />} label={t('compare.specialization')} />
        <div className="kk-compare-badges-list">
          {shownSpecs.length ? (
            shownSpecs.map((spec, sIdx) => (
              <span key={sIdx} className="kk-compare-tag is-law">
                {spec}
              </span>
            ))
          ) : (
            <span className="kk-mcard-muted">{t('compareUi.table.generalConsulting')}</span>
          )}
          {hiddenSpecs > 0 ? (
            <button type="button" className="kk-mcard-more" aria-expanded={specsExpanded} onClick={onToggleSpecs}>
              {specsExpanded ? t('compareUi.cards.showLess') : t('compareUi.cards.showMore', { count: hiddenSpecs })}
            </button>
          ) : null}
        </div>
        <p className="kk-mcard-license">
          <BadgeCheck size={13} aria-hidden />
          <span>{t('compare.verifiedBar')}</span>
        </p>
      </section>

      {/* 4. Experience */}
      <section className="kk-mcard-sec">
        <SectionLabel
          icon={<Award size={14} aria-hidden />}
          label={t('compareUi.score.experience')}
          value={
            <>
              {years != null ? t('compareUi.score.years', { count: years }) : t('compareUi.score.notDeclared')}
              <AdvantageBadge
                show={leads('bestExpUid')}
                label={t('compareUi.adv.mostExperience')}
                hint={t('compareUi.adv.mostExperienceHint')}
              />
            </>
          }
        />
        {bio ? <p className="kk-mcard-text kk-mcard-bio">{bio}</p> : null}
        {work.length > 0 || edu.length > 0 ? (
          <ul className="kk-mcard-history">
            {work.slice(0, 2).map((w, wIdx) => (
              <li key={wIdx}>
                <Briefcase size={12} aria-hidden />
                <span>
                  {w.position} {w.organization ? `· ${w.organization}` : ''}
                </span>
              </li>
            ))}
            {edu.slice(0, 1).map((e, eIdx) => (
              <li key={`edu-${eIdx}`}>
                <GraduationCap size={12} aria-hidden />
                <span>
                  {e.degree} {e.institution ? `· ${e.institution}` : ''}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      {/* 5. Fees */}
      <section className="kk-mcard-sec">
        <SectionLabel
          icon={<Coins size={14} aria-hidden />}
          label={t('compare.fees')}
          value={
            <>
              <span className={minPrice != null ? 'is-price' : undefined}>
                {minPrice != null ? t('compareUi.priceFrom', { price: minPrice }) : t('compare.byAgreement')}
              </span>
              <AdvantageBadge
                show={leads('lowestPriceUid')}
                label={t('compareUi.adv.lowestPrice')}
                hint={t('compareUi.adv.lowestPriceHint')}
              />
            </>
          }
        />
        {/* No services/slots: the headline value ("by agreement", "on request") already says so */}
        {item.services.length > 0 ? (
          <ul className="kk-mcard-rows">
            {item.services.slice(0, 3).map((service) => (
              <li key={service.id}>
                <span className="kk-mcard-row-name">{service.title}</span>
                <span className="kk-mcard-row-value">{formatServicePrice(service) || t('compareUi.onRequest')}</span>
              </li>
            ))}
            {item.services.length > 3 ? (
              <li className="kk-mcard-row-more">
                {t('compareUi.table.moreServices', { count: item.services.length - 3 })}
              </li>
            ) : null}
          </ul>
        ) : null}
      </section>

      {/* 6. Availability */}
      <section className="kk-mcard-sec">
        <SectionLabel
          icon={<Calendar size={14} aria-hidden />}
          label={t('compare.slots')}
          value={
            <>
              {slots.length ? t('compareUi.score.slotCount', { count: slots.length }) : t('compareUi.onRequest')}
              <AdvantageBadge
                show={leads('earliestSlotUid')}
                label={t('compareUi.adv.earliest')}
                hint={t('compareUi.adv.earliestHint')}
              />
            </>
          }
        />
        {slots.length ? (
          <ul className="kk-mcard-rows">
            {slots.slice(0, 2).map((slot) => (
              <li key={slot.id}>
                <span className="kk-mcard-row-name">
                  <Clock size={12} aria-hidden />
                  {formatDateLocale(slot.startAt)}
                </span>
                <span className="kk-mcard-row-value is-accent">
                  {slot.mode === 'online' ? t('compareUi.mode.online') : t('compareUi.mode.office')}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      {/* 7. Consultation & languages */}
      <section className="kk-mcard-sec">
        <SectionLabel icon={<Video size={14} aria-hidden />} label={t('compare.modes')} />
        <ul className="kk-mcard-modes">
          <li className={lawyerHasOnline(item) ? 'is-online' : 'is-off'}>
            <Video size={14} aria-hidden />
            <span>
              {lawyerHasOnline(item) ? t('compare.onlineConsultation') : t('compareUi.table.officeOnly')}
            </span>
          </li>
          <li className="is-office">
            <MapPin size={14} aria-hidden />
            <span>
              {item.provider.location
                ? t('compareUi.table.officeAt', { location: item.provider.location })
                : t('compare.officeConsultation')}
            </span>
          </li>
          <li className="is-languages">
            <Globe size={14} aria-hidden />
            <span>{languages.join(' · ')}</span>
          </li>
        </ul>
      </section>

      {/* 8. Actions (tablet; phones use the sticky action bar) */}
      <footer className="kk-mcard-actions">
        <SendRequestButton
          providerUid={item.uid}
          providerName={name}
          intake={intakeFor(item, t)}
          compact
          ctaLabel={t('compare.bookSlot')}
        />
        <div className="kk-mcard-actions-row">
          <StartChatButton
            providerUid={item.uid}
            providerName={name}
            hideGuestHint
            label={t('compareUi.cards.chat')}
            className="kk-mcard-chat-btn"
          />
          <Link to={profileUrl} className="kk-mcard-profile-btn">
            <span>{t('compare.viewProfile')}</span>
            <ExternalLink size={13} aria-hidden />
          </Link>
        </div>
      </footer>
    </article>
  )
}

/** Loading state matching the card layout (no table rows to collapse on small screens). */
export function CompareLawyerCardsSkeleton({ count }: { count: number }) {
  return (
    <div className="kk-mcmp kk-mcmp--loading" data-cols={Math.max(1, count)} style={{ '--cols': Math.max(1, count) } as CSSProperties}>
      <div className="kk-mcmp-track" aria-hidden>
        {Array.from({ length: Math.max(1, count) }, (_, index) => (
          <div key={index} className="kk-mcard is-skeleton">
            <div className="kk-mcard-head">
              <Skeleton className="w-14 h-14 rounded-full" />
              <div className="kk-mcard-id">
                <Skeleton className="w-32 h-5 rounded" />
                <Skeleton className="w-24 h-4 rounded mt-2" />
              </div>
            </div>
            {[0, 1, 2].map((row) => (
              <div key={row} className="kk-mcard-sec">
                <Skeleton className="w-24 h-4 rounded" />
                <Skeleton className="w-full h-12 rounded-lg mt-3" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
