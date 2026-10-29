import { useLocation, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowRight, Scale, X } from 'lucide-react'
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
        ? t('compare.dockActionTwo', 'Krahaso (2 Avokatë)')
        : t('compare.dockActionOne', 'Krahaso Tani')

  const statusHint =
    count === 1
      ? t('compare.dockHint1', 'Zgjidhni edhe 1-2 avokatë për krahasim')
      : count === 2
        ? t('compare.dockHint2', 'Zgjidhni edhe 1 avokat për krahasim të plotë')
        : t('compare.dockHint3', 'Gati për krahasim!')

  return (
    <aside className="kk-compare-dock" role="region" aria-label={t('compare.dockTitle', 'Krahasimi i Avokatëve')}>
      <div className="kk-dock-left">
        <div className="kk-dock-badge">
          <Scale size={18} className="kk-dock-badge-icon" aria-hidden />
          <span>{t('compare.dockTitle', 'Krahaso Avokatët')}</span>
          <strong className="kk-dock-counter">({count}/{MAX_COMPARE_LAWYERS})</strong>
        </div>

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
                    e.stopPropagation()
                    removeLawyer(uid)
                  }}
                  aria-label={`${t('compare.removeLawyer', 'Hiq')} ${name}`}
                  title={`${t('compare.removeLawyer', 'Hiq')} ${name}`}
                >
                  <X size={11} aria-hidden />
                </button>
              </div>
            )
          })}

          {Array.from({ length: emptySlotsCount }).map((_, index) => (
            <div
              key={`empty-${index}`}
              className="kk-dock-empty-slot"
              title={t('compare.emptySlot', 'Vend i lirë për avokat')}
            >
              +
            </div>
          ))}
        </div>

        <span className="kk-dock-hint" aria-hidden>{statusHint}</span>
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
        >
          {t('compare.clear', 'Pastro')}
        </button>

        <Link
          to="/krahaso"
          className={`kk-dock-cta-btn${count === 3 ? ' is-complete' : ''}`}
        >
          <span>{ctaLabel}</span>
          <ArrowRight size={15} aria-hidden />
        </Link>
      </div>
    </aside>
  )
}
