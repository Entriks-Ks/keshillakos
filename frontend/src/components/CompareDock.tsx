import { useEffect } from 'react'
import { useLocation, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowRight, Scale, X, Trash2, Plus } from 'lucide-react'
import { toast } from '@heroui/react'
import { MAX_COMPARE_LAWYERS, setCompareTranslator, useCompareLawyers } from '../hooks/useCompareLawyers'
import ProfileAvatar from './ProfileAvatar'
import './CompareDock.css'

export default function CompareDock() {
  const { t } = useTranslation()
  const location = useLocation()
  const { selectedUids, metaMap, removeLawyer, clearComparison, count } = useCompareLawyers()

  // The dock is always mounted, so it supplies the translator for the compare hook's toasts.
  useEffect(() => {
    setCompareTranslator((key, params) => t(key, params))
  }, [t])

  // Hidden with no lawyers selected, on the comparison page itself, and in messaging, where the
  // composer is pinned to the bottom of the screen and the dock would cover it.
  const hidden =
    count === 0 ||
    location.pathname === '/krahaso' ||
    location.pathname === '/krahaso-avokatet' ||
    /^\/dashboard\/[^/]+\/messages/.test(location.pathname)

  // While visible, reserve the dock's height at the bottom of the page so the last content
  // (footer links, form buttons) can always scroll clear of it.
  useEffect(() => {
    if (hidden) return
    document.body.classList.add('has-compare-dock')
    return () => document.body.classList.remove('has-compare-dock')
  }, [hidden])

  if (hidden) {
    return null
  }

  const emptySlotsCount = Math.max(0, MAX_COMPARE_LAWYERS - count)

  const ctaLabel =
    count === 3
      ? t('compare.dockActionAll', 'Krahaso të 3 Avokatët')
      : count === 2
        ? t('compare.dockActionTwo', { count: 2, defaultValue: 'Krahaso (2 Avokatë)' })
        : t('compare.dockActionOne', 'Krahaso Tani')

  return (
    <aside className="kk-compare-dock" role="region" aria-label={t('compare.dockTitle', 'Krahasimi i Avokatëve')}>
      <div className="kk-dock-left">
        <div className="kk-dock-badge">
          <span className="kk-dock-icon-wrap" aria-hidden="true">
            <Scale size={16} />
          </span>
          <span className="kk-dock-title">{t('compare.dockTitle', 'Krahaso Avokatët')}</span>
          <span className="kk-dock-counter" aria-label={t('compareUi.dock.counter', { n: count, max: MAX_COMPARE_LAWYERS })}>
            {count}/{MAX_COMPARE_LAWYERS}
          </span>
        </div>

        <span className="kk-dock-divider" aria-hidden="true" />

        <div className="kk-dock-items" aria-label={t('compareUi.dock.selected')}>
          {selectedUids.map((uid) => {
            const meta = metaMap[uid]
            const name = meta?.name || t('compareUi.lawyerFallback')
            return (
              <div key={uid} className="kk-dock-chip" title={name}>
                <div className="kk-dock-avatar">
                  <ProfileAvatar src={meta?.photoUrl} seed={uid} size="sm" alt={name} />
                </div>
                <button
                  type="button"
                  className="kk-dock-remove"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    removeLawyer(uid)
                  }}
                  aria-label={t('compareUi.removeNamed', { name })}
                  title={t('compareUi.removeNamed', { name })}
                >
                  <X size={11} strokeWidth={2.5} aria-hidden="true" />
                </button>
              </div>
            )
          })}

          {Array.from({ length: emptySlotsCount }).map((_, index) => (
            <div
              key={`empty-${index}`}
              className="kk-dock-empty-slot"
              title={t('compare.emptySlot', 'Vend i lirë për avokat')}
              aria-label={t('compare.emptySlot', 'Vend i lirë për avokat')}
            >
              <Plus size={13} strokeWidth={2} aria-hidden="true" />
            </div>
          ))}
        </div>
      </div>

      <div className="kk-dock-right">
        <button
          type="button"
          className="kk-dock-clear-btn"
          onClick={() => {
            clearComparison()
            toast.info(t('compare.cleared', 'Krahasimi u pastrua'))
          }}
          title={t('compare.clear', 'Pastro')}
          aria-label={t('compare.clear', 'Pastro')}
        >
          <Trash2 size={13} aria-hidden="true" />
          <span>{t('compare.clear', 'Pastro')}</span>
        </button>

        <Link
          to="/krahaso"
          className={`kk-dock-cta-btn${count === 3 ? ' is-complete' : ''}`}
          aria-label={ctaLabel}
        >
          <span className="kk-dock-cta-full">{ctaLabel}</span>
          <span className="kk-dock-cta-short" aria-hidden="true">
            {t('cards.compare')}
          </span>
          <ArrowRight size={15} aria-hidden="true" className="kk-dock-cta-arrow" />
        </Link>
      </div>
    </aside>
  )
}
