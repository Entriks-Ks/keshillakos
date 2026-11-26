import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  Calculator,
  CheckCircle2,
  Clock3,
  Coins,
  FileCheck,
  Heart,
  HelpCircle,
  Home,
  MapPin,
  MessageCircle,
  MessagesSquare,
  PenLine,
  RotateCcw,
  Scale,
  Search,
  Send,
  Share2,
  Trash2,
  UserCheck,
  UserRound,
  X,
  type LucideIcon,
  Info,
  LayoutGrid,
  MessageSquareText,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react'
import { Button, toast } from '@heroui/react'
import { Trans, useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { dateLocale } from '../i18n'
import { useAuth } from '../auth/AuthContext'
import ProfileAvatar from '../components/ProfileAvatar'
import SiteNav from '../components/SiteNav'
import SiteFooter from '../components/SiteFooter'
import {
  fetchCommunityPosts,
  createCommunityPost,
  deleteCommunityPost,
  toggleLikePost,
  updateCommunityPostStatus,
  fetchPostComments,
  createPostComment,
  deletePostComment,
  toggleLikeComment,
  type CommunityPost,
  type CommunityComment,
  type CommunityCategory,
  type CommunityPostStatus,
} from '../api/community'
import { routePath } from '../routes/routeMap'
import { providerPath } from '../utils/publicPaths'
import './CommunityPage.css'

type CategoryItem = {
  id: CommunityCategory | 'all'
  icon: LucideIcon
  color: string
}

const CATEGORY_ITEMS: CategoryItem[] = [
  { id: 'all', icon: LayoutGrid, color: '#2563eb' },
  { id: 'avokat', icon: Scale, color: '#2563eb' },
  { id: 'kontabilitet', icon: Calculator, color: '#2563eb' },
  { id: 'noter', icon: FileCheck, color: '#2563eb' },
  { id: 'biznes', icon: Building2, color: '#2563eb' },
  { id: 'patundshmeri', icon: Home, color: '#2563eb' },
  { id: 'tjeter', icon: HelpCircle, color: '#64748b' },
]

/** Full category label in the active language (e.g. "Lawyers & Justice"). */
function categoryLabel(t: TFunction, id: CategoryItem['id']): string {
  return t(`community.categories.${id}`)
}

/** Short category label used on the composer picker. */
function categoryShort(t: TFunction, id: CategoryItem['id']): string {
  return t(`community.categoriesShort.${id}`)
}

const CATEGORY_BY_ID = Object.fromEntries(CATEGORY_ITEMS.map((c) => [c.id, c])) as Record<
  string,
  CategoryItem
>

function categoryOf(id: string): CategoryItem {
  return CATEGORY_BY_ID[id] ?? CATEGORY_BY_ID.tjeter
}

const SORT_OPTIONS: { id: 'recent' | 'popular' | 'unanswered' | 'resolved'; icon: LucideIcon }[] = [
  { id: 'recent', icon: Clock3 },
  { id: 'popular', icon: TrendingUp },
  { id: 'unanswered', icon: HelpCircle },
  { id: 'resolved', icon: CheckCircle2 },
]

/** One-click starters that pre-fill the composer. */
const QUICK_PROMPTS: { labelKey: string; titleKey: string; category: CommunityCategory }[] = [
  { labelKey: 'community.quick.propertyLabel', titleKey: 'community.quick.propertyTitle', category: 'patundshmeri' },
  { labelKey: 'community.quick.businessLabel', titleKey: 'community.quick.businessTitle', category: 'biznes' },
  { labelKey: 'community.quick.notaryLabel', titleKey: 'community.quick.notaryTitle', category: 'noter' },
  { labelKey: 'community.quick.taxLabel', titleKey: 'community.quick.taxTitle', category: 'kontabilitet' },
]

/** City filter value meaning "no city filter" — rendered as "All of Kosovo". */
const ALL_CITIES = ''

/** City names are sent to the API as-is; only the "all" option is translated. */
const CITIES = [
  ALL_CITIES,
  'Prishtinë',
  'Prizren',
  'Pejë',
  'Gjakovë',
  'Ferizaj',
  'Gjilan',
  'Mitrovicë',
  'Podujevë',
  'Vushtrri',
]

function formatRelativeTime(dateStr: string, t: TFunction): string {
  try {
    const diff = Date.now() - new Date(dateStr).getTime()
    const minutes = Math.floor(diff / 60000)
    if (minutes < 1) return t('community.time.justNow')
    if (minutes < 60) return t('community.time.minutesAgo', { count: minutes })
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return t('community.time.hoursAgo', { count: hours })
    const days = Math.floor(hours / 24)
    if (days === 1) return t('community.time.yesterday')
    if (days < 7) return t('community.time.daysAgo', { count: days })
    return new Date(dateStr).toLocaleDateString(dateLocale(), {
      day: 'numeric',
      month: 'short',
    })
  } catch {
    return t('community.time.recently')
  }
}

function RoleBadge({ role }: { role?: string }) {
  const { t } = useTranslation()
  if (role === 'provider' || role === 'expert') {
    return (
      <span className="kk-role-badge kk-role-badge-expert">
        <BadgeCheck size={12} aria-hidden /> {t('community.badge.verifiedExpert')}
      </span>
    )
  }
  if (role === 'company') {
    return (
      <span className="kk-role-badge kk-role-badge-company">
        <Building2 size={12} aria-hidden /> {t('role.company')}
      </span>
    )
  }
  if (role === 'admin') {
    return (
      <span className="kk-role-badge kk-role-badge-admin">
        <ShieldCheck size={12} aria-hidden /> {t('community.badge.staff')}
      </span>
    )
  }
  return (
    <span className="kk-role-badge kk-role-badge-user">
      <UserRound size={12} aria-hidden /> {t('community.badge.citizen')}
    </span>
  )
}

/** Decorative hero illustration: question → expert answer with price → resolved. */
function HeroConversation() {
  const { t } = useTranslation()
  return (
    <div className="kk-comm-hero-visual" aria-hidden>
      <div className="kk-comm-hero-orbit" />
      <span className="kk-comm-hero-caption">{t('community.demo.caption')}</span>

      <div className="kk-comm-bubble kk-comm-bubble--question">
        <div className="kk-comm-bubble-head">
          <span className="kk-comm-bubble-avatar">A</span>
          <div>
            <strong>{t('community.demo.newQuestion')}</strong>
            <span>Prishtinë · {t('community.time.justNow')}</span>
          </div>
          <span className="kk-comm-bubble-chip">
            <Home size={11} /> {categoryShort(t, 'patundshmeri')}
          </span>
        </div>
        <p>{t('community.demo.question')}</p>
        <div className="kk-comm-bubble-foot">
          <span className="kk-comm-bubble-budget">
            <Coins size={11} /> {t('community.demo.budget')}
          </span>
        </div>
      </div>

      <div className="kk-comm-bubble kk-comm-bubble--answer">
        <div className="kk-comm-bubble-head">
          <span className="kk-comm-bubble-avatar is-expert">
            <BadgeCheck size={14} />
          </span>
          <div>
            <strong>{t('community.badge.verifiedExpert')}</strong>
            <span>{t('community.demo.answeredAfter')}</span>
          </div>
        </div>
        <p>{t('community.demo.answerIntro')}</p>
        <div className="kk-comm-bubble-price">
          <span>{t('community.indicativeFee')}</span>
          <strong>80 – 120 €</strong>
        </div>
      </div>

      <div className="kk-comm-bubble kk-comm-bubble--resolved">
        <CheckCircle2 size={16} />
        <span>{t('community.demo.resolved')}</span>
      </div>

      <div className="kk-comm-bubble kk-comm-bubble--likes">
        <Heart size={13} fill="currentColor" />
        <span>+24</span>
      </div>
    </div>
  )
}

function PostSkeleton({ index }: { index: number }) {
  return (
    <div className="kk-comm-post kk-comm-skeleton" style={{ '--i': index } as CSSProperties}>
      <div className="kk-comm-post-rail">
        <span className="kk-sk kk-sk-box" />
        <span className="kk-sk kk-sk-box" />
      </div>
      <div className="kk-comm-post-main">
        <span className="kk-sk kk-sk-line" style={{ width: '32%' }} />
        <span className="kk-sk kk-sk-line kk-sk-title" style={{ width: '78%' }} />
        <span className="kk-sk kk-sk-line" style={{ width: '94%' }} />
        <span className="kk-sk kk-sk-line" style={{ width: '64%' }} />
      </div>
    </div>
  )
}

export default function CommunityPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const composerRef = useRef<HTMLDivElement>(null)
  const feedRef = useRef<HTMLDivElement>(null)

  // Feed states
  const [posts, setPosts] = useState<CommunityPost[]>([])
  const [total, setTotal] = useState<number | null>(null)
  const [communityTotal, setCommunityTotal] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [selectedCity, setSelectedCity] = useState<string>(ALL_CITIES)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<'recent' | 'popular' | 'unanswered' | 'resolved'>('recent')

  // Post composer states
  const [isPublisherExpanded, setIsPublisherExpanded] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newContent, setNewContent] = useState('')
  const [newCategory, setNewCategory] = useState<CommunityCategory>('avokat')
  const [newCity, setNewCity] = useState('Prishtinë')
  const [newBudget, setNewBudget] = useState('')
  const [submittingPost, setSubmittingPost] = useState(false)

  // Comments state
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({})
  const [commentsMap, setCommentsMap] = useState<Record<string, CommunityComment[]>>({})
  const [loadingComments, setLoadingComments] = useState<Record<string, boolean>>({})
  const [commentText, setCommentText] = useState<Record<string, string>>({})
  const [commentPrice, setCommentPrice] = useState<Record<string, string>>({})
  const [commentProvider, setCommentProvider] = useState<Record<string, string>>({})
  const [submittingComment, setSubmittingComment] = useState<Record<string, boolean>>({})

  const hasActiveFilters =
    selectedCategory !== 'all' || selectedCity !== ALL_CITIES || searchQuery.trim() !== ''

  // Fetch posts
  const loadPosts = async () => {
    setLoading(true)
    try {
      const res = await fetchCommunityPosts({
        category: selectedCategory === 'all' ? undefined : selectedCategory,
        city: selectedCity === ALL_CITIES ? undefined : selectedCity,
        search: searchQuery.trim() || undefined,
        sort: sortBy,
      })
      setPosts(res.posts || [])
      setTotal(typeof res.total === 'number' ? res.total : null)
      // Only the unfiltered "recent"/"popular" views reflect the whole community.
      if (!hasActiveFilters && (sortBy === 'recent' || sortBy === 'popular') && typeof res.total === 'number') {
        setCommunityTotal(res.total)
      }
    } catch (err) {
      console.error(err)
      toast.danger(t('community.toast.loadError'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      loadPosts()
    }, 250)
    return () => clearTimeout(timer)
  }, [selectedCategory, selectedCity, searchQuery, sortBy])

  const openComposer = (prefill?: { title: string; category: CommunityCategory }) => {
    if (prefill) {
      setNewTitle(prefill.title)
      setNewCategory(prefill.category)
    }
    if (user) setIsPublisherExpanded(true)
    composerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    if (user) {
      window.setTimeout(() => document.getElementById('comm-title')?.focus({ preventScroll: true }), 350)
    }
  }

  const resetFilters = () => {
    setSelectedCategory('all')
    setSelectedCity(ALL_CITIES)
    setSearchQuery('')
    setSortBy('recent')
  }

  // Toggle comments
  const handleToggleComments = async (postId: string) => {
    const isOpen = !!expandedComments[postId]
    setExpandedComments((prev) => ({ ...prev, [postId]: !isOpen }))

    if (!isOpen && !commentsMap[postId]) {
      setLoadingComments((prev) => ({ ...prev, [postId]: true }))
      try {
        const comments = await fetchPostComments(postId)
        setCommentsMap((prev) => ({ ...prev, [postId]: comments }))
      } catch (err) {
        console.error(err)
        toast.danger(t('community.toast.commentsError'))
      } finally {
        setLoadingComments((prev) => ({ ...prev, [postId]: false }))
      }
    }
  }

  // Handle create post
  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) {
      toast.info(t('community.toast.loginToPost'))
      return
    }
    if (newTitle.trim().length < 5) {
      toast.warning(t('community.toast.titleShort'))
      return
    }
    if (newContent.trim().length < 10) {
      toast.warning(t('community.toast.contentShort'))
      return
    }

    setSubmittingPost(true)
    try {
      const created = await createCommunityPost({
        title: newTitle.trim(),
        content: newContent.trim(),
        category: newCategory,
        city: newCity,
        budget: newBudget.trim(),
      })
      toast.success(t('community.toast.postCreated'))
      setPosts((prev) => [created, ...prev])
      setTotal((prev) => (prev === null ? prev : prev + 1))
      setCommunityTotal((prev) => (prev === null ? prev : prev + 1))
      setNewTitle('')
      setNewContent('')
      setNewBudget('')
      setIsPublisherExpanded(false)
    } catch (err: any) {
      toast.danger(err?.response?.data?.message || t('community.toast.postFailed'))
    } finally {
      setSubmittingPost(false)
    }
  }

  // Handle like post
  const handleLikePost = async (postId: string) => {
    if (!user) {
      toast.info(t('community.toast.loginToLike'))
      return
    }
    try {
      const res = await toggleLikePost(postId)
      setPosts((prev) =>
        prev.map((p) =>
          p._id === postId
            ? { ...p, likes: res.likes }
            : p,
        ),
      )
    } catch {
      toast.danger(t('community.toast.likeFailed'))
    }
  }

  // Handle status update
  const handleToggleStatus = async (post: CommunityPost) => {
    const nextStatus: CommunityPostStatus = post.status === 'resolved' ? 'open' : 'resolved'
    try {
      const updated = await updateCommunityPostStatus(post._id, nextStatus)
      setPosts((prev) => prev.map((p) => (p._id === post._id ? updated : p)))
      toast.success(
        nextStatus === 'resolved'
          ? t('community.toast.markedResolved')
          : t('community.toast.reopened'),
      )
    } catch (err: any) {
      toast.danger(err?.response?.data?.message || t('community.toast.noPermission'))
    }
  }

  // Handle delete post
  const handleDeletePost = async (postId: string) => {
    if (!window.confirm(t('community.toast.confirmDeletePost'))) return
    try {
      await deleteCommunityPost(postId)
      setPosts((prev) => prev.filter((p) => p._id !== postId))
      setTotal((prev) => (prev === null ? prev : Math.max(0, prev - 1)))
      setCommunityTotal((prev) => (prev === null ? prev : Math.max(0, prev - 1)))
      toast.success(t('community.toast.postDeleted'))
    } catch (err: any) {
      toast.danger(err?.response?.data?.message || t('community.toast.postDeleteFailed'))
    }
  }

  // Handle submit comment
  const handleAddComment = async (postId: string, e: React.FormEvent) => {
    e.preventDefault()
    if (!user) {
      toast.info(t('community.toast.loginToComment'))
      return
    }

    const text = (commentText[postId] || '').trim()
    if (text.length < 2) {
      toast.warning(t('community.toast.commentInvalid'))
      return
    }

    setSubmittingComment((prev) => ({ ...prev, [postId]: true }))
    try {
      const newComment = await createPostComment(postId, {
        content: text,
        suggestedPrice: (commentPrice[postId] || '').trim(),
        suggestedProviderName: (commentProvider[postId] || '').trim(),
      })

      setCommentsMap((prev) => ({
        ...prev,
        [postId]: [...(prev[postId] || []), newComment],
      }))
      setPosts((prev) =>
        prev.map((p) => (p._id === postId ? { ...p, commentsCount: (p.commentsCount || 0) + 1 } : p)),
      )
      setCommentText((prev) => ({ ...prev, [postId]: '' }))
      setCommentPrice((prev) => ({ ...prev, [postId]: '' }))
      setCommentProvider((prev) => ({ ...prev, [postId]: '' }))
      toast.success(t('community.toast.commentAdded'))
    } catch (err: any) {
      toast.danger(err?.response?.data?.message || t('community.toast.commentFailed'))
    } finally {
      setSubmittingComment((prev) => ({ ...prev, [postId]: false }))
    }
  }

  // Handle like comment
  const handleLikeComment = async (postId: string, commentId: string) => {
    if (!user) {
      toast.info(t('community.toast.loginToRateComment'))
      return
    }
    try {
      const res = await toggleLikeComment(postId, commentId)
      setCommentsMap((prev) => ({
        ...prev,
        [postId]: (prev[postId] || []).map((c) =>
          c._id === commentId ? { ...c, likes: res.likes } : c,
        ),
      }))
    } catch {
      toast.danger(t('community.toast.commentLikeFailed'))
    }
  }

  // Handle delete comment
  const handleDeleteComment = async (postId: string, commentId: string) => {
    if (!window.confirm(t('community.toast.confirmDeleteComment'))) return
    try {
      await deletePostComment(postId, commentId)
      setCommentsMap((prev) => ({
        ...prev,
        [postId]: (prev[postId] || []).filter((c) => c._id !== commentId),
      }))
      setPosts((prev) =>
        prev.map((p) => (p._id === postId ? { ...p, commentsCount: Math.max(0, p.commentsCount - 1) } : p)),
      )
      toast.success(t('community.toast.commentDeleted'))
    } catch (err: any) {
      toast.danger(err?.response?.data?.message || t('community.toast.commentDeleteFailed'))
    }
  }

  // Copy share link
  const handleSharePost = (postId: string) => {
    const url = `${window.location.origin}/komuniteti#post-${postId}`
    navigator.clipboard?.writeText(url)
    toast.success(t('community.toast.linkCopied'))
  }

  const firstName = user?.name?.trim().split(/\s+/)[0] || ''
  const activeCategory = categoryOf(selectedCategory)
  const isAdmin = !!user && (user.role === 'admin' || !!user.roles?.includes('admin'))

  return (
    <div className="kk-community-page">
      <SiteNav />

      {/* ================= Hero ================= */}
      <header className="kk-comm-hero">
        <div className="kk-comm-hero-bg" aria-hidden>
          <span className="kk-comm-hero-glow kk-comm-hero-glow--a" />
          <span className="kk-comm-hero-glow kk-comm-hero-glow--b" />
        </div>

        <div className="kk-comm-hero-inner">
          <div className="kk-comm-hero-content">
            <div className="kk-comm-hero-kicker">
              <span className="kk-comm-live-dot" aria-hidden />
              <span>
                {t('community.hero.kicker')}
                {communityTotal !== null && communityTotal > 0 && (
                  <> · {t('community.hero.activeQuestions', { count: communityTotal })}</>
                )}
              </span>
            </div>

            <h1 className="kk-comm-hero-title">
              {t('community.hero.title')}{' '}
              <span className="kk-comm-hero-title-accent">{t('community.hero.titleAccent')}</span>
            </h1>

            <p className="kk-comm-hero-subtitle">
              {t('community.hero.subtitle')}
            </p>

            <div className="kk-comm-hero-ctas">
              <button type="button" className="kk-comm-hero-cta" onClick={() => openComposer()}>
                <PenLine size={17} aria-hidden />
                {t('community.hero.ask')}
              </button>
              <button
                type="button"
                className="kk-comm-hero-cta kk-comm-hero-cta--ghost"
                onClick={() => feedRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              >
                {t('community.hero.browse')}
                <ArrowRight size={16} aria-hidden />
              </button>
            </div>

            <ul className="kk-comm-hero-badges">
              <li>
                <CheckCircle2 size={15} aria-hidden /> {t('community.hero.free')}
              </li>
              <li>
                <Coins size={15} aria-hidden /> {t('community.indicativeFee')}
              </li>
              <li>
                <UserCheck size={15} aria-hidden /> {t('community.hero.verifiedExperts')}
              </li>
            </ul>
          </div>

          <HeroConversation />
        </div>
      </header>

      <main className="kk-comm-container">
        <div className="kk-comm-grid">
          {/* ================= Feed column ================= */}
          <section className="kk-comm-feed-col" aria-label={t('community.feedAria')}>
            {/* Composer */}
            <div
              ref={composerRef}
              className={`kk-comm-composer ${isPublisherExpanded ? 'is-expanded' : ''}`}
            >
              {user ? (
                <>
                  <div className="kk-comm-composer-head">
                    <ProfileAvatar src={user.profilePhoto} seed={user.uid} alt={user.name} size="md" />
                    {!isPublisherExpanded ? (
                      <button
                        type="button"
                        className="kk-comm-fake-input"
                        onClick={() => openComposer()}
                      >
                        <span>
                          {firstName
                            ? t('community.composer.greetingName', { name: firstName })
                            : t('community.composer.greeting')}{' '}
                          <em>{t('community.composer.placeholder')}</em>
                        </span>
                        <span className="kk-comm-fake-input-btn">
                          <PenLine size={15} aria-hidden /> {t('community.composer.askShort')}
                        </span>
                      </button>
                    ) : (
                      <div className="kk-comm-composer-title">
                        <strong>{t('community.composer.newTitle')}</strong>
                        <span>{t('community.composer.newHint')}</span>
                      </div>
                    )}
                    {isPublisherExpanded && (
                      <button
                        type="button"
                        className="kk-comm-icon-btn"
                        onClick={() => setIsPublisherExpanded(false)}
                        aria-label={t('community.composer.close')}
                      >
                        <X size={18} />
                      </button>
                    )}
                  </div>

                  {!isPublisherExpanded ? (
                    <div className="kk-comm-quick-prompts">
                      <span className="kk-comm-quick-label">{t('community.composer.quickStart')}</span>
                      {QUICK_PROMPTS.map((p) => {
                        const cat = categoryOf(p.category)
                        const Icon = cat.icon
                        return (
                          <button
                            key={p.labelKey}
                            type="button"
                            className="kk-comm-quick-chip"
                            style={{ '--cat': cat.color } as CSSProperties}
                            onClick={() => openComposer({ title: t(p.titleKey), category: p.category })}
                          >
                            <Icon size={13} aria-hidden />
                            {t(p.labelKey)}
                          </button>
                        )
                      })}
                    </div>
                  ) : (
                    <form onSubmit={handleCreatePost} className="kk-comm-post-form">
                      <div className="kk-form-group">
                        <label htmlFor="comm-title">{t('community.composer.titleLabel')}</label>
                        <input
                          id="comm-title"
                          type="text"
                          required
                          className="kk-comm-input kk-comm-input--lg"
                          placeholder={t('community.composer.titlePlaceholder')}
                          value={newTitle}
                          onChange={(e) => setNewTitle(e.target.value)}
                        />
                      </div>

                      <div className="kk-form-group">
                        <label htmlFor="comm-content">{t('community.composer.contentLabel')}</label>
                        <textarea
                          id="comm-content"
                          required
                          rows={4}
                          className="kk-comm-textarea"
                          placeholder={t('community.composer.contentPlaceholder')}
                          value={newContent}
                          onChange={(e) => setNewContent(e.target.value)}
                        />
                      </div>

                      <fieldset className="kk-form-group kk-comm-cat-picker">
                        <legend>{t('community.composer.category')}</legend>
                        <div className="kk-comm-cat-options">
                          {CATEGORY_ITEMS.filter((c) => c.id !== 'all').map((c) => {
                            const Icon = c.icon
                            const checked = newCategory === c.id
                            return (
                              <label
                                key={c.id}
                                className={`kk-comm-cat-option ${checked ? 'is-checked' : ''}`}
                                style={{ '--cat': c.color } as CSSProperties}
                              >
                                <input
                                  type="radio"
                                  name="comm-category"
                                  value={c.id}
                                  checked={checked}
                                  onChange={() => setNewCategory(c.id as CommunityCategory)}
                                />
                                <span className="kk-comm-cat-option-icon">
                                  <Icon size={16} aria-hidden />
                                </span>
                                <span>{categoryShort(t, c.id)}</span>
                              </label>
                            )
                          })}
                        </div>
                      </fieldset>

                      <div className="kk-form-row">
                        <div className="kk-form-col">
                          <label htmlFor="comm-city">{t('community.composer.city')}</label>
                          <div className="kk-comm-field-icon">
                            <MapPin size={15} aria-hidden />
                            <select
                              id="comm-city"
                              className="kk-comm-select"
                              value={newCity}
                              onChange={(e) => setNewCity(e.target.value)}
                            >
                              {CITIES.map((c) => (
                                <option key={c} value={c}>
                                  {c || t('community.allKosovo')}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div className="kk-form-col">
                          <label htmlFor="comm-budget">{t('community.composer.budget')}</label>
                          <div className="kk-comm-field-icon">
                            <Coins size={15} aria-hidden />
                            <input
                              id="comm-budget"
                              type="text"
                              className="kk-comm-input"
                              placeholder={t('community.composer.budgetPlaceholder')}
                              value={newBudget}
                              onChange={(e) => setNewBudget(e.target.value)}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="kk-comm-form-actions">
                        <span className="kk-comm-form-hint">
                          <Info size={13} aria-hidden /> {t('community.composer.publicHint')}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setIsPublisherExpanded(false)}
                        >
                          {t('community.composer.cancel')}
                        </Button>
                        <Button
                          type="submit"
                          variant="primary"
                          size="sm"
                          isDisabled={submittingPost}
                          className="kk-comm-submit-btn"
                        >
                          <Send size={14} aria-hidden />
                          {submittingPost ? t('community.composer.publishing') : t('community.composer.publish')}
                        </Button>
                      </div>
                    </form>
                  )}
                </>
              ) : (
                <div className="kk-comm-guest-card">
                  <div className="kk-comm-guest-icon">
                    <MessagesSquare size={24} aria-hidden />
                  </div>
                  <div className="kk-comm-guest-info">
                    <strong>{t('community.guest.title')}</strong>
                    <p>{t('community.guest.text')}</p>
                  </div>
                  <div className="kk-comm-guest-actions">
                    <Link to={routePath('login')} className="kk-comm-btn-login">
                      {t('community.guest.login')}
                    </Link>
                    <Link to={routePath('register')} className="kk-comm-btn-register">
                      {t('community.guest.register')} <ArrowRight size={15} aria-hidden />
                    </Link>
                  </div>
                </div>
              )}
            </div>

            {/* Toolbar */}
            <div className="kk-comm-toolbar" ref={feedRef}>
              <div className="kk-comm-category-tabs" role="tablist" aria-label={t('community.toolbar.categoriesAria')}>
                {CATEGORY_ITEMS.map((item) => {
                  const Icon = item.icon
                  const isActive = selectedCategory === item.id
                  return (
                    <button
                      key={item.id}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      className={`kk-comm-category-tab ${isActive ? 'is-active' : ''}`}
                      style={{ '--cat': item.color } as CSSProperties}
                      onClick={() => setSelectedCategory(item.id)}
                    >
                      <span className="kk-comm-category-tab-icon">
                        <Icon size={14} aria-hidden />
                      </span>
                      <span>{categoryLabel(t, item.id)}</span>
                    </button>
                  )
                })}
              </div>

              <div className="kk-comm-subfilters">
                <div className="kk-comm-search-box">
                  <Search size={16} className="kk-comm-search-icon" aria-hidden />
                  <input
                    type="search"
                    placeholder={t('community.toolbar.searchPlaceholder')}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="kk-comm-search-input"
                    aria-label={t('community.toolbar.searchAria')}
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      className="kk-comm-clear-btn"
                      onClick={() => setSearchQuery('')}
                      aria-label={t('community.toolbar.clearSearch')}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                <div className="kk-comm-city-select">
                  <MapPin size={15} aria-hidden />
                  <select
                    value={selectedCity}
                    onChange={(e) => setSelectedCity(e.target.value)}
                    aria-label={t('community.toolbar.cityAria')}
                  >
                    {CITIES.map((c) => (
                      <option key={c} value={c}>
                        {c || t('community.allKosovo')}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="kk-comm-feed-head">
                <div className="kk-comm-feed-count">
                  {loading ? (
                    <span>{t('community.toolbar.loading')}</span>
                  ) : (
                    <>
                      <Trans
                        i18nKey="community.toolbar.questionsCount"
                        count={total ?? posts.length}
                        components={{ strong: <strong /> }}
                      />
                      {selectedCategory !== 'all' && (
                        <span
                          className="kk-comm-feed-count-cat"
                          style={{ '--cat': activeCategory.color } as CSSProperties}
                        >
                          {t('community.toolbar.inCategory', { category: categoryLabel(t, activeCategory.id) })}
                        </span>
                      )}
                      {hasActiveFilters && (
                        <button type="button" className="kk-comm-reset-link" onClick={resetFilters}>
                          <RotateCcw size={12} aria-hidden /> {t('community.toolbar.clear')}
                        </button>
                      )}
                    </>
                  )}
                </div>

                <div className="kk-comm-sort" role="radiogroup" aria-label={t('community.toolbar.sortAria')}>
                  {SORT_OPTIONS.map((opt) => {
                    const Icon = opt.icon
                    const active = sortBy === opt.id
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        className={`kk-comm-sort-btn ${active ? 'is-active' : ''}`}
                        onClick={() => setSortBy(opt.id)}
                      >
                        <Icon size={13} aria-hidden />
                        <span>{t(`community.sort.${opt.id}`)}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Posts stream */}
            <div className="kk-comm-posts-stream">
              {loading ? (
                [0, 1, 2].map((i) => <PostSkeleton key={i} index={i} />)
              ) : posts.length === 0 ? (
                <div className="kk-comm-empty-state">
                  <div className="kk-comm-empty-art" aria-hidden>
                    <MessageCircle size={30} />
                    <span className="kk-comm-empty-dot kk-comm-empty-dot--a" />
                    <span className="kk-comm-empty-dot kk-comm-empty-dot--b" />
                  </div>
                  <h3>{hasActiveFilters ? t('community.empty.filteredTitle') : t('community.empty.title')}</h3>
                  <p>
                    {hasActiveFilters
                      ? t('community.empty.filteredText')
                      : t('community.empty.text')}
                  </p>
                  <div className="kk-comm-empty-actions">
                    {hasActiveFilters && (
                      <Button variant="outline" size="sm" onClick={resetFilters}>
                        <RotateCcw size={14} aria-hidden /> {t('community.empty.clearFilters')}
                      </Button>
                    )}
                    {user ? (
                      <Button variant="primary" size="sm" onClick={() => openComposer()}>
                        <PenLine size={14} aria-hidden /> {t('community.hero.ask')}
                      </Button>
                    ) : (
                      <Link to={routePath('register')} className="kk-comm-btn-register">
                        {t('community.empty.registerAndAsk')} <ArrowRight size={15} aria-hidden />
                      </Link>
                    )}
                  </div>
                </div>
              ) : (
                posts.map((post, index) => {
                  const hasLiked = !!user && post.likes?.includes(user.uid)
                  const isAuthor = !!user && user.uid === post.authorUid
                  const isResolved = post.status === 'resolved'
                  const areCommentsOpen = !!expandedComments[post._id]
                  const commentsList = commentsMap[post._id] || []
                  const isLoadingPostComments = !!loadingComments[post._id]
                  const cat = categoryOf(post.category)
                  const CatIcon = cat.icon
                  const likeCount = post.likes?.length || 0
                  const answerCount = post.commentsCount || 0

                  return (
                    <article
                      key={post._id}
                      id={`post-${post._id}`}
                      className={`kk-comm-post ${isResolved ? 'is-resolved' : ''} ${areCommentsOpen ? 'is-open' : ''}`}
                      style={{ '--cat': cat.color, '--i': Math.min(index, 8) } as CSSProperties}
                    >
                      {/* Left rail: support + answers */}
                      <div className="kk-comm-post-rail">
                        <button
                          type="button"
                          className={`kk-comm-rail-like ${hasLiked ? 'is-liked' : ''}`}
                          onClick={() => handleLikePost(post._id)}
                          aria-pressed={hasLiked}
                          aria-label={t('community.post.supportAria', { count: likeCount })}
                        >
                          <Heart size={18} fill={hasLiked ? 'currentColor' : 'none'} aria-hidden />
                          <strong>{likeCount}</strong>
                          <span>{t('community.post.supportLabel', { count: likeCount })}</span>
                        </button>
                        <button
                          type="button"
                          className={`kk-comm-rail-answers ${answerCount > 0 ? 'has-answers' : ''} ${isResolved ? 'is-resolved' : ''}`}
                          onClick={() => handleToggleComments(post._id)}
                          aria-label={t('community.post.answersAria', { count: answerCount })}
                        >
                          {isResolved ? <CheckCircle2 size={16} aria-hidden /> : <MessageCircle size={16} aria-hidden />}
                          <strong>{answerCount}</strong>
                          <span>{t('community.post.answersLabel', { count: answerCount })}</span>
                        </button>
                      </div>

                      <div className="kk-comm-post-main">
                        {/* Meta row */}
                        <div className="kk-comm-post-topline">
                          <span className="kk-comm-cat-chip">
                            <CatIcon size={13} aria-hidden /> {categoryLabel(t, cat.id)}
                          </span>
                          {post.city && (
                            <span className="kk-comm-topline-meta">
                              <MapPin size={12} aria-hidden /> {post.city}
                            </span>
                          )}
                          <span className="kk-comm-topline-meta">
                            <Clock3 size={12} aria-hidden /> {formatRelativeTime(post.createdAt, t)}
                          </span>
                          {isResolved && (
                            <span className="kk-comm-status-resolved">
                              <CheckCircle2 size={13} aria-hidden /> {t('community.post.resolved')}
                            </span>
                          )}
                        </div>

                        {/* Body */}
                        <h2 className="kk-comm-post-title">{post.title}</h2>
                        <p className="kk-comm-post-text">{post.content}</p>

                        {/* Author + budget */}
                        <div className="kk-comm-post-byline">
                          <div className="kk-comm-post-author">
                            <ProfileAvatar
                              src={post.authorPhoto}
                              seed={post.authorUid}
                              alt={post.authorName}
                              size="sm"
                            />
                            <strong>{post.authorName}</strong>
                            <RoleBadge role={post.authorRole} />
                          </div>
                          {post.budget && (
                            <span className="kk-comm-budget-ticket">
                              <Coins size={13} aria-hidden />
                              <span>{t('community.post.budget')}</span>
                              <strong>{post.budget}</strong>
                            </span>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="kk-comm-post-actions-bar">
                          <button
                            type="button"
                            className={`kk-comm-action-btn kk-comm-action-btn--primary ${areCommentsOpen ? 'is-active' : ''}`}
                            onClick={() => handleToggleComments(post._id)}
                            aria-expanded={areCommentsOpen}
                          >
                            <MessageCircle size={16} aria-hidden />
                            <span>
                              {areCommentsOpen
                                ? t('community.post.closeDiscussion')
                                : answerCount > 0
                                  ? t('community.post.viewAnswers', { count: answerCount })
                                  : t('community.post.answerFirst')}
                            </span>
                          </button>

                          <button
                            type="button"
                            className={`kk-comm-action-btn kk-comm-action-like ${hasLiked ? 'is-liked' : ''}`}
                            onClick={() => handleLikePost(post._id)}
                            aria-pressed={hasLiked}
                          >
                            <Heart size={16} fill={hasLiked ? 'currentColor' : 'none'} aria-hidden />
                            <span>{likeCount}</span>
                          </button>

                          <button
                            type="button"
                            className="kk-comm-action-btn"
                            onClick={() => handleSharePost(post._id)}
                            title={t('community.post.shareTitle')}
                          >
                            <Share2 size={16} aria-hidden />
                            <span className="kk-hide-mobile">{t('community.post.share')}</span>
                          </button>

                          {(isAuthor || isAdmin) && (
                            <div className="kk-comm-author-menu">
                              <button
                                type="button"
                                className={`kk-comm-mini-btn ${isResolved ? '' : 'kk-comm-mini-btn--success'}`}
                                onClick={() => handleToggleStatus(post)}
                                title={isResolved ? t('community.post.reopenTitle') : t('community.post.markResolvedTitle')}
                              >
                                {isResolved ? <RotateCcw size={14} aria-hidden /> : <CheckCircle2 size={14} aria-hidden />}
                                <span>{isResolved ? t('community.post.reopen') : t('community.post.markResolved')}</span>
                              </button>
                              <button
                                type="button"
                                className="kk-comm-mini-btn kk-comm-danger-btn"
                                onClick={() => handleDeletePost(post._id)}
                                title={t('community.post.delete')}
                                aria-label={t('community.post.delete')}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Comments */}
                        {areCommentsOpen && (
                          <div className="kk-comm-comments-panel">
                            <div className="kk-comm-comments-heading">
                              <MessagesSquare size={15} aria-hidden />
                              <span>{t('community.comments.heading')}</span>
                              <span className="kk-comm-count-pill">{commentsList.length}</span>
                            </div>

                            {isLoadingPostComments ? (
                              <div className="kk-comm-comments-loading">
                                <div className="kk-spinner-sm" />
                                <span>{t('community.comments.loading')}</span>
                              </div>
                            ) : commentsList.length === 0 ? (
                              <p className="kk-comm-no-comments">
                                {t('community.comments.empty')}
                              </p>
                            ) : (
                              <ol className="kk-comm-comments-list">
                                {commentsList.map((comm) => {
                                  const isCommAuthor = !!user && user.uid === comm.authorUid
                                  const commLiked = !!user && comm.likes?.includes(user.uid)
                                  const isExpert = comm.authorRole === 'provider' || comm.authorRole === 'company'

                                  return (
                                    <li
                                      key={comm._id}
                                      className={`kk-comm-comment-item ${isExpert ? 'is-expert-comment' : ''}`}
                                    >
                                      <div className="kk-comm-comment-avatar">
                                        <ProfileAvatar
                                          src={comm.authorPhoto}
                                          seed={comm.authorUid}
                                          alt={comm.authorName}
                                          size="sm"
                                        />
                                      </div>
                                      <div className="kk-comm-comment-content-box">
                                        {isExpert && (
                                          <span className="kk-comm-expert-flag">
                                            <BadgeCheck size={12} aria-hidden /> {t('community.comments.expertAnswer')}
                                          </span>
                                        )}
                                        <div className="kk-comm-comment-author-bar">
                                          <div className="kk-comm-author-left">
                                            <strong>{comm.authorName}</strong>
                                            <RoleBadge role={comm.authorRole} />
                                            <span className="kk-comm-comment-date">
                                              {formatRelativeTime(comm.createdAt, t)}
                                            </span>
                                          </div>

                                          {(isCommAuthor || isAdmin) && (
                                            <button
                                              type="button"
                                              className="kk-comm-delete-comment-btn"
                                              onClick={() => handleDeleteComment(post._id, comm._id)}
                                              title={t('community.comments.delete')}
                                              aria-label={t('community.comments.delete')}
                                            >
                                              <Trash2 size={13} />
                                            </button>
                                          )}
                                        </div>

                                        <p className="kk-comm-comment-text">{comm.content}</p>

                                        {(comm.suggestedPrice || comm.suggestedProviderName) && (
                                          <div className="kk-comm-comment-extras">
                                            {comm.suggestedPrice && (
                                              <div className="kk-comm-price-tag">
                                                <Coins size={15} aria-hidden />
                                                <span>{t('community.indicativeFee')}</span>
                                                <strong>{comm.suggestedPrice}</strong>
                                              </div>
                                            )}

                                            {comm.suggestedProviderName && (
                                              <div className="kk-comm-rec-card">
                                                <span className="kk-comm-rec-icon">
                                                  <BadgeCheck size={15} aria-hidden />
                                                </span>
                                                <div>
                                                  <span>{t('community.comments.recommends')}</span>
                                                  <strong>{comm.suggestedProviderName}</strong>
                                                </div>
                                                {comm.suggestedProviderUid && (
                                                  <Link
                                                    to={providerPath({ uid: comm.suggestedProviderUid })}
                                                    className="kk-comm-view-profile-link"
                                                  >
                                                    {t('req.profile')} <ArrowRight size={13} aria-hidden />
                                                  </Link>
                                                )}
                                              </div>
                                            )}
                                          </div>
                                        )}

                                        <div className="kk-comm-comment-footer">
                                          <button
                                            type="button"
                                            className={`kk-comm-comment-like-btn ${commLiked ? 'is-liked' : ''}`}
                                            onClick={() => handleLikeComment(post._id, comm._id)}
                                            aria-pressed={commLiked}
                                          >
                                            <Heart size={13} fill={commLiked ? 'currentColor' : 'none'} aria-hidden />
                                            <span>{comm.likes?.length ? comm.likes.length : t('community.comments.helpful')}</span>
                                          </button>

                                          {isExpert && comm.authorUid && (
                                            <Link
                                              to={providerPath({ uid: comm.authorUid })}
                                              className="kk-comm-contact-expert-link"
                                            >
                                              {t('community.comments.contactExpert')} <ArrowRight size={13} aria-hidden />
                                            </Link>
                                          )}
                                        </div>
                                      </div>
                                    </li>
                                  )
                                })}
                              </ol>
                            )}

                            {user ? (
                              <form
                                onSubmit={(e) => handleAddComment(post._id, e)}
                                className="kk-comm-new-comment-form"
                              >
                                <ProfileAvatar
                                  src={user.profilePhoto}
                                  seed={user.uid}
                                  alt={user.name}
                                  size="sm"
                                />
                                <div className="kk-comm-comment-input-wrap">
                                  <textarea
                                    rows={2}
                                    required
                                    className="kk-comm-comment-textarea"
                                    placeholder={t('community.comments.placeholder')}
                                    aria-label={t('community.comments.aria')}
                                    value={commentText[post._id] || ''}
                                    onChange={(e) =>
                                      setCommentText((prev) => ({ ...prev, [post._id]: e.target.value }))
                                    }
                                  />

                                  <div className="kk-comm-comment-meta-inputs">
                                    <label className="kk-comm-meta-field">
                                      <Coins size={14} aria-hidden />
                                      <input
                                        type="text"
                                        placeholder={t('community.comments.pricePlaceholder')}
                                        value={commentPrice[post._id] || ''}
                                        onChange={(e) =>
                                          setCommentPrice((prev) => ({ ...prev, [post._id]: e.target.value }))
                                        }
                                        className="kk-comm-mini-input"
                                      />
                                    </label>

                                    <label className="kk-comm-meta-field">
                                      <BadgeCheck size={14} aria-hidden />
                                      <input
                                        type="text"
                                        placeholder={t('community.comments.providerPlaceholder')}
                                        value={commentProvider[post._id] || ''}
                                        onChange={(e) =>
                                          setCommentProvider((prev) => ({
                                            ...prev,
                                            [post._id]: e.target.value,
                                          }))
                                        }
                                        className="kk-comm-mini-input"
                                      />
                                    </label>

                                    <Button
                                      type="submit"
                                      size="sm"
                                      variant="primary"
                                      isDisabled={submittingComment[post._id]}
                                      className="kk-comm-comment-send-btn"
                                    >
                                      <Send size={14} aria-hidden />
                                      <span>{submittingComment[post._id] ? t('community.comments.sending') : t('community.comments.send')}</span>
                                    </Button>
                                  </div>
                                </div>
                              </form>
                            ) : (
                              <div className="kk-comm-login-to-comment">
                                <span>{t('community.comments.loginPrompt')}</span>
                                <Link to={routePath('login')} className="kk-comm-login-link">
                                  {t('community.comments.loginLink')} <ArrowRight size={13} aria-hidden />
                                </Link>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </article>
                  )
                })
              )}
            </div>
          </section>

          {/* ================= Sidebar ================= */}
          <aside className="kk-comm-sidebar">
            <div className="kk-comm-side-card kk-comm-guide-widget">
              <div className="kk-comm-widget-title">
                <Info size={17} aria-hidden />
                <h3>{t('community.sidebar.howTitle')}</h3>
              </div>
              <ol className="kk-comm-steps">
                <li>
                  <span className="kk-comm-step-num">1</span>
                  <div>
                    <strong>{t('community.sidebar.step1Title')}</strong>
                    <p>{t('community.sidebar.step1Text')}</p>
                  </div>
                </li>
                <li>
                  <span className="kk-comm-step-num">2</span>
                  <div>
                    <strong>{t('community.sidebar.step2Title')}</strong>
                    <p>{t('community.sidebar.step2Text')}</p>
                  </div>
                </li>
                <li>
                  <span className="kk-comm-step-num">3</span>
                  <div>
                    <strong>{t('community.sidebar.step3Title')}</strong>
                    <p>{t('community.sidebar.step3Text')}</p>
                  </div>
                </li>
              </ol>
            </div>

            <Link to={routePath('compare')} className="kk-comm-side-card kk-comm-feature-card">
              <span className="kk-comm-feature-icon">
                <Scale size={22} aria-hidden />
              </span>
              <h4>{t('community.sidebar.compareTitle')}</h4>
              <p>{t('community.sidebar.compareText')}</p>
              <span className="kk-comm-sidebar-action-btn">
                {t('community.sidebar.compareCta')} <ArrowRight size={15} aria-hidden />
              </span>
            </Link>

            <Link to={routePath('aiAssistant')} className="kk-comm-side-card kk-comm-ai-widget">
              <span className="kk-comm-ai-badge">
                <MessageSquareText size={13} aria-hidden /> Këshilla AI · 24/7
              </span>
              <h4>{t('community.sidebar.aiTitle')}</h4>
              <p>{t('community.sidebar.aiText')}</p>
              <span className="kk-comm-ai-btn">
                {t('community.sidebar.aiCta')} <ArrowRight size={15} aria-hidden />
              </span>
            </Link>
          </aside>
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
