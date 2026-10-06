import KeshillaPagination from '../components/KeshillaPagination'
import { usePagination } from '../hooks/usePagination'
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Alert, Button, Card, Chip, toast } from '@heroui/react'
import {
  createAdminUser,
  deleteAdminUser,
  fetchAdminUsers,
  fetchAdminUsersMeta,
  fetchPendingRoleRequests,
  reviewRoleRequest,
  updateAdminUser,
  type AdminUser,
} from '../api/adminUsers'
import type { UserRole } from '../api/auth'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import PasswordInput from '../components/PasswordInput'
import ProfileAvatar from '../components/ProfileAvatar'
import ConfirmActionDialog from '../components/ConfirmActionDialog'
import { getErrorMessage } from '../utils/errors'
import { EmptyBlock, RowsSkeleton, SectionHead, StatsStrip } from './OverviewParts'
import './UserOverview.css'
import './DashboardSections.css'
import './AdminDashboard.css'
import './AdminUsersPanel.css'

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: 'user', label: 'Përdorues' },
  { value: 'provider', label: 'Ofrues' },
  { value: 'company', label: 'Kompani' },
  { value: 'admin', label: 'Admin' },
]

const emptyCreate = {
  name: '',
  email: '',
  password: '',
  role: 'user' as UserRole,
}

