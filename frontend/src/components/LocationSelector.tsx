import { useEffect, useRef, useState } from 'react'
import { Autocomplete, Label, ListBox, SearchField, useFilter } from '@heroui/react'
import i18next from 'i18next'
import { MapPin } from 'lucide-react'
import { fetchCities, fetchCountries, locationLabel, type LocationSelection } from '../api/locations'
import { getErrorMessage } from '../utils/errors'

type Language = 'sq' | 'en'

function currentLanguage(): Language {
  const language = i18next.isInitialized ? i18next.language : document.documentElement.lang
  return language?.toLowerCase().startsWith('en') ? 'en' : 'sq'
}

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
  const [language, setLanguage] = useState(currentLanguage)
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
    const update = () => setLanguage(currentLanguage())
    const observer = new MutationObserver(update)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] })
    i18next.on('languageChanged', update)
    return () => { observer.disconnect(); i18next.off('languageChanged', update) }
  }, [])

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

  const placeholder = language === 'sq' ? 'Zgjidh qytetin' : 'Choose a city'

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
      <Label className="sr-only">{language === 'sq' ? 'Lokacioni' : 'Location'}</Label>
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
              <SearchField.Input placeholder={language === 'sq' ? 'Kërko qytet ose shtet' : 'Search city or country'} />
            </SearchField.Group>
          </SearchField>
          {status === 'loading' ? <p className="tt-location-status" role="status">{language === 'sq' ? 'Lokacionet po ngarkohen...' : 'Loading locations...'}</p> : null}
          {status === 'error' ? <p className="tt-location-status error" role="alert">{error}</p> : null}
          {status === 'ready' && options.length === 0 ? <p className="tt-location-status">{language === 'sq' ? 'Nuk ka qytete të disponueshme.' : 'No cities available.'}</p> : null}
          <ListBox className="tt-location-list" aria-label={language === 'sq' ? 'Qytetet' : 'Cities'}>
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
