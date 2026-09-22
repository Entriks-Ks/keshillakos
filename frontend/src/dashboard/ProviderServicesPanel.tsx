import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  fetchCategories,
  fetchSubcategories,
  type CatalogCategory,
  type CatalogSubcategory,
} from '../api/catalog'
import { locationLabel, matchLocationByText, type LocationSelection } from '../api/locations'
import { IMAGE_ACCEPT, IMAGE_ACCEPT_HINT, MAX_SERVICE_PHOTOS, mediaUrl } from '../api/media'
import {
  createService,
  deleteService,
  fetchMyServices,
  updateService,
  uploadServicePhoto,
  type ServiceDetails,
  type ServiceItem,
} from '../api/services'
import ExtensionFieldsForm, { categorySpecificFields } from '../components/ExtensionFieldsForm'
import LocationSelector from '../components/LocationSelector'
import DashPageHeader from './DashPageHeader'
import { useCatalogOptions } from '../hooks/useCatalogOptions'
import { getErrorMessage } from '../utils/errors'

function currentCatalogLanguage(): 'sq' | 'en' {
  return document.documentElement.lang.toLowerCase().startsWith('en') ? 'en' : 'sq'
}

function catalogLabel(item: { name: { sq: string; en: string } }, language: 'sq' | 'en') {
  return item.name[language] || item.name.sq
}

