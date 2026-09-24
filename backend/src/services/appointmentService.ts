import { Types } from 'mongoose'
import { Appointment } from '../models/Appointment'
import { AvailabilitySlot } from '../models/AvailabilitySlot'
import { RequestDelivery } from '../models/RequestDelivery'
import { ProviderProfile } from '../models/ProviderProfile'
import { User } from '../models/User'
import { UserRequest } from '../models/UserRequest'
import { syncSlotWithRequestStatus } from './availabilityService'
import { listMyProviderProfiles } from './providerProfileService'

export async function confirmAppointmentFromDelivery(deliveryId: string) {
  if (!Types.ObjectId.isValid(deliveryId)) throw new Error('Delivery ID i pavlefshëm')
  const delivery = await RequestDelivery.findById(deliveryId)
  if (!delivery?.slotId || !Types.ObjectId.isValid(delivery.slotId)) throw new Error('Nuk ka termin të zgjedhur')
  const [request, slot] = await Promise.all([
    UserRequest.findById(delivery.request), AvailabilitySlot.findById(delivery.slotId),
  ])
  if (!request || !slot) throw new Error('Termini nuk u gjet')
  if (slot.providerProfile) {
    if (!slot.providerProfile.equals(delivery.providerProfile)) throw new Error('Termini nuk i përket dërgesës')
  } else {
    const profile = await ProviderProfile.findById(delivery.providerProfile).select('ownerUser').lean()
    const owner = profile ? await User.findById(profile.ownerUser).select('uid').lean() : null
    if (!owner || slot.providerUid !== owner.uid) throw new Error('Termini nuk i përket dërgesës')
  }
  const hold = slot.holds.find((item) => item.requestId === deliveryId)
  if (!hold) throw new Error('Termini nuk mbahet më për këtë kërkesë')
  let appointment = await Appointment.findOne({ requestDelivery: delivery._id })
  if (appointment?.status === 'confirmed' || appointment?.status === 'completed') return appointment
  if (appointment?.status === 'cancelled') throw new Error('Rezervimi është anuluar')
  if (!appointment) {
    try {
      appointment = await Appointment.create({
        user: request.user, providerProfile: delivery.providerProfile,
        business: slot.business, serviceOffer: delivery.serviceOffer || slot.serviceOffer,
        userRequest: request._id, requestDelivery: delivery._id, availabilitySlot: slot._id,
        startAt: slot.startAt, endAt: slot.endAt, timezone: slot.timezone || 'Europe/Belgrade',
        mode: slot.mode || 'online', location: slot.location, status: 'pending',
      })
    } catch (err) {
      if ((err as { code?: number }).code !== 11000) throw err
      appointment = await Appointment.findOne({ requestDelivery: delivery._id })
      if (!appointment) throw err
    }
  }
  const booked = hold.state === 'booked' ? slot : await syncSlotWithRequestStatus({ requestId: deliveryId, status: 'accepted' })
  if (!booked) throw new Error('Termini nuk u konfirmua')
  appointment.status = 'confirmed'
  await appointment.save()
  return appointment
}

export async function completeAppointmentFromDelivery(deliveryId: string) {
  const appointment = await Appointment.findOne({ requestDelivery: deliveryId })
  if (!appointment || appointment.status !== 'confirmed') throw new Error('Rezervimi nuk është konfirmuar')
  appointment.status = 'completed'
  await appointment.save()
  return appointment
}

export async function listMyAppointments(uid: string) {
  const user = await User.findOne({ uid }).select('_id').lean()
  if (!user) return []
  return Appointment.find({ user: user._id, status: { $ne: 'pending' } }).sort({ startAt: -1 }).limit(100)
}

export async function listProviderAppointments(uid: string) {
  const profiles = await listMyProviderProfiles(uid)
  return Appointment.find({ providerProfile: { $in: profiles.map((profile) => profile._id) }, status: { $ne: 'pending' } }).sort({ startAt: -1 }).limit(100)
}

export async function cancelAppointment(uid: string, id: string, reason?: string, asAdmin = false) {
  if (!Types.ObjectId.isValid(id)) throw new Error('Appointment ID i pavlefshëm')
  const [user, appointment] = await Promise.all([
    User.findOne({ uid }).select('_id').lean(), Appointment.findById(id),
  ])
  if (!user || !appointment) throw new Error('Rezervimi nuk u gjet')
  const profiles = asAdmin ? [] : await listMyProviderProfiles(uid)
  const owns = appointment.user.equals(user._id) || profiles.some((profile) => profile._id.equals(appointment.providerProfile))
  if (!asAdmin && !owns) throw new Error('Nuk ke leje për këtë rezervim')
  if (appointment.status === 'completed' || appointment.status === 'no_show') throw new Error('Rezervimi ka përfunduar')
  if (appointment.status !== 'cancelled') {
    appointment.status = 'cancelled'
    appointment.cancellation = { cancelledAt: new Date(), cancelledBy: user._id, reason: reason?.trim() }
    await appointment.save()
  }
  if (appointment.requestDelivery) await syncSlotWithRequestStatus({ requestId: String(appointment.requestDelivery), status: 'rejected' })
  return appointment
}
