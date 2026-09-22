import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import multer from 'multer'
import type { NextFunction, Request, Response } from 'express'

export const UPLOADS_ROOT = path.resolve(process.cwd(), 'uploads')
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024
export const MAX_SERVICE_PHOTOS = 8

const ALLOWED_MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
}

const ALLOWED_EXTENSIONS = new Set(Object.values(ALLOWED_MIME_TO_EXT))

export type UploadKind = 'profiles' | 'services'

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true })
}

function safeToken(value: string, fallback = 'file') {
  const cleaned = value.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64)
  return cleaned || fallback
}

function extensionFor(file: Express.Multer.File) {
  const fromMime = ALLOWED_MIME_TO_EXT[file.mimetype]
  if (fromMime) return fromMime
  const fromName = path.extname(file.originalname).toLowerCase()
  if (fromName === '.jpeg') return '.jpg'
  if (ALLOWED_EXTENSIONS.has(fromName)) return fromName
  return '.jpg'
}

function isSafeFilename(filename: string) {
  return Boolean(filename)
    && !filename.includes('..')
    && !filename.includes('/')
    && !filename.includes('\\')
    && path.basename(filename) === filename
}

/** Public URL path stored in MongoDB, e.g. `/uploads/profiles/abc.jpg`. */
export function toPublicUploadPath(kind: UploadKind, filename: string) {
  if (!isSafeFilename(filename)) throw new Error('Emri i skedarit nuk është i vlefshëm')
  return `/uploads/${kind}/${filename}`
}

/** Accept only managed `/uploads/{kind}/{filename}` paths (no traversal). */
export function normalizeUploadPath(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  const match = trimmed.match(/^\/uploads\/(profiles|services)\/([^/\\]+)$/)
  if (!match) return null
  const [, kind, filename] = match
  if (!isSafeFilename(filename)) return null
  return `/uploads/${kind}/${filename}`
}

export function sanitizeUploadPaths(values: unknown, limit = MAX_SERVICE_PHOTOS) {
  if (!Array.isArray(values)) return [] as string[]
  const paths = values
    .map((value) => normalizeUploadPath(value))
    .filter((value): value is string => Boolean(value))
  return [...new Set(paths)].slice(0, limit)
}

function absolutePathForPublicUpload(publicPath: string) {
  const normalized = normalizeUploadPath(publicPath)
  if (!normalized) return null
  const relative = normalized.replace(/^\//, '')
  const absolute = path.resolve(UPLOADS_ROOT, ...relative.split('/').slice(1))
  const rootWithSep = UPLOADS_ROOT.endsWith(path.sep) ? UPLOADS_ROOT : `${UPLOADS_ROOT}${path.sep}`
  if (absolute !== UPLOADS_ROOT && !absolute.startsWith(rootWithSep)) return null
  return absolute
}

/** Best-effort delete of a managed upload. Ignores missing/invalid paths. */
export async function deleteUpload(publicPath?: string | null) {
  const absolute = publicPath ? absolutePathForPublicUpload(publicPath) : null
  if (!absolute) return
  try {
    await fs.promises.unlink(absolute)
  } catch (err) {
    const code = err && typeof err === 'object' && 'code' in err ? (err as NodeJS.ErrnoException).code : undefined
    if (code !== 'ENOENT') {
      console.warn('Failed to delete upload:', publicPath, err)
    }
  }
}

export async function deleteUploads(publicPaths: Array<string | null | undefined>) {
  const unique = [...new Set(publicPaths.filter((value): value is string => Boolean(value)))]
  await Promise.all(unique.map((item) => deleteUpload(item)))
}

/** Delete managed paths present in `previous` but not in `next`. */
export async function deleteRemovedUploads(previous: string[] | undefined, next: string[]) {
  const keep = new Set(next)
  const removed = (previous || []).filter((item) => !keep.has(item))
  await deleteUploads(removed)
}

export function uploadErrorMessage(err: unknown, fallback = 'Ngarkimi i fotos dështoi') {
  if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
    return 'Fotoja duhet të jetë më e vogël se 2MB'
  }
  if (err instanceof Error && err.message) return err.message
  return fallback
}

type FilenameFactory = (req: Request, file: Express.Multer.File) => string

function createDiskUpload(kind: UploadKind, filename: FilenameFactory) {
  const destination = path.join(UPLOADS_ROOT, kind)
  ensureDir(destination)

  return multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => cb(null, destination),
      filename: (req, file, cb) => {
        try {
          const name = filename(req, file)
          if (!isSafeFilename(name)) throw new Error('Emri i skedarit nuk është i vlefshëm')
          cb(null, name)
        } catch (err) {
          cb(err instanceof Error ? err : new Error('Emri i skedarit nuk është i vlefshëm'), '')
        }
      },
    }),
    limits: { fileSize: MAX_IMAGE_BYTES },
    fileFilter: (_req, file, cb) => {
      if (!ALLOWED_MIME_TO_EXT[file.mimetype]) {
        cb(new Error('Ngarko vetëm foto (JPG, PNG, WEBP, GIF)'))
        return
      }
      cb(null, true)
    },
  })
}

export const profilePhotoUpload = createDiskUpload('profiles', (req, file) => {
  const uid = safeToken(req.user?.uid || 'user')
  const id = crypto.randomBytes(8).toString('hex')
  return `${uid}-${id}${extensionFor(file)}`
})

export const servicePhotoUpload = createDiskUpload('services', (req, file) => {
  const uid = safeToken(req.user?.uid || 'user')
  const id = crypto.randomBytes(8).toString('hex')
  return `${uid}-${Date.now()}-${id}${extensionFor(file)}`
})

/** Express middleware: run a single-file image upload and map multer errors to 400. */
export function withImageUpload(uploader: multer.Multer, field = 'photo') {
  return (req: Request, res: Response, next: NextFunction) => {
    uploader.single(field)(req, res, (err) => {
      if (err) {
        return res.status(400).json({ message: uploadErrorMessage(err) })
      }
      return next()
    })
  }
}

export function requireUploadedImage(req: Request, missingMessage: string) {
  if (!req.file) throw new Error(missingMessage)
  return req.file
}
