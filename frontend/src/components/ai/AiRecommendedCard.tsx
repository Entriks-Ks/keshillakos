import { memo } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, Star, Briefcase, UserCheck, LayoutGrid } from 'lucide-react'
import type { RecommendedEntity } from '../../api/aiChat'

interface AiRecommendedCardProps {
  item: RecommendedEntity
  onNavigate?: () => void
}

export const AiRecommendedCard = memo(function AiRecommendedCard({ item, onNavigate }: AiRecommendedCardProps) {
  const Icon = item.type === 'service' ? Briefcase : item.type === 'expert' ? UserCheck : LayoutGrid

  return (
    <Link
      to={item.url}
      onClick={onNavigate}
      className="kk-ai-card"
      aria-label={`Shiko ${item.title}`}
    >
      <div className="kk-ai-card-icon-box">
        <Icon size={18} className="kk-ai-card-icon" />
      </div>

      <div className="kk-ai-card-body">
        <div className="kk-ai-card-top">
          <span className="kk-ai-card-category">{item.category || (item.type === 'expert' ? 'Ekspert' : 'Shërbim')}</span>
          {typeof item.rating === 'number' && item.rating > 0 && (
            <span className="kk-ai-card-rating">
              <Star size={12} className="kk-ai-star-icon" fill="currentColor" />
              <span>{item.rating.toFixed(1)}</span>
              {typeof item.ratingCount === 'number' && item.ratingCount > 0 && (
                <span className="kk-ai-rating-count">({item.ratingCount})</span>
              )}
            </span>
          )}
        </div>

        <h5 className="kk-ai-card-title">{item.title}</h5>

        {item.subtitle && (
          <p className="kk-ai-card-subtitle">{item.subtitle}</p>
        )}

        <div className="kk-ai-card-footer">
          {typeof item.price === 'number' ? (
            <span className="kk-ai-card-price">nga €{item.price}</span>
          ) : (
            <span className="kk-ai-card-action-text">Shiko detajet</span>
          )}
          <ArrowUpRight size={14} className="kk-ai-card-arrow" />
        </div>
      </div>
    </Link>
  )
})
