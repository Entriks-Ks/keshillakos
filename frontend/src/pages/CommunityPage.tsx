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
  Flame,
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
  Sparkles,
  Trash2,
  UserCheck,
  UserRound,
  X,
  type LucideIcon,
} from 'lucide-react'
import { Button, toast } from '@heroui/react'
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
import './CommunityPage.css'

type CategoryItem = {
  id: CommunityCategory | 'all'
  label: string
  short: string
  icon: LucideIcon
  color: string
}

const CATEGORY_ITEMS: CategoryItem[] = [
  { id: 'all', label: 'Të gjitha', short: 'Të gjitha', icon: Sparkles, color: '#0a21c0' },
  { id: 'avokat', label: 'Avokatë & Drejtësi', short: 'Avokatë', icon: Scale, color: '#2563eb' },
  { id: 'kontabilitet', label: 'Kontabilitet & Financa', short: 'Kontabilitet', icon: Calculator, color: '#059669' },
  { id: 'noter', label: 'Noteri & Akte', short: 'Noteri', icon: FileCheck, color: '#7c3aed' },
  { id: 'biznes', label: 'Biznes & Konsulencë', short: 'Biznes', icon: Building2, color: '#d97706' },
  { id: 'patundshmeri', label: 'Prona & Patundshmëri', short: 'Prona', icon: Home, color: '#0891b2' },
  { id: 'tjeter', label: 'Të tjera', short: 'Të tjera', icon: HelpCircle, color: '#64748b' },
]

const CATEGORY_BY_ID = Object.fromEntries(CATEGORY_ITEMS.map((c) => [c.id, c])) as Record<
  string,
  CategoryItem
>

function categoryOf(id: string): CategoryItem {
  return CATEGORY_BY_ID[id] ?? CATEGORY_BY_ID.tjeter
}

const SORT_OPTIONS: { id: 'recent' | 'popular' | 'unanswered' | 'resolved'; label: string; icon: LucideIcon }[] = [
  { id: 'recent', label: 'Më të rejat', icon: Clock3 },
  { id: 'popular', label: 'Më aktive', icon: Flame },
  { id: 'unanswered', label: 'Pa përgjigje', icon: HelpCircle },
  { id: 'resolved', label: 'Të zgjidhura', icon: CheckCircle2 },
]

/** One-click starters that pre-fill the composer. */
const QUICK_PROMPTS: { label: string; title: string; category: CommunityCategory }[] = [
  { label: 'Avokat për kontratë prone', title: 'Kam nevojë për një avokat për kontratë prone', category: 'patundshmeri' },
  { label: 'Regjistrim biznesi', title: 'Si ta regjistroj biznesin dhe sa kushton?', category: 'biznes' },
  { label: 'Vërtetim noterial', title: 'Sa kushton vërtetimi i një kontrate te noteri?', category: 'noter' },
  { label: 'Deklarim tatimor', title: 'Kërkoj kontabilist për deklarimin vjetor tatimor', category: 'kontabilitet' },
]

