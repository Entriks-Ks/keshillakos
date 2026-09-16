import {
  AvailabilitySlot,
  type AvailabilitySlotDoc,
  type SlotStatus,
} from '../models/AvailabilitySlot'

function toSlot(doc: AvailabilitySlotDoc & { _id: { toString(): string } }) {
  return {
    id: doc._id.toString(),
    providerUid: doc.providerUid,
    providerName: doc.providerName,
    startAt: doc.startAt.toISOString(),
    endAt: doc.endAt.toISOString(),
    status: doc.status,
    note: doc.note,
    requestId: doc.requestId,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  }
}

function assertValidRange(startAt: Date, endAt: Date) {
  if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
    throw new Error('Data ose ora nuk është e vlefshme')
  }
  if (endAt <= startAt) {
    throw new Error('Ora e mbarimit duhet të jetë pas fillimit')
  }
  const minMs = 15 * 60 * 1000
  if (endAt.getTime() - startAt.getTime() < minMs) {
    throw new Error('Termini duhet të jetë të paktën 15 minuta')
  }
  if (startAt.getTime() < Date.now() - 60_000) {
    throw new Error('Nuk mund të shtosh orare në të kaluarën')
  }
}

export async function createAvailabilitySlot(input: {
  providerUid: string
  providerName: string
  startAt: string | Date
  endAt: string | Date
  note?: string
}) {
  const startAt = new Date(input.startAt)
  const endAt = new Date(input.endAt)
  assertValidRange(startAt, endAt)

  const overlap = await AvailabilitySlot.findOne({
    providerUid: input.providerUid,
    status: { $in: ['open', 'held', 'booked'] },
    startAt: { $lt: endAt },
    endAt: { $gt: startAt },
  })
  if (overlap) {
    throw new Error('Ky orar përputhet me një termin ekzistues')
  }

  const doc = await AvailabilitySlot.create({
    providerUid: input.providerUid,
    providerName: input.providerName,
    startAt,
    endAt,
    note: input.note?.trim() || undefined,
    status: 'open',
  })

  return toSlot(doc)
}

export async function listMyAvailability(providerUid: string) {
  const docs = await AvailabilitySlot.find({
    providerUid,
    status: { $ne: 'cancelled' },
    endAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
  }).sort({ startAt: 1 })
  return docs.map((d) => toSlot(d))
}

export async function listOpenAvailabilityForProvider(providerUid: string) {
  const docs = await AvailabilitySlot.find({
    providerUid,
    status: 'open',
    startAt: { $gte: new Date() },
  })
    .sort({ startAt: 1 })
    .limit(40)
  return docs.map((d) => toSlot(d))
}

/** Oraret e ardhshme: të lira + të zëna (held/booked), që klienti t’i shohë qartë. */
export async function listScheduleForProvider(providerUid: string) {
  const docs = await AvailabilitySlot.find({
    providerUid,
    status: { $in: ['open', 'held', 'booked'] },
    startAt: { $gte: new Date() },
  })
    .sort({ startAt: 1 })
    .limit(60)

  const slots = docs.map((d) => toSlot(d))
  return {
    slots,
    free: slots.filter((s) => s.status === 'open'),
    busy: slots.filter((s) => s.status === 'held' || s.status === 'booked'),
  }
}

export async function deleteAvailabilitySlot(input: {
  id: string
  providerUid: string
  asAdmin?: boolean
}) {
  const doc = await AvailabilitySlot.findById(input.id)
  if (!doc || doc.status === 'cancelled') {
    throw new Error('Termini nuk u gjet')
  }
  if (!input.asAdmin && doc.providerUid !== input.providerUid) {
    throw new Error('Nuk ke leje për këtë termin')
  }
  if (doc.status === 'held' || doc.status === 'booked') {
    throw new Error('Ky termin është i rezervuar dhe nuk mund të fshihet')
  }
  doc.status = 'cancelled'
  await doc.save()
  return { deleted: true, id: doc._id.toString() }
}

export async function holdSlotForRequest(input: {
  slotId: string
  providerUid: string
  requestId: string
}) {
  // Atomic: vetëm nëse ende 'open' — dy klientë nuk mund të marrin të njëjtën orë
  const doc = await AvailabilitySlot.findOneAndUpdate(
    {
      _id: input.slotId,
      providerUid: input.providerUid,
      status: 'open',
      startAt: { $gte: new Date() },
    },
    {
      $set: {
        status: 'held',
        requestId: input.requestId,
      },
    },
    { returnDocument: 'after' },
  )

  if (!doc) {
    const existing = await AvailabilitySlot.findById(input.slotId)
    if (!existing || existing.status === 'cancelled') {
      throw new Error('Termini i zgjedhur nuk ekziston')
    }
    if (existing.providerUid !== input.providerUid) {
      throw new Error('Termini nuk i përket këtij ofruesi')
    }
    if (existing.startAt.getTime() < Date.now()) {
      throw new Error('Ky termin ka kaluar')
    }
    throw new Error('Ky termin sapo u zë — zgjidh një orë tjetër të lirë')
  }

  return toSlot(doc)
}

export async function syncSlotWithRequestStatus(input: {
  requestId: string
  status: 'accepted' | 'rejected' | 'completed' | 'pending'
}) {
  const doc = await AvailabilitySlot.findOne({ requestId: input.requestId })
  if (!doc) return null

  if (input.status === 'accepted' || input.status === 'completed') {
    doc.status = 'booked'
  } else if (input.status === 'rejected') {
    doc.status = 'open'
    doc.requestId = undefined
  } else if (input.status === 'pending') {
    doc.status = 'held'
  }

  await doc.save()
  return toSlot(doc)
}

export async function getSlotById(slotId: string) {
  const doc = await AvailabilitySlot.findById(slotId)
  if (!doc) return null
  return toSlot(doc)
}

export type PublicSlot = ReturnType<typeof toSlot>
export type { SlotStatus }
