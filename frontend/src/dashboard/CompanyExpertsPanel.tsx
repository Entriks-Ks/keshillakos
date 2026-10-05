import KeshillaPagination from '../components/KeshillaPagination'
import { usePagination } from '../hooks/usePagination'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Alert, Button, buttonVariants, Card, Chip, toast } from '@heroui/react'
import { Building2, ChevronDown, Clock, Eye, Mail, MailPlus, Plus, UserMinus, Users } from 'lucide-react'
import { fetchDomains } from '../api/domains'
import {
  cancelInvitation,
  fetchBusinessTeam,
  fetchMyBusinesses,
  inviteExpert,
  lookupExpert,
  removeExpert,
  type BusinessSummary,
  type BusinessTeam,
  type ExpertLookup,
} from '../api/onboarding'
import ProfileAvatar from '../components/ProfileAvatar'
import ConfirmActionDialog from '../components/ConfirmActionDialog'
import { useAuth } from '../auth/AuthContext'
import { getErrorMessage } from '../utils/errors'
import { providerPath } from '../utils/publicPaths'
import { RowsSkeleton, SectionHead } from './OverviewParts'
import type { ChipColor } from './requestDisplay'
import './UserOverview.css'
import './UserRequests.css'
import './DashboardSections.css'

function formatInviteDate(value: string) {
  try {
    return new Date(value).toLocaleString('sq-AL', { dateStyle: 'medium', timeStyle: 'short' })
  } catch {
    return value
  }
}

const LOOKUP_HINT: Record<Exclude<ExpertLookup['status'], 'ready' | 'invalid'>, string> = {
  missing: 'Ky email nuk është i regjistruar në KëshillaKos.',
  not_expert: 'Ky përdorues nuk ka profil eksperti. Duhet të regjistrohet si ekspert fillimisht.',
  member: 'Ky ekspert është tashmë në ekip.',
  invited: 'Ftesa është dërguar. Pret që eksperti ta pranojë.',
  owner: 'Ky person e menaxhon kompaninë.',
}

const PROFILE_STATUS: Record<string, { label: string; color: ChipColor }> = {
  published: { label: 'Profil publik', color: 'success' },
  pending: { label: 'Profili në shqyrtim', color: 'warning' },
  draft: { label: 'Profil draft', color: 'default' },
  suspended: { label: 'Profil i pezulluar', color: 'danger' },
}

