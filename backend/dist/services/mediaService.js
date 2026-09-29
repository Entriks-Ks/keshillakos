"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.certificationDocumentUpload = exports.imageUpload = exports.MAX_SERVICE_PHOTOS = exports.MAX_DOCUMENT_BYTES = exports.MAX_IMAGE_BYTES = void 0;
exports.mediaKeyFromPath = mediaKeyFromPath;
exports.normalizeUploadPath = normalizeUploadPath;
exports.sanitizeUploadPaths = sanitizeUploadPaths;
exports.deleteUploads = deleteUploads;
exports.deleteUpload = deleteUpload;
exports.deleteRemovedUploads = deleteRemovedUploads;
exports.uploadErrorMessage = uploadErrorMessage;
exports.withImageUpload = withImageUpload;
exports.withDocumentUpload = withDocumentUpload;
exports.storeUploadedFile = storeUploadedFile;
const crypto_1 = __importDefault(require("crypto"));
const multer_1 = __importDefault(require("multer"));
const Business_1 = require("../models/Business");
const ProviderProfile_1 = require("../models/ProviderProfile");
const Service_1 = require("../models/Service");
const ServiceOffer_1 = require("../models/ServiceOffer");
const User_1 = require("../models/User");
const s3Storage_1 = require("./s3Storage");
exports.MAX_IMAGE_BYTES = 2 * 1024 * 1024;
exports.MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;
exports.MAX_SERVICE_PHOTOS = 8;
const ALLOWED_MIME_TO_EXT = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif',
};
const ALLOWED_DOCUMENT_MIME_TO_EXT = {
    ...ALLOWED_MIME_TO_EXT,
    'application/pdf': '.pdf',
};
const MEDIA_PATH = /^\/media\/((?:profiles|providers|companies|services|documents)\/[A-Za-z0-9_-]{1,64}\/[A-Za-z0-9_-]{1,160}\.(?:jpg|png|webp|gif|pdf))$/;
/** Pre-S3 records; still accepted so existing profiles can be saved until they are migrated. */
const LEGACY_UPLOAD_PATH = /^\/uploads\/(?:profiles|services|documents)\/[A-Za-z0-9_.-]{1,160}$/;
function safeToken(value, fallback = 'file') {
    const cleaned = value.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
    return cleaned || fallback;
}
/** Detects the real file type from its signature instead of trusting the client-sent mimetype. */
function sniffMime(buffer) {
    if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff)
        return 'image/jpeg';
    if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
        return 'image/png';
    if (buffer.length >= 6 && ['GIF87a', 'GIF89a'].includes(buffer.subarray(0, 6).toString('ascii')))
        return 'image/gif';
    if (buffer.length >= 12 && buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP')
        return 'image/webp';
    if (buffer.length >= 5 && buffer.subarray(0, 5).toString('ascii') === '%PDF-')
        return 'application/pdf';
    return null;
}
/** S3 object key for a stored `/media/{key}` path, or null for anything unmanaged. */
function mediaKeyFromPath(value) {
    if (typeof value !== 'string')
        return null;
    const match = value.trim().match(MEDIA_PATH);
    return match ? match[1] : null;
}
/** Accept only managed `/media/{key}` paths (plus legacy `/uploads/...` records). */
function normalizeUploadPath(value) {
    if (typeof value !== 'string')
        return null;
    const trimmed = value.trim();
    if (MEDIA_PATH.test(trimmed) || LEGACY_UPLOAD_PATH.test(trimmed))
        return trimmed;
    return null;
}
function sanitizeUploadPaths(values, limit = exports.MAX_SERVICE_PHOTOS) {
    if (!Array.isArray(values))
        return [];
    const paths = values
        .map((value) => normalizeUploadPath(value))
        .filter((value) => Boolean(value));
    return [...new Set(paths)].slice(0, limit);
}
async function isUploadReferenced(publicPath) {
    const [user, provider, business, offer, service] = await Promise.all([
        User_1.User.exists({ profilePhoto: publicPath }),
        ProviderProfile_1.ProviderProfile.exists({ $or: [{ 'publicProfile.photoUrl': publicPath }, { 'publicProfile.coverUrl': publicPath }] }),
        Business_1.Business.exists({ $or: [{ logoUrl: publicPath }, { coverUrl: publicPath }] }),
        ServiceOffer_1.ServiceOffer.exists({ photos: publicPath }),
        Service_1.Service.exists({ 'details.photos': publicPath }),
    ]);
    return Boolean(user || provider || business || offer || service);
}
/**
 * Deletes managed S3 objects that no MongoDB document references any more.
 * Call after the owning document is saved; one object can be shared (e.g. user photo mirrored to the provider profile).
 */