export default function ProviderServicesPanel() {
  const formRef = useRef<HTMLFormElement>(null)
  const editingCatalogRef = useRef<{ categoryId?: string; subcategoryId?: string; subcategory?: string } | null>(null)
  const {
    languages,
    deliveryModes: deliveryModeOptions,
    availabilityOptions,
    options: catalogOptions,
    error: optionsError,
  } = useCatalogOptions()
  const [services, setServices] = useState<ServiceItem[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [catalogLanguage, setCatalogLanguage] = useState(currentCatalogLanguage)
  const [categories, setCategories] = useState<CatalogCategory[]>([])
  const [categoryId, setCategoryId] = useState('')
  const [subcategories, setSubcategories] = useState<CatalogSubcategory[]>([])
  const [subcategoryId, setSubcategoryId] = useState('')
  const [subcategoriesLoading, setSubcategoriesLoading] = useState(false)
  const [location, setLocation] = useState<LocationSelection | null>(null)
  const [priceFrom, setPriceFrom] = useState('')
  const [priceTo, setPriceTo] = useState('')
  const [deliveryModes, setDeliveryModes] = useState<string[]>([])
  const [supportLanguages, setSupportLanguages] = useState<string[]>([])
  const [availabilityMode, setAvailabilityMode] = useState('request')
  const [portfolioUrl, setPortfolioUrl] = useState('')
  const [experience, setExperience] = useState('')
  const [extensionValues, setExtensionValues] = useState<Record<string, unknown>>({})
  const [photos, setPhotos] = useState<string[]>([])
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState('')

  const selectedCategory = useMemo(
    () => categories.find((item) => item._id === categoryId) ?? null,
    [categories, categoryId],
  )
  const selectedSubcategory = useMemo(
    () => subcategories.find((item) => item._id === subcategoryId) ?? null,
    [subcategories, subcategoryId],
  )
  const extensionFields = selectedCategory?.extensionFields ?? []
  const showCategoryFields = Boolean(subcategoryId && categorySpecificFields(extensionFields).length)

  useEffect(() => {
    const observer = new MutationObserver(() => setCatalogLanguage(currentCatalogLanguage()))
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    let cancelled = false
    fetchCategories()
      .then((items) => {
        if (cancelled) return
        const active = items.filter((item) => item.isActive).sort((a, b) => a.order - b.order || a.slug.localeCompare(b.slug))
        setCategories(active)
        setCategoryId((previous) => (active.some((item) => item._id === previous) ? previous : active[0]?._id ?? ''))
      })
      .catch((err) => {
        if (!cancelled) setError(getErrorMessage(err))
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!categoryId) {
      setSubcategories([])
      setSubcategoryId('')
      return
    }
    const controller = new AbortController()
    setSubcategoriesLoading(true)
    fetchSubcategories(categoryId, controller.signal)
      .then((items) => {
        const active = items.filter((item) => item.isActive).sort((a, b) => a.order - b.order || a.slug.localeCompare(b.slug))
        setSubcategories(active)
        setSubcategoryId((previous) => {
          if (previous && active.some((item) => item._id === previous)) return previous
          const editing = editingCatalogRef.current
          if (editing) {
            const matched = active.find(
              (item) =>
                item._id === editing.subcategoryId
                || item.name.sq === editing.subcategory
                || item.name.en === editing.subcategory
                || item.slug === editing.subcategory,
            )
            if (matched) return matched._id
          }
          return active[0]?._id ?? ''
        })
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          setSubcategories([])
          setSubcategoryId('')
          setError(getErrorMessage(err))
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setSubcategoriesLoading(false)
      })
    return () => controller.abort()
  }, [categoryId])

  useEffect(() => {
    let cancelled = false
    fetchMyServices()
      .then((items) => {
        if (!cancelled) setServices(items)
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
  }, [])

  useEffect(() => {
    if (optionsError) setError(optionsError)
  }, [optionsError])

  useEffect(() => {
    if (editingId) return
    if (languages[0] && !supportLanguages.length) {
      setSupportLanguages(languages.slice(0, 2).map((item) => item.value))
    }
    if (availabilityOptions[0] && !availabilityOptions.some((item) => item.value === availabilityMode)) {
      setAvailabilityMode(availabilityOptions.find((item) => item.id === 'request')?.value || availabilityOptions[0].value)
    }
  }, [languages, availabilityOptions, editingId, supportLanguages.length, availabilityMode])

  useEffect(() => {
    if (editingId) return
    const next: Record<string, unknown> = {}
    for (const field of categorySpecificFields(extensionFields)) {
      if (field.defaultValue !== undefined) next[field.key] = field.defaultValue
      else if (field.type === 'boolean') next[field.key] = false
      else if (field.type === 'stringArray') next[field.key] = []
      else if (field.allowedValues?.length) next[field.key] = field.allowedValues[0]
      else next[field.key] = ''
    }
    setExtensionValues(next)
  }, [categoryId, extensionFields, editingId])

  function resetForm() {
    setEditingId(null)
    editingCatalogRef.current = null
    setTitle('')
    setDescription('')
    setCategoryId(categories[0]?._id ?? '')
    setSubcategoryId('')
    setLocation(null)
    setPriceFrom('')
    setPriceTo('')
    setDeliveryModes([])
    setSupportLanguages(languages.slice(0, 2).map((item) => item.value))
    setAvailabilityMode(availabilityOptions.find((item) => item.id === 'request')?.value || availabilityOptions[0]?.value || 'request')
    setPortfolioUrl('')
    setExperience('')
    setExtensionValues({})
    setPhotos([])
  }

  function startEdit(service: ServiceItem) {
    const details = service.details || {}
    setEditingId(service.id)
    editingCatalogRef.current = {
      categoryId: service.categoryId,
      subcategoryId: service.subcategoryId,
      subcategory: service.subcategory,
    }
    setTitle(service.title)
    setDescription(service.description)
    const matchedCategory = categories.find(
      (item) => item._id === service.categoryId || item.slug === service.categoryId,
    )
    setCategoryId(matchedCategory?._id || service.categoryId || categoryId)
    setSubcategoryId(service.subcategoryId || '')
    setLocation(null)
    void matchLocationByText(service.location).then(setLocation)
    setPriceFrom(service.priceFrom != null ? String(service.priceFrom) : '')
    setPriceTo(details.priceTo != null ? String(details.priceTo) : '')
    setDeliveryModes(details.deliveryModes || [])
    setSupportLanguages(details.supportLanguages?.length ? details.supportLanguages : languages.slice(0, 2).map((item) => item.value))
    setAvailabilityMode(details.availabilityMode || 'request')
    setPortfolioUrl(details.portfolioUrl || '')
    setExperience(details.experience || details.references || '')
    const next: Record<string, unknown> = {}
    for (const field of categorySpecificFields(matchedCategory?.extensionFields || extensionFields)) {
      const raw = (details as Record<string, unknown>)[field.key]
      next[field.key] = raw !== undefined ? raw : field.defaultValue ?? (field.type === 'boolean' ? false : field.type === 'stringArray' ? [] : '')
    }
    setExtensionValues(next)
    setPhotos(details.photos || [])
    setError('')
    setSuccess('')
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function collectDetails(): ServiceDetails {
    const details: ServiceDetails = { ...extensionValues, photos }
    if (deliveryModes.length) details.deliveryModes = deliveryModes
    if (supportLanguages.length) {
      details.supportLanguages = supportLanguages
      details.crossBorder = true
    }
    if (priceTo.trim()) details.priceTo = Number(priceTo)
    if (portfolioUrl.trim()) details.portfolioUrl = portfolioUrl.trim()
    if (experience.trim()) {
      details.experience = experience.trim()
      details.references = experience.trim()
    }
    if (availabilityMode) details.availabilityMode = availabilityMode as ServiceDetails['availabilityMode']
    return details
  }

  async function onPhotoChange(file: File | undefined) {
    if (!file) return
    setError('')
    setUploadingPhoto(true)
    try {
      const url = await uploadServicePhoto(file)
      setPhotos((prev) => [...prev, url].slice(0, MAX_SERVICE_PHOTOS))
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setUploadingPhoto(false)
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')
    if (!categoryId || !subcategoryId || !selectedSubcategory) {
      setError(catalogLanguage === 'en' ? 'Choose a category and subcategory.' : 'Zgjidh kategorinë dhe nënkategorinë.')
      return
    }
    if (!location) {
      setError(catalogLanguage === 'en' ? 'Choose a location from the city list.' : 'Zgjidh lokacionin nga lista e qyteteve.')
      return
    }
    setSubmitting(true)
    const payload = {
      title,
      description,
      categoryId,
      subcategory: catalogLabel(selectedSubcategory, catalogLanguage),
      subcategoryId,
      location: locationLabel(location, 'sq'),
      priceFrom: priceFrom.trim() ? Number(priceFrom) : undefined,
      details: collectDetails(),
    }
    try {
      if (editingId) {
        const service = await updateService(editingId, payload)
        setServices((prev) => prev.map((item) => (item.id === service.id ? service : item)))
        resetForm()
        setSuccess(catalogLanguage === 'en' ? 'Service updated.' : 'Shërbimi u përditësua.')
      } else {
        const service = await createService(payload)
        setServices((prev) => [service, ...prev])
        resetForm()
        setSuccess(catalogLanguage === 'en' ? 'Service published and visible in offers.' : 'Shërbimi u publikua dhe shfaqet te ofertat.')
      }
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  async function onDelete(id: string) {
    if (!window.confirm(catalogLanguage === 'en' ? 'Delete this service?' : 'A je i sigurt që do ta fshish këtë shërbim?')) return
    setError('')
    setSuccess('')
    setDeletingId(id)
    try {
      await deleteService(id)
      setServices((prev) => prev.filter((item) => item.id !== id))
      if (editingId === id) resetForm()
      setSuccess(catalogLanguage === 'en' ? 'Service deleted.' : 'Shërbimi u fshi.')
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setDeletingId('')
    }
  }

  return (
    <section className="provider-section">
      <DashPageHeader
        title={editingId ? (catalogLanguage === 'en' ? 'Edit service' : 'Ndrysho shërbimin') : (catalogLanguage === 'en' ? 'Offer a service' : 'Ofro një shërbim')}
        description={catalogLanguage === 'en'
          ? 'Fill in the shared service fields, add photos, then complete any category-specific details.'
          : 'Plotëso fushat e përbashkëta, shto foto dhe pastaj detajet sipas kategorisë.'}
      />

      <form ref={formRef} onSubmit={onSubmit} className="service-form">
        <label>
          {catalogLanguage === 'en' ? 'Category' : 'Kategoria'}
          <select
            value={categoryId}
            required
            onChange={(e) => {
              setCategoryId(e.target.value)
              setSubcategoryId('')
            }}
          >
            {categories.length === 0 ? <option value="">{catalogLanguage === 'en' ? 'Loading...' : 'Duke u ngarkuar...'}</option> : null}
            {categories.map((category) => (
              <option key={category._id} value={category._id}>
                {catalogLabel(category, catalogLanguage)}
              </option>
            ))}
          </select>
        </label>

        <label>
          {catalogLanguage === 'en' ? 'Subcategory' : 'Nënkategoria'}
          <select
            value={subcategoryId}
            required
            disabled={!categoryId || subcategoriesLoading || subcategories.length === 0}
            onChange={(e) => setSubcategoryId(e.target.value)}
          >
            {subcategoriesLoading ? <option value="">{catalogLanguage === 'en' ? 'Loading...' : 'Duke u ngarkuar...'}</option> : null}
            {!subcategoriesLoading && subcategories.length === 0 ? (
              <option value="">{catalogLanguage === 'en' ? 'No subcategories' : 'Nuk ka nënkategori'}</option>
            ) : null}
            {subcategories.map((subcategory) => (
              <option key={subcategory._id} value={subcategory._id}>
                {catalogLabel(subcategory, catalogLanguage)}
              </option>
            ))}
          </select>
        </label>

        <label>
          {catalogLanguage === 'en' ? 'Title' : 'Titulli'}
          <input value={title} onChange={(e) => setTitle(e.target.value)} required />
        </label>

        <div className="full field">
          <span>{catalogLanguage === 'en' ? 'Location' : 'Lokacioni'}</span>
          <LocationSelector value={location} onChange={setLocation} />
        </div>

        <label className="full">
          {catalogLanguage === 'en' ? 'Description' : 'Përshkrimi'}
          <textarea value={description} rows={4} required onChange={(e) => setDescription(e.target.value)} />
        </label>

        <fieldset className="full checkbox-fieldset">
          <legend>{catalogLanguage === 'en' ? 'Delivery mode' : 'Mënyra e mbajtjes'}</legend>
          {deliveryModeOptions.map((mode) => (
            <label key={mode.id} className="check-row">
              <input
                type="checkbox"
                checked={deliveryModes.includes(mode.value)}
                onChange={() => {
                  setDeliveryModes((prev) =>
                    prev.includes(mode.value) ? prev.filter((item) => item !== mode.value) : [...prev, mode.value],
                  )
                }}
              />
              {mode.label}
            </label>
          ))}
        </fieldset>

        <fieldset className="full checkbox-fieldset">
          <legend>{catalogLanguage === 'en' ? 'Languages' : 'Gjuhët'}</legend>
          {languages.map((lang) => (
            <label key={lang.id} className="check-row">
              <input
                type="checkbox"
                checked={supportLanguages.includes(lang.value)}
                onChange={() => {
                  setSupportLanguages((prev) =>
                    prev.includes(lang.value) ? prev.filter((item) => item !== lang.value) : [...prev, lang.value],
                  )
                }}
              />
              {lang.label}
            </label>
          ))}
        </fieldset>

        <label>
          {catalogLanguage === 'en' ? 'Price from (€)' : 'Çmimi nga (€)'}
          <input type="number" min={0} value={priceFrom} onChange={(e) => setPriceFrom(e.target.value)} />
        </label>

        <label>
          {catalogLanguage === 'en' ? 'Price to (€)' : 'Çmimi deri (€)'}
          <input type="number" min={0} value={priceTo} onChange={(e) => setPriceTo(e.target.value)} />
        </label>

        <label>
          {catalogLanguage === 'en' ? 'Availability' : 'Disponueshmëria'}
          <select value={availabilityMode} onChange={(e) => setAvailabilityMode(e.target.value)}>
            {availabilityOptions.map((option) => (
              <option key={option.id} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          Portfolio URL
          <input value={portfolioUrl} onChange={(e) => setPortfolioUrl(e.target.value)} placeholder="https://..." />
        </label>

        <label className="full">
          {catalogLanguage === 'en' ? 'Experience / qualifications' : 'Përvoja / kualifikimet'}
          <textarea
            value={experience}
            rows={3}
            onChange={(e) => setExperience(e.target.value)}
            placeholder={catalogLanguage === 'en' ? 'Experience, certifications, references' : 'Përvoja, certifikata, referenca'}
          />
        </label>

        <div className="full service-photo-picker">
          <span>{catalogLanguage === 'en' ? `Work photos (up to ${MAX_SERVICE_PHOTOS})` : `Foto të punës (deri ${MAX_SERVICE_PHOTOS})`}</span>
          <div className="service-photo-grid">
            {photos.map((url) => (
              <div key={url} className="service-photo-tile">
                <img src={mediaUrl(url)} alt="" />
                <button
                  type="button"
                  className="service-photo-remove"
                  aria-label={catalogLanguage === 'en' ? 'Remove photo' : 'Hiq foton'}
                  onClick={() => setPhotos((prev) => prev.filter((item) => item !== url))}
                >
                  ×
                </button>
              </div>
            ))}
            {photos.length < MAX_SERVICE_PHOTOS ? (
              <label className="service-photo-add">
                {uploadingPhoto ? '...' : '+'}
                <input
                  type="file"
                  accept={IMAGE_ACCEPT}
                  hidden
                  disabled={uploadingPhoto}
                  onChange={(e) => {
                    void onPhotoChange(e.target.files?.[0])
                    e.target.value = ''
                  }}
                />
              </label>
            ) : null}
          </div>
          <p className="muted">{IMAGE_ACCEPT_HINT}</p>
        </div>

        {showCategoryFields ? (
          <ExtensionFieldsForm
            fields={extensionFields}
            values={extensionValues}
            language={catalogLanguage}
            catalogOptions={catalogOptions}
            onChange={(key, value) => setExtensionValues((previous) => ({ ...previous, [key]: value }))}
          />
        ) : null}

        {selectedCategory?.guidelines && typeof selectedCategory.guidelines === 'object' && 'sq' in (selectedCategory.guidelines as object) ? (
          <p className="muted full">{(selectedCategory.guidelines as { sq?: string }).sq}</p>
        ) : null}

        {error ? <p className="error full">{error}</p> : null}
        {success ? <p className="success full">{success}</p> : null}

        <div className="full form-actions">
          <button type="submit" disabled={submitting || uploadingPhoto}>
            {submitting
              ? editingId
                ? (catalogLanguage === 'en' ? 'Saving...' : 'Duke ruajtur...')
                : (catalogLanguage === 'en' ? 'Publishing...' : 'Duke publikuar...')
              : editingId
                ? (catalogLanguage === 'en' ? 'Save changes' : 'Ruaj ndryshimet')
                : (catalogLanguage === 'en' ? 'Publish service' : 'Publiko shërbimin')}
          </button>
          {editingId ? (
            <button
              type="button"
              className="ghost"
              onClick={() => {
                resetForm()
                setSuccess('')
                setError('')
              }}
            >
              {catalogLanguage === 'en' ? 'Cancel' : 'Anulo'}
            </button>
          ) : null}
        </div>
      </form>

      <div className="services-list">
        <h3>{catalogLanguage === 'en' ? 'My services' : 'Shërbimet e mia'}</h3>
        {loading ? <p className="muted">{catalogLanguage === 'en' ? 'Loading...' : 'Duke u ngarkuar...'}</p> : null}
        {!loading && services.length === 0 ? (
          <p className="muted">{catalogLanguage === 'en' ? 'No published services yet.' : 'Nuk ke publikuar ende asnjë shërbim.'}</p>
        ) : null}
        <ul>
          {services.map((service) => (
            <li key={service.id} className={editingId === service.id ? 'is-editing' : undefined}>
              <strong>{service.title}</strong>
              <span>
                {service.categoryLabel || service.category} · {service.subcategory} · {service.location}
                {service.priceFrom != null ? ` · nga €${service.priceFrom}` : ''}
                {service.details?.priceTo != null ? `–€${service.details.priceTo}` : ''}
              </span>
              {service.details?.deliveryModes?.length ? <span>{service.details.deliveryModes.join(' · ')}</span> : null}
              {service.details?.supportLanguages?.length ? <span>{service.details.supportLanguages.join(' · ')}</span> : null}
              <p>{service.description}</p>
              {service.details?.photos?.length ? (
                <div className="services-list-thumbs">
                  {service.details.photos.map((url) => (
                    <img key={url} src={mediaUrl(url)} alt="" />
                  ))}
                </div>
              ) : null}
              <div className="services-list-actions">
                <Link className="ghost link-btn" to={`/services/${service.id}`}>
                  {catalogLanguage === 'en' ? 'View' : 'Shiko'}
                </Link>
                <button type="button" className="ghost" onClick={() => startEdit(service)}>
                  {catalogLanguage === 'en' ? 'Edit' : 'Ndrysho'}
                </button>
                <button
                  type="button"
                  className="ghost danger-ghost"
                  disabled={deletingId === service.id}
                  onClick={() => void onDelete(service.id)}
                >
                  {deletingId === service.id
                    ? (catalogLanguage === 'en' ? 'Deleting...' : 'Duke fshirë...')
                    : (catalogLanguage === 'en' ? 'Delete' : 'Fshi')}
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
