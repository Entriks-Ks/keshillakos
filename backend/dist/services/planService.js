"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlanError = void 0;
exports.getPlan = getPlan;
exports.isPro = isPro;
exports.assertPro = assertPro;
exports.choosePlan = choosePlan;
exports.liveProUids = liveProUids;
exports.proOwnerIds = proOwnerIds;
exports.recordPlanEvent = recordPlanEvent;
exports.clampBio = clampBio;
const Subscription_1 = require("../models/Subscription");
const User_1 = require("../models/User");
const catalog_1 = require("../plans/catalog");
class PlanError extends Error {
    constructor(message, status = 402) {
        super(message);
        this.status = status;
    }
}
exports.PlanError = PlanError;
const emptyStats = { visits: 0, contacts: 0, requests: 0, clicks: 0 };
function view(doc, audience) {
    const now = new Date();
    const plan = (0, catalog_1.effectivePlan)(doc, now);
    return {
        audience,
        plan,
        storedPlan: doc?.plan ?? 'basic',
        interval: doc?.interval ?? null,
        status: doc?.status ?? 'active',
        trialEndsAt: doc?.trialEndsAt ?? null,
        periodEndsAt: doc?.periodEndsAt ?? null,
        trialAvailable: !doc?.trialUsed,
        testMode: (0, catalog_1.isPlanTestMode)(),
        stats: plan === 'pro' ? (doc?.stats ?? emptyStats) : null,
        limits: plan === 'pro'
            ? { bio: catalog_1.PLAN_LIMITS.proBio, photos: catalog_1.PLAN_LIMITS.galleryPhotos, videos: catalog_1.PLAN_LIMITS.videos, specialties: catalog_1.PLAN_LIMITS.specialties, faqs: catalog_1.PLAN_LIMITS.faqs, references: catalog_1.PLAN_LIMITS.references, qualifications: catalog_1.PLAN_LIMITS.qualifications }
            : { bio: catalog_1.PLAN_LIMITS.basicBio, photos: 0, videos: 0, specialties: 0, faqs: 0, references: 0, qualifications: 0 },
    };
}
async function load(ownerUid, audience) {
    const doc = await Subscription_1.Subscription.findOne({ ownerUid, audience });
    if (!doc)
        return null;
    const now = new Date();
    let dirty = false;
    if (doc.status === 'trialing' && doc.trialEndsAt && doc.trialEndsAt.getTime() <= now.getTime()) {
        doc.status = 'expired';
        dirty = true;
    }
    if (doc.plan === 'pro' && doc.status === 'active' && doc.periodEndsAt && doc.periodEndsAt.getTime() <= now.getTime()) {
        doc.status = 'expired';
        dirty = true;
    }
    if (dirty)
        await doc.save();
    return doc;
}
async function getPlan(ownerUid, audience) {
    return view(await load(ownerUid, audience), audience);
}
async function isPro(ownerUid, audience) {
    return (await getPlan(ownerUid, audience)).plan === 'pro';
}
async function assertPro(ownerUid, audience) {
    if (!(await isPro(ownerUid, audience))) {
        throw new PlanError('Kjo kërkon planin Pro. Zgjidh Pro mujor, Pro vjetor, ose provën 14-ditore.');
    }
}
async function choosePlan(ownerUid, audience, choice) {
    const current = (await load(ownerUid, audience)) ?? new Subscription_1.Subscription({ ownerUid, audience, plan: 'basic', status: 'active', trialUsed: false, stats: emptyStats });
    const now = new Date();
    if (choice === 'basic') {
        current.plan = 'basic';
        current.interval = undefined;
        current.status = 'active';
        current.trialEndsAt = undefined;
        current.periodEndsAt = undefined;
        await current.save();
        return view(current, audience);
    }
    if (choice === 'trial') {
        if (current.trialUsed)
            throw new PlanError('Prova 14-ditore është përdorur një herë.', 409);
        current.plan = 'pro';
        current.interval = undefined;
        current.status = 'trialing';
        current.trialUsed = true;
        current.trialEndsAt = (0, catalog_1.addDays)(now, catalog_1.PLAN_LIMITS.trialDays);
        current.periodEndsAt = undefined;
        await current.save();
        return view(current, audience);
    }
    if (!(0, catalog_1.isPlanTestMode)()) {
        throw new PlanError('Pagesa nuk është e lidhur. Në development, TEST MODE aktivizon planin pa pagesë.');
    }
    current.plan = 'pro';
    current.interval = choice === 'yearly' ? 'yearly' : 'monthly';
    current.status = 'active';
    current.trialEndsAt = undefined;
    current.periodEndsAt = (0, catalog_1.addDays)(now, choice === 'yearly' ? 365 : 30);
    await current.save();
    return view(current, audience);
}
async function liveProUids() {
    const docs = await Subscription_1.Subscription.find({ plan: 'pro', status: { $in: ['active', 'trialing'] } }).select('ownerUid audience trialEndsAt periodEndsAt status plan interval').lean();
    const now = new Date();
    const live = docs.filter((doc) => (0, catalog_1.effectivePlan)(doc, now) === 'pro');
    return {
        providers: new Set(live.filter((doc) => doc.audience === 'provider').map((doc) => doc.ownerUid)),
        companies: new Set(live.filter((doc) => doc.audience === 'company').map((doc) => doc.ownerUid)),
    };
}
async function proOwnerIds() {
    const sets = await liveProUids();
    const live = [
        ...[...sets.providers].map((ownerUid) => ({ ownerUid, audience: 'provider' })),
        ...[...sets.companies].map((ownerUid) => ({ ownerUid, audience: 'company' })),
    ];
    if (live.length === 0)
        return { providers: [], companies: [] };
    const users = await User_1.User.find({ uid: { $in: live.map((doc) => doc.ownerUid) } }).select('_id uid').lean();
    const idByUid = new Map(users.map((user) => [user.uid, user._id]));
    const providers = [];
    const companies = [];
    for (const doc of live) {
        const id = idByUid.get(doc.ownerUid);
        if (!id)
            continue;
        if (doc.audience === 'company')
            companies.push(id);
        else
            providers.push(id);
    }
    return { providers, companies };
}
async function recordPlanEvent(ownerUid, audience, kind) {
    if (!(await isPro(ownerUid, audience)))
        return;
    await Subscription_1.Subscription.updateOne({ ownerUid, audience }, { $inc: { [`stats.${kind}`]: 1 } });
}
function clampBio(text, pro) {
    const max = pro ? catalog_1.PLAN_LIMITS.proBio : catalog_1.PLAN_LIMITS.basicBio;
    return text.length > max ? text.slice(0, max) : text;
}
//# sourceMappingURL=planService.js.map