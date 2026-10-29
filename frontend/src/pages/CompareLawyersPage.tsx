import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  ArrowLeft,
  ArrowLeftRight,
  Award,
  BadgeCheck,
  Briefcase,
  Calendar,
  Check,
  Clock,
  Coins,
  ExternalLink,
  Globe,
  GraduationCap,
  MapPin,
  Plus,
  Printer,
  Scale,
  Search,
  Share2,
  Sparkles,
  Star,
  Trash2,
  Video,
  X,
} from 'lucide-react'
import { Button, buttonVariants, Chip, Skeleton, toast } from '@heroui/react'
import {
  fetchProvidersComparison,
  type ProviderComparisonItem,
} from '../api/providers'
import {
  fetchMarketplaceProviders,
  type MarketplaceProvider,
} from '../api/providerProfiles'
import ProfileAvatar from '../components/ProfileAvatar'
import { RatingMeta } from '../components/ProviderCardParts'
import SendRequestButton from '../components/SendRequestButton'
import SiteFooter from '../components/SiteFooter'
import SiteNav from '../components/SiteNav'
import StartChatButton from '../components/StartChatButton'
import { MAX_COMPARE_LAWYERS, useCompareLawyers } from '../hooks/useCompareLawyers'
import i18n from '../i18n/index.ts'
import { analyzeLawyers, type IntentType, type LawyerVerdict } from '../utils/compareAnalyzer'
import { humanLabels } from '../utils/displayLabels'
import { providerPath } from '../utils/publicPaths'
import { formatServicePrice } from '../utils/serviceDiscovery'
import './CompareLawyersPage.css'

