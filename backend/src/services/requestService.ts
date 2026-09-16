import {
  ServiceRequest,
  type ContactMethod,
  type RequestStatus,
  type ServiceRequestDoc,
} from '../models/ServiceRequest'
import {
  getSlotById,
  holdSlotForRequest,
  syncSlotWithRequestStatus,
} from './availabilityService'

function toRequest(doc: ServiceRequestDoc & { _id: { toString(): string } }) {
  return {
    id: doc._id.toString(),
    seekerUid: doc.seekerUid,
    seekerName: doc.seekerName,
    seekerEmail: doc.seekerEmail,
    providerUid: doc.providerUid,
    providerName: doc.providerName,
    serviceId: doc.serviceId,
    serviceTitle: doc.serviceTitle,
    need: doc.need,
    message: doc.message,
    location: doc.location,
    language: doc.language,
    urgency: doc.urgency,
    contactMethod: doc.contactMethod,
    status: doc.status,
    providerNote: doc.providerNote,
    slotId: doc.slotId,
    requestedStartAt: doc.requestedStartAt?.toISOString(),
    requestedEndAt: doc.requestedEndAt?.toISOString(),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  }
}

export async function createServiceRequest(input: {
  seekerUid: string
  seekerName: string
  seekerEmail: string
  providerUid: string
  providerName: string
  serviceId?: string
  serviceTitle?: string
  need: string
  message: string
  location?: string
  language?: string
  urgency?: string
  contactMethod: ContactMethod
  slotId?: string
}) {
  if (input.seekerUid === input.providerUid) {
    throw new Error('Nuk mund t’i dërgosh kërkesë vetes')
  }

  let requestedStartAt: Date | undefined
  let requestedEndAt: Date | undefined
  const slotId = input.slotId?.trim()

  if (slotId) {
    const slot = await getSlotById(slotId)
    if (!slot) throw new Error('Termini i zgjedhur nuk ekziston')
    if (slot.providerUid !== input.providerUid) {
      throw new Error('Termini nuk i përket këtij ofruesi')
    }
    if (slot.status !== 'open') {
      throw new Error('Ky termin nuk është më i lirë')
    }
    requestedStartAt = new Date(slot.startAt)
    requestedEndAt = new Date(slot.endAt)
  }

  const doc = await ServiceRequest.create({
    ...input,
    need: input.need.trim(),
    message: input.message.trim(),
    slotId: slotId || undefined,
    requestedStartAt,
    requestedEndAt,
    status: 'pending',
  })

  if (slotId) {
    try {
      await holdSlotForRequest({
        slotId,
        providerUid: input.providerUid,
        requestId: doc._id.toString(),
      })
    } catch (err) {
      await ServiceRequest.findByIdAndDelete(doc._id)
      throw err
    }
  }

  return toRequest(doc)
}

export async function listRequestsBySeeker(seekerUid: string) {
  const docs = await ServiceRequest.find({ seekerUid }).sort({ createdAt: -1 })
  return docs.map((d) => toRequest(d))
}

export async function listRequestsByProvider(providerUid: string) {
  const docs = await ServiceRequest.find({ providerUid }).sort({ createdAt: -1 })
  return docs.map((d) => toRequest(d))
}

export async function listAllRequests() {
  const docs = await ServiceRequest.find({}).sort({ createdAt: -1 }).limit(100)
  return docs.map((d) => toRequest(d))
}

export async function updateRequestStatus(input: {
  id: string
  providerUid: string
  status: RequestStatus
  providerNote?: string
  asAdmin?: boolean
}) {
  const doc = await ServiceRequest.findById(input.id)
  if (!doc) throw new Error('Kërkesa nuk u gjet')

  if (!input.asAdmin && doc.providerUid !== input.providerUid) {
    throw new Error('Nuk ke leje për këtë kërkesë')
  }

  doc.status = input.status
  if (input.providerNote !== undefined) {
    doc.providerNote = input.providerNote.trim()
  }
  await doc.save()

  if (doc.slotId || doc.id) {
    await syncSlotWithRequestStatus({
      requestId: doc._id.toString(),
      status: input.status,
    })
  }

  return toRequest(doc)
}

export async function countPendingForProvider(providerUid: string) {
  return ServiceRequest.countDocuments({ providerUid, status: 'pending' })
}
