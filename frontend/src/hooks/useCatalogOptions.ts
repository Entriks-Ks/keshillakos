import { useEffect, useMemo, useState } from 'react'
import {
  catalogOptionLabel,
  catalogOptionValue,
  fetchCatalogOptions,
  type CatalogOption,
  type CatalogOptionGroup,
} from '../api/catalog'

export type CatalogOptionChoice = {
  id: string
  value: string
  label: string
  option: CatalogOption
}

function currentLanguage(): 'sq' | 'en' {
  return document.documentElement.lang.toLowerCase().startsWith('en') ? 'en' : 'sq'
}

export function useCatalogOptions() {
  const [options, setOptions] = useState<CatalogOption[]>([])
  const [language, setLanguage] = useState(currentLanguage)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const update = () => setLanguage(currentLanguage())
    const observer = new MutationObserver(update)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchCatalogOptions()
      .then((items) => {
        if (cancelled) return
        setOptions(items.filter((item) => item.isActive).sort((a, b) => a.group.localeCompare(b.group) || a.order - b.order || a.slug.localeCompare(b.slug)))
        setError('')
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setOptions([])
          setError(err instanceof Error ? err.message : 'Nuk u ngarkuan opsionet')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const byGroup = useMemo(() => {
    const map: Record<CatalogOptionGroup, CatalogOptionChoice[]> = {
      language: [],
      'delivery-mode': [],
      audience: [],
      'offer-type': [],
      availability: [],
    }
    for (const option of options) {
      map[option.group].push({
        id: option.slug,
        value: catalogOptionValue(option),
        label: catalogOptionLabel(option, language),
        option,
      })
    }
    return map
  }, [options, language])

  return {
    loading,
    error,
    languages: byGroup.language,
    deliveryModes: byGroup['delivery-mode'],
    audienceOptions: byGroup.audience,
    offerTypes: byGroup['offer-type'],
    availabilityOptions: byGroup.availability,
    options,
  }
}
