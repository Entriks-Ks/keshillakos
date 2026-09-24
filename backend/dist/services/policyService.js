"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_POLICY_RULES = void 0;
exports.resolvePolicySnapshot = resolvePolicySnapshot;
exports.resolvePolicyRules = resolvePolicyRules;
const Category_1 = require("../models/Category");
const Policy_1 = require("../models/Policy");
// Secure baseline for portals that have not yet published a versioned policy.
exports.DEFAULT_POLICY_RULES = {
    privacy: { requireConsent: true, reviewerDisplay: 'anonymous', contactDisclosure: 'after_interaction' },
    sensitiveData: { publicRedactions: ['licenseNumber'], prohibitFreeTextSecrets: true, exportRequiresApproval: true },
    providerVerification: { requiredChecks: [], requireBusinessVerification: false },
    reviewEligibility: { completedDelivery: true, completedAppointment: true },
    // Fallback when no published Policy exists: completed jobs go live so the rating
    // appears on the public profile, service page, and provider dashboard.
    moderation: { reviewRequiresApproval: false, abuseBlocksPublication: true, responseRequiresApproval: false },
    retention: { legalHold: false },
    categoryRequirements: { requiredProviderFields: [], requiredOfferExtensions: [], allowedModes: ['online', 'on_site'] },
};
async function resolvePolicySnapshot(portal, categoryId) {
    const now = new Date();
    let key = 'platform';
    if (categoryId) {
        const category = await Category_1.Category.findById(categoryId).select('portal configRefs.policy').lean();
        if (!category || category.portal !== portal)
            throw new Error('Policy category does not belong to portal');
        key = category.configRefs?.policy || key;
    }
    const effective = { status: 'active', $and: [
            { $or: [{ effectiveFrom: { $exists: false } }, { effectiveFrom: { $lte: now } }] },
            { $or: [{ effectiveUntil: { $exists: false } }, { effectiveUntil: { $gt: now } }] },
        ] };
    const specific = categoryId ? await Policy_1.Policy.findOne({ portal, key, category: categoryId, ...effective }).sort({ version: -1 }) : null;
    if (specific)
        return { rules: specific.rules, policyId: specific._id, version: specific.version };
    const global = await Policy_1.Policy.findOne({ portal, key, category: null, ...effective }).sort({ version: -1 });
    if (global)
        return { rules: global.rules, policyId: global._id, version: global.version };
    if (key !== 'platform') {
        const fallback = await Policy_1.Policy.findOne({ portal, key: 'platform', category: null, ...effective }).sort({ version: -1 });
        if (fallback)
            return { rules: fallback.rules, policyId: fallback._id, version: fallback.version };
    }
    return { rules: exports.DEFAULT_POLICY_RULES, policyId: undefined, version: undefined };
}
async function resolvePolicyRules(portal, categoryId) {
    return (await resolvePolicySnapshot(portal, categoryId)).rules;
}
//# sourceMappingURL=policyService.js.map