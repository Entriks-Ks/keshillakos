import { useLocation, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowRight, Scale, X, Trash2, Plus } from 'lucide-react'
import { toast } from '@heroui/react'
import { MAX_COMPARE_LAWYERS, useCompareLawyers } from '../hooks/useCompareLawyers'
import ProfileAvatar from './ProfileAvatar'
import './CompareDock.css'

export default function CompareDock() {
  const { t } = useTranslation()
  const location = useLocation()
  const { selectedUids, metaMap, removeLawyer, clearComparison, count } = useCompareLawyers()

  // Hide dock if no lawyers selected or if already on the comparison page
  if (count === 0 || location.pathname === '/krahaso' || location.pathname === '/krahaso-avokatet') {
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
          <span className="kk-dock-counter" aria-label={`${count} nga ${MAX_COMPARE_LAWYERS}`}>
            {count}/{MAX_COMPARE_LAWYERS}
          </span>
        </div>

        <span className="kk-dock-divider" aria-hidden="true" />

        <div className="kk-dock-items" aria-label="Avokatët e zgjedhur">
          {selectedUids.map((uid) => {
            const meta = metaMap[uid]
            const name = meta?.name || 'Avokat'
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
                  aria-label={`${t('compare.removeLawyer', 'Hiq')} ${name}`}
                  title={`${t('compare.removeLawyer', 'Hiq')} ${name}`}
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
        >
          <span>{ctaLabel}</span>
          <ArrowRight size={15} aria-hidden="true" className="kk-dock-cta-arrow" />
        </Link>
      </div>
    </aside>
  )
}