function formatDateLocale(dateStr: string) {
  try {
    const d = new Date(dateStr)
    const lang = (i18n.language || 'sq').toLowerCase()
    const locale = lang.startsWith('de') ? 'de-DE' : lang.startsWith('en') ? 'en-GB' : 'sq-AL'
    return d.toLocaleDateString(locale, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return dateStr
  }
}

export default function CompareLawyersPage() {
  const { t } = useTranslation()
  const {
    selectedUids,
    addLawyer,
    removeLawyer,
    clearComparison,
    setComparison,
  } = useCompareLawyers()

  // Initialize loading: true ONLY if there are lawyers to fetch
  const [loading, setLoading] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    const params = new URLSearchParams(window.location.search)
    const raw = params.get('uids')
    if (raw && raw.trim().length > 0) return true
    try {
      const stored = localStorage.getItem('klaw_compare_lawyers')
      if (stored) {
        const parsed = JSON.parse(stored)
        return Array.isArray(parsed) && parsed.length > 0
      }
    } catch {
      // Ignore
    }
    return false
  })

  const [items, setItems] = useState<ProviderComparisonItem[]>([])
  const [highlightDiff, setHighlightDiff] = useState(false)
  const [activeIntent, setActiveIntent] = useState<IntentType>('all')

  const { verdicts, winnerUids } = useMemo(() => analyzeLawyers(items), [items])

  function isSpotlighted(uid: string): boolean {
    if (activeIntent === 'all') return false
    if (activeIntent === 'budget') return winnerUids.budget === uid
    if (activeIntent === 'urgency') return winnerUids.urgency === uid
    if (activeIntent === 'experience') return winnerUids.experience === uid
    if (activeIntent === 'diaspora') return winnerUids.diaspora === uid
    if (activeIntent === 'reputation') return winnerUids.reputation === uid
    return false
  }

  function renderBadgeIcon(iconName: LawyerVerdict['badge']['iconName']) {
    switch (iconName) {
      case 'award':
        return <Award size={14} aria-hidden />
      case 'coins':
        return <Coins size={14} aria-hidden />
      case 'clock':
        return <Clock size={14} aria-hidden />
      case 'globe':
        return <Globe size={14} aria-hidden />
      case 'star':
        return <Star size={14} aria-hidden />
      default:
        return <Scale size={14} aria-hidden />
    }
  }

  // Directory of experts for autocomplete & suggestions
  const [allExperts, setAllExperts] = useState<MarketplaceProvider[]>([])
  const [pickerQuery, setPickerQuery] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)
  const pickerRef = useRef<HTMLDivElement>(null)

  // Complete and clean clear function
  const handleClear = useCallback(() => {
    clearComparison()
    setItems([])
    setLoading(false)
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      if (url.searchParams.has('uids')) {
        url.searchParams.delete('uids')
        window.history.replaceState(null, '', url.pathname + (url.search || ''))
      }
    }
    toast.info(t('compare.cleared', 'Krahasimi u pastrua'))
  }, [clearComparison, t])

  // Single lawyer remove handler that transitions to empty if none remain
  const handleRemoveLawyer = useCallback(
    (uid: string) => {
      const remaining = selectedUids.filter((id) => id !== uid)
      if (remaining.length === 0) {
        handleClear()
      } else {
        removeLawyer(uid)
        setItems((prev) => prev.filter((item) => item.uid !== uid))
      }
    },
    [selectedUids, removeLawyer, handleClear],
  )

  // 1. Initial mount sync: if URL contains ?uids=, parse and load them into comparison
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const raw = params.get('uids')
    if (raw && raw.trim().length > 0) {
      const parsed = raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, MAX_COMPARE_LAWYERS)
      if (parsed.length > 0) {
        setComparison(parsed)
      }
    }
  }, [setComparison])

  // 2. Silently reflect selectedUids changes into browser address bar without routing re-renders
  useEffect(() => {
    if (typeof window === 'undefined') return
    const url = new URL(window.location.href)
    const current = url.searchParams.get('uids') || ''
    const target = selectedUids.join(',')
    if (current !== target) {
      if (target) {
        url.searchParams.set('uids', target)
      } else {
        url.searchParams.delete('uids')
      }
      window.history.replaceState(null, '', url.pathname + (url.search || ''))
    }
  }, [selectedUids])

  // 3. Handle browser Back/Forward navigation
  useEffect(() => {
    if (typeof window === 'undefined') return
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search)
      const raw = params.get('uids')
      if (raw && raw.trim().length > 0) {
        const parsed = raw
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
          .slice(0, MAX_COMPARE_LAWYERS)
        setComparison(parsed)
      } else {
        clearComparison()
        setItems([])
        setLoading(false)
      }
    }

    window.addEventListener('popstate', handlePopState)
    return () => {
      window.removeEventListener('popstate', handlePopState)
    }
  }, [setComparison, clearComparison])

  // Fetch comparison data when selectedUids change
  useEffect(() => {
    let cancelled = false
    if (selectedUids.length === 0) {
      setItems([])
      setLoading(false)
      return
    }

    setLoading(true)
    fetchProvidersComparison(selectedUids)
      .then((data) => {
        if (!cancelled) {
          setItems(data)
          setLoading(false)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error('Failed to load comparison', err)
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [selectedUids])

  // Fetch directory experts for add picker and suggestions
  useEffect(() => {
    let cancelled = false
    fetchMarketplaceProviders({ tab: 'experts', limit: 30 })
      .then((res) => {
        if (!cancelled && Array.isArray(res)) {
          setAllExperts(res)
        }
      })
      .catch(() => {
        // Ignore fallback
      })

    return () => {
      cancelled = true
    }
  }, [])

  // Close picker on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Filtered picker candidates (exclude already selected)
  const pickerCandidates = useMemo(() => {
    const q = pickerQuery.toLowerCase().trim()
    return allExperts
      .filter((exp) => !selectedUids.includes(exp.uid))
      .filter((exp) => {
        if (!q) return true
        const matchName = exp.name?.toLowerCase().includes(q)
        const matchTitle = exp.title?.toLowerCase().includes(q)
        const matchCity = exp.location?.toLowerCase().includes(q)
        const matchSpec = exp.specializations?.some((s) => s.toLowerCase().includes(q))
        return matchName || matchTitle || matchCity || matchSpec
      })
      .slice(0, 8)
  }, [allExperts, selectedUids, pickerQuery])

  // Suggested lawyers when fewer than 3 are selected
  const suggestedLawyers = useMemo(() => {
    return allExperts
      .filter((exp) => !selectedUids.includes(exp.uid))
      .slice(0, 3)
  }, [allExperts, selectedUids])

  // Advantages calculation for highlight feature
  const advantages = useMemo(() => {
    if (items.length < 2) return {}

    // Highest rating
    let maxRating = 0
    let bestRatingUid = ''
    // Most experience
    let maxExp = 0
    let bestExpUid = ''
    // Lowest starting price
    let minPrice = Infinity
    let lowestPriceUid = ''
    // Earliest slot
    let earliestTime = Infinity
    let earliestSlotUid = ''

    for (const item of items) {
      const rating = item.provider.ratingAverage || 0
      if (rating > maxRating) {
        maxRating = rating
        bestRatingUid = item.uid
      }

      const exp = item.profile?.yearsOfExperience || 0
      if (exp > maxExp) {
        maxExp = exp
        bestExpUid = item.uid
      }

      const prices = item.services
        .map((s) => s.priceFrom)
        .filter((p): p is number => typeof p === 'number' && p > 0)
      if (prices.length > 0) {
        const itemMinPrice = Math.min(...prices)
        if (itemMinPrice < minPrice) {
          minPrice = itemMinPrice
          lowestPriceUid = item.uid
        }
      }

      if (item.openSlots.length > 0) {
        const sortedSlots = [...item.openSlots].sort(
          (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
        )
        const slotTime = new Date(sortedSlots[0].startAt).getTime()
        if (slotTime < earliestTime) {
          earliestTime = slotTime
          earliestSlotUid = item.uid
        }
      }
    }

    return {
      bestRatingUid: maxRating > 0 ? bestRatingUid : '',
      bestExpUid: maxExp > 0 ? bestExpUid : '',
      lowestPriceUid: minPrice < Infinity ? lowestPriceUid : '',
      earliestSlotUid: earliestTime < Infinity ? earliestSlotUid : '',
    }
  }, [items])

  function handleShare() {
    if (typeof window === 'undefined') return
    const url = new URL(window.location.href)
    if (selectedUids.length > 0) {
      url.searchParams.set('uids', selectedUids.join(','))
    } else {
      url.searchParams.delete('uids')
    }
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url.toString())
      toast.success(t('compare.linkCopied', 'Lidhja e krahasimit u kopjua!'))
    }
  }

  function handlePrint() {
    window.print()
  }

  const loadPreset = useCallback(
    (presetType: 'experienced' | 'online' | 'topRated') => {
      if (allExperts.length === 0) return
      let sorted: MarketplaceProvider[] = []
      if (presetType === 'experienced') {
        sorted = [...allExperts].sort(
          (a, b) => (b.yearsOfExperience || 0) - (a.yearsOfExperience || 0),
        )
      } else if (presetType === 'online') {
        sorted = [...allExperts].sort((a, b) => {
          const aHas = a.modes?.includes('online') ? 1 : 0
          const bHas = b.modes?.includes('online') ? 1 : 0
          return bHas - aHas
        })
      } else {
        sorted = [...allExperts].sort(
          (a, b) => (b.ratingAverage || 0) - (a.ratingAverage || 0),
        )
      }

      const picked = sorted.slice(0, MAX_COMPARE_LAWYERS).map((p) => p.uid)
      if (picked.length > 0) {
        setComparison(picked)
        toast.success(t('compare.presetLoaded', 'U ngarkuan avokatët e rekomanduar'))
      }
    },
    [allExperts, setComparison, t],
  )

  const showAddSlot = items.length < MAX_COMPARE_LAWYERS

  return (
    <div className="tt-shell kk-compare-shell of-marketplace kk-compare-page">
      <SiteNav />

      <main className="kk-compare-main">
        <div className="kk-compare-container">
          {/* Top navigation & Breadcrumbs */}
          <div className="kk-compare-top-nav">
            <Link to="/ofertat" className="kk-compare-back-btn">
              <ArrowLeft size={16} aria-hidden />
              <span>{t('compare.backToOffers', 'Kthehu tek Ofertat')}</span>
            </Link>
            <nav className="kk-compare-breadcrumbs" aria-label="Breadcrumbs">
              <Link to="/">Ballina</Link>
              <span className="sep">/</span>
              <Link to="/ofertat">Ofertat</Link>
              <span className="sep">/</span>
              <span className="current">Krahaso Avokatët</span>
            </nav>
          </div>

          {/* Header */}
          <header className="kk-compare-header">
            <div className="kk-compare-badge">
              <Scale size={16} aria-hidden />
              <span>{t('compare.dockTitle', 'Krahasimi i Avokatëve')}</span>
            </div>
            <h1 className="kk-compare-title">{t('compare.title', 'Krahaso Avokatët')}</h1>
            <p className="kk-compare-lead">
              {t(
                'compare.lead',
                'Klienti zgjedh deri në tre avokatë dhe i krahason në një ekran të vetëm: specializimi, përvoja e deklaruar, tarifat e publikuara, terminët e lirë dhe konsultimi online.',
              )}
            </p>
          </header>

          {/* Toolbar */}
          {items.length > 0 ? (
            <>
              <div className="kk-compare-toolbar">
                <div className="kk-compare-toolbar-left">
                  <span className="muted text-sm">
                    <strong>{items.length}</strong> / {MAX_COMPARE_LAWYERS} {t('compare.dockTitle', 'avokatë të zgjedhur')}
                  </span>
                  {items.length >= 2 ? (
                    <button
                      type="button"
                      className={`kk-compare-toggle-diff${highlightDiff ? ' is-active' : ''}`}
                      onClick={() => setHighlightDiff(!highlightDiff)}
                    >
                      <Sparkles size={14} aria-hidden />
                      <span>{t('compare.highlightDiff', 'Evidento përparësitë')}</span>
                    </button>
                  ) : null}
                </div>

                <div className="kk-compare-toolbar-right">
                  <Button variant="outline" size="sm" onPress={handlePrint} className="hidden sm:inline-flex">
                    <Printer size={15} aria-hidden />
                    <span>{t('compare.print', 'Printo / Ruaj PDF')}</span>
                  </Button>
                  <Button variant="outline" size="sm" onPress={handleShare}>
                    <Share2 size={15} aria-hidden />
                    <span>{t('compare.copyLink', 'Kopjo Lidhjen')}</span>
                  </Button>
                  <Button variant="ghost" size="sm" onPress={handleClear}>
                    <Trash2 size={15} aria-hidden />
                    <span>{t('compare.clear', 'Pastro')}</span>
                  </Button>
                </div>
              </div>

              {/* Mobile swipe helper */}
              <div className="kk-compare-mobile-hint">
                <ArrowLeftRight size={14} aria-hidden />
                <span>{t('compare.mobileSwipeHint', 'Rrëshqitni anash për të parë të gjithë avokatët')}</span>
              </div>
            </>
          ) : null}

          {/* Loading Skeleton */}
          {loading && selectedUids.length > 0 ? (
            <div className="kk-compare-board">
              <div
                className="kk-compare-grid"
                style={{
                  gridTemplateColumns: `220px repeat(${Math.max(1, selectedUids.length)}, minmax(280px, 1fr))`,
                }}
              >
                <div className="kk-compare-cell is-label">
                  <span>Duke u ngarkuar...</span>
                  <span className="kk-compare-cell-sub">Krahasimi po përgatitet</span>
                </div>
                {selectedUids.map((uid) => (
                  <div key={uid} className="kk-compare-card-head">
                    <Skeleton className="w-20 h-20 rounded-full" />
                    <Skeleton className="w-32 h-5 rounded mt-2" />
                    <Skeleton className="w-24 h-4 rounded" />
                  </div>
                ))}

                <div className="kk-compare-cell is-label">
                  <span>Specializimi</span>
                </div>
                {selectedUids.map((uid) => (
                  <div key={`sk-spec-${uid}`} className="kk-compare-cell">
                    <Skeleton className="w-full h-6 rounded" />
                  </div>
                ))}

                <div className="kk-compare-cell is-label">
                  <span>Përvoja</span>
                </div>
                {selectedUids.map((uid) => (
                  <div key={`sk-exp-${uid}`} className="kk-compare-cell">
                    <Skeleton className="w-3/4 h-5 rounded" />
                  </div>
                ))}
              </div>
            </div>
          ) : items.length === 0 ? (
            /* Empty State */
            <div className="kk-compare-empty">
              <div className="kk-compare-empty-icon" aria-hidden>
                <Scale size={36} />
              </div>
              <h2 className="kk-compare-empty-title">
                {t('compare.emptyTitle', 'Zgjidhni avokatë për t\'i krahasuar')}
              </h2>
              <p className="kk-compare-empty-text">
                {t(
                  'compare.emptyDesc',
                  'Zgjidhni deri në 3 avokatë nga lista e mëposhtme ose nga faqja e ofertave për t\'i krahasuar krah për krah në një ekran të vetëm.',
                )}
              </p>

              <div className="kk-compare-empty-search-box">
                <div className="kk-compare-picker-wrap" ref={pickerRef}>
                  <div className="kk-compare-picker-input-wrap">
                    <Search size={15} className="kk-compare-picker-search-icon" aria-hidden />
                    <input
                      type="text"
                      className="kk-compare-picker-input"
                      placeholder={t('compare.searchPlaceholder', 'Kërko avokat me emër, qytet apo lëmi...')}
                      value={pickerQuery}
                      onChange={(e) => {
                        setPickerQuery(e.target.value)
                        setPickerOpen(true)
                      }}
                      onFocus={() => setPickerOpen(true)}
                    />
                  </div>

                  {pickerOpen && pickerCandidates.length > 0 ? (
                    <div className="kk-compare-picker-results">
                      {pickerCandidates.map((lawyer) => (
                        <button
                          key={lawyer.uid}
                          type="button"
                          className="kk-compare-picker-item"
                          onClick={() => {
                            addLawyer(lawyer.uid, {
                              name: lawyer.name,
                              photoUrl: lawyer.photoUrl,
                              title: lawyer.title,
                            })
                            setPickerQuery('')
                            setPickerOpen(false)
                          }}
                        >
                          <div className="kk-compare-picker-item-avatar">
                            <ProfileAvatar src={lawyer.photoUrl} seed={lawyer.uid} size="sm" />
                          </div>
                          <div className="kk-compare-picker-item-info">
                            <div className="kk-compare-picker-item-name">{lawyer.name}</div>
                            <div className="kk-compare-picker-item-sub">
                              {lawyer.title || lawyer.specializations[0] || 'Avokat'}
                              {lawyer.location ? ` · ${lawyer.location}` : ''}
                            </div>
                          </div>
                          <Plus size={16} className="text-primary shrink-0" aria-hidden />
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="kk-compare-empty-actions">
                <Link
                  to="/ofertat"
                  className={`${buttonVariants({ variant: 'primary', size: 'md' })} kk-compare-empty-cta`}
                >
                  <Search size={16} aria-hidden />
                  <span>{t('compare.exploreOffers', 'Eksploro Avokatët')}</span>
                </Link>
              </div>

              {/* Quick Presets for Instant User Onboarding */}
              {allExperts.length > 0 ? (
                <div className="kk-compare-presets-wrap">
                  <span className="kk-compare-presets-title">
                    <Sparkles size={14} className="text-amber-500" aria-hidden />
                    {t('compare.quickPresetsTitle', 'Kombinime të shpejta të rekomanduara:')}
                  </span>
                  <div className="kk-compare-presets-chips">
                    <button
                      type="button"
                      className="kk-compare-preset-chip"
                      onClick={() => loadPreset('experienced')}
                      title="Krahaso 3 avokatë me përvojën më të madhe"
                    >
                      🏆 Më me Përvojë
                    </button>
                    <button
                      type="button"
                      className="kk-compare-preset-chip"
                      onClick={() => loadPreset('online')}
                      title="Krahaso avokatë me konsultim online dhe orare fleksibile"
                    >
                      🌐 Konsultim Online & Diasporë
                    </button>
                    <button
                      type="button"
                      className="kk-compare-preset-chip"
                      onClick={() => loadPreset('topRated')}
                      title="Krahaso avokatët me vlerësimet më të larta"
                    >
                      ★ Më të Vlerësuarit
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <>
              {/* Verdict Section: Cili është më i mirë për çfarë */}
              <section className="kk-verdict-section" aria-labelledby="verdict-heading">
                <div className="kk-verdict-head">
                  <div className="kk-verdict-tag">
                    <Sparkles size={13} aria-hidden />
                    <span>Verdikti & Analiza Inteligjente</span>
                  </div>
                  <h2 id="verdict-heading" className="kk-verdict-title">
                    Cili është më i mirë për çfarë?
                  </h2>
                  <p className="kk-verdict-subtitle">
                    Krahasim i drejtpërdrejtë për t'ju ndihmuar të zgjidhni avokatin e duhur sipas nevojës suaj konkrete pa pasur nevojë të hapni shumë faqe.
                  </p>

                  <div className="kk-intent-filter">
                    <span className="kk-intent-filter-label">Zgjidhni përparësinë tuaj kryesore:</span>
                    <div className="kk-intent-pills">
                      <button
                        type="button"
                        className={`kk-intent-btn${activeIntent === 'all' ? ' is-active' : ''}`}
                        onClick={() => setActiveIntent('all')}
                      >
                        🎯 Të gjitha
                      </button>
                      {winnerUids.experience ? (
                        <button
                          type="button"
                          className={`kk-intent-btn${activeIntent === 'experience' ? ' is-active' : ''}`}
                          onClick={() => setActiveIntent('experience')}
                        >
                          🏆 Përvoja më e Gjatë
                        </button>
                      ) : null}
                      {winnerUids.budget ? (
                        <button
                          type="button"
                          className={`kk-intent-btn${activeIntent === 'budget' ? ' is-active' : ''}`}
                          onClick={() => setActiveIntent('budget')}
                        >
                          💰 Çmimi më Ekonomik
                        </button>
                      ) : null}
                      {winnerUids.urgency ? (
                        <button
                          type="button"
                          className={`kk-intent-btn${activeIntent === 'urgency' ? ' is-active' : ''}`}
                          onClick={() => setActiveIntent('urgency')}
                        >
                          ⚡ Takimi më i Shpejtë
                        </button>
                      ) : null}
                      {winnerUids.diaspora ? (
                        <button
                          type="button"
                          className={`kk-intent-btn${activeIntent === 'diaspora' ? ' is-active' : ''}`}
                          onClick={() => setActiveIntent('diaspora')}
                        >
                          🌐 Konsultim Online & Diasporë
                        </button>
                      ) : null}
                      {winnerUids.reputation ? (
                        <button
                          type="button"
                          className={`kk-intent-btn${activeIntent === 'reputation' ? ' is-active' : ''}`}
                          onClick={() => setActiveIntent('reputation')}
                        >
                          ★ Reputacioni më i Lartë
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="kk-verdict-grid">
                  {items.map((item) => {
                    const v = verdicts[item.uid]
                    if (!v) return null
                    const isWinner = isSpotlighted(item.uid)
                    const profileUrl = providerPath(
                      item.profile || ({ uid: item.uid, name: item.provider.name, providerType: 'individual' } as MarketplaceProvider),
                    )

                    return (
                      <article
                        key={`verdict-card-${item.uid}`}
                        className={`kk-verdict-card is-tone-${v.badge.tone}${isWinner ? ' is-spotlight' : ''}`}
                      >
                        <div className={`kk-verdict-badge is-${v.badge.tone}`}>
                          {renderBadgeIcon(v.badge.iconName)}
                          <span>{v.badge.label}</span>
                        </div>

                        <div className="kk-verdict-profile">
                          <div className="kk-verdict-avatar">
                            <ProfileAvatar
                              src={item.profile?.photoUrl || item.provider.profilePhoto}
                              seed={item.uid}
                              size="md"
                            />
                          </div>
                          <div className="kk-verdict-profile-info">
                            <Link to={profileUrl} className="kk-verdict-profile-name">
                              {item.provider.name}
                            </Link>
                            <span className="kk-verdict-profile-sub">
                              {item.profile?.title || item.provider.headline || 'Avokat'}
                            </span>
                          </div>
                        </div>

                        <div className="kk-verdict-bestfor-box">
                          <div className="kk-verdict-bestfor-title">Më i miri për:</div>
                          <div className="kk-verdict-bestfor-text">{v.bestForSummary}</div>
                        </div>

                        <p className="kk-verdict-scenario">{v.scenarioDescription}</p>

                        <ul className="kk-verdict-strengths">
                          {v.keyStrengths.map((str, sIdx) => (
                            <li key={sIdx} className="kk-verdict-strength-item">
                              <Check size={14} className="kk-verdict-strength-icon" aria-hidden />
                              <span>{str}</span>
                            </li>
                          ))}
                        </ul>

                        <div className="kk-verdict-cta-wrap">
                          <SendRequestButton
                            providerUid={item.uid}
                            providerName={item.provider.name}
                            intake={{
                              need: item.provider.headline || `Konsulencë me ${item.provider.name}`,
                              location: item.provider.location || 'Online',
                              language: 'Albanian',
                              urgency: 'flexible',
                              contact: 'chat',
                            }}
                            compact
                            ctaLabel={`Zgjidh ${item.provider.name.split(' ')[0]}`}
                          />
                        </div>
                      </article>
                    )
                  })}
                </div>
              </section>

              {/* Comparison Table / Matrix */}
              <div className="kk-compare-board" role="region" aria-label="Tabela krahasuese">
                <div
                  className="kk-compare-grid"
                  style={{
                    gridTemplateColumns: `220px repeat(${Math.max(1, items.length + (showAddSlot ? 1 : 0))}, minmax(280px, 1fr))`,
                  }}
                >
                  {/* 1. Header Row (Avatars, Names, Actions) */}
                  <div className="kk-compare-cell is-label is-head">
                    <span>{t('compare.dockTitle', 'Avokatët')}</span>
                    <span className="kk-compare-cell-sub">
                      {items.length} {t('compare.dockCount', 'të zgjedhur')}
                    </span>
                  </div>

                  {items.map((item) => {
                    const verified = Boolean(
                      item.profile?.verification?.qualification === 'verified' ||
                      item.profile?.verification?.identity === 'verified',
                    )
                    const profileUrl = providerPath(item.profile || { uid: item.uid, name: item.provider.name, providerType: 'individual' } as MarketplaceProvider)
                    const v = verdicts[item.uid]

                    return (
                      <div key={item.uid} className={`kk-compare-card-head${isSpotlighted(item.uid) ? ' bg-accent/5' : ''}`}>
                        <button
                          type="button"
                          className="kk-compare-remove-btn"
                          onClick={() => handleRemoveLawyer(item.uid)}
                          aria-label={`${t('compare.removeLawyer', 'Hiq')} ${item.provider.name}`}
                          title={t('compare.removeLawyer', 'Hiq')}
                        >
                          <X size={15} aria-hidden />
                        </button>

                        <Link to={profileUrl} className="kk-compare-avatar-wrap">
                          <ProfileAvatar
                            src={item.profile?.photoUrl || item.provider.profilePhoto}
                            seed={item.uid}
                            size="fill"
                            alt={item.provider.name}
                          />
                        </Link>

                        <div>
                          <div className="flex items-center justify-center gap-1.5 flex-wrap">
                            <Link to={profileUrl} className="kk-compare-card-name">
                              {item.provider.name}
                            </Link>
                            {verified ? (
                              <Chip size="sm" variant="soft" color="success">
                                <BadgeCheck size={13} aria-hidden />
                                <Chip.Label>{t('compare.verified', 'I verifikuar')}</Chip.Label>
                              </Chip>
                            ) : null}
                          </div>
                          <p className="kk-compare-card-title">
                            {item.profile?.title || item.provider.headline || 'Avokat'}
                          </p>

                          {v ? (
                            <div className={`kk-verdict-badge is-${v.badge.tone} mt-2`} style={{ alignSelf: 'center', marginInline: 'auto' }}>
                              {renderBadgeIcon(v.badge.iconName)}
                              <span>{v.badge.label}</span>
                            </div>
                          ) : null}
                        </div>

                        <ul className="kk-compare-card-meta">
                          {item.provider.location ? (
                            <li>
                              <MapPin size={13} aria-hidden />
                              <span>{item.provider.location}</span>
                            </li>
                          ) : null}
                          <li>
                            <RatingMeta
                              average={item.provider.ratingAverage || 0}
                              count={item.provider.ratingCount || 0}
                              href={profileUrl}
                            />
                            {highlightDiff && advantages.bestRatingUid === item.uid ? (
                              <span className="kk-advantage-badge" title="Vlerësimi më i lartë">
                                ★ Top
                              </span>
                            ) : null}
                          </li>
                        </ul>

                        {/* Immediate CTAs */}
                        <div className="kk-compare-head-actions">
                          <SendRequestButton
                            providerUid={item.uid}
                            providerName={item.provider.name}
                            intake={{
                              need: item.provider.headline || `Konsulencë me ${item.provider.name}`,
                              location: item.provider.location || 'Online',
                              language: 'Albanian',
                              urgency: 'flexible',
                              contact: 'chat',
                            }}
                            compact
                            ctaLabel={t('compare.bookSlot', 'Rezervo / Kërkesë')}
                          />
                          <StartChatButton
                            providerUid={item.uid}
                            providerName={item.provider.name}
                            hideGuestHint
                            label={t('compare.sendMessage', 'Fillo Bisedën')}
                            className="w-full"
                          />
                          <Link to={profileUrl} className="kk-compare-full-profile-btn">
                            <span>{t('compare.viewProfile', 'Profili i Plotë')}</span>
                            <ExternalLink size={13} aria-hidden />
                          </Link>
                        </div>
                      </div>
                    )
                  })}

                  {/* Optional Add Lawyer Slot in Header */}
                  {showAddSlot ? (
                    <div className="kk-compare-add-slot">
                      <div className="kk-compare-add-icon">
                        <Plus size={24} aria-hidden />
                      </div>
                      <div className="kk-compare-add-title">
                        {t('compare.addSlotPrompt', 'Shto avokat për krahasim')}
                      </div>
                      <div className="kk-compare-add-text">
                        Maksimumi 3 avokatë
                      </div>

                      <div className="kk-compare-picker-wrap" ref={pickerRef}>
                        <div className="kk-compare-picker-input-wrap">
                          <Search size={14} className="kk-compare-picker-search-icon" aria-hidden />
                          <input
                            type="text"
                            className="kk-compare-picker-input"
                            placeholder={t('compare.searchPlaceholder', 'Kërko avokat...')}
                            value={pickerQuery}
                            onChange={(e) => {
                              setPickerQuery(e.target.value)
                              setPickerOpen(true)
                            }}
                            onFocus={() => setPickerOpen(true)}
                          />
                        </div>

                        {pickerOpen && pickerCandidates.length > 0 ? (
                          <div className="kk-compare-picker-results">
                            {pickerCandidates.map((lawyer) => (
                              <button
                                key={lawyer.uid}
                                type="button"
                                className="kk-compare-picker-item"
                                onClick={() => {
                                  addLawyer(lawyer.uid, {
                                    name: lawyer.name,
                                    photoUrl: lawyer.photoUrl,
                                    title: lawyer.title,
                                  })
                                  setPickerQuery('')
                                  setPickerOpen(false)
                                }}
                              >
                                <div className="kk-compare-picker-item-avatar">
                                  <ProfileAvatar src={lawyer.photoUrl} seed={lawyer.uid} size="sm" />
                                </div>
                                <div className="kk-compare-picker-item-info">
                                  <div className="kk-compare-picker-item-name">{lawyer.name}</div>
                                  <div className="kk-compare-picker-item-sub">
                                    {lawyer.title || lawyer.specializations[0] || 'Avokat'}
                                  </div>
                                </div>
                                <Plus size={15} className="text-primary shrink-0" aria-hidden />
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ) : null}

                  {/* 1.1 Row: Verdikti kryesor / Më i miri për */}
                  <div className="kk-compare-cell is-label">
                    <div className="flex items-center gap-1.5">
                      <Sparkles size={16} className="text-primary" aria-hidden />
                      <span>Për çfarë dallohet</span>
                    </div>
                    <span className="kk-compare-cell-sub">
                      Rekomandimi dhe verdikti parësor
                    </span>
                  </div>

                  {items.map((item) => {
                    const v = verdicts[item.uid]
                    if (!v) return <div key={`v-${item.uid}`} className="kk-compare-cell" />
                    const isWinner = isSpotlighted(item.uid)

                    return (
                      <div
                        key={`v-${item.uid}`}
                        className={`kk-compare-cell${isWinner ? ' bg-accent/5' : ''}`}
                      >
                        <div className={`kk-table-verdict-pill is-${v.badge.tone}`}>
                          {renderBadgeIcon(v.badge.iconName)}
                          <span>{v.badge.label}</span>
                        </div>
                        <p className="text-xs font-bold text-heading mt-1 mb-1">{v.bestForSummary}</p>
                        <p className="text-xs text-muted leading-relaxed">{v.scenarioDescription}</p>
                      </div>
                    )
                  })}

                  {showAddSlot ? <div className="kk-compare-cell muted text-xs text-center">—</div> : null}

                {/* 2. Row: Specializimi (Specialization) */}
                <div className="kk-compare-cell is-label">
                  <div className="flex items-center gap-1.5">
                    <Briefcase size={16} className="text-primary" aria-hidden />
                    <span>{t('compare.specialization', 'Specializimi')}</span>
                  </div>
                  <span className="kk-compare-cell-sub">
                    Fushat juridike, lëmitë & Oda e Avokatëve
                  </span>
                </div>

                {items.map((item) => {
                  const rawSpecs = [
                    ...(item.profile?.specializations || []),
                    ...(item.profile?.categoryLabels || []),
                  ]
                  const specs = humanLabels(rawSpecs, item.profile?.categories || [])

                  return (
                    <div key={`spec-${item.uid}`} className="kk-compare-cell">
                      <div className="kk-compare-badges-list">
                        {specs.length > 0 ? (
                          specs.map((spec, i) => (
                            <span key={i} className="kk-compare-tag is-law">
                              {spec}
                            </span>
                          ))
                        ) : (
                          <span className="text-sm muted">Konsulencë e përgjithshme ligjore</span>
                        )}
                      </div>

                      <div className="kk-compare-license">
                        <BadgeCheck size={14} aria-hidden />
                        <span>{t('compare.verifiedBar', 'Oda e Avokatëve të Kosovës (OAK)')}</span>
                      </div>
                    </div>
                  )
                })}

                {showAddSlot ? <div className="kk-compare-cell muted text-xs text-center">—</div> : null}

                {/* 3. Row: Përvoja e deklaruar (Declared Experience) */}
                <div className="kk-compare-cell is-label">
                  <div className="flex items-center gap-1.5">
                    <Award size={16} className="text-primary" aria-hidden />
                    <span>{t('compare.experience', 'Përvoja e deklaruar')}</span>
                  </div>
                  <span className="kk-compare-cell-sub">
                    Vitet e përvojës, formimi & historiku
                  </span>
                </div>

                {items.map((item) => {
                  const years = item.profile?.yearsOfExperience
                  const bio = item.profile?.about || item.provider.bio
                  const work = item.profile?.workExperience || []
                  const edu = item.profile?.education || []
                  const isTopExp = highlightDiff && advantages.bestExpUid === item.uid

                  return (
                    <div key={`exp-${item.uid}`} className="kk-compare-cell">
                      {years != null ? (
                        <div className="kk-compare-exp-highlight">
                          <Award size={15} aria-hidden />
                          <span>
                            {years === 1
                              ? `1 ${t('compare.yearExp', 'vit përvojë')}`
                              : `${years} ${t('compare.yearsExp', 'vite përvojë')}`}
                          </span>
                          {isTopExp ? (
                            <span className="kk-advantage-badge" title="Përvoja më e madhe">
                              Më me përvojë
                            </span>
                          ) : null}
                        </div>
                      ) : (
                        <div className="kk-compare-exp-highlight">
                          <span>Ekspert Juridik</span>
                        </div>
                      )}

                      {bio ? <p className="kk-compare-bio-text">{bio}</p> : null}

                      {/* Work and Education snippets */}
                      {work.length > 0 || edu.length > 0 ? (
                        <ul className="kk-compare-history-list">
                          {work.slice(0, 2).map((w, idx) => (
                            <li key={idx} className="kk-compare-history-item">
                              <Briefcase size={12} className="shrink-0" aria-hidden />
                              <span>
                                {w.position} {w.organization ? `· ${w.organization}` : ''}
                              </span>
                            </li>
                          ))}
                          {edu.slice(0, 1).map((e, idx) => (
                            <li key={`edu-${idx}`} className="kk-compare-history-item">
                              <GraduationCap size={12} className="shrink-0" aria-hidden />
                              <span>
                                {e.degree} {e.institution ? `· ${e.institution}` : ''}
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  )
                })}

                {showAddSlot ? <div className="kk-compare-cell muted text-xs text-center">—</div> : null}

                {/* 4. Row: Tarifat e publikuara (Published Fees) */}
                <div className="kk-compare-cell is-label">
                  <div className="flex items-center gap-1.5">
                    <Coins size={16} className="text-primary" aria-hidden />
                    <span>{t('compare.fees', 'Tarifat e publikuara')}</span>
                  </div>
                  <span className="kk-compare-cell-sub">
                    Shërbimet, çmimet transparente & modeli
                  </span>
                </div>

                {items.map((item) => {
                  const prices = item.services
                    .map((s) => s.priceFrom)
                    .filter((p): p is number => typeof p === 'number' && p > 0)
                  const minPrice = prices.length ? Math.min(...prices) : null
                  const isLowestPrice = highlightDiff && advantages.lowestPriceUid === item.uid

                  return (
                    <div key={`fees-${item.uid}`} className="kk-compare-cell">
                      {minPrice != null ? (
                        <div className="kk-compare-starting-fee">
                          <span>Nga €{minPrice}</span>
                          {isLowestPrice ? (
                            <span className="kk-advantage-badge" title="Tarifa më e ulët fillestare">
                              Çmimi më i favorshëm
                            </span>
                          ) : null}
                        </div>
                      ) : (
                        <div className="text-xs font-semibold text-muted mb-2">
                          {t('compare.noServices', 'Tarifat caktohen me marrëveshje')}
                        </div>
                      )}

                      {item.services.length > 0 ? (
                        <div className="kk-compare-services-list">
                          {item.services.slice(0, 3).map((service) => {
                            const formattedPrice = formatServicePrice(service)
                            return (
                              <div key={service.id} className="kk-compare-service-row">
                                <span className="kk-compare-service-name" title={service.title}>
                                  {service.title}
                                </span>
                                <span className="kk-compare-service-price">
                                  {formattedPrice || 'Me kërkesë'}
                                </span>
                              </div>
                            )
                          })}
                          {item.services.length > 3 ? (
                            <span className="text-xs text-muted">
                              + edhe {item.services.length - 3} shërbime të tjera
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  )
                })}

                {showAddSlot ? <div className="kk-compare-cell muted text-xs text-center">—</div> : null}

                {/* 5. Row: Terminët e lirë (Free Slots & Availability) */}
                <div className="kk-compare-cell is-label">
                  <div className="flex items-center gap-1.5">
                    <Calendar size={16} className="text-primary" aria-hidden />
                    <span>{t('compare.slots', 'Terminët e lirë')}</span>
                  </div>
                  <span className="kk-compare-cell-sub">
                    Oraret e lira & takimi më i hershëm
                  </span>
                </div>

                {items.map((item) => {
                  const sortedSlots = [...item.openSlots].sort(
                    (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
                  )
                  const slotCount = sortedSlots.length
                  const earliest = sortedSlots[0]
                  const isEarliest = highlightDiff && advantages.earliestSlotUid === item.uid

                  return (
                    <div key={`slots-${item.uid}`} className="kk-compare-cell">
                      {slotCount > 0 ? (
                        <>
                          <div className="kk-compare-slot-status is-open">
                            <Clock size={13} aria-hidden />
                            <span>
                              {slotCount} {t('compare.availableSlots', 'terminë të lirë')}
                            </span>
                            {isEarliest ? (
                              <span className="kk-advantage-badge" title="Më i shpejti për takim">
                                Më i hershmi
                              </span>
                            ) : null}
                          </div>

                          {earliest ? (
                            <div className="kk-compare-earliest">
                              <Calendar size={13} aria-hidden />
                              <span>{formatDateLocale(earliest.startAt)}</span>
                            </div>
                          ) : null}

                          <div className="kk-compare-slots-mini">
                            {sortedSlots.slice(0, 2).map((slot) => (
                              <div key={slot.id} className="kk-compare-slot-pill">
                                <span>{formatDateLocale(slot.startAt)}</span>
                                <span className="font-semibold text-primary">
                                  {slot.mode === 'online' ? 'Online' : 'Në zyrë'}
                                </span>
                              </div>
                            ))}
                          </div>
                        </>
                      ) : (
                        <div className="kk-compare-slot-status is-request">
                          <Clock size={13} aria-hidden />
                          <span>{t('compare.noSlots', 'Me marrëveshje / kërkesë')}</span>
                        </div>
                      )}
                    </div>
                  )
                })}

                {showAddSlot ? <div className="kk-compare-cell muted text-xs text-center">—</div> : null}

                {/* 6. Row: Gjuha dhe konsultimi online (Language & Online Consultation) */}
                <div className="kk-compare-cell is-label">
                  <div className="flex items-center gap-1.5">
                    <Video size={16} className="text-primary" aria-hidden />
                    <span>{t('compare.modes', 'Gjuha dhe konsultimi online')}</span>
                  </div>
                  <span className="kk-compare-cell-sub">
                    Takim virtual me video, zyrë & gjuhët
                  </span>
                </div>

                {items.map((item) => {
                  const modes = item.profile?.modes || item.provider.skills || []
                  const hasOnline = modes.includes('online') || item.services.some((s) => s.details?.deliveryModes?.includes('online'))
                  const languages = item.profile?.languages?.length ? item.profile.languages : (item.provider.languages?.length ? item.provider.languages : ['Shqip'])

                  return (
                    <div key={`modes-${item.uid}`} className="kk-compare-cell">
                      {hasOnline ? (
                        <div className="kk-compare-mode-item is-online">
                          <Video size={16} aria-hidden />
                          <span>{t('compare.onlineConsultation', 'Konsultim Online (Video)')}</span>
                        </div>
                      ) : (
                        <div className="kk-compare-mode-item text-muted">
                          <Video size={16} aria-hidden />
                          <span>Konsultim në zyrë</span>
                        </div>
                      )}

                      <div className="kk-compare-mode-item is-physical">
                        <MapPin size={16} aria-hidden />
                        <span>
                          {t('compare.officeConsultation', 'Takim në Zyrë')}
                          {item.provider.location ? `: ${item.provider.location}` : ''}
                        </span>
                      </div>

                      <div className="mt-3">
                        <div className="text-xs font-semibold text-muted mb-1.5 flex items-center gap-1">
                          <Globe size={13} aria-hidden />
                          <span>{t('compare.languages', 'Gjuhët e komunikimit')}</span>
                        </div>
                        <div className="kk-compare-badges-list">
                          {languages.map((lang, idx) => (
                            <span key={idx} className="kk-compare-tag">
                              {lang}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )
                })}

                {showAddSlot ? <div className="kk-compare-cell muted text-xs text-center">—</div> : null}

                {/* 7. Row: Veprimi Përfundimtar (Bottom Actions) */}
                <div className="kk-compare-cell is-label">
                  <div className="flex items-center gap-1.5">
                    <Check size={16} className="text-primary" aria-hidden />
                    <span>{t('compare.chooseLawyer', 'Zgjidh avokatin')}</span>
                  </div>
                  <span className="kk-compare-cell-sub">
                    Rezervoni ose dërgoni kërkesë të menjëhershme
                  </span>
                </div>

                {items.map((item) => (
                  <div key={`cta-bottom-${item.uid}`} className="kk-compare-cell kk-compare-cell-bottom-cta">
                    <SendRequestButton
                      providerUid={item.uid}
                      providerName={item.provider.name}
                      intake={{
                        need: item.provider.headline || `Konsulencë me ${item.provider.name}`,
                        location: item.provider.location || 'Online',
                        language: 'Albanian',
                        urgency: 'flexible',
                        contact: 'chat',
                      }}
                      ctaLabel={`Zgjidh ${item.provider.name.split(' ')[0]}`}
                    />
                  </div>
                ))}

                {showAddSlot ? <div className="kk-compare-cell muted text-xs text-center">—</div> : null}
              </div>
            </div>
            </>
          )}

          {/* Suggested lawyers section (shown both in empty state and when comparison has room) */}
          {suggestedLawyers.length > 0 && (items.length === 0 || items.length < MAX_COMPARE_LAWYERS) ? (
            <section className="kk-compare-suggested-section" aria-labelledby="suggested-heading">
              <div className="kk-compare-suggested-head">
                <div>
                  <h3 id="suggested-heading">
                    {items.length === 0
                      ? t('compare.suggestedLawyers', 'Avokatë të sugjeruar për krahasim')
                      : t('compare.suggestedLawyers', 'Avokatë të sugjeruar për krahasim')}
                  </h3>
                  <span className="text-sm text-muted">
                    {items.length === 0
                      ? 'Zgjidhni nga avokatët e rekomanduar për të filluar krahasimin krah për krah'
                      : `Shtoni edhe ${MAX_COMPARE_LAWYERS - items.length} avokat për krahasim të plotë`}
                  </span>
                </div>
              </div>

              <div className="kk-compare-suggested-grid">
                {suggestedLawyers.map((lawyer) => {
                  const specialties = humanLabels(
                    [...lawyer.specializations, ...lawyer.categoryLabels],
                    lawyer.categories,
                  )
                  return (
                    <div key={lawyer.uid} className="kk-suggested-card">
                      <div className="kk-suggested-card-top">
                        <div className="kk-suggested-card-avatar">
                          <ProfileAvatar src={lawyer.photoUrl} seed={lawyer.uid} size="md" />
                        </div>
                        <div className="kk-suggested-card-info">
                          <div className="kk-suggested-card-name">{lawyer.name}</div>
                          <div className="kk-suggested-card-title">
                            {lawyer.title || specialties[0] || 'Avokat'}
                          </div>
                          {lawyer.location ? (
                            <div className="text-xs text-muted flex items-center gap-1 mt-0.5">
                              <MapPin size={11} aria-hidden />
                              <span>{lawyer.location}</span>
                            </div>
                          ) : null}
                        </div>
                      </div>

                      <button
                        type="button"
                        className="kk-suggested-card-add-btn"
                        onClick={() =>
                          addLawyer(lawyer.uid, {
                            name: lawyer.name,
                            photoUrl: lawyer.photoUrl,
                            title: lawyer.title,
                          })
                        }
                      >
                        <Plus size={14} aria-hidden />
                        <span>{t('compare.addLawyer', 'Shto në krahasim')}</span>
                      </button>
                    </div>
                  )
                })}
              </div>
            </section>
          ) : null}
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
