import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Autocomplete, Label, ListBox, SearchField, useFilter } from '@heroui/react'
import { MapPin } from 'lucide-react'
import { fetchCities, fetchCountries, locationLabel, type LocationSelection } from '../api/locations'
import { catalogLanguage } from '../i18n'
import { getErrorMessage } from '../utils/errors'

export default function LocationSelector({
  value,
  onChange,
  className = '',
  disabled = false,
}: {
  value: LocationSelection | null
  onChange: (value: LocationSelection | null) => void
  className?: string
  disabled?: boolean
}) {
  const { t, i18n } = useTranslation()
  const language = catalogLanguage(i18n.language)
  const [open, setOpen] = useState(false)
  const [options, setOptions] = useState<LocationSelection[]>(() => value ? [value] : [])
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [error, setError] = useState('')
  const loaded = useRef(false)
  const { contains } = useFilter({ sensitivity: 'base' })
  const items = value && !options.some((item) => item.city._id === value.city._id)
    ? [value, ...options]
    : options

  useEffect(() => {
    if (!open || loaded.current) return
    const controller = new AbortController()
    setStatus('loading')
    setError('')
    fetchCountries(controller.signal).then(async (countries) => {
      const active = countries.filter((country) => country.isActive).sort((a, b) => a.order - b.order)
      const groups = await Promise.all(active.map(async (country) => ({
        country,
        cities: await fetchCities(country.slug, controller.signal),
      })))
      if (controller.signal.aborted) return
      setOptions(groups.flatMap(({ country, cities }) => cities
        .filter((city) => city.isActive)
        .sort((a, b) => a.order - b.order)
        .map((city) => ({ city, country }))))
      loaded.current = true
      setStatus('ready')
    }).catch((err: unknown) => {
      if (controller.signal.aborted) return
      setError(getErrorMessage(err))
      setStatus('error')
    })
    return () => controller.abort()
  }, [open])

  const placeholder = t('location.city')

  return (
    <Autocomplete
      className={`tt-location-selector ${className}`.trim()}
      fullWidth
      isDisabled={disabled}
      allowsEmptyCollection
      isOpen={open}
      onOpenChange={setOpen}
      value={value?.city._id ?? null}
      onChange={(key) => onChange(items.find((item) => item.city._id === key) ?? null)}
      placeholder={placeholder}
    >
      <Label className="sr-only">{t('location.label')}</Label>
      <Autocomplete.Trigger className="tt-location-trigger">
        <MapPin size={18} aria-hidden />
        <Autocomplete.Value>{() => value ? locationLabel(value, language) : placeholder}</Autocomplete.Value>
        <Autocomplete.ClearButton />
        <Autocomplete.Indicator />
      </Autocomplete.Trigger>
      <Autocomplete.Popover className="tt-location-popover">
        <Autocomplete.Filter filter={contains}>
          <SearchField>
            <SearchField.Group>
              <SearchField.SearchIcon />
              <SearchField.Input placeholder={t('location.search')} />
            </SearchField.Group>
          </SearchField>
          {status === 'loading' ? <p className="tt-location-status" role="status">{t('location.loading')}</p> : null}
          {status === 'error' ? <p className="tt-location-status error" role="alert">{error}</p> : null}
          {status === 'ready' && options.length === 0 ? <p className="tt-location-status">{t('location.empty')}</p> : null}
          <ListBox className="tt-location-list" aria-label={t('location.cities')}>
            {items.map((item) => {
              const label = locationLabel(item, language)
              return <ListBox.Item key={item.city._id} id={item.city._id} textValue={label}>{label}</ListBox.Item>
            })}
          </ListBox>
        </Autocomplete.Filter>
      </Autocomplete.Popover>
    </Autocomplete>
  )
}
