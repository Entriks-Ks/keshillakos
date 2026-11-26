"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const mongoose_1 = __importDefault(require("mongoose"));
const db_1 = require("../config/db");
const ProviderProfile_1 = require("../models/ProviderProfile");
const ServiceOffer_1 = require("../models/ServiceOffer");
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
const apply = process.argv.includes('--apply');
async function main() {
    await (0, db_1.connectDB)();
    const pending = await ProviderProfile_1.ProviderProfile.find({ status: 'pending', 'moderation.status': 'pending' }).select('_id').lean();
    const ids = await ServiceOffer_1.ServiceOffer.distinct('providerProfile', {
        providerProfile: { $in: pending.map((profile) => profile._id) },
        status: 'published',
        visibility: 'public',
        'moderation.status': 'approved',
    });
    console.log(`${pending.length} pending profile(s); ${ids.length} still own published services:`);
    for (const id of ids)
        console.log(`  ${String(id)}`);
    if (!apply) {
        console.log('Dry run. Re-run with --apply to publish them again.');
        return;
    }
    const result = await ProviderProfile_1.ProviderProfile.updateMany({ _id: { $in: ids }, status: 'pending', 'moderation.status': 'pending' }, { $set: { status: 'published', moderation: { status: 'approved', reviewedAt: new Date() } } });
    console.log(`Published ${result.modifiedCount} profile(s).`);
}
main()
    .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
})
    .finally(() => mongoose_1.default.disconnect());
//# sourceMappingURL=republishEditedProfiles.js.map