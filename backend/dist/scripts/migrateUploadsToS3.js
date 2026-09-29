"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const mongoose_1 = __importDefault(require("mongoose"));
const db_1 = require("../config/db");
const Business_1 = require("../models/Business");
const ProviderProfile_1 = require("../models/ProviderProfile");
const Service_1 = require("../models/Service");
const ServiceOffer_1 = require("../models/ServiceOffer");
const User_1 = require("../models/User");
const s3Storage_1 = require("../services/s3Storage");
/**
 * Moves legacy `/uploads/...` records to S3 (`/media/{key}`).
 * Dry run by default; pass `--apply` to upload and rewrite MongoDB.
 * Files are read from LEGACY_UPLOADS_DIR (default `backend/uploads`).
 */
const apply = process.argv.includes('--apply');
const legacyRoot = path_1.default.resolve(process.env.LEGACY_UPLOADS_DIR || path_1.default.join(process.cwd(), 'uploads'));
const LEGACY_PREFIX = '/uploads/';
const MIME_BY_EXT = {
    '.jpg': { mime: 'image/jpeg', ext: '.jpg' },
    '.jpeg': { mime: 'image/jpeg', ext: '.jpg' },
    '.png': { mime: 'image/png', ext: '.png' },
    '.webp': { mime: 'image/webp', ext: '.webp' },
    '.gif': { mime: 'image/gif', ext: '.gif' },
    '.pdf': { mime: 'application/pdf', ext: '.pdf' },
};
function safeToken(value, fallback) {
    return value.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64) || fallback;
}
async function main() {
    await (0, db_1.connectDB)();
    const owners = new Map();
    const note = (value, kind, owner) => {
        if (typeof value === 'string' && value.startsWith(LEGACY_PREFIX) && !owners.has(value))
            owners.set(value, { kind, owner });
    };
    const legacy = { $regex: '^/uploads/' };
    for (const user of await User_1.User.find({ profilePhoto: legacy }).select('uid profilePhoto').lean()) {
        note(user.profilePhoto, 'profiles', user.uid || String(user._id));
    }
    for (const business of await Business_1.Business.find({ $or: [{ logoUrl: legacy }, { coverUrl: legacy }] }).select('logoUrl coverUrl').lean()) {
        note(business.logoUrl, 'companies', String(business._id));
        note(business.coverUrl, 'companies', String(business._id));
    }
    for (const profile of await ProviderProfile_1.ProviderProfile.find({ $or: [{ 'publicProfile.photoUrl': legacy }, { 'publicProfile.coverUrl': legacy }] }).select('publicProfile').lean()) {
        note(profile.publicProfile?.photoUrl, 'providers', String(profile._id));
        note(profile.publicProfile?.coverUrl, 'providers', String(profile._id));
    }
    for (const offer of await ServiceOffer_1.ServiceOffer.find({ photos: legacy }).select('photos').lean()) {
        for (const photo of offer.photos ?? [])
            note(photo, 'services', String(offer._id));
    }
    for (const service of await Service_1.Service.find({ 'details.photos': legacy }).select('details.photos').lean()) {
        for (const photo of service.details?.photos ?? [])
            note(photo, 'services', String(service._id));
    }
    const moved = new Map();
    const missing = [];
    for (const [legacyPath, { kind, owner }] of owners) {
        const relative = legacyPath.slice(LEGACY_PREFIX.length);
        const file = path_1.default.resolve(legacyRoot, relative);
        const type = MIME_BY_EXT[path_1.default.extname(file).toLowerCase()];
        if (!file.startsWith(`${legacyRoot}${path_1.default.sep}`) || !type || !fs_1.default.existsSync(file)) {
            missing.push(legacyPath);
            continue;
        }
        const base = safeToken(path_1.default.basename(file, path_1.default.extname(file)), 'file');
        const key = `${kind}/${safeToken(owner, 'unknown')}/legacy-${base}${type.ext}`;
        if (apply)
            await (0, s3Storage_1.putObject)(key, fs_1.default.readFileSync(file), type.mime);
        moved.set(legacyPath, `/media/${key}`);
        console.log(`${apply ? 'uploaded' : 'would upload'} ${legacyPath} -> /media/${key}`);
    }
    if (apply) {
        for (const [from, to] of moved) {
            await Promise.all([
                User_1.User.updateMany({ profilePhoto: from }, { $set: { profilePhoto: to } }),
                ProviderProfile_1.ProviderProfile.updateMany({ 'publicProfile.photoUrl': from }, { $set: { 'publicProfile.photoUrl': to } }),
                ProviderProfile_1.ProviderProfile.updateMany({ 'publicProfile.coverUrl': from }, { $set: { 'publicProfile.coverUrl': to } }),
                Business_1.Business.updateMany({ logoUrl: from }, { $set: { logoUrl: to } }),
                Business_1.Business.updateMany({ coverUrl: from }, { $set: { coverUrl: to } }),
                ServiceOffer_1.ServiceOffer.updateMany({ photos: from }, { $set: { 'photos.$[photo]': to } }, { arrayFilters: [{ photo: from }] }),
                Service_1.Service.updateMany({ 'details.photos': from }, { $set: { 'details.photos.$[photo]': to } }, { arrayFilters: [{ photo: from }] }),
            ]);
        }
    }
    console.log(`\n${owners.size} legacy paths, ${moved.size} ${apply ? 'migrated' : 'migratable'}, ${missing.length} missing locally`);
    for (const item of missing)
        console.log(`missing: ${item}`);
    if (!apply)
        console.log('\nDry run only. Re-run with --apply to upload to S3 and update MongoDB.');
}
main()
    .catch((err) => {
    console.error(err);
    process.exitCode = 1;
})
    .finally(() => mongoose_1.default.disconnect());
//# sourceMappingURL=migrateUploadsToS3.js.map