import 'dotenv/config'
import fs from 'fs'
import path from 'path'
import mongoose from 'mongoose'
import { connectDB } from '../config/db'
import { Business } from '../models/Business'
import { ProviderProfile } from '../models/ProviderProfile'
import { Service } from '../models/Service'
import { ServiceOffer } from '../models/ServiceOffer'
import { User } from '../models/User'
import type { UploadKind } from '../services/mediaService'
import { putObject } from '../services/s3Storage'

/**
 * Moves legacy `/uploads/...` records to S3 (`/media/{key}`).
 * Dry run by default; pass `--apply` to upload and rewrite MongoDB.
 * Files are read from LEGACY_UPLOADS_DIR (default `backend/uploads`).
 */
const apply = process.argv.includes('--apply')
const legacyRoot = path.resolve(process.env.LEGACY_UPLOADS_DIR || path.join(process.cwd(), 'uploads'))
const LEGACY_PREFIX = '/uploads/'

const MIME_BY_EXT: Record<string, { mime: string; ext: string }> = {
  '.jpg': { mime: 'image/jpeg', ext: '.jpg' },
  '.jpeg': { mime: 'image/jpeg', ext: '.jpg' },
  '.png': { mime: 'image/png', ext: '.png' },
  '.webp': { mime: 'image/webp', ext: '.webp' },
  '.gif': { mime: 'image/gif', ext: '.gif' },
  '.pdf': { mime: 'application/pdf', ext: '.pdf' },
}

function safeToken(value: string, fallback: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64) || fallback
}

async function main() {
  await connectDB()
  const owners = new Map<string, { kind: UploadKind; owner: string }>()
  const note = (value: unknown, kind: UploadKind, owner: string) => {
    if (typeof value === 'string' && value.startsWith(LEGACY_PREFIX) && !owners.has(value)) owners.set(value, { kind, owner })
  }
  const legacy = { $regex: '^/uploads/' }

  for (const user of await User.find({ profilePhoto: legacy }).select('uid profilePhoto').lean()) {
    note(user.profilePhoto, 'profiles', user.uid || String(user._id))
  }
  for (const business of await Business.find({ $or: [{ logoUrl: legacy }, { coverUrl: legacy }] }).select('logoUrl coverUrl').lean()) {
    note(business.logoUrl, 'companies', String(business._id))
    note(business.coverUrl, 'companies', String(business._id))
  }
  for (const profile of await ProviderProfile.find({ $or: [{ 'publicProfile.photoUrl': legacy }, { 'publicProfile.coverUrl': legacy }] }).select('publicProfile').lean()) {
    note(profile.publicProfile?.photoUrl, 'providers', String(profile._id))
    note(profile.publicProfile?.coverUrl, 'providers', String(profile._id))
  }
  for (const offer of await ServiceOffer.find({ photos: legacy }).select('photos').lean()) {
    for (const photo of offer.photos ?? []) note(photo, 'services', String(offer._id))
  }
  for (const service of await Service.find({ 'details.photos': legacy }).select('details.photos').lean()) {
    for (const photo of service.details?.photos ?? []) note(photo, 'services', String(service._id))
  }

  const moved = new Map<string, string>()
  const missing: string[] = []
  for (const [legacyPath, { kind, owner }] of owners) {
    const relative = legacyPath.slice(LEGACY_PREFIX.length)
    const file = path.resolve(legacyRoot, relative)
    const type = MIME_BY_EXT[path.extname(file).toLowerCase()]
    if (!file.startsWith(`${legacyRoot}${path.sep}`) || !type || !fs.existsSync(file)) {
      missing.push(legacyPath)
      continue
    }
    const base = safeToken(path.basename(file, path.extname(file)), 'file')
    const key = `${kind}/${safeToken(owner, 'unknown')}/legacy-${base}${type.ext}`
    if (apply) await putObject(key, fs.readFileSync(file), type.mime)
    moved.set(legacyPath, `/media/${key}`)
    console.log(`${apply ? 'uploaded' : 'would upload'} ${legacyPath} -> /media/${key}`)
  }

  if (apply) {
    for (const [from, to] of moved) {
      await Promise.all([
        User.updateMany({ profilePhoto: from }, { $set: { profilePhoto: to } }),
        ProviderProfile.updateMany({ 'publicProfile.photoUrl': from }, { $set: { 'publicProfile.photoUrl': to } }),
        ProviderProfile.updateMany({ 'publicProfile.coverUrl': from }, { $set: { 'publicProfile.coverUrl': to } }),
        Business.updateMany({ logoUrl: from }, { $set: { logoUrl: to } }),
        Business.updateMany({ coverUrl: from }, { $set: { coverUrl: to } }),
        ServiceOffer.updateMany({ photos: from }, { $set: { 'photos.$[photo]': to } }, { arrayFilters: [{ photo: from }] }),
        Service.updateMany({ 'details.photos': from }, { $set: { 'details.photos.$[photo]': to } }, { arrayFilters: [{ photo: from }] }),
      ])
    }
  }

  console.log(`\n${owners.size} legacy paths, ${moved.size} ${apply ? 'migrated' : 'migratable'}, ${missing.length} missing locally`)
  for (const item of missing) console.log(`missing: ${item}`)
  if (!apply) console.log('\nDry run only. Re-run with --apply to upload to S3 and update MongoDB.')
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(() => mongoose.disconnect())
