import { useEffect, useState } from 'react'
import { Chip, CloseButton } from '@heroui/react'
import i18next from 'i18next'
import { locationLabel, type LocationSelection } from '../api/locations'
import LocationSelector from './LocationSelector'

function language(): 'sq' | 'en' {
  const selected = i18next.isInitialized ? i18next.language : document.documentElement.lang
  return selected?.toLowerCase().startsWith('en') ? 'en' : 'sq'
}

export default function ProviderLocationFields({ location, serviceAreas, onLocationChange, onServiceAreasChange, disabled = false }: {
  location: LocationSelection | null
  serviceAreas: LocationSelection[]
  onLocationChange: (value: LocationSelection | null) => void
  onServiceAreasChange: (value: LocationSelection[]) => void
  disabled?: boolean
}) {
  const [locale, setLocale] = useState(language)
  useEffect(() => {
    const update = () => setLocale(language())
    const observer = new MutationObserver(update)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] })
    i18next.on('languageChanged', update)
    return () => { observer.disconnect(); i18next.off('languageChanged', update) }
  }, [])

  return <div className="provider-location-fields full">
    <div className="provider-location-field">
      <span>{locale === 'sq' ? 'Lokacioni i biznesit' : 'Business location'}</span>
      <LocationSelector value={location} onChange={onLocationChange} disabled={disabled} />
    </div>
    <div className="provider-location-field">
      <span>{locale === 'sq' ? 'Qytetet ku ofron shërbime' : 'Service area cities'}</span>
      <LocationSelector value={null} disabled={disabled} onChange={(selected) => {
        if (selected && !serviceAreas.some((area) => area.city._id === selected.city._id)) onServiceAreasChange([...serviceAreas, selected])
      }} />
      {serviceAreas.length ? <div className="provider-service-area-chips">
        {serviceAreas.map((area) => <Chip key={area.city._id} variant="soft" color="accent">
          {locationLabel(area, locale)}
          <CloseButton aria-label={`${locale === 'sq' ? 'Hiq' : 'Remove'} ${locationLabel(area, locale)}`} isDisabled={disabled} onPress={() => onServiceAreasChange(serviceAreas.filter((item) => item.city._id !== area.city._id))} />
        </Chip>)}
      </div> : null}
    </div>
  </div>
}