export default function AdminUsersPanel() {
  const { user: me } = useAuth()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [counts, setCounts] = useState<Record<UserRole, number> | null>(null)
  const [roleFilter, setRoleFilter] = useState<UserRole | ''>('')
  const [searchParams] = useSearchParams()
  const [query, setQuery] = useState(() => searchParams.get('q') || '')
  const usersPaging = usePagination(`${roleFilter}:${query}`)
  const pendingPaging = usePagination()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [createForm, setCreateForm] = useState(emptyCreate)
  const [creating, setCreating] = useState(false)
  const [editingUid, setEditingUid] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ name: '', email: '', role: 'user' as UserRole })
  const [saving, setSaving] = useState(false)
  const [pending, setPending] = useState<AdminUser[]>([])
  const [reviewingUid, setReviewingUid] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null)
  const [deleting, setDeleting] = useState(false)

  const loadVersion = useRef(0)
  const load = useCallback(async () => {
    const version = ++loadVersion.current
    setLoading(true)
    setError('')
    try {
      const [list, meta, roleRequests] = await Promise.all([
        fetchAdminUsers({ role: roleFilter, q: query, page: usersPaging.page, limit: 20 }),
        fetchAdminUsersMeta(),
        fetchPendingRoleRequests({ page: pendingPaging.page, limit: 20 }),
      ])
      if (version !== loadVersion.current) return
      setUsers(list)
      usersPaging.receivePagination(list.pagination)
      setCounts(meta.counts)
      setPending(roleRequests)
      pendingPaging.receivePagination(roleRequests.pagination)
    } catch (err) {
      if (version === loadVersion.current) setError(getErrorMessage(err))
    } finally {
      if (version === loadVersion.current) setLoading(false)
    }
  }, [roleFilter, query, usersPaging.page, pendingPaging.page])

  useEffect(() => {
    void load()
  }, [load])

  async function onCreate(e: FormEvent) {
    e.preventDefault()
    setCreating(true)
    setError('')
    try {
      await createAdminUser(createForm)
      setCreateForm(emptyCreate)
      toast.success('Përdoruesi u krijua.')
      await load()
    } catch (err) {
      toast.danger(getErrorMessage(err))
    } finally {
      setCreating(false)
    }
  }

  function startEdit(user: AdminUser) {
    setEditingUid(user.uid)
    setEditForm({ name: user.name, email: user.email, role: user.role })
    setError('')
  }

  async function onSaveEdit(e: FormEvent) {
    e.preventDefault()
    if (!editingUid) return
    setSaving(true)
    setError('')
    try {
      await updateAdminUser(editingUid, editForm)
      setEditingUid(null)
      toast.success('Përdoruesi u përditësua.')
      await load()
    } catch (err) {
      toast.danger(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  async function onReview(user: AdminUser, action: 'accept' | 'reject') {
    setReviewingUid(user.uid)
    setError('')
    try {
      const requestedLabel = ROLE_OPTIONS.find((r) => r.value === user.requestedRole)?.label ?? 'rol i ri'
      await reviewRoleRequest(user.uid, action)
      toast.success(
        action === 'accept'
          ? `${user.name} u bë ${requestedLabel.toLowerCase()}.`
          : `Kërkesa e ${user.name} u refuzua.`,
      )
      await load()
    } catch (err) {
      toast.danger(getErrorMessage(err))
    } finally {
      setReviewingUid('')
    }
  }

  async function onDelete() {
    const user = deleteTarget
    if (!user || deleting) return
    if (user.uid === me?.uid) {
      setError('Nuk mund ta fshish llogarinë tënde.')
      return
    }
    setDeleting(true)
    setError('')
    try {
      await deleteAdminUser(user.uid)
      toast.success('Përdoruesi u fshi.')
      setDeleteTarget(null)
      if (editingUid === user.uid) setEditingUid(null)
      await load()
    } catch (err) {
      toast.danger(getErrorMessage(err))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <section className="uo ds ad admin-users">
      <header className="uo-head"><div className="uo-head-copy"><h1>Përdoruesit</h1><p>Menaxho llogaritë, rolet dhe kërkesat për akses në platformë.</p></div></header>

      <Card className="uo-card admin-role-requests">
        <SectionHead title="Kërkesa për akses" meta={<span className="uo-card-meta">{pendingPaging.pagination.total}</span>} />
        <Card.Content className="uo-card-body">
        {loading ? <RowsSkeleton rows={2} /> : pending.length === 0 ? (
          <EmptyBlock title="Nuk ka kërkesa në pritje" text="Kërkesat për t’u bërë ofrues ose kompani do të shfaqen këtu." />
        ) : (
          <ul>
            {pending.map((user) => (
              <li key={user.uid} className="admin-role-request">
                <div>
                  <strong>{user.name}</strong>
                  <span className="muted">{user.email}</span>
                  <Chip size="sm" variant="soft" color="warning"><Chip.Label>Në pritje · {ROLE_OPTIONS.find((r) => r.value === user.requestedRole)?.label ?? user.requestedRole}</Chip.Label></Chip>
                </div>
                <div className="admin-row-actions">
                  <Button size="sm" variant="primary" isDisabled={reviewingUid === user.uid} onPress={() => void onReview(user, 'accept')}>
                    {reviewingUid === user.uid ? 'Duke ruajtur…' : 'Prano'}
                  </Button>
                  <Button size="sm" variant="outline" isDisabled={reviewingUid === user.uid} onPress={() => void onReview(user, 'reject')}>
                    Refuzo
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {!loading ? <KeshillaPagination pagination={pendingPaging.pagination} onPageChange={pendingPaging.setPage} /> : null}
        </Card.Content>
      </Card>

      {counts ? (
        <StatsStrip loading={loading} stats={ROLE_OPTIONS.map((role) => ({ label: role.label, value: counts[role.value], hint: 'Llogari', to: '/dashboard/admin/users' }))} />
      ) : null}

      <Card className="uo-card"><Card.Content className="uo-card-body admin-users-filters">
        <label>
          Filtro sipas rolit
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as UserRole | '')}
          >
            <option value="">Të gjitha</option>
            {ROLE_OPTIONS.map((role) => (
              <option key={role.value} value={role.value}>
                {role.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Kërko
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Emër, email ose UID"
          />
        </label>
        <Button size="sm" variant="outline" onPress={() => void load()}>Rifresko</Button>
      </Card.Content></Card>

      <Card className="uo-card"><SectionHead title="Krijo përdorues" /><Card.Content className="uo-card-body"><form onSubmit={onCreate} className="service-form admin-create-form">
        <label>
          Emri
          <input
            value={createForm.name}
            onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
            required
          />
        </label>
        <label>
          Email
          <input
            type="email"
            value={createForm.email}
            onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
            required
          />
        </label>
        <label>
          Fjalëkalimi
          <PasswordInput
            minLength={6}
            value={createForm.password}
            onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))}
            required
          />
        </label>
        <label>
          Roli
          <select
            value={createForm.role}
            onChange={(e) => setCreateForm((f) => ({ ...f, role: e.target.value as UserRole }))}
          >
            {ROLE_OPTIONS.map((role) => (
              <option key={role.value} value={role.value}>
                {role.label}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit" variant="primary" className="full" isPending={creating}>
          {creating ? 'Duke krijuar...' : 'Krijo'}
        </Button>
      </form></Card.Content></Card>

      {error ? <Alert status="danger" className="uo-alert"><Alert.Indicator /><Alert.Content><Alert.Title>Veprimi nuk u krye</Alert.Title><Alert.Description>{error}</Alert.Description></Alert.Content></Alert> : null}

      <Card className="uo-card"><SectionHead title="Të gjithë përdoruesit" meta={!loading ? <span className="uo-card-meta">{usersPaging.pagination.total}</span> : null} />
      {loading ? <Card.Content className="uo-card-body"><RowsSkeleton rows={4} /></Card.Content> : null}
      {!loading ? <div className="admin-users-table-wrap">
        <table className="admin-users-table">
          <thead>
            <tr>
              <th>Emri</th>
              <th>Email</th>
              <th>Roli</th>
              <th>Veprime</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.uid}>
                {editingUid === user.uid ? (
                  <td colSpan={4}>
                    <form onSubmit={onSaveEdit} className="service-form admin-edit-form">
                      <label>
                        Emri
                        <input
                          value={editForm.name}
                          onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                          required
                        />
                      </label>
                      <label>
                        Email
                        <input
                          type="email"
                          value={editForm.email}
                          onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                          required
                        />
                      </label>
                      <label>
                        Roli
                        <select
                          value={editForm.role}
                          onChange={(e) =>
                            setEditForm((f) => ({ ...f, role: e.target.value as UserRole }))
                          }
                        >
                          {ROLE_OPTIONS.map((role) => (
                            <option key={role.value} value={role.value}>
                              {role.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <div className="full admin-edit-actions">
                        <Button type="submit" variant="primary" size="sm" isPending={saving}>
                          {saving ? 'Duke ruajtur...' : 'Ruaj'}
                        </Button>
                        <Button size="sm" variant="outline" className="ad-secondary" onPress={() => setEditingUid(null)} isDisabled={saving}>
                          Anulo
                        </Button>
                      </div>
                    </form>
                  </td>
                ) : (
                  <>
                    <td><span className="ad-user-name"><ProfileAvatar seed={user.uid} size={32} alt="" />{user.name}</span></td>
                    <td>{user.email}</td>
                    <td>
                      <Chip size="sm" variant="soft"><Chip.Label>{ROLE_OPTIONS.find((r) => r.value === user.role)?.label}</Chip.Label></Chip>
                      {user.requestedRole && user.requestedRole !== user.role ? (
                        <Chip size="sm" variant="soft" color="warning"><Chip.Label>Në pritje · {ROLE_OPTIONS.find((r) => r.value === user.requestedRole)?.label}</Chip.Label></Chip>
                      ) : null}
                    </td>
                    <td>
                      <div className="admin-row-actions">
                        <Button size="sm" variant="outline" onPress={() => startEdit(user)}>Ndrysho</Button>
                        <Button size="sm" variant="ghost" className="ds-danger-btn" onPress={() => setDeleteTarget(user)} isDisabled={user.uid === me?.uid}>Fshi</Button>
                      </div>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && users.length === 0 ? <EmptyBlock title="Nuk u gjet asnjë përdorues" text="Provo një kërkim ose filtër tjetër." /> : null}
      </div> : null}
      </Card>
      {!loading ? <KeshillaPagination pagination={usersPaging.pagination} onPageChange={usersPaging.setPage} /> : null}
      <ConfirmActionDialog isOpen={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} onConfirm={() => void onDelete()} pending={deleting} title="Fshi përdoruesin?" description={`Llogaria e ${deleteTarget?.name ?? ''} (${deleteTarget?.email ?? ''}) do të fshihet përgjithmonë. Ky veprim nuk mund të zhbëhet.`} confirmLabel="Fshi" />
    </section>
  )
}
