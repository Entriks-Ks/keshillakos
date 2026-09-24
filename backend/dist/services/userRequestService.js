"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.canSeeDelivery = canSeeDelivery;
exports.createUserRequest = createUserRequest;
exports.sendExistingRequest = sendExistingRequest;
exports.updateUserRequestLifecycle = updateUserRequestLifecycle;
exports.listMyUserRequests = listMyUserRequests;
exports.listProviderDeliveries = listProviderDeliveries;
exports.listAllUserRequests = listAllUserRequests;
exports.updateDeliveryStatus = updateDeliveryStatus;
exports.countPendingDeliveries = countPendingDeliveries;
const mongoose_1 = require("mongoose");
const Category_1 = require("../models/Category");
const ProviderProfile_1 = require("../models/ProviderProfile");
const RequestDelivery_1 = require("../models/RequestDelivery");
const Service_1 = require("../models/Service");
const ServiceOffer_1 = require("../models/ServiceOffer");
const User_1 = require("../models/User");
const UserRequest_1 = require("../models/UserRequest");
const availabilityService_1 = require("./availabilityService");
const domainService_1 = require("./domainService");
const providerProfileService_1 = require("./providerProfileService");
const appointmentService_1 = require("./appointmentService");
function canSeeDelivery(providerIds, deliveryProviderId, isAdmin = false) {
    return isAdmin || new Set(providerIds).has(deliveryProviderId);
}
async function resolveCategory(input) {
    const portal = input.portal || domainService_1.DEFAULT_PORTAL;
    if (input.categoryId)
        return (0, domainService_1.findCategoryById)(input.categoryId, portal);
    if (input.serviceId && mongoose_1.Types.ObjectId.isValid(input.serviceId)) {
        const offer = await ServiceOffer_1.ServiceOffer.findById(input.serviceId);
        if (offer)
            return Category_1.Category.findOne({ _id: offer.category, portal, status: 'active' });
        const legacyService = await Service_1.Service.findById(input.serviceId);
        if (legacyService)
            return (0, domainService_1.findCategoryById)(legacyService.categoryId, portal);
    }
    return (0, domainService_1.findCategoryById)('other', portal);
}
async function resolveProviders(input, categoryId) {
    const ids = [...new Set(input.providerIds ?? [])];
    if (input.providerUid && !ids.length) {
        const user = await User_1.User.findOne({ uid: input.providerUid }).select('_id').lean();
        if (!user)
            throw new Error('Ofruesi nuk u gjet');
        const matches = await ProviderProfile_1.ProviderProfile.find({ ownerUser: user._id, categories: categoryId, status: { $ne: 'suspended' } }).sort({ createdAt: 1 });
        if (matches.length !== 1)
            throw new Error('Zgjidh profilin e saktë të ofruesit');
        ids.push(String(matches[0]._id));
    }
    if (ids.length > 20)
        throw new Error('Maksimumi 20 ofrues për kërkesë');
    if (ids.some((id) => !mongoose_1.Types.ObjectId.isValid(id)))
        throw new Error('ProviderProfile ID i pavlefshëm');
    const profiles = await ProviderProfile_1.ProviderProfile.find({ _id: { $in: ids }, status: { $ne: 'suspended' } });
    if (profiles.length !== ids.length || profiles.some((profile) => !profile.categories.includes(categoryId)))
        throw new Error('Ofruesi nuk e mbulon këtë kategori');
    return profiles;
}
async function createUserRequest(input) {
    const user = await User_1.User.findOne({ uid: input.uid }).select('_id').lean();
    if (!user)
        throw new Error('Përdoruesi nuk u gjet');
    const category = await resolveCategory(input);
    if (!category)
        throw new Error('Kategoria nuk ekziston');
    const profiles = input.draft ? [] : await resolveProviders(input, category.stableId);
    if (!input.draft && !profiles.length)
        throw new Error('Zgjidh të paktën një ofrues');
    if (profiles.some((profile) => profile.ownerUser.equals(user._id)))
        throw new Error('Nuk mund t’i dërgosh kërkesë vetes');
    if (!input.draft && !input.slotId?.trim())
        throw new Error('Zgjidh një orë të lirë për kërkesën');
    if (input.slotId && profiles.length !== 1)
        throw new Error('Termini kërkon saktësisht një ofrues');
    let slot = null;
    if (input.slotId) {
        slot = await (0, availabilityService_1.getSlotById)(input.slotId);
        if (!slot || slot.status !== 'open')
            throw new Error('Termini nuk është më i lirë');
        if (slot.providerId) {
            if (slot.providerId !== String(profiles[0]._id))
                throw new Error('Termini nuk i përket këtij ofruesi');
        }
        else {
            const owner = await User_1.User.findById(profiles[0].ownerUser).select('uid').lean();
            if (slot.providerUid !== owner?.uid)
                throw new Error('Termini nuk i përket këtij ofruesi');
        }
    }
    const location = input.location ?? (input.legacyLocation?.trim() ? {
        countryCode: 'XK', cityName: input.legacyLocation.trim(), online: input.preferredMode === 'online',
    } : undefined);
    const request = await UserRequest_1.UserRequest.create({
        user: user._id, category: category._id, portal: category.portal,
        problem: input.problem, description: input.description, location,
        language: input.language, budget: input.budget,
        urgency: input.urgency ?? 'flexible', preferredMode: input.preferredMode ?? 'either',
        contactPreference: input.contactPreference,
        contactPhone: input.contactPhone, contactEmail: input.contactEmail,
        source: input.source ?? 'web',
        status: input.draft ? 'draft' : 'open',
    });
    try {
        const deliveries = await RequestDelivery_1.RequestDelivery.insertMany(profiles.map((profile) => ({
            request: request._id, providerProfile: profile._id, status: 'pending', sentAt: new Date(),
            slotId: slot ? input.slotId : undefined,
            requestedStartAt: slot?.startAt, requestedEndAt: slot?.endAt,
        })));
        if (slot)
            await (0, availabilityService_1.holdSlotForRequest)({ slotId: input.slotId, providerUid: slot.providerUid, providerId: slot.providerId, requestId: String(deliveries[0]._id) });
        return { request, deliveries };
    }
    catch (err) {
        // Roll back only documents created by this operation; legacy records are never touched.
        await RequestDelivery_1.RequestDelivery.deleteMany({ request: request._id });
        await UserRequest_1.UserRequest.findByIdAndDelete(request._id);
        throw err;
    }
}
async function sendExistingRequest(uid, id, providerIds) {
    if (!mongoose_1.Types.ObjectId.isValid(id))
        throw new Error('Request ID i pavlefshëm');
    const owner = await User_1.User.findOne({ uid }).select('_id').lean();
    const request = await UserRequest_1.UserRequest.findById(id);
    if (!owner || !request || !request.user.equals(owner._id))
        throw new Error('Nuk ke leje për këtë kërkesë');
    if (!['draft', 'open'].includes(request.status))
        throw new Error('Kërkesa nuk pranon dërgesa');
    const category = await Category_1.Category.findById(request.category);
    if (!category || category.status !== 'active')
        throw new Error('Kategoria nuk është aktive');
    const profiles = await resolveProviders({ uid, providerIds, problem: request.problem, description: request.description, contactPreference: request.contactPreference }, category.stableId);
    if (!profiles.length || profiles.some((profile) => profile.ownerUser.equals(owner._id)))
        throw new Error('Ofruesit janë të pavlefshëm');
    const existing = await RequestDelivery_1.RequestDelivery.exists({ request: request._id, providerProfile: { $in: profiles.map((profile) => profile._id) } });
    if (existing)
        throw new Error('Kërkesa i është dërguar tashmë njërit prej këtyre ofruesve');
    await RequestDelivery_1.RequestDelivery.insertMany(profiles.map((profile) => ({ request: request._id, providerProfile: profile._id, sentAt: new Date(), status: 'pending' })));
    request.status = 'open';
    await request.save();
    return listMyUserRequests(uid);
}
async function updateUserRequestLifecycle(uid, id, status) {
    if (!mongoose_1.Types.ObjectId.isValid(id))
        throw new Error('Request ID i pavlefshëm');
    const owner = await User_1.User.findOne({ uid }).select('_id').lean();
    const request = await UserRequest_1.UserRequest.findById(id);
    if (!owner || !request || !request.user.equals(owner._id))
        throw new Error('Nuk ke leje për këtë kërkesë');
    if (!['draft', 'open'].includes(request.status))
        throw new Error('Kërkesa është mbyllur tashmë');
    if (status === 'closed' && request.status === 'draft')
        throw new Error('Drafti nuk mund të mbyllet');
    request.status = status;
    await request.save();
    const pending = await RequestDelivery_1.RequestDelivery.find({ request: request._id, status: { $in: ['pending', 'read'] } });
    for (const delivery of pending) {
        delivery.status = 'withdrawn';
        await delivery.save();
        if (delivery.slotId)
            await (0, availabilityService_1.syncSlotWithRequestStatus)({ requestId: String(delivery._id), status: 'rejected' });
    }
    return listMyUserRequests(uid);
}
async function view(request, delivery, providerName = '', providerUid = '') {
    const owner = await User_1.User.findById(request.user).select('uid firstName lastName email').lean();
    return {
        id: delivery ? String(delivery._id) : String(request._id), requestId: String(request._id),
        deliveryId: delivery ? String(delivery._id) : undefined,
        providerId: delivery ? String(delivery.providerProfile) : undefined,
        providerUid,
        seekerUid: owner?.uid || '', seekerName: [owner?.firstName, owner?.lastName].filter(Boolean).join(' '), seekerEmail: owner?.email || '',
        providerName, need: request.problem, message: request.description,
        location: request.location?.cityName || '', language: request.language, urgency: request.urgency,
        contactMethod: request.contactPreference,
        contactPhone: request.contactPhone, contactEmail: request.contactEmail || owner?.email || '',
        status: delivery?.status || request.status, providerNote: delivery?.response, offer: delivery?.offer,
        slotId: delivery?.slotId, requestedStartAt: delivery?.requestedStartAt?.toISOString(), requestedEndAt: delivery?.requestedEndAt?.toISOString(),
        sentAt: delivery?.sentAt, readAt: delivery?.readAt, respondedAt: delivery?.respondedAt,
        categoryId: String(request.category), budget: request.budget, preferredMode: request.preferredMode,
        portal: request.portal, source: request.source, createdAt: request.createdAt, updatedAt: request.updatedAt,
    };
}
async function viewsForRequests(requests, providerFilter) {
    const deliveries = await RequestDelivery_1.RequestDelivery.find({ request: { $in: requests.map((request) => request._id) } }).sort({ sentAt: -1 });
    const filtered = providerFilter ? deliveries.filter((delivery) => providerFilter.has(String(delivery.providerProfile))) : deliveries;
    const profiles = await ProviderProfile_1.ProviderProfile.find({ _id: { $in: filtered.map((delivery) => delivery.providerProfile) } }).select('publicProfile.displayName ownerUser');
    const owners = await User_1.User.find({ _id: { $in: profiles.map((profile) => profile.ownerUser) } }).select('uid').lean();
    const uidByOwner = new Map(owners.map((item) => [String(item._id), item.uid]));
    const names = new Map(profiles.map((profile) => [String(profile._id), profile.publicProfile.displayName]));
    const uids = new Map(profiles.map((profile) => [String(profile._id), uidByOwner.get(String(profile.ownerUser)) || '']));
    const byRequest = new Map();
    for (const delivery of filtered)
        byRequest.set(String(delivery.request), [...(byRequest.get(String(delivery.request)) ?? []), delivery]);
    const output = [];
    for (const request of requests) {
        const rows = byRequest.get(String(request._id)) ?? [];
        if (!rows.length && !providerFilter)
            output.push(await view(request));
        for (const delivery of rows)
            output.push(await view(request, delivery, names.get(String(delivery.providerProfile)), uids.get(String(delivery.providerProfile))));
    }
    return output;
}
async function listMyUserRequests(uid) {
    const owner = await User_1.User.findOne({ uid }).select('_id').lean();
    if (!owner)
        return [];
    return viewsForRequests(await UserRequest_1.UserRequest.find({ user: owner._id }).sort({ createdAt: -1 }).limit(100));
}
async function listProviderDeliveries(uid) {
    const profiles = await (0, providerProfileService_1.listMyProviderProfiles)(uid);
    const ids = profiles.map((profile) => profile._id);
    const deliveries = await RequestDelivery_1.RequestDelivery.find({ providerProfile: { $in: ids } }).sort({ sentAt: -1 }).limit(100);
    const requests = await UserRequest_1.UserRequest.find({ _id: { $in: deliveries.map((delivery) => delivery.request) } });
    const byId = new Map(requests.map((request) => [String(request._id), request]));
    const names = new Map(profiles.map((profile) => [String(profile._id), profile.publicProfile.displayName]));
    const output = [];
    for (const delivery of deliveries) {
        const request = byId.get(String(delivery.request));
        if (request)
            output.push(await view(request, delivery, names.get(String(delivery.providerProfile)), uid));
    }
    return output;
}
async function listAllUserRequests() {
    return viewsForRequests(await UserRequest_1.UserRequest.find().sort({ createdAt: -1 }).limit(100));
}
async function updateDeliveryStatus(uid, id, status, response, isAdmin = false, offer) {
    if (!mongoose_1.Types.ObjectId.isValid(id))
        throw new Error('Delivery ID i pavlefshëm');
    const delivery = await RequestDelivery_1.RequestDelivery.findById(id);
    if (!delivery)
        throw new Error('Dërgesa nuk u gjet');
    const profiles = isAdmin ? [] : await (0, providerProfileService_1.listMyProviderProfiles)(uid);
    if (!canSeeDelivery(profiles.map((profile) => String(profile._id)), String(delivery.providerProfile), isAdmin))
        throw new Error('Nuk ke leje për këtë dërgesë');
    const request = await UserRequest_1.UserRequest.findById(delivery.request);
    if (!request || request.status !== 'open')
        throw new Error('Kërkesa nuk është aktive');
    if (status === 'withdrawn')
        throw new Error('Vetëm kërkuesi mund ta tërheqë dërgesën');
    const allowed = {
        pending: ['read', 'accepted', 'rejected', 'completed'],
        read: ['accepted', 'rejected', 'completed'],
        accepted: ['completed'],
        rejected: [],
        completed: [],
        withdrawn: [],
    };
    if (status !== delivery.status && !allowed[delivery.status].includes(status)) {
        throw new Error(delivery.status === 'accepted'
            ? 'Kërkesa e pranuar mund vetëm të përfundojë'
            : 'Kjo dërgesë nuk mund të ndryshohet më');
    }
    if (delivery.slotId && status === 'accepted')
        await (0, appointmentService_1.confirmAppointmentFromDelivery)(String(delivery._id));
    if (delivery.slotId && status === 'completed')
        await (0, appointmentService_1.completeAppointmentFromDelivery)(String(delivery._id));
    delivery.status = status;
    if (status === 'read' && !delivery.readAt)
        delivery.readAt = new Date();
    if (['accepted', 'rejected', 'completed'].includes(status))
        delivery.respondedAt = new Date();
    if (response !== undefined)
        delivery.response = response.trim();
    if (offer !== undefined)
        delivery.offer = offer;
    await delivery.save();
    if (delivery.slotId && ['rejected', 'pending'].includes(status))
        await (0, availabilityService_1.syncSlotWithRequestStatus)({ requestId: String(delivery._id), status: status });
    const profile = await ProviderProfile_1.ProviderProfile.findById(delivery.providerProfile).select('publicProfile.displayName');
    return view(request, delivery, profile?.publicProfile.displayName);
}
async function countPendingDeliveries(uid) {
    const profiles = await (0, providerProfileService_1.listMyProviderProfiles)(uid);
    return RequestDelivery_1.RequestDelivery.countDocuments({ providerProfile: { $in: profiles.map((profile) => profile._id) }, status: 'pending' });
}
//# sourceMappingURL=userRequestService.js.map