const CITIES = [
  'Gjithë Kosova',
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

function formatRelativeTime(dateStr: string): string {
  try {
    const diff = Date.now() - new Date(dateStr).getTime()
    const minutes = Math.floor(diff / 60000)
    if (minutes < 1) return 'sapo'
    if (minutes < 60) return `para ${minutes} min`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `para ${hours} orësh`
    const days = Math.floor(hours / 24)
    if (days === 1) return 'dje'
    if (days < 7) return `para ${days} ditësh`
    return new Date(dateStr).toLocaleDateString('sq-AL', {
      day: 'numeric',
      month: 'short',
    })
  } catch {
    return 'së fundmi'
  }
}

function RoleBadge({ role }: { role?: string }) {
  if (role === 'provider' || role === 'expert') {
    return (
      <span className="kk-role-badge kk-role-badge-expert">
        <BadgeCheck size={12} aria-hidden /> Ekspert i Verifikuar
      </span>
    )
  }
  if (role === 'company') {
    return (
      <span className="kk-role-badge kk-role-badge-company">
        <Building2 size={12} aria-hidden /> Kompani
      </span>
    )
  }
  if (role === 'admin') {
    return (
      <span className="kk-role-badge kk-role-badge-admin">
        <Sparkles size={12} aria-hidden /> Stafi
      </span>
    )
  }
  return (
    <span className="kk-role-badge kk-role-badge-user">
      <UserRound size={12} aria-hidden /> Qytetar
    </span>
  )
}

/** Decorative hero illustration: question → expert answer with price → resolved. */
function HeroConversation() {
  return (
    <div className="kk-comm-hero-visual" aria-hidden>
      <div className="kk-comm-hero-orbit" />
      <span className="kk-comm-hero-caption">Shembull i një bisede</span>

      <div className="kk-comm-bubble kk-comm-bubble--question">
        <div className="kk-comm-bubble-head">
          <span className="kk-comm-bubble-avatar">A</span>
          <div>
            <strong>Pyetje e re</strong>
            <span>Prishtinë · sapo</span>
          </div>
          <span className="kk-comm-bubble-chip">
            <Home size={11} /> Prona
          </span>
        </div>
        <p>Kam nevojë për avokat për kontratë shitblerjeje banese. Sa kushton zakonisht?</p>
        <div className="kk-comm-bubble-foot">
          <span className="kk-comm-bubble-budget">
            <Coins size={11} /> Buxheti deri 150 €
          </span>
        </div>
      </div>

      <div className="kk-comm-bubble kk-comm-bubble--answer">
        <div className="kk-comm-bubble-head">
          <span className="kk-comm-bubble-avatar is-expert">
            <BadgeCheck size={14} />
          </span>
          <div>
            <strong>Ekspert i verifikuar</strong>
            <span>u përgjigj pas 12 min</span>
          </div>
        </div>
        <p>Përpilimi + verifikimi te noteri zakonisht kushton:</p>
        <div className="kk-comm-bubble-price">
          <span>Tarifa orientuese</span>
          <strong>80 – 120 €</strong>
        </div>
      </div>

      <div className="kk-comm-bubble kk-comm-bubble--resolved">
        <CheckCircle2 size={16} />
        <span>E zgjidhur · 3 rekomandime</span>
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
  const { user } = useAuth()
  const composerRef = useRef<HTMLDivElement>(null)
  const feedRef = useRef<HTMLDivElement>(null)

  // Feed states
  const [posts, setPosts] = useState<CommunityPost[]>([])
  const [total, setTotal] = useState<number | null>(null)
  const [communityTotal, setCommunityTotal] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [selectedCity, setSelectedCity] = useState<string>('Gjithë Kosova')
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
    selectedCategory !== 'all' || selectedCity !== 'Gjithë Kosova' || searchQuery.trim() !== ''

  // Fetch posts
  const loadPosts = async () => {
    setLoading(true)
    try {
      const res = await fetchCommunityPosts({
        category: selectedCategory === 'all' ? undefined : selectedCategory,
        city: selectedCity === 'Gjithë Kosova' ? undefined : selectedCity,
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
      toast.danger('Nuk mund të ngarkoheshin pyetjet e komunitetit.')
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
    setSelectedCity('Gjithë Kosova')
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
        toast.danger('Dështoi ngarkimi i komenteve')
      } finally {
        setLoadingComments((prev) => ({ ...prev, [postId]: false }))
      }
    }
  }

  // Handle create post
  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) {
      toast.info('Duhet të kyçeni për të publikuar një pyetje.')
      return
    }
    if (newTitle.trim().length < 5) {
      toast.warning('Ju lutem shkruani një titull të qartë (së paku 5 shkronja).')
      return
    }
    if (newContent.trim().length < 10) {
      toast.warning('Ju lutem përshkruani pyetjen ose kërkesën tuaj më hollësisht.')
      return
    }

    setSubmittingPost(true)
    try {
      const created = await createCommunityPost({
        title: newTitle.trim(),
        content: newContent.trim(),
        category: newCategory,
        city: newCity === 'Gjithë Kosova' ? '' : newCity,
        budget: newBudget.trim(),
      })
      toast.success('Pyetja u publikua me sukses në komunitet!')
      setPosts((prev) => [created, ...prev])
      setTotal((prev) => (prev === null ? prev : prev + 1))
      setCommunityTotal((prev) => (prev === null ? prev : prev + 1))
      setNewTitle('')
      setNewContent('')
      setNewBudget('')
      setIsPublisherExpanded(false)
    } catch (err: any) {
      toast.danger(err?.response?.data?.message || 'Dështoi publikimi i pyetjes.')
    } finally {
      setSubmittingPost(false)
    }
  }

  // Handle like post
  const handleLikePost = async (postId: string) => {
    if (!user) {
      toast.info('Kyçuni për të mbështetur këtë pyetje.')
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
      toast.danger('Dështoi veprimi i pëlqimit.')
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
          ? 'Kërkesa u shënua si e zgjidhur!'
          : 'Kërkesa u rihap për rekomandime të reja.',
      )
    } catch (err: any) {
      toast.danger(err?.response?.data?.message || 'Nuk keni leje për këtë veprim.')
    }
  }

  // Handle delete post
  const handleDeletePost = async (postId: string) => {
    if (!window.confirm('A jeni të sigurt që dëshironi të fshini këtë pyetje?')) return
    try {
      await deleteCommunityPost(postId)
      setPosts((prev) => prev.filter((p) => p._id !== postId))
      setTotal((prev) => (prev === null ? prev : Math.max(0, prev - 1)))
      setCommunityTotal((prev) => (prev === null ? prev : Math.max(0, prev - 1)))
      toast.success('Pyetja u fshi nga komuniteti.')
    } catch (err: any) {
      toast.danger(err?.response?.data?.message || 'Dështoi fshirja e pyetjes.')
    }
  }

  // Handle submit comment
  const handleAddComment = async (postId: string, e: React.FormEvent) => {
    e.preventDefault()
    if (!user) {
      toast.info('Duhet të kyçeni për të komentuar.')
      return
    }

    const text = (commentText[postId] || '').trim()
    if (text.length < 2) {
      toast.warning('Shkruani një koment të vlefshëm.')
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
      toast.success('Komenti dhe rekomandimi u shtuan me sukses!')
    } catch (err: any) {
      toast.danger(err?.response?.data?.message || 'Dështoi shtimi i komentit.')
    } finally {
      setSubmittingComment((prev) => ({ ...prev, [postId]: false }))
    }
  }

  // Handle like comment
  const handleLikeComment = async (postId: string, commentId: string) => {
    if (!user) {
      toast.info('Kyçuni për të vlerësuar këtë koment.')
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
      toast.danger('Dështoi vlerësimi i komentit.')
    }
  }

  // Handle delete comment
  const handleDeleteComment = async (postId: string, commentId: string) => {
    if (!window.confirm('A jeni të sigurt që dëshironi të fshini këtë koment?')) return
    try {
      await deletePostComment(postId, commentId)
      setCommentsMap((prev) => ({
        ...prev,
        [postId]: (prev[postId] || []).filter((c) => c._id !== commentId),
      }))
      setPosts((prev) =>
        prev.map((p) => (p._id === postId ? { ...p, commentsCount: Math.max(0, p.commentsCount - 1) } : p)),
      )
      toast.success('Komenti u fshi.')
    } catch (err: any) {
      toast.danger(err?.response?.data?.message || 'Dështoi fshirja e komentit.')
    }
  }

  // Copy share link
  const handleSharePost = (postId: string) => {
    const url = `${window.location.origin}/komuniteti#post-${postId}`
    navigator.clipboard?.writeText(url)
    toast.success('Lidhja e kësaj pyetjeje u kopjua në kujtesë!')
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
                Komuniteti Këshillohu
                {communityTotal !== null && communityTotal > 0 && (
                  <> · {communityTotal} pyetje aktive</>
                )}
              </span>
            </div>

            <h1 className="kk-comm-hero-title">
              Pyet komunitetin.{' '}
              <span className="kk-comm-hero-title-accent">Merr çmime reale.</span>
            </h1>

            <p className="kk-comm-hero-subtitle">
              Kërkon avokat, noter apo kontabilist të besueshëm? Shkruaje kërkesën si status dhe
              merr këshilla, rekomandime e tarifa orientuese nga qytetarët dhe ekspertët e verifikuar.
            </p>

            <div className="kk-comm-hero-ctas">
              <button type="button" className="kk-comm-hero-cta" onClick={() => openComposer()}>
                <PenLine size={17} aria-hidden />
                Bëj një pyetje
              </button>
              <button
                type="button"
                className="kk-comm-hero-cta kk-comm-hero-cta--ghost"
                onClick={() => feedRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              >
                Shfleto diskutimet
                <ArrowRight size={16} aria-hidden />
              </button>
            </div>

            <ul className="kk-comm-hero-badges">
              <li>
                <CheckCircle2 size={15} aria-hidden /> 100% falas
              </li>
              <li>
                <Coins size={15} aria-hidden /> Tarifa orientuese
              </li>
              <li>
                <UserCheck size={15} aria-hidden /> Ekspertë të verifikuar
              </li>
            </ul>
          </div>

          <HeroConversation />
        </div>
      </header>

      <main className="kk-comm-container">
        <div className="kk-comm-grid">
          {/* ================= Feed column ================= */}
          <section className="kk-comm-feed-col" aria-label="Pyetjet e komunitetit">
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
                          {firstName ? `Çfarë të duhet sot, ${firstName}?` : 'Çfarë të duhet sot?'}{' '}
                          <em>Shkruaj pyetjen tënde…</em>
                        </span>
                        <span className="kk-comm-fake-input-btn">
                          <PenLine size={15} aria-hidden /> Pyet
                        </span>
                      </button>
                    ) : (
                      <div className="kk-comm-composer-title">
                        <strong>Pyetje e re për komunitetin</strong>
                        <span>Sa më shumë detaje, aq më të sakta rekomandimet dhe çmimet.</span>
                      </div>
                    )}
                    {isPublisherExpanded && (
                      <button
                        type="button"
                        className="kk-comm-icon-btn"
                        onClick={() => setIsPublisherExpanded(false)}
                        aria-label="Mbyll"
                      >
                        <X size={18} />
                      </button>
                    )}
                  </div>

                  {!isPublisherExpanded ? (
                    <div className="kk-comm-quick-prompts">
                      <span className="kk-comm-quick-label">Fillo shpejt:</span>
                      {QUICK_PROMPTS.map((p) => {
                        const cat = categoryOf(p.category)
                        const Icon = cat.icon
                        return (
                          <button
                            key={p.label}
                            type="button"
                            className="kk-comm-quick-chip"
                            style={{ '--cat': cat.color } as CSSProperties}
                            onClick={() => openComposer({ title: p.title, category: p.category })}
                          >
                            <Icon size={13} aria-hidden />
                            {p.label}
                          </button>
                        )
                      })}
                    </div>
                  ) : (
                    <form onSubmit={handleCreatePost} className="kk-comm-post-form">
                      <div className="kk-form-group">
                        <label htmlFor="comm-title">Titulli i pyetjes ose kërkesës *</label>
                        <input
                          id="comm-title"
                          type="text"
                          required
                          className="kk-comm-input kk-comm-input--lg"
                          placeholder="P.sh.: Kam nevojë për një avokat për çështje trashëgimie"
                          value={newTitle}
                          onChange={(e) => setNewTitle(e.target.value)}
                        />
                      </div>

                      <div className="kk-form-group">
                        <label htmlFor="comm-content">Përshkruaj situatën tënde *</label>
                        <textarea
                          id="comm-content"
                          required
                          rows={4}
                          className="kk-comm-textarea"
                          placeholder="Trego çfarë lloj shërbimi kërkon, nëse ke dokumentet gati, dhe çfarë këshille apo çmimi të duhet..."
                          value={newContent}
                          onChange={(e) => setNewContent(e.target.value)}
                        />
                      </div>

                      <fieldset className="kk-form-group kk-comm-cat-picker">
                        <legend>Kategoria e shërbimit</legend>
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
                                <span>{c.short}</span>
                              </label>
                            )
                          })}
                        </div>
                      </fieldset>

                      <div className="kk-form-row">
                        <div className="kk-form-col">
                          <label htmlFor="comm-city">Qyteti</label>
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
                                  {c}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div className="kk-form-col">
                          <label htmlFor="comm-budget">Buxheti orientues (opsionale)</label>
                          <div className="kk-comm-field-icon">
                            <Coins size={15} aria-hidden />
                            <input
                              id="comm-budget"
                              type="text"
                              className="kk-comm-input"
                              placeholder="P.sh. Deri 100€"
                              value={newBudget}
                              onChange={(e) => setNewBudget(e.target.value)}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="kk-comm-form-actions">
                        <span className="kk-comm-form-hint">
                          <Sparkles size={13} aria-hidden /> Pyetjet janë publike — mos shkruaj të dhëna personale.
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setIsPublisherExpanded(false)}
                        >
                          Anulo
                        </Button>
                        <Button
                          type="submit"
                          variant="primary"
                          size="sm"
                          isDisabled={submittingPost}
                          className="kk-comm-submit-btn"
                        >
                          <Send size={14} aria-hidden />
                          {submittingPost ? 'Duke u publikuar...' : 'Publiko pyetjen'}
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
                    <strong>Ke nevojë për një avokat apo ekspert?</strong>
                    <p>Kyçu për të bërë pyetje, për të marrë rekomandime dhe tarifa orientuese — falas.</p>
                  </div>
                  <div className="kk-comm-guest-actions">
                    <Link to="/login" className="kk-comm-btn-login">
                      Kyçu
                    </Link>
                    <Link to="/register" className="kk-comm-btn-register">
                      Regjistrohu falas <ArrowRight size={15} aria-hidden />
                    </Link>
                  </div>
                </div>
              )}
            </div>

            {/* Toolbar */}
            <div className="kk-comm-toolbar" ref={feedRef}>
              <div className="kk-comm-category-tabs" role="tablist" aria-label="Kategoritë">
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
                      <span>{item.label}</span>
                    </button>
                  )
                })}
              </div>

              <div className="kk-comm-subfilters">
                <div className="kk-comm-search-box">
                  <Search size={16} className="kk-comm-search-icon" aria-hidden />
                  <input
                    type="search"
                    placeholder="Kërko pyetje, avokatë, tema..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="kk-comm-search-input"
                    aria-label="Kërko në komunitet"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      className="kk-comm-clear-btn"
                      onClick={() => setSearchQuery('')}
                      aria-label="Pastro kërkimin"
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
                    aria-label="Filtro sipas qytetit"
                  >
                    {CITIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="kk-comm-feed-head">
                <div className="kk-comm-feed-count">
                  {loading ? (
                    <span>Duke ngarkuar…</span>
                  ) : (
                    <>
                      <strong>{total ?? posts.length}</strong> pyetje
                      {selectedCategory !== 'all' && (
                        <span
                          className="kk-comm-feed-count-cat"
                          style={{ '--cat': activeCategory.color } as CSSProperties}
                        >
                          në {activeCategory.label}
                        </span>
                      )}
                      {hasActiveFilters && (
                        <button type="button" className="kk-comm-reset-link" onClick={resetFilters}>
                          <RotateCcw size={12} aria-hidden /> Pastro
                        </button>
                      )}
                    </>
                  )}
                </div>

                <div className="kk-comm-sort" role="radiogroup" aria-label="Renditja">
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
                        <span>{opt.label}</span>
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
                  <h3>{hasActiveFilters ? 'Asnjë pyetje për këto filtra' : 'Bëhu i pari që pyet'}</h3>
                  <p>
                    {hasActiveFilters
                      ? 'Provo një kategori tjetër, një qytet tjetër ose pastro kërkimin.'
                      : 'Komuniteti po pret pyetjen tënde — ekspertët përgjigjen shpejt.'}
                  </p>
                  <div className="kk-comm-empty-actions">
                    {hasActiveFilters && (
                      <Button variant="outline" size="sm" onClick={resetFilters}>
                        <RotateCcw size={14} aria-hidden /> Pastro filtrat
                      </Button>
                    )}
                    {user ? (
                      <Button variant="primary" size="sm" onClick={() => openComposer()}>
                        <PenLine size={14} aria-hidden /> Bëj një pyetje
                      </Button>
                    ) : (
                      <Link to="/register" className="kk-comm-btn-register">
                        Regjistrohu dhe pyet <ArrowRight size={15} aria-hidden />
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
                          aria-label={`Mbështet pyetjen (${likeCount})`}
                        >
                          <Heart size={18} fill={hasLiked ? 'currentColor' : 'none'} aria-hidden />
                          <strong>{likeCount}</strong>
                          <span>mbështetje</span>
                        </button>
                        <button
                          type="button"
                          className={`kk-comm-rail-answers ${answerCount > 0 ? 'has-answers' : ''} ${isResolved ? 'is-resolved' : ''}`}
                          onClick={() => handleToggleComments(post._id)}
                          aria-label={`${answerCount} përgjigje`}
                        >
                          {isResolved ? <CheckCircle2 size={16} aria-hidden /> : <MessageCircle size={16} aria-hidden />}
                          <strong>{answerCount}</strong>
                          <span>përgjigje</span>
                        </button>
                      </div>

                      <div className="kk-comm-post-main">
                        {/* Meta row */}
                        <div className="kk-comm-post-topline">
                          <span className="kk-comm-cat-chip">
                            <CatIcon size={13} aria-hidden /> {cat.label}
                          </span>
                          {post.city && (
                            <span className="kk-comm-topline-meta">
                              <MapPin size={12} aria-hidden /> {post.city}
                            </span>
                          )}
                          <span className="kk-comm-topline-meta">
                            <Clock3 size={12} aria-hidden /> {formatRelativeTime(post.createdAt)}
                          </span>
                          {isResolved && (
                            <span className="kk-comm-status-resolved">
                              <CheckCircle2 size={13} aria-hidden /> E zgjidhur
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
                              <span>Buxheti</span>
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
                                ? 'Mbyll diskutimin'
                                : answerCount > 0
                                  ? `Shiko ${answerCount} përgjigje`
                                  : 'Përgjigju i pari'}
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
                            title="Shpërndaj lidhjen"
                          >
                            <Share2 size={16} aria-hidden />
                            <span className="kk-hide-mobile">Shpërndaj</span>
                          </button>

                          {(isAuthor || isAdmin) && (
                            <div className="kk-comm-author-menu">
                              <button
                                type="button"
                                className={`kk-comm-mini-btn ${isResolved ? '' : 'kk-comm-mini-btn--success'}`}
                                onClick={() => handleToggleStatus(post)}
                                title={isResolved ? 'Rihap pyetjen' : 'Shëno si të zgjidhur'}
                              >
                                {isResolved ? <RotateCcw size={14} aria-hidden /> : <CheckCircle2 size={14} aria-hidden />}
                                <span>{isResolved ? 'Rihap' : 'Shëno të zgjidhur'}</span>
                              </button>
                              <button
                                type="button"
                                className="kk-comm-mini-btn kk-comm-danger-btn"
                                onClick={() => handleDeletePost(post._id)}
                                title="Fshij pyetjen"
                                aria-label="Fshij pyetjen"
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
                              <span>Diskutimi & rekomandimet</span>
                              <span className="kk-comm-count-pill">{commentsList.length}</span>
                            </div>

                            {isLoadingPostComments ? (
                              <div className="kk-comm-comments-loading">
                                <div className="kk-spinner-sm" />
                                <span>Duke ngarkuar komentet...</span>
                              </div>
                            ) : commentsList.length === 0 ? (
                              <p className="kk-comm-no-comments">
                                Ende pa përgjigje. Sugjero një ekspert, ndaj përvojën tënde ose jep një çmim orientues.
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
                                            <BadgeCheck size={12} aria-hidden /> Përgjigje nga eksperti
                                          </span>
                                        )}
                                        <div className="kk-comm-comment-author-bar">
                                          <div className="kk-comm-author-left">
                                            <strong>{comm.authorName}</strong>
                                            <RoleBadge role={comm.authorRole} />
                                            <span className="kk-comm-comment-date">
                                              {formatRelativeTime(comm.createdAt)}
                                            </span>
                                          </div>

                                          {(isCommAuthor || isAdmin) && (
                                            <button
                                              type="button"
                                              className="kk-comm-delete-comment-btn"
                                              onClick={() => handleDeleteComment(post._id, comm._id)}
                                              title="Fshij komentin"
                                              aria-label="Fshij komentin"
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
                                                <span>Tarifa orientuese</span>
                                                <strong>{comm.suggestedPrice}</strong>
                                              </div>
                                            )}

                                            {comm.suggestedProviderName && (
                                              <div className="kk-comm-rec-card">
                                                <span className="kk-comm-rec-icon">
                                                  <BadgeCheck size={15} aria-hidden />
                                                </span>
                                                <div>
                                                  <span>Rekomandon</span>
                                                  <strong>{comm.suggestedProviderName}</strong>
                                                </div>
                                                {comm.suggestedProviderUid && (
                                                  <Link
                                                    to={`/providers/${comm.suggestedProviderUid}`}
                                                    className="kk-comm-view-profile-link"
                                                  >
                                                    Profili <ArrowRight size={13} aria-hidden />
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
                                            <span>{comm.likes?.length ? comm.likes.length : 'E dobishme'}</span>
                                          </button>

                                          {isExpert && comm.authorUid && (
                                            <Link
                                              to={`/providers/${comm.authorUid}`}
                                              className="kk-comm-contact-expert-link"
                                            >
                                              Kontakto ekspertin <ArrowRight size={13} aria-hidden />
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
                                    placeholder="Shkruaj një këshillë, përvojë ose sugjero një zyrë..."
                                    aria-label="Komenti yt"
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
                                        placeholder="Çmimi orientues (p.sh. 30–100 €)"
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
                                        placeholder="Rekomando një ekspert (opsionale)"
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
                                      <span>{submittingComment[post._id] ? 'Duke dërguar...' : 'Dërgo'}</span>
                                    </Button>
                                  </div>
                                </div>
                              </form>
                            ) : (
                              <div className="kk-comm-login-to-comment">
                                <span>Për të komentuar ose për të sugjeruar çmime,</span>
                                <Link to="/login" className="kk-comm-login-link">
                                  kyçu këtu <ArrowRight size={13} aria-hidden />
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
                <Sparkles size={17} aria-hidden />
                <h3>Si funksionon?</h3>
              </div>
              <ol className="kk-comm-steps">
                <li>
                  <span className="kk-comm-step-num">1</span>
                  <div>
                    <strong>Pyet si status</strong>
                    <p>Shkruaj problemin ligjor, noterial apo financiar me pak fjalë.</p>
                  </div>
                </li>
                <li>
                  <span className="kk-comm-step-num">2</span>
                  <div>
                    <strong>Merr këshilla & çmime</strong>
                    <p>Anëtarët dhe ekspertët ndajnë tarifa orientuese dhe rekomandime.</p>
                  </div>
                </li>
                <li>
                  <span className="kk-comm-step-num">3</span>
                  <div>
                    <strong>Lidhu direkt</strong>
                    <p>Hap profilin e ekspertit të sugjeruar për takim ose bisedë.</p>
                  </div>
                </li>
              </ol>
            </div>

            <Link to="/krahaso" className="kk-comm-side-card kk-comm-feature-card">
              <span className="kk-comm-feature-icon">
                <Scale size={22} aria-hidden />
              </span>
              <h4>Krahaso avokatët krah për krah</h4>
              <p>Deri në 3 avokatë — përvojë, tarifa dhe orare të lira në një pamje.</p>
              <span className="kk-comm-sidebar-action-btn">
                Hap krahasimin <ArrowRight size={15} aria-hidden />
              </span>
            </Link>

            <Link to="/ai-asistenti" className="kk-comm-side-card kk-comm-ai-widget">
              <span className="kk-comm-ai-badge">
                <Sparkles size={13} aria-hidden /> Këshilla AI · 24/7
              </span>
              <h4>S'do të presësh? Pyet AI-në.</h4>
              <p>Sqarime të menjëhershme për hapat ligjorë, dokumentet dhe afatet.</p>
              <span className="kk-comm-ai-btn">
                Bisedo tani <ArrowRight size={15} aria-hidden />
              </span>
            </Link>
          </aside>
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
