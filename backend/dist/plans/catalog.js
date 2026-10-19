"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PLAN_LIMITS = void 0;
exports.isPlanTestMode = isPlanTestMode;
exports.addDays = addDays;
exports.effectivePlan = effectivePlan;
exports.PLAN_LIMITS = {
    basicBio: 250,
    proBio: 2000,
    galleryPhotos: 10,
    videos: 1,
    specialties: 10,
    faqs: 10,
    references: 5,
    qualifications: 10,
    trialDays: 14,
    monthlyPrice: 19.9,
    yearlyPrice: 199,
};
function isPlanTestMode() {
    return process.env.NODE_ENV !== 'production' || process.env.PLAN_TEST_MODE === 'true';
}
function addDays(from, days) {
    const next = new Date(from);
    next.setUTCDate(next.getUTCDate() + days);
    return next;
}
/** Effective public plan. Expired Pro stays stored; callers must not delete profile data. */
function effectivePlan(snapshot, now = new Date()) {
    if (!snapshot || snapshot.plan !== 'pro')
        return 'basic';
    if (snapshot.status === 'trialing') {
        return snapshot.trialEndsAt && snapshot.trialEndsAt.getTime() > now.getTime() ? 'pro' : 'basic';
    }
    if (snapshot.status === 'expired')
        return 'basic';
    if (snapshot.periodEndsAt && snapshot.periodEndsAt.getTime() <= now.getTime())
        return 'basic';
    return snapshot.status === 'active' ? 'pro' : 'basic';
}
//# sourceMappingURL=catalog.js.map