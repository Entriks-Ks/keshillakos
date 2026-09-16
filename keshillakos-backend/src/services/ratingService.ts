import { Rating } from '../models/Rating'
import { listActiveServices } from './serviceService'

export type ProviderRatingStats = {
  providerUid: string
  average: number
  count: number
}

function toRating(doc: {
  _id: { toString(): string }
  providerUid: string
  providerName: string
  raterUid: string
  raterName: string
  score: number
  comment?: string
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: doc._id.toString(),
    providerUid: doc.providerUid,
    providerName: doc.providerName,
    raterUid: doc.raterUid,
    raterName: doc.raterName,
    score: doc.score,
    comment: doc.comment,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  }
}

export async function upsertRating(input: {
  providerUid: string
  providerName: string
  raterUid: string
  raterName: string
  score: number
  comment?: string
}) {
  if (input.providerUid === input.raterUid) {
    throw new Error('Nuk mund ta vlerësosh veten')
  }

  if (!Number.isInteger(input.score) || input.score < 1 || input.score > 5) {
    throw new Error('Vlerësimi duhet të jetë nga 1 deri në 5')
  }

  const rating = await Rating.findOneAndUpdate(
    { raterUid: input.raterUid, providerUid: input.providerUid },
    {
      $set: {
        providerName: input.providerName.trim(),
        raterName: input.raterName.trim(),
        score: input.score,
        comment: input.comment?.trim() || undefined,
      },
      $setOnInsert: {
        raterUid: input.raterUid,
        providerUid: input.providerUid,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  )

  return toRating(rating)
}

export async function getProviderStats(providerUid: string): Promise<ProviderRatingStats> {
  const [agg] = await Rating.aggregate<{ average: number; count: number }>([
    { $match: { providerUid } },
    {
      $group: {
        _id: '$providerUid',
        average: { $avg: '$score' },
        count: { $sum: 1 },
      },
    },
  ])

  return {
    providerUid,
    average: agg ? Math.round(agg.average * 10) / 10 : 0,
    count: agg?.count ?? 0,
  }
}

export async function getStatsForProviders(
  providerUids: string[],
): Promise<Map<string, ProviderRatingStats>> {
  const unique = [...new Set(providerUids.filter(Boolean))]
  const map = new Map<string, ProviderRatingStats>()
  if (unique.length === 0) return map

  const rows = await Rating.aggregate<{ _id: string; average: number; count: number }>([
    { $match: { providerUid: { $in: unique } } },
    {
      $group: {
        _id: '$providerUid',
        average: { $avg: '$score' },
        count: { $sum: 1 },
      },
    },
  ])

  for (const uid of unique) {
    map.set(uid, { providerUid: uid, average: 0, count: 0 })
  }
  for (const row of rows) {
    map.set(row._id, {
      providerUid: row._id,
      average: Math.round(row.average * 10) / 10,
      count: row.count,
    })
  }
  return map
}

export async function listProviderRatings(providerUid: string, limit = 20) {
  const ratings = await Rating.find({ providerUid }).sort({ updatedAt: -1 }).limit(limit)
  return ratings.map((r) => toRating(r))
}

export async function findMyRating(raterUid: string, providerUid: string) {
  const rating = await Rating.findOne({ raterUid, providerUid })
  return rating ? toRating(rating) : null
}

export async function listRateableProviders() {
  const services = await listActiveServices()
  const byProvider = new Map<
    string,
    { providerUid: string; providerName: string; titles: string[] }
  >()

  for (const s of services) {
    const existing = byProvider.get(s.providerUid)
    if (existing) {
      existing.titles.push(s.title)
    } else {
      byProvider.set(s.providerUid, {
        providerUid: s.providerUid,
        providerName: s.providerName,
        titles: [s.title],
      })
    }
  }

  const providers = [...byProvider.values()]
  const stats = await getStatsForProviders(providers.map((p) => p.providerUid))

  return providers.map((p) => ({
    ...p,
    average: stats.get(p.providerUid)?.average ?? 0,
    count: stats.get(p.providerUid)?.count ?? 0,
  }))
}