async function deleteUploads(publicPaths) {
    const unique = [...new Set(publicPaths.filter((value) => Boolean(value)))];
    await Promise.all(unique.map(async (publicPath) => {
        const key = mediaKeyFromPath(publicPath);
        if (!key)
            return;
        try {
            if (await isUploadReferenced(publicPath))
                return;
            await (0, s3Storage_1.deleteObject)(key);
        }
        catch (err) {
            console.warn('Failed to delete upload:', publicPath, err);
        }
    }));
}
async function deleteUpload(publicPath) {
    await deleteUploads([publicPath]);
}
/** Delete managed paths present in `previous` but not in `next` (after saving `next`). */
async function deleteRemovedUploads(previous, next) {
    const keep = new Set(next);
    await deleteUploads((previous || []).filter((item) => !keep.has(item)));
}
function uploadErrorMessage(err, fallback = 'Ngarkimi i fotos dështoi') {
    if (err instanceof multer_1.default.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return fallback.includes('dokument')
            ? 'Dokumenti duhet të jetë më i vogël se 5MB'
            : 'Fotoja duhet të jetë më e vogël se 2MB';
    }
    if (err instanceof Error && err.message)
        return err.message;
    return fallback;
}
function createMemoryUpload(options) {
    const documents = Boolean(options?.documents);
    const mimeMap = documents ? ALLOWED_DOCUMENT_MIME_TO_EXT : ALLOWED_MIME_TO_EXT;
    return (0, multer_1.default)({
        storage: multer_1.default.memoryStorage(),
        limits: { fileSize: options?.maxBytes ?? exports.MAX_IMAGE_BYTES, files: 1 },
        fileFilter: (_req, file, cb) => {
            if (!mimeMap[file.mimetype]) {
                cb(new Error(documents
                    ? 'Ngarko vetëm PDF ose foto (JPG, PNG, WEBP, GIF)'
                    : 'Ngarko vetëm foto (JPG, PNG, WEBP, GIF)'));
                return;
            }
            cb(null, true);
        },
    });
}
exports.imageUpload = createMemoryUpload();
exports.certificationDocumentUpload = createMemoryUpload({ maxBytes: exports.MAX_DOCUMENT_BYTES, documents: true });
/** Express middleware: run a single-file image upload and map multer errors to 400. */
function withImageUpload(uploader, field = 'photo') {
    return (req, res, next) => {
        uploader.single(field)(req, res, (err) => {
            if (err) {
                return res.status(400).json({ message: uploadErrorMessage(err) });
            }
            return next();
        });
    };
}
function withDocumentUpload(uploader, field = 'document') {
    return (req, res, next) => {
        uploader.single(field)(req, res, (err) => {
            if (err) {
                return res.status(400).json({ message: uploadErrorMessage(err, 'Ngarkimi i dokumentit dështoi') });
            }
            return next();
        });
    };
}
/**
 * Validates the uploaded file, stores it in S3 under `{kind}/{ownerId}/{label-}{time}-{random}.{ext}`
 * and returns the `/media/{key}` path to persist in MongoDB.
 */
async function storeUploadedFile(req, kind, ownerId, missingMessage, options) {
    const file = req.file;
    if (!file?.buffer?.length)
        throw new Error(missingMessage);
    const mimeMap = options?.documents ? ALLOWED_DOCUMENT_MIME_TO_EXT : ALLOWED_MIME_TO_EXT;
    const mime = sniffMime(file.buffer);
    const ext = mime ? mimeMap[mime] : undefined;
    if (!mime || !ext) {
        throw new Error(options?.documents
            ? 'Ngarko vetëm PDF ose foto (JPG, PNG, WEBP, GIF)'
            : 'Ngarko vetëm foto (JPG, PNG, WEBP, GIF)');
    }
    const label = options?.label ? `${safeToken(options.label)}-` : '';
    const key = `${kind}/${safeToken(ownerId, 'unknown')}/${label}${Date.now()}-${crypto_1.default.randomBytes(8).toString('hex')}${ext}`;
    try {
        await (0, s3Storage_1.putObject)(key, file.buffer, mime);
    }
    catch (err) {
        console.error('S3 upload failed:', key, err);
        throw new Error('Ngarkimi dështoi. Provo sërish pas pak.');
    }
    return `/media/${key}`;
}
//# sourceMappingURL=mediaService.js.map