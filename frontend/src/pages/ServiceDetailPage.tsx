import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { fetchService, type ServiceItem } from '../api/services'
import ServiceCard from '../components/ServiceCard'
import { useAuth } from '../auth/AuthContext'
import { getDashboardPath } from '../utils/dashboardPath'
import { getErrorMessage } from '../utils/errors'

export default function ServiceDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const [service, setService] = useState<ServiceItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id) {
      setError('Shërbimi nuk u gjet')
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setError('')
    fetchService(id)
      .then((item) => {
        if (!cancelled) setService(item)
      })
      .catch((err) => {
        if (!cancelled) {
          setService(null)
          setError(getErrorMessage(err))
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [id])

  return (
    <div className="home-shell">
      <header className="home-header">
        <Link to="/" className="brand brand-link">
          KëshillaKos
        </Link>
        {user ? (
          <Link className="ghost link-btn" to={getDashboardPath(user.role)}>
            Dashboard
          </Link>
        ) : (
          <Link className="ghost link-btn" to="/login">
            Hyr
          </Link>
        )}
      </header>

      <main className="service-detail-main">
        <Link to="/" className="ghost link-btn service-detail-back">
          ← Kthehu te shërbimet
        </Link>

        {loading ? <p className="muted">Duke u ngarkuar...</p> : null}

        {!loading && error ? (
          <div className="service-detail-empty">
            <h1>Shërbimi nuk u gjet</h1>
            <p className="error">{error}</p>
            <Link className="primary-btn" to="/">
              Kthehu në fillim
            </Link>
          </div>
        ) : null}

        {!loading && service ? (
          <section aria-labelledby="service-detail-heading">
            <h1 id="service-detail-heading" className="service-detail-title">
              Detajet e shërbimit
            </h1>
            <ServiceCard service={service} mode="detail" />
          </section>
        ) : null}
      </main>
    </div>
  )
}
