import type { RequestHandler } from 'express'

/** Only these GET endpoints return the same public content for every account. */
export const publicCache: RequestHandler = (req, res, next) => {
  if (req.method !== 'GET') return next()
  const configuration = /^\/api\/v1\/(categories|subcategories|countries|cities|catalog-options)(\/|$)/.test(req.path)
  const marketplace = /^\/api\/(services|providers)\/?$/.test(req.path)
  if (!configuration && !marketplace) return next()
  const json = res.json
  res.json = function (body) {
    // Errors must never inherit the public success response's cache policy.
    this.set('Cache-Control', this.statusCode === 200
      ? configuration ? 'public, max-age=300, must-revalidate' : 'public, max-age=0, must-revalidate'
      : 'no-store')
    return json.call(this, body)
  }
  next()
}
