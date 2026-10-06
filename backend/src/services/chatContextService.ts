import { Types } from 'mongoose'
import { User } from '../models/User'
import { ProviderProfile } from '../models/ProviderProfile'
import { UserRequest } from '../models/UserRequest'
import { RequestDelivery } from '../models/RequestDelivery'
import { ServiceRequest } from '../models/ServiceRequest'
import { ServiceOffer } from '../models/ServiceOffer'

/** Only called after conversation membership has been verified. Never returns chat content. */
export async function chatRequestContext(conversation: { seekerUid: string; providerUid: string; serviceId?: string; requestDeliveryId?: Types.ObjectId }) {
  if (conversation.serviceId && !Types.ObjectId.isValid(conversation.serviceId) && !conversation.requestDeliveryId) return null
  const [seeker, provider] = await Promise.all([
    User.findOne({ uid: conversation.seekerUid }).select('_id').lean(),
    User.findOne({ uid: conversation.providerUid }).select('_id').lean(),
  ])
  if (!seeker || !provider) return null
  const [profiles, requests] = await Promise.all([
    ProviderProfile.find({ ownerUser: provider._id }).select('_id').lean(),
    UserRequest.find({ user: seeker._id, status: { $ne: 'draft' } }).select('_id problem status').lean(),
  ])
  const deliveries = await RequestDelivery.find({
    providerProfile: { $in: profiles.map(p => p._id) }, request: { $in: requests.map(r => r._id) },
    ...(conversation.requestDeliveryId ? { _id: conversation.requestDeliveryId } : conversation.serviceId ? { serviceOffer: conversation.serviceId } : {}),
  }).sort({ sentAt: -1 }).limit(2).lean()
  // Existing pair-based threads may represent multiple requests. Do not guess a link.
  if (deliveries.length === 1) {
    const delivery = deliveries[0]
    const request = requests.find(r => String(r._id) === String(delivery.request))!
    const offer = delivery.serviceOffer ? await ServiceOffer.findById(delivery.serviceOffer).select('name').lean() : null
    return { id: String(delivery._id), title: offer?.name || request.problem, status: request.status === 'cancelled' ? 'cancelled' : delivery.status }
  }
  if (conversation.requestDeliveryId || deliveries.length > 1) return null
  const legacy = await ServiceRequest.find({ seekerUid: conversation.seekerUid, providerUid: conversation.providerUid, ...(conversation.serviceId ? { serviceId: conversation.serviceId } : {}) }).limit(2).lean()
  return legacy.length === 1 ? { id: String(legacy[0]._id), title: legacy[0].serviceTitle || legacy[0].need, status: legacy[0].status } : null
}
