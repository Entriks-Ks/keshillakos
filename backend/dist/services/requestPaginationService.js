"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listRequestPage = listRequestPage;
const RequestDelivery_1 = require("../models/RequestDelivery");
const ServiceRequest_1 = require("../models/ServiceRequest");
const User_1 = require("../models/User");
const UserRequest_1 = require("../models/UserRequest");
const ProviderProfile_1 = require("../models/ProviderProfile");
const providerProfileService_1 = require("./providerProfileService");
const pagination_1 = require("./pagination");
const requestService_1 = require("./requestService");
const userRequestService_1 = require("./userRequestService");
/** Canonical deliveries and legacy requests are paged as one stable collection in MongoDB. */
async function listRequestPage(uid, scope, query, input) {
    const owner = scope === 'mine' ? await User_1.User.findOne({ uid }).select('_id').lean() : null;
    const profiles = scope === 'inbox' ? await (0, providerProfileService_1.listMyProviderProfiles)(uid) : [];
    const canonical = [
        { $match: scope === 'mine' ? { user: owner?._id ?? null } : {} },
        { $lookup: { from: RequestDelivery_1.RequestDelivery.collection.name, let: { request: '$_id' }, pipeline: [
                    { $match: { $expr: { $eq: ['$request', '$$request'] }, ...(scope === 'inbox' ? { providerProfile: { $in: profiles.map((profile) => profile._id) } } : {}) } },
                ], as: '_deliveries' } },
        { $unwind: { path: '$_deliveries', preserveNullAndEmptyArrays: scope !== 'inbox' } },
        { $project: {
                _id: { $ifNull: ['$_deliveries._id', '$_id'] }, source: { $literal: 'canonical' }, requestId: '$_id', deliveryId: '$_deliveries._id',
                status: { $ifNull: ['$_deliveries.status', '$status'] }, offer: '$_deliveries.offer', requestedStartAt: '$_deliveries.requestedStartAt', createdAt: 1,
            } },
    ];
    const legacy = [
        { $match: scope === 'mine' ? { seekerUid: uid } : scope === 'inbox' ? { providerUid: uid } : {} },
        { $project: { _id: 1, source: { $literal: 'legacy' }, status: 1, offer: 1, requestedStartAt: 1, createdAt: 1 } },
    ];
    const pipeline = [...canonical, { $unionWith: { coll: ServiceRequest_1.ServiceRequest.collection.name, pipeline: legacy } }];
    const summaryRows = await UserRequest_1.UserRequest.aggregate([...pipeline, { $group: {
                _id: '$status', total: { $sum: 1 }, offers: { $sum: { $cond: [{ $ifNull: ['$offer', false] }, 1, 0] } },
                upcoming: { $sum: { $cond: [{ $and: [{ $in: ['$status', ['open', 'pending', 'read', 'accepted']] }, { $gt: ['$requestedStartAt', new Date()] }] }, 1, 0] } },
            } }]);
    const statusCounts = Object.fromEntries(summaryRows.map((row) => [row._id, row.total]));
    const summary = { total: summaryRows.reduce((sum, row) => sum + row.total, 0), active: summaryRows.filter((row) => ['open', 'pending', 'read', 'accepted'].includes(row._id)).reduce((sum, row) => sum + row.total, 0), offers: summaryRows.reduce((sum, row) => sum + row.offers, 0), upcoming: summaryRows.reduce((sum, row) => sum + row.upcoming, 0), statusCounts };
    const statuses = typeof query.statuses === 'string' ? [...new Set(query.statuses.split(','))] : [];
    const total = statuses.length ? statuses.reduce((sum, status) => sum + (statusCounts[status] ?? 0), 0) : summary.total;
    const filtered = statuses.length ? [{ $match: { status: { $in: statuses } } }] : [];
    const result = await (0, pagination_1.queryPage)(input, () => Promise.resolve(total), (skip, limit) => UserRequest_1.UserRequest.aggregate([
        ...pipeline, ...filtered,
        { $set: { rank: scope === 'inbox' ? { $switch: { branches: [
                            { case: { $in: ['$status', ['open', 'pending', 'read']] }, then: 0 }, { case: { $eq: ['$status', 'accepted'] }, then: 1 }, { case: { $eq: ['$status', 'completed'] }, then: 2 },
                        ], default: 3 } } : 0 } },
        { $sort: { rank: 1, createdAt: -1, _id: -1 } }, { $skip: skip }, { $limit: limit }, { $project: { _id: 1, source: 1, requestId: 1, deliveryId: 1 } },
    ]));
    const requests = await requestCards(result.items);
    return { requests, pagination: result.pagination, summary, pendingCount: scope === 'inbox' ? (statusCounts.pending ?? 0) : undefined };
}
async function requestCards(rows) {
    const [legacy, requests, deliveries] = await Promise.all([
        ServiceRequest_1.ServiceRequest.find({ _id: { $in: rows.filter((row) => row.source === 'legacy').map((row) => row._id) } }),
        UserRequest_1.UserRequest.find({ _id: { $in: rows.flatMap((row) => row.requestId ? [row.requestId] : []) } }),
        RequestDelivery_1.RequestDelivery.find({ _id: { $in: rows.flatMap((row) => row.deliveryId ? [row.deliveryId] : []) } }),
    ]);
    const providers = await ProviderProfile_1.ProviderProfile.find({ _id: { $in: deliveries.map((delivery) => delivery.providerProfile) } }).select('ownerUser publicProfile.displayName').lean();
    const owners = await User_1.User.find({ _id: { $in: providers.map((profile) => profile.ownerUser) } }).select('uid').lean();
    const uidByOwner = new Map(owners.map((owner) => [String(owner._id), owner.uid]));
    const profileById = new Map(providers.map((profile) => [String(profile._id), profile]));
    const legacyById = new Map(legacy.map((request) => [String(request._id), request]));
    const requestById = new Map(requests.map((request) => [String(request._id), request]));
    const deliveryById = new Map(deliveries.map((delivery) => [String(delivery._id), delivery]));
    const cards = await Promise.all(rows.map(async (row) => {
        const old = legacyById.get(String(row._id));
        if (row.source === 'legacy')
            return old ? (0, requestService_1.toRequest)(old) : null;
        const request = requestById.get(String(row.requestId));
        if (!request)
            return null;
        const delivery = deliveryById.get(String(row.deliveryId));
        const provider = delivery ? profileById.get(String(delivery.providerProfile)) : undefined;
        return (0, userRequestService_1.requestView)(request, delivery, provider?.publicProfile.displayName, provider ? uidByOwner.get(String(provider.ownerUser)) : undefined);
    }));
    return cards.filter((card) => card !== null);
}
//# sourceMappingURL=requestPaginationService.js.map