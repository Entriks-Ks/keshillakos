import 'dotenv/config'
import mongoose from 'mongoose'
import { connectDB } from '../config/db'
import { ProviderProfile } from '../models/ProviderProfile'
import { ServiceOffer } from '../models/ServiceOffer'

/**
 * One-off repair for profiles that the old edit rule sent back to review.
 *
 * Saving an expert profile used to set it to `pending`, which hid every service under it from the public (detail
 * pages answered "not found") while the dashboard still listed those services as active. Edits no longer do that.
 * This restores profiles left `pending` that still own published, approved, public services: they were published
 * when those services went live. Suspended, rejected and draft profiles are not touched.
 *
 * Dry run by default; pass `--apply` to write.
 */
const apply = process.argv.includes('--apply')

async function main() {
  await connectDB()
  const pending = await ProviderProfile.find({ status: 'pending', 'moderation.status': 'pending' }).select('_id').lean()
  const ids: mongoose.Types.ObjectId[] = await ServiceOffer.distinct('providerProfile', {
    providerProfile: { $in: pending.map((profile) => profile._id) },
    status: 'published',
    visibility: 'public',
    'moderation.status': 'approved',
  })
  console.log(`${pending.length} pending profile(s); ${ids.length} still own published services:`)
  for (const id of ids) console.log(`  ${String(id)}`)
  if (!apply) {
    console.log('Dry run. Re-run with --apply to publish them again.')
    return
  }
  const result = await ProviderProfile.updateMany(
    { _id: { $in: ids }, status: 'pending', 'moderation.status': 'pending' },
    { $set: { status: 'published', moderation: { status: 'approved', reviewedAt: new Date() } } },
  )
  console.log(`Published ${result.modifiedCount} profile(s).`)
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err)
    process.exitCode = 1
  })
  .finally(() => mongoose.disconnect())