export default function CompanyExpertsPanel() {
  const { user } = useAuth()
  const [businesses, setBusinesses] = useState<BusinessSummary[]>([])
  const [selected, setSelected] = useState('')
  const membersPaging = usePagination(selected)
  const invitesPaging = usePagination(selected)
  const [revision, setRevision] = useState(0)
  const [team, setTeam] = useState<BusinessTeam | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [email, setEmail] = useState('')
  const [match, setMatch] = useState<ExpertLookup | null>(null)
  const [checking, setChecking] = useState(false)
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState('')
  const [removeTarget, setRemoveTarget] = useState<{ id: string; name: string } | null>(null)
  const [categoryLabels, setCategoryLabels] = useState<Record<string, string>>({})
  const emailRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let cancelled = false
    fetchDomains()
      .then((domains) => {
        if (!cancelled) setCategoryLabels(Object.fromEntries(domains.map((domain) => [domain.id, domain.labelSq])))
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!(user?.roles ?? []).includes('company') && user?.role !== 'admin') return
    let cancelled = false
    setLoading(true)
    fetchMyBusinesses()
      .then((items) => {
        if (cancelled) return
        setBusinesses(items)
        setSelected((current) => current || items[0]?._id || '')
        if (!items.length) setLoading(false)
      })
      .catch((err) => {
        if (!cancelled) {
          setError(getErrorMessage(err))
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [user?.roles, user?.role])

  useEffect(() => {
    if (!selected) return
    let cancelled = false
    setLoading(true)
    fetchBusinessTeam(selected, { page: membersPaging.page, invitationsPage: invitesPaging.page, limit: 20 })
      .then((next) => {
        if (!cancelled) {
          setTeam(next)
          if (next.pagination) membersPaging.receivePagination(next.pagination)
          if (next.invitationsPagination) invitesPaging.receivePagination(next.invitationsPagination)
          setError('')
        }
      })
      .catch((err) => {
        if (!cancelled) setError(getErrorMessage(err))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [selected, membersPaging.page, invitesPaging.page, revision])

  useEffect(() => {
    const trimmed = email.trim()
    if (!selected || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setMatch(null)
      setChecking(false)
      return
    }
    setMatch(null)
    let cancelled = false
    const timer = window.setTimeout(() => {
      setChecking(true)
      lookupExpert(selected, trimmed)
        .then((next) => {
          if (!cancelled) setMatch(next)
        })
        .catch(() => {
          if (!cancelled) setMatch(null)
        })
        .finally(() => {
          if (!cancelled) setChecking(false)
        })
    }, 350)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [email, selected])

  async function onInvite(event: FormEvent) {
    event.preventDefault()
    if (!selected || match?.status !== 'ready') return
    setSaving(true)
    try {
      await inviteExpert(selected, email.trim()); setRevision((value) => value + 1)
      setMatch({ ...match, status: 'invited' })
      toast.success('Ftesa u dërgua. Eksperti e pranon te profili i tij.')
    } catch (err) {
      toast.danger(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  async function onRemove() {
    const userId = removeTarget?.id
    if (!selected || !userId || busyId) return
    setBusyId(userId)
    try {
      await removeExpert(selected, userId); setRevision((value) => value + 1)
      toast.success('Eksperti u hoq nga kompania.')
      setRemoveTarget(null)
    } catch (err) {
      toast.danger(getErrorMessage(err))
    } finally {
      setBusyId('')
    }
  }

  async function onCancelInvite(userId: string) {
    if (!selected) return
    setBusyId(userId)
    try {
      await cancelInvitation(selected, userId); setRevision((value) => value + 1)
      if (match?.person?.id === userId) setMatch({ ...match, status: 'ready' })
      toast.success('Ftesa u anulua.')
    } catch (err) {
      toast.danger(getErrorMessage(err))
    } finally {
      setBusyId('')
    }
  }

  function focusInvite() {
    emailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    emailRef.current?.focus({ preventScroll: true })
  }

  const members = team?.members ?? []
  const invitations = team?.invitations ?? []
  const selectedBusiness = businesses.find((item) => item._id === selected)
  const canInviteExperts = Boolean(selectedBusiness && selectedBusiness.status !== 'suspended' && selectedBusiness.status !== 'closed')
  const companyName = team?.business.publicName || selectedBusiness?.publicName || ''
  const noCompany = !loading && !error && !selected

  return (
    <section className="uo ds">
      <header className="uo-head">
        <div className="uo-head-copy">
          <h1>Ekspertët</h1>
          <p>
            {companyName ? `Ekipi i ${companyName}. ` : ''}
            Fto ekspertë që janë tashmë në KëshillaKos. Pasi e pranojnë ftesën, klientët i shohin te profili i kompanisë,
            u shkruajnë dhe caktojnë takim.
          </p>
        </div>
        {!loading && selected && canInviteExperts ? (
          <Button variant="primary" className="uo-primary" onPress={focusInvite}>
            <Plus size={16} aria-hidden />
            Fto ekspert
          </Button>
        ) : null}
      </header>

      {businesses.length > 1 ? (
        <div className="ds-field ds-company-select">
          <label className="ds-label" htmlFor="company-select">
            Kompania
          </label>
          <span className="ds-select">
            <select id="company-select" value={selected} onChange={(e) => setSelected(e.target.value)}>
              {businesses.map((business) => (
                <option key={business._id} value={business._id}>
                  {business.publicName}
                </option>
              ))}
            </select>
            <ChevronDown size={16} aria-hidden />
          </span>
        </div>
      ) : null}

      {error ? (
        <Alert status="danger" className="uo-alert">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>Nuk u ngarkuan ekspertët</Alert.Title>
            <Alert.Description>{error}</Alert.Description>
          </Alert.Content>
        </Alert>
      ) : null}

      {selectedBusiness && !canInviteExperts ? (
        <Alert status="warning" className="uo-alert">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>Ftesat nuk janë të disponueshme</Alert.Title>
            <Alert.Description>Kompania është pezulluar ose e mbyllur. Ftesat e ekspertëve nuk janë të disponueshme.</Alert.Description>
          </Alert.Content>
        </Alert>
      ) : null}

      {noCompany ? (
        <Card className="uo-card ur-empty">
          <span className="ur-empty-icon" aria-hidden>
            <Building2 size={22} />
          </span>
          <h2>Nuk ke ende një kompani të menaxhueshme</h2>
          <p>Krijo kompaninë për të ftuar ekspertë në ekip. Ekspertët e pranuar shfaqen te profili publik i kompanisë.</p>
          <div className="ur-empty-actions">
            <Link to="/dashboard/company/create" className={buttonVariants({ variant: 'primary' })}>
              <Plus size={16} aria-hidden />
              Krijo kompaninë
            </Link>
          </div>
        </Card>
      ) : null}

      {selected ? (
        <div className={`uo-grid${canInviteExperts ? '' : ' ds-single'}`}>
          <div className="uo-side">
            <Card className="uo-card ur-card">
              <SectionHead
                title="Ekspertët në ekip"
                meta={!loading && members.length > 0 ? <span className="uo-card-meta">{membersPaging.pagination.total}</span> : null}
              />
              {loading ? (
                <Card.Content className="uo-card-body">
                  <RowsSkeleton rows={3} />
                </Card.Content>
              ) : members.length === 0 ? (
                <div className="ur-empty ds-divided">
                  <span className="ur-empty-icon" aria-hidden>
                    <Users size={22} />
                  </span>
                  <h2>Ende nuk ka ekspertë në kompani</h2>
                  <p>
                    {invitations.length > 0
                      ? 'Ekspertët e ftuar shfaqen këtu sapo ta pranojnë ftesën te profili i tyre.'
                      : 'Fto ekspertin e parë me email-in që përdor në KëshillaKos. Pasi ta pranojë ftesën, shfaqet këtu dhe te profili i kompanisë.'}
                  </p>
                  {canInviteExperts ? (
                    <div className="ur-empty-actions">
                      <Button variant="primary" onPress={focusInvite}>
                        <MailPlus size={16} aria-hidden />
                        Fto ekspertin e parë
                      </Button>
                    </div>
                  ) : null}
                </div>
              ) : (
                <ul className="ur-list ds-divided">
                  {members.map((member) => {
                    const status = member.profileStatus ? PROFILE_STATUS[member.profileStatus] : null
                    const categories = (member.categories ?? []).map((id) => categoryLabels[id]).filter(Boolean)
                    return (
                      <li key={member.id} className="ds-member">
                        <ProfileAvatar src={member.photoUrl} seed={member.uid} size={48} alt="" />
                        <div className="ur-main">
                          <div className="ur-top">
                            <div className="ur-titles">
                              <h3 className="ur-title">{member.name}</h3>
                              {member.headline ? <p className="ur-sub">{member.headline}</p> : null}
                            </div>
                            <div className="ur-chips">
                              {member.role === 'manager' ? (
                                <Chip size="sm" variant="soft" color="accent">
                                  <Chip.Label>Menaxher</Chip.Label>
                                </Chip>
                              ) : null}
                              {status ? (
                                <Chip size="sm" variant="soft" color={status.color}>
                                  <Chip.Label>{status.label}</Chip.Label>
                                </Chip>
                              ) : null}
                            </div>
                          </div>

                          {categories.length > 0 ? (
                            <div className="ur-chips">
                              {categories.map((label) => (
                                <Chip key={label} size="sm" variant="soft">
                                  <Chip.Label>{label}</Chip.Label>
                                </Chip>
                              ))}
                            </div>
                          ) : null}

                          {member.email ? (
                            <ul className="ur-facts">
                              <li>
                                <Mail size={14} aria-hidden />
                                {member.email}
                              </li>
                            </ul>
                          ) : null}

                          <div className="ur-actions is-wrap ds-service-actions">
                            {member.uid ? (
                              <Link
                                className={buttonVariants({ variant: 'ghost', size: 'sm' })}
                                to={providerPath({ uid: member.uid, name: member.name })}
                              >
                                <Eye size={14} aria-hidden />
                                Profili
                              </Link>
                            ) : null}
                            <Button
                              size="sm"
                              variant="outline"
                              className="ds-danger-btn"
                              isPending={busyId === member.id}
                              isDisabled={Boolean(busyId) && busyId !== member.id}
                              onPress={() => setRemoveTarget({ id: member.id, name: member.name || member.email })}
                            >
                              <UserMinus size={14} aria-hidden />
                              {busyId === member.id ? 'Duke hequr…' : 'Hiq'}
                            </Button>
                          </div>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
              <KeshillaPagination pagination={membersPaging.pagination} onPageChange={membersPaging.setPage} isDisabled={loading} />
            </Card>

            {!loading && invitations.length > 0 ? (
              <Card className="uo-card">
                <SectionHead title="Ftesa në pritje" meta={<span className="uo-card-meta">{invitesPaging.pagination.total}</span>} />
                <Card.Content className="uo-card-body">
                  <ul className="uo-rows">
                    {invitations.map((invite) => (
                      <li key={invite.id}>
                        <div className="uo-row is-static ds-invite-row">
                          <ProfileAvatar src={invite.photoUrl} seed={invite.uid} size={36} alt="" />
                          <span className="uo-row-copy">
                            <strong>{invite.name || invite.email}</strong>
                            <span>
                              {invite.email}
                              {invite.invitedAt ? ` · ${formatInviteDate(invite.invitedAt)}` : ''}
                            </span>
                          </span>
                          <span className="ds-invite-end">
                            <Chip size="sm" variant="soft" color="warning">
                              <Clock size={12} aria-hidden />
                              <Chip.Label>Në pritje</Chip.Label>
                            </Chip>
                            <Button
                              size="sm"
                              variant="outline"
                              isPending={busyId === invite.id}
                              isDisabled={Boolean(busyId) && busyId !== invite.id}
                              onPress={() => void onCancelInvite(invite.id)}
                            >
                              {busyId === invite.id ? 'Duke anuluar…' : 'Anulo'}
                            </Button>
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                  <KeshillaPagination pagination={invitesPaging.pagination} onPageChange={invitesPaging.setPage} isDisabled={loading} />
                </Card.Content>
              </Card>
            ) : null}
          </div>

          {canInviteExperts ? (
            <div className="uo-side ds-invite-col">
              <Card className="uo-card">
                <SectionHead title="Fto ekspert" />
                <Card.Content className="uo-card-body">
                  <form className="ds-form ds-invite" onSubmit={onInvite}>
                    <p className="ds-hint">
                      Shkruaj email-in me të cilin eksperti është regjistruar në KëshillaKos. Eksperti e pranon ftesën te
                      profili i tij.
                    </p>
                    <div className="ds-field">
                      <label className="ds-label" htmlFor="expert-email">
                        Email i ekspertit
                      </label>
                      <div className="ds-invite-input">
                        <input
                          ref={emailRef}
                          id="expert-email"
                          className="ds-input"
                          type="email"
                          autoComplete="email"
                          value={email}
                          placeholder="eksperti@email.com"
                          onChange={(e) => setEmail(e.target.value)}
                        />
                        <Button type="submit" variant="primary" isPending={saving} isDisabled={saving || match?.status !== 'ready'}>
                          {saving ? 'Duke ftuar…' : 'Fto'}
                        </Button>
                      </div>
                    </div>
                    {checking ? <p className="ds-hint">Po kontrollohet…</p> : null}
                    {!checking && match?.status === 'ready' && match.person ? (
                      <div className="ds-invite-match">
                        <ProfileAvatar src={match.person.photoUrl} seed={match.person.uid} size={40} alt="" />
                        <span className="uo-row-copy">
                          <strong>{match.person.name}</strong>
                          <span>{match.person.headline || match.person.email}</span>
                        </span>
                      </div>
                    ) : null}
                    {!checking && match && match.status !== 'ready' && match.status !== 'invalid' ? (
                      <p className="ds-hint">{LOOKUP_HINT[match.status]}</p>
                    ) : null}
                  </form>
                </Card.Content>
              </Card>
            </div>
          ) : null}
        </div>
      ) : null}
      <ConfirmActionDialog isOpen={Boolean(removeTarget)} onClose={() => setRemoveTarget(null)} onConfirm={() => void onRemove()} pending={Boolean(busyId)} title="Hiq ekspertin?" description={`${removeTarget?.name ?? 'Eksperti'} do të hiqet nga ekipi i kompanisë. Ai nuk do të shfaqet më në profilin e kompanisë.`} confirmLabel="Hiq" />
    </section>
  )
}
