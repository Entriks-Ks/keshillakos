"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.servicePhotoUpload = exports.profilePhotoUpload = exports.MAX_SERVICE_PHOTOS = exports.MAX_IMAGE_BYTES = exports.UPLOADS_ROOT = void 0;
exports.toPublicUploadPath = toPublicUploadPath;
exports.normalizeUploadPath = normalizeUploadPath;
exports.sanitizeUploadPaths = sanitizeUploadPaths;
exports.deleteUpload = deleteUpload;
exports.deleteUploads = deleteUploads;
exports.deleteRemovedUploads = deleteRemovedUploads;
exports.uploadErrorMessage = uploadErrorMessage;
exports.withImageUpload = withImageUpload;
exports.requireUploadedImage = requireUploadedImage;
const crypto_1 = __importDefault(require("crypto"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const multer_1 = __importDefault(require("multer"));
exports.UPLOADS_ROOT = path_1.default.resolve(process.cwd(), 'uploads');
exports.MAX_IMAGE_BYTES = 2 * 1024 * 1024;
exports.MAX_SERVICE_PHOTOS = 8;
const ALLOWED_MIME_TO_EXT = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif',
};
const ALLOWED_EXTENSIONS = new Set(Object.values(ALLOWED_MIME_TO_EXT));
function ensureDir(dir) {
    fs_1.default.mkdirSync(dir, { recursive: true });
}
function safeToken(value, fallback = 'file') {
    const cleaned = value.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
    return cleaned || fallback;
}
function extensionFor(file) {
    const fromMime = ALLOWED_MIME_TO_EXT[file.mimetype];
    if (fromMime)
        return fromMime;
    const fromName = path_1.default.extname(file.originalname).toLowerCase();
    if (fromName === '.jpeg')
        return '.jpg';
    if (ALLOWED_EXTENSIONS.has(fromName))
        return fromName;
    return '.jpg';
}
function isSafeFilename(filename) {
    return Boolean(filename)
        && !filename.includes('..')
        && !filename.includes('/')
        && !filename.includes('\\')
        && path_1.default.basename(filename) === filename;
}
/** Public URL path stored in MongoDB, e.g. `/uploads/profiles/abc.jpg`. */
function toPublicUploadPath(kind, filename) {
    if (!isSafeFilename(filename))
        throw new Error('Emri i skedarit nuk është i vlefshëm');
    return `/uploads/${kind}/${filename}`;
}
/** Accept only managed `/uploads/{kind}/{filename}` paths (no traversal). */
function normalizeUploadPath(value) {
    if (typeof value !== 'string')
        return null;
    const trimmed = value.trim();
    const match = trimmed.match(/^\/uploads\/(profiles|services)\/([^/\\]+)$/);
    if (!match)
        return null;
    const [, kind, filename] = match;
    if (!isSafeFilename(filename))
        return null;
    return `/uploads/${kind}/${filename}`;
}
function sanitizeUploadPaths(values, limit = exports.MAX_SERVICE_PHOTOS) {
    if (!Array.isArray(values))
        return [];
    const paths = values
        .map((value) => normalizeUploadPath(value))
        .filter((value) => Boolean(value));
    return [...new Set(paths)].slice(0, limit);
}
function absolutePathForPublicUpload(publicPath) {
    const normalized = normalizeUploadPath(publicPath);
    if (!normalized)
        return null;
    const relative = normalized.replace(/^\//, '');
    const absolute = path_1.default.resolve(exports.UPLOADS_ROOT, ...relative.split('/').slice(1));
    const rootWithSep = exports.UPLOADS_ROOT.endsWith(path_1.default.sep) ? exports.UPLOADS_ROOT : `${exports.UPLOADS_ROOT}${path_1.default.sep}`;
    if (absolute !== exports.UPLOADS_ROOT && !absolute.startsWith(rootWithSep))
        return null;
    return absolute;
}
/** Best-effort delete of a managed upload. Ignores missing/invalid paths. */
async function deleteUpload(publicPath) {
    const absolute = publicPath ? absolutePathForPublicUpload(publicPath) : null;
    if (!absolute)
        return;
    try {
        await fs_1.default.promises.unlink(absolute);
    }
    catch (err) {
        const code = err && typeof err === 'object' && 'code' in err ? err.code : undefined;
        if (code !== 'ENOENT') {
            console.warn('Failed to delete upload:', publicPath, err);
        }
    }
}
async function deleteUploads(publicPaths) {
    const unique = [...new Set(publicPaths.filter((value) => Boolean(value)))];
    await Promise.all(unique.map((item) => deleteUpload(item)));
}
/** Delete managed paths present in `previous` but not in `next`. */
async function deleteRemovedUploads(previous, next) {
    const keep = new Set(next);
    const removed = (previous || []).filter((item) => !keep.has(item));
    await deleteUploads(removed);
}
function uploadErrorMessage(err, fallback = 'Ngarkimi i fotos dështoi') {
    if (err instanceof multer_1.default.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return 'Fotoja duhet të jetë më e vogël se 2MB';
    }
    if (err instanceof Error && err.message)
        return err.message;
    return fallback;
}
function createDiskUpload(kind, filename) {
    const destination = path_1.default.join(exports.UPLOADS_ROOT, kind);
    ensureDir(destination);
    return (0, multer_1.default)({
        storage: multer_1.default.diskStorage({
            destination: (_req, _file, cb) => cb(null, destination),
            filename: (req, file, cb) => {
                try {
                    const name = filename(req, file);
                    if (!isSafeFilename(name))
                        throw new Error('Emri i skedarit nuk është i vlefshëm');
                    cb(null, name);
                }
                catch (err) {
                    cb(err instanceof Error ? err : new Error('Emri i skedarit nuk është i vlefshëm'), '');
                }
            },
        }),
        limits: { fileSize: exports.MAX_IMAGE_BYTES },
        fileFilter: (_req, file, cb) => {
            if (!ALLOWED_MIME_TO_EXT[file.mimetype]) {
                cb(new Error('Ngarko vetëm foto (JPG, PNG, WEBP, GIF)'));
                return;
            }
            cb(null, true);
        },
    });
}
exports.profilePhotoUpload = createDiskUpload('profiles', (req, file) => {
    const uid = safeToken(req.user?.uid || 'user');
    const id = crypto_1.default.randomBytes(8).toString('hex');
    return `${uid}-${id}${extensionFor(file)}`;
});
exports.servicePhotoUpload = createDiskUpload('services', (req, file) => {
    const uid = safeToken(req.user?.uid || 'user');
    const id = crypto_1.default.randomBytes(8).toString('hex');
    return `${uid}-${Date.now()}-${id}${extensionFor(file)}`;
});
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
function requireUploadedImage(req, missingMessage) {
    if (!req.file)
        throw new Error(missingMessage);
    return req.file;
}
//# sourceMappingURL=mediaService.js.map