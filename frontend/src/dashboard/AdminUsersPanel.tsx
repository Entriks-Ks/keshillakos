import { useCallback, useEffect, useState, type FormEvent } from 'react'
import {
  createAdminUser,
  deleteAdminUser,
  fetchAdminUsers,
  fetchAdminUsersMeta,
  updateAdminUser,
  type AdminUser,
} from '../api/adminUsers'
import type { UserRole } from '../api/auth'
import { useAuth } from '../auth/AuthContext'
import PasswordInput from '../components/PasswordInput'
import { getErrorMessage } from '../utils/errors'
import DashPageHeader from './DashPageHeader'

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
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [createForm, setCreateForm] = useState(emptyCreate)
  const [creating, setCreating] = useState(false)
  const [editingUid, setEditingUid] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ name: '', email: '', role: 'user' as UserRole })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [list, meta] = await Promise.all([
        fetchAdminUsers({ role: roleFilter, q: query }),
        fetchAdminUsersMeta(),
      ])
      setUsers(list)
      setCounts(meta.counts)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [roleFilter, query])

  useEffect(() => {
    void load()
  }, [load])

  async function onCreate(e: FormEvent) {
    e.preventDefault()
    setCreating(true)
    setError('')
    setSuccess('')
    try {
      await createAdminUser(createForm)
      setCreateForm(emptyCreate)
      setSuccess('Përdoruesi u krijua.')
      await load()
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setCreating(false)
    }
  }

  function startEdit(user: AdminUser) {
    setEditingUid(user.uid)
    setEditForm({ name: user.name, email: user.email, role: user.role })
    setSuccess('')
    setError('')
  }

  async function onSaveEdit(e: FormEvent) {
    e.preventDefault()
    if (!editingUid) return
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      await updateAdminUser(editingUid, editForm)
      setEditingUid(null)
      setSuccess('Përdoruesi u përditësua.')
      await load()
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  async function onDelete(user: AdminUser) {
    if (user.uid === me?.uid) {
      setError('Nuk mund ta fshish llogarinë tënde.')
      return
    }
    const ok = window.confirm(`Fshi përdoruesin ${user.name} (${user.email})?`)
    if (!ok) return
    setError('')
    setSuccess('')
    try {
      await deleteAdminUser(user.uid)
      setSuccess('Përdoruesi u fshi.')
      if (editingUid === user.uid) setEditingUid(null)
      await load()
    } catch (err) {
      setError(getErrorMessage(err))
    }
  }

  return (
    <section className="provider-section">
      <DashPageHeader
        title="Menaxhimi i përdoruesve"
        description="Shiko dhe menaxho të gjitha rolet: user, provider, company, admin."
      />

      {counts ? (
        <ul className="admin-role-stats">
          {ROLE_OPTIONS.map((role) => (
            <li key={role.value}>
              <strong>{counts[role.value]}</strong>
              <span>{role.label}</span>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="admin-users-filters">
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
        <button type="button" className="ghost" onClick={() => void load()}>
          Rifresko
        </button>
      </div>

      <form onSubmit={onCreate} className="service-form admin-create-form">
        <h3 className="full">Krijo përdorues</h3>
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
        <button type="submit" className="full" disabled={creating}>
          {creating ? 'Duke krijuar...' : 'Krijo'}
        </button>
      </form>

      {error ? <p className="error">{error}</p> : null}
      {success ? <p className="success">{success}</p> : null}

      {loading ? <p className="muted">Duke u ngarkuar...</p> : null}

      <div className="admin-users-table-wrap">
        <table className="admin-users-table">
          <thead>
            <tr>
              <th>Emri</th>
              <th>Email</th>
              <th>Roli</th>
              <th>UID</th>
              <th>Veprime</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.uid}>
                {editingUid === user.uid ? (
                  <td colSpan={5}>
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
                        <button type="submit" disabled={saving}>
                          {saving ? 'Duke ruajtur...' : 'Ruaj'}
                        </button>
                        <button
                          type="button"
                          className="ghost"
                          onClick={() => setEditingUid(null)}
                          disabled={saving}
                        >
                          Anulo
                        </button>
                      </div>
                    </form>
                  </td>
                ) : (
                  <>
                    <td>{user.name}</td>
                    <td>{user.email}</td>
                    <td>
                      <span className="role-pill">{ROLE_OPTIONS.find((r) => r.value === user.role)?.label}</span>
                    </td>
                    <td className="mono">{user.uid}</td>
                    <td>
                      <div className="admin-row-actions">
                        <button type="button" className="ghost" onClick={() => startEdit(user)}>
                          Ndrysho
                        </button>
                        <button
                          type="button"
                          className="ghost danger-ghost"
                          onClick={() => void onDelete(user)}
                          disabled={user.uid === me?.uid}
                        >
                          Fshi
                        </button>
                      </div>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && users.length === 0 ? (
          <p className="muted">Nuk u gjet asnjë përdorues.</p>
        ) : null}
      </div>
    </section>
  )
}
