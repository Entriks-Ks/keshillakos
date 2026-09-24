"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rangesOverlap = rangesOverlap;
exports.createAvailabilitySlot = createAvailabilitySlot;
exports.createAvailabilitySlotsBulk = createAvailabilitySlotsBulk;
exports.listMyAvailability = listMyAvailability;
exports.listOpenAvailabilityForProvider = listOpenAvailabilityForProvider;
exports.listScheduleForProvider = listScheduleForProvider;
exports.deleteAvailabilitySlot = deleteAvailabilitySlot;
exports.holdSlotForRequest = holdSlotForRequest;
exports.syncSlotWithRequestStatus = syncSlotWithRequestStatus;
exports.getSlotById = getSlotById;
const node_crypto_1 = require("node:crypto");
const mongoose_1 = require("mongoose");
const AvailabilityLock_1 = require("../models/AvailabilityLock");
const AvailabilitySlot_1 = require("../models/AvailabilitySlot");
const Business_1 = require("../models/Business");
const ProviderProfile_1 = require("../models/ProviderProfile");
const ServiceOffer_1 = require("../models/ServiceOffer");
const User_1 = require("../models/User");
const providerProfileService_1 = require("./providerProfileService");
function rangesOverlap(aStart, aEnd, bStart, bEnd) {
    return aStart < bEnd && aEnd > bStart;
}
function remaining(doc) {
    if (!doc.holds?.length && doc.status === 'held' && doc.requestId)
        return 0;
    if (!doc.holds?.length && doc.status === 'booked')
        return 0;
    return Math.max(0, (doc.capacity || 1) - (doc.holds?.length || 0));
}
function toSlot(doc) {
    const available = remaining(doc);
    const status = doc.status === 'cancelled' ? 'cancelled' : available > 0 ? 'open'
        : doc.holds?.some((hold) => hold.state === 'booked') || (!doc.holds?.length && doc.status === 'booked') ? 'booked' : 'held';
    return {
        id: doc._id.toString(), providerId: doc.providerProfile ? String(doc.providerProfile) : undefined,
        providerUid: doc.providerUid, providerName: doc.providerName,
        businessId: doc.business ? String(doc.business) : undefined,
        serviceOfferId: doc.serviceOffer ? String(doc.serviceOffer) : undefined,
        staffUserId: doc.staffUser ? String(doc.staffUser) : undefined,
        resourceKey: doc.resourceKey,
        startAt: doc.startAt.toISOString(), endAt: doc.endAt.toISOString(),
        timezone: doc.timezone || 'Europe/Belgrade', mode: doc.mode || 'online', location: doc.location,
        capacity: doc.capacity || 1, remainingCapacity: available,
        status, note: doc.note, createdAt: doc.createdAt, updatedAt: doc.updatedAt,
    };
}
function assertValidRange(startAt, endAt) {
    if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime()))
        throw new Error('Data ose ora nuk është e vlefshme');
    if (endAt <= startAt)
        throw new Error('Ora e mbarimit duhet të jetë pas fillimit');
    if (endAt.getTime() - startAt.getTime() < 15 * 60 * 1000)
        throw new Error('Termini duhet të jetë të paktën 15 minuta');
    if (startAt.getTime() < Date.now() - 60000)
        throw new Error('Nuk mund të shtosh orare në të kaluarën');
}
async function withScheduleLock(key, work) {
    const token = (0, node_crypto_1.randomUUID)();
    const now = new Date();
    try {
        await AvailabilityLock_1.AvailabilityLock.findOneAndUpdate({ _id: key, leaseUntil: { $lte: now } }, { $set: { token, leaseUntil: new Date(now.getTime() + 30000) } }, { upsert: true, new: true });
    }
    catch (err) {
        if (err.code === 11000)
            throw new Error('Orari po përditësohet; provo përsëri');
        throw err;
    }
    try {
        return await work();
    }
    finally {
        await AvailabilityLock_1.AvailabilityLock.deleteOne({ _id: key, token });
    }
}
async function withScheduleLocks(keys, work) {
    const ordered = [...new Set(keys)].sort();
    const acquire = (index) => index === ordered.length
        ? work() : withScheduleLock(ordered[index], () => acquire(index + 1));
    return acquire(0);
}
async function managedProfile(uid, providerId) {
    const profiles = await (0, providerProfileService_1.listMyProviderProfiles)(uid);
    if (providerId) {
        const profile = profiles.find((item) => String(item._id) === providerId);
        if (!profile)
            throw new Error('Nuk ke leje për këtë profil');
        return profile;
    }
    if (profiles.length === 1)
        return profiles[0];
    if (profiles.length > 1)
        throw new Error('Zgjidh ProviderProfile për orarin');
    return null; // Legacy-only provider account.
}
async function createAvailabilitySlot(input) {
    const startAt = new Date(input.startAt);
    const endAt = new Date(input.endAt);
    assertValidRange(startAt, endAt);
    const profile = await managedProfile(input.providerUid, input.providerId);
    if (input.businessId && (!profile?.business || String(profile.business) !== input.businessId))
        throw new Error('Biznesi nuk i përket profilit');
    if (input.serviceOfferId) {
        if (!mongoose_1.Types.ObjectId.isValid(input.serviceOfferId) || !profile)
            throw new Error('ServiceOffer ID i pavlefshëm');
        const offer = await ServiceOffer_1.ServiceOffer.findOne({ _id: input.serviceOfferId, providerProfile: profile._id });
        if (!offer)
            throw new Error('Shërbimi nuk i përket profilit');
    }
    if (input.staffUserId) {
        if (!mongoose_1.Types.ObjectId.isValid(input.staffUserId) || !profile?.business)
            throw new Error('Staff kërkon profil biznesi');
        const business = await Business_1.Business.findById(profile.business);
        const staffId = new mongoose_1.Types.ObjectId(input.staffUserId);
        if (!business || !business.owners.some((id) => id.equals(staffId)) && !business.members.some((member) => member.user.equals(staffId)))
            throw new Error('Stafi nuk i përket biznesit');
    }
    const key = profile ? `profile:${profile._id}` : `legacy:${input.providerUid}`;
    const locks = [key];
    if (profile?.business && input.staffUserId)
        locks.push(`staff:${profile.business}:${input.staffUserId}`);
    if (profile?.business && input.resourceKey)
        locks.push(`resource:${profile.business}:${input.resourceKey}`);
    return withScheduleLocks(locks, async () => {
        const conflictScope = profile
            ? [{ providerProfile: profile._id }, { providerUid: input.providerUid, providerProfile: { $exists: false } }]
            : [{ providerUid: input.providerUid }];
        if (profile?.business && input.staffUserId)
            conflictScope.push({ business: profile.business, staffUser: new mongoose_1.Types.ObjectId(input.staffUserId) });
        if (profile?.business && input.resourceKey)
            conflictScope.push({ business: profile.business, resourceKey: input.resourceKey });
        const overlap = await AvailabilitySlot_1.AvailabilitySlot.findOne({
            $or: conflictScope, status: { $ne: 'cancelled' },
            startAt: { $lt: endAt }, endAt: { $gt: startAt },
        });
        if (overlap)
            throw new Error('Ky orar përputhet me një termin ekzistues');
        const doc = await AvailabilitySlot_1.AvailabilitySlot.create({
            providerUid: input.providerUid, providerName: input.providerName,
            providerProfile: profile?._id, business: profile?.business,
            serviceOffer: input.serviceOfferId ? new mongoose_1.Types.ObjectId(input.serviceOfferId) : undefined,
            staffUser: input.staffUserId ? new mongoose_1.Types.ObjectId(input.staffUserId) : undefined,
            resourceKey: input.resourceKey,
            startAt, endAt, timezone: input.timezone || 'Europe/Belgrade',
            mode: input.mode || 'online', location: input.location,
            capacity: input.capacity ?? 1, note: input.note?.trim() || undefined, status: 'open',
        });
        return toSlot(doc);
    });
}
async function createAvailabilitySlotsBulk(input) {
    if (!input.slots.length)
        throw new Error('Zgjidh të paktën një orë');
    if (input.slots.length > 400)
        throw new Error('Maksimumi 400 orë njëherësh');
    const profile = await managedProfile(input.providerUid, input.providerId);
    const ranges = [];
    for (const slot of input.slots) {
        const startAt = new Date(slot.startAt);
        const endAt = new Date(slot.endAt);
        try {
            assertValidRange(startAt, endAt);
            ranges.push({ startAt, endAt });
        }
        catch {
            // Skip hours that already passed or that are invalid.
        }
    }
    if (!ranges.length)
        throw new Error('Asnjë orë e vlefshme për t’u publikuar');
    const key = profile ? `profile:${profile._id}` : `legacy:${input.providerUid}`;
    return withScheduleLock(key, async () => {
        const minStart = new Date(Math.min(...ranges.map((range) => range.startAt.getTime())));
        const maxEnd = new Date(Math.max(...ranges.map((range) => range.endAt.getTime())));
        const conflictScope = profile
            ? [{ providerProfile: profile._id }, { providerUid: input.providerUid, providerProfile: { $exists: false } }]
            : [{ providerUid: input.providerUid }];
        const existing = await AvailabilitySlot_1.AvailabilitySlot.find({
            $or: conflictScope, status: { $ne: 'cancelled' },
            startAt: { $lt: maxEnd }, endAt: { $gt: minStart },
        }).select('startAt endAt');
        const docs = [];
        for (const range of ranges) {
            const clash = existing.some((item) => rangesOverlap(item.startAt, item.endAt, range.startAt, range.endAt))
                || docs.some((item) => rangesOverlap(item.startAt, item.endAt, range.startAt, range.endAt));
            if (clash)
                continue;
            docs.push({
                providerUid: input.providerUid, providerName: input.providerName,
                providerProfile: profile?._id, business: profile?.business,
                startAt: range.startAt, endAt: range.endAt,
                timezone: input.timezone || 'Europe/Belgrade',
                mode: input.mode || 'online',
                capacity: 1, note: input.note?.trim() || undefined, status: 'open',
            });
        }
        if (!docs.length)
            return { created: [], skipped: ranges.length };
        const inserted = await AvailabilitySlot_1.AvailabilitySlot.insertMany(docs);
        return {
            created: inserted.map((doc) => toSlot(doc)),
            skipped: input.slots.length - inserted.length,
        };
    });
}
async function providerSlotFilter(identifier) {
    if (mongoose_1.Types.ObjectId.isValid(identifier))
        return { providerProfile: new mongoose_1.Types.ObjectId(identifier) };
    const user = await User_1.User.findOne({ uid: identifier }).select('_id').lean();
    const profiles = user ? await ProviderProfile_1.ProviderProfile.find({ ownerUser: user._id }).select('_id').lean() : [];
    return { $or: [{ providerUid: identifier }, { providerProfile: { $in: profiles.map((profile) => profile._id) } }] };
}
async function listMyAvailability(uid) {
    const profiles = await (0, providerProfileService_1.listMyProviderProfiles)(uid);
    const docs = await AvailabilitySlot_1.AvailabilitySlot.find({
        $or: [{ providerUid: uid }, { providerProfile: { $in: profiles.map((profile) => profile._id) } }],
        status: { $ne: 'cancelled' }, endAt: { $gte: new Date(Date.now() - 86400000) },
    }).sort({ startAt: 1 });
    return docs.map(toSlot);
}
async function listOpenAvailabilityForProvider(identifier) {
    const docs = await AvailabilitySlot_1.AvailabilitySlot.find({
        ...(await providerSlotFilter(identifier)), status: { $in: ['open', 'held', 'booked'] }, startAt: { $gte: new Date() },
    }).sort({ startAt: 1 }).limit(200);
    return docs.map(toSlot).filter((slot) => slot.remainingCapacity > 0).slice(0, 120);
}
async function listScheduleForProvider(identifier) {
    const docs = await AvailabilitySlot_1.AvailabilitySlot.find({
        ...(await providerSlotFilter(identifier)), status: { $in: ['open', 'held', 'booked'] }, startAt: { $gte: new Date() },
    }).sort({ startAt: 1 }).limit(200);
    const slots = docs.map(toSlot);
    return { slots, free: slots.filter((slot) => slot.remainingCapacity > 0), busy: slots.filter((slot) => slot.remainingCapacity === 0) };
}
async function deleteAvailabilitySlot(input) {
    if (!mongoose_1.Types.ObjectId.isValid(input.id))
        throw new Error('Termini nuk u gjet');
    const profiles = input.asAdmin ? [] : await (0, providerProfileService_1.listMyProviderProfiles)(input.providerUid);
    const ownership = input.asAdmin ? {} : { $or: [{ providerUid: input.providerUid }, { providerProfile: { $in: profiles.map((profile) => profile._id) } }] };
    const doc = await AvailabilitySlot_1.AvailabilitySlot.findOneAndUpdate({
        _id: input.id, ...ownership, status: 'open',
        $expr: { $eq: [{ $size: { $ifNull: ['$holds', []] } }, 0] },
    }, { $set: { status: 'cancelled' } }, { new: true });
    if (!doc)
        throw new Error('Termini është i zënë ose nuk ke leje për ta fshirë');
    return { deleted: true, id: String(doc._id) };
}
async function holdSlotForRequest(input) {
    if (!mongoose_1.Types.ObjectId.isValid(input.slotId))
        throw new Error('Termini nuk u gjet');
    const scope = input.providerId ? { providerProfile: new mongoose_1.Types.ObjectId(input.providerId) } : { providerUid: input.providerUid };
    const doc = await AvailabilitySlot_1.AvailabilitySlot.findOneAndUpdate({
        _id: input.slotId, ...scope,
        $or: [{ status: 'open' }, { status: { $in: ['held', 'booked'] }, 'holds.0': { $exists: true } }],
        requestId: { $exists: false }, startAt: { $gte: new Date() },
        'holds.requestId': { $ne: input.requestId },
        $expr: { $lt: [{ $size: { $ifNull: ['$holds', []] } }, { $ifNull: ['$capacity', 1] }] },
    }, {
        $push: { holds: { requestId: input.requestId, state: 'held', heldAt: new Date() } },
        $set: { status: 'held' },
    }, { new: true });
    if (!doc)
        throw new Error('Ky termin sapo u zë ose nuk i përket këtij ofruesi');
    return toSlot(doc);
}
async function syncSlotWithRequestStatus(input) {
    if (input.status === 'accepted' || input.status === 'completed') {
        const doc = await AvailabilitySlot_1.AvailabilitySlot.findOneAndUpdate({ holds: { $elemMatch: { requestId: input.requestId, state: 'held' } } }, { $set: { 'holds.$.state': 'booked', status: 'booked' } }, { new: true });
        if (doc)
            return toSlot(doc);
    }
    else if (input.status === 'rejected') {
        const doc = await AvailabilitySlot_1.AvailabilitySlot.findOneAndUpdate({ 'holds.requestId': input.requestId }, { $pull: { holds: { requestId: input.requestId } } }, { new: true });
        if (doc) {
            if (!doc.holds.length) {
                const reopened = await AvailabilitySlot_1.AvailabilitySlot.findOneAndUpdate({ _id: doc._id, holds: { $size: 0 } }, { $set: { status: 'open' } }, { new: true });
                return toSlot(reopened || doc);
            }
            return toSlot(doc);
        }
    }
    else {
        const doc = await AvailabilitySlot_1.AvailabilitySlot.findOne({ 'holds.requestId': input.requestId });
        if (doc)
            return toSlot(doc);
    }
    const legacyStatus = input.status === 'accepted' || input.status === 'completed' ? 'booked' : input.status === 'rejected' ? 'open' : 'held';
    const legacy = await AvailabilitySlot_1.AvailabilitySlot.findOneAndUpdate({ requestId: input.requestId }, { $set: { status: legacyStatus }, ...(input.status === 'rejected' ? { $unset: { requestId: '' } } : {}) }, { new: true });
    return legacy ? toSlot(legacy) : null;
}
async function getSlotById(slotId) {
    if (!mongoose_1.Types.ObjectId.isValid(slotId))
        return null;
    const doc = await AvailabilitySlot_1.AvailabilitySlot.findById(slotId);
    return doc ? toSlot(doc) : null;
}
//# sourceMappingURL=availabilityService.js.map