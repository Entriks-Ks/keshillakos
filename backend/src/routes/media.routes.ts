import { Router } from 'express'
import type { Readable } from 'stream'
import { mediaKeyFromPath } from '../services/mediaService'
import { getObject, s3StatusCode } from '../services/s3Storage'

const router = Router()

/** Streams a private S3 object for a stored `/media/{key}` path; keys are unique, so responses are immutable. */
router.get('/*key', async (req, res) => {
  const segments = (req.params as { key?: string[] }).key ?? []
  const key = mediaKeyFromPath(`/media/${segments.join('/')}`)
  if (!key) return res.status(404).end()

  try {
    const object = await getObject(key, req.get('if-none-match') || undefined)
    res.set('Cache-Control', 'public, max-age=31536000, immutable')
    res.set('X-Content-Type-Options', 'nosniff')
    if (object.ContentType) res.type(object.ContentType)
    if (object.ContentLength != null) res.set('Content-Length', String(object.ContentLength))
    if (object.ETag) res.set('ETag', object.ETag)
    if (object.LastModified) res.set('Last-Modified', object.LastModified.toUTCString())
    const body = object.Body as Readable | undefined
    if (!body) return res.status(404).end()
    body.on('error', (err) => {
      console.error('Media stream failed:', key, err)
      res.destroy(err)
    })
    body.pipe(res)
  } catch (err) {
    const status = s3StatusCode(err)
    if (status === 304) return res.status(304).end()
    if (status === 403 || status === 404) return res.status(404).end()
    console.error('Media fetch failed:', key, err)
    return res.status(502).end()
  }
})

export default router
