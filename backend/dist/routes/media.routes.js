"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const mediaService_1 = require("../services/mediaService");
const s3Storage_1 = require("../services/s3Storage");
const router = (0, express_1.Router)();
/** Streams a private S3 object for a stored `/media/{key}` path; keys are unique, so responses are immutable. */
router.get('/*key', async (req, res) => {
    const segments = req.params.key ?? [];
    const key = (0, mediaService_1.mediaKeyFromPath)(`/media/${segments.join('/')}`);
    if (!key)
        return res.status(404).end();
    try {
        const object = await (0, s3Storage_1.getObject)(key, req.get('if-none-match') || undefined);
        res.set('Cache-Control', 'public, max-age=31536000, immutable');
        res.set('X-Content-Type-Options', 'nosniff');
        if (object.ContentType)
            res.type(object.ContentType);
        if (object.ContentLength != null)
            res.set('Content-Length', String(object.ContentLength));
        if (object.ETag)
            res.set('ETag', object.ETag);
        if (object.LastModified)
            res.set('Last-Modified', object.LastModified.toUTCString());
        const body = object.Body;
        if (!body)
            return res.status(404).end();
        body.on('error', (err) => {
            console.error('Media stream failed:', key, err);
            res.destroy(err);
        });
        body.pipe(res);
    }
    catch (err) {
        const status = (0, s3Storage_1.s3StatusCode)(err);
        if (status === 304)
            return res.status(304).end();
        if (status === 403 || status === 404)
            return res.status(404).end();
        console.error('Media fetch failed:', key, err);
        return res.status(502).end();
    }
});
exports.default = router;
//# sourceMappingURL=media.routes.js.map