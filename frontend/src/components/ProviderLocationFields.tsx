import { useTranslation } from 'react-i18next'
import { Chip, CloseButton } from '@heroui/react'
import { locationLabel, type LocationSelection } from '../api/locations'
import { catalogLanguage } from '../i18n'
import LocationSelector from './LocationSelector'

export default function ProviderLocationFields({ location, serviceAreas, onLocationChange, onServiceAreasChange, disabled = false }: {
  location: LocationSelection | null
  serviceAreas: LocationSelection[]
  onLocationChange: (value: LocationSelection | null) => void
  onServiceAreasChange: (value: LocationSelection[]) => void
  disabled?: boolean
}) {
  const { t, i18n } = useTranslation()
  const locale = catalogLanguage(i18n.language)

  return <div className="provider-location-fields full">
    <div className="provider-location-field">
      <span>{t('location.business')}</span>
      <LocationSelector value={location} onChange={onLocationChange} disabled={disabled} />
    </div>
    <div className="provider-location-field">
      <span>{t('location.areas')}</span>
      <LocationSelector value={null} disabled={disabled} onChange={(selected) => {
        if (selected && !serviceAreas.some((area) => area.city._id === selected.city._id)) onServiceAreasChange([...serviceAreas, selected])
      }} />
      {serviceAreas.length ? <div className="provider-service-area-chips">
        {serviceAreas.map((area) => <Chip key={area.city._id} variant="soft" color="accent">
          {locationLabel(area, locale)}
          <CloseButton aria-label={`${t('location.remove')} ${locationLabel(area, locale)}`} isDisabled={disabled} onPress={() => onServiceAreasChange(serviceAreas.filter((item) => item.city._id !== area.city._id))} />
        </Chip>)}
      </div> : null}
    </div>
  </div>
}
