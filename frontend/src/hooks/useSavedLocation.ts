import { useEffect, useRef, useState } from 'react'
import { toast } from '@heroui/react'
import { useAuth } from '../auth/AuthContext'
import { resolveSavedLocation, type LocationSelection, type SavedLocationIds } from '../api/locations'
import { getErrorMessage } from '../utils/errors'

const GUEST_LOCATION_KEY = 'keshillakos:guest-location'

function guestLocation(): SavedLocationIds | null {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(GUEST_LOCATION_KEY) || 'null')
    if (saved && typeof saved === 'object' && 'countryId' in saved && 'cityId' in saved
      && typeof saved.countryId === 'string' && typeof saved.cityId === 'string') {
      return { countryId: saved.countryId, cityId: saved.cityId }
    }
  } catch { /* Ignore invalid or unavailable guest storage. */ }
  return null
}

export function useSavedLocation() {
  const { user, loading: authLoading, updateProfile } = useAuth()
  const [selectedLocation, setSelectedLocation] = useState<LocationSelection | null>(null)
  const [locationLoading, setLocationLoading] = useState(false)
  const [locationSaving, setLocationSaving] = useState(false)
  const [locationError, setLocationError] = useState('')
  const changeVersion = useRef(0)
  const accountUid = user?.uid
  const accountCountryId = user?.savedLocation?.countryId
  const accountCityId = user?.savedLocation?.cityId

  useEffect(() => {
    if (authLoading) return
    const controller = new AbortController()
    const version = changeVersion.current
    const saved = accountUid
      ? accountCountryId && accountCityId ? { countryId: accountCountryId, cityId: accountCityId } : null
      : guestLocation()
    if (!saved) {
      setSelectedLocation(null)
      setLocationLoading(false)
      return
    }
    setLocationLoading(true)
    resolveSavedLocation(saved, controller.signal)
      .then((selection) => { if (!controller.signal.aborted && version === changeVersion.current) setSelectedLocation(selection) })
      .catch((err: unknown) => { if (!controller.signal.aborted) setLocationError(getErrorMessage(err)) })
      .finally(() => { if (!controller.signal.aborted) setLocationLoading(false) })
    return () => controller.abort()
  }, [authLoading, accountUid, accountCountryId, accountCityId])

  async function changeLocation(value: LocationSelection | null) {
    if (locationSaving || authLoading || locationLoading) return
    const previous = selectedLocation
    const version = ++changeVersion.current
    setLocationError('')
    setSelectedLocation(value)
    const ids = value ? { countryId: value.country._id, cityId: value.city._id } : null
    if (!user) {
      try {
        if (ids) localStorage.setItem(GUEST_LOCATION_KEY, JSON.stringify(ids))
        else localStorage.removeItem(GUEST_LOCATION_KEY)
      } catch {
        toast.danger('Lokacioni nuk mund të ruhet në këtë pajisje.')
      }
      return
    }
    setLocationSaving(true)
    try {
      await updateProfile({ savedLocation: ids })
      toast.success(ids ? 'Lokacioni u ruajt.' : 'Lokacioni u hoq.')
    } catch (err) {
      if (version === changeVersion.current) {
        setSelectedLocation(previous)
        toast.danger(getErrorMessage(err))
      }
    } finally { setLocationSaving(false) }
  }

  return { selectedLocation, changeLocation, locationLoading: authLoading || locationLoading, locationSaving, locationError }
}
