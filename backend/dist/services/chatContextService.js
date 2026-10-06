"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.chatRequestContext = chatRequestContext;
const mongoose_1 = require("mongoose");
const User_1 = require("../models/User");
const ProviderProfile_1 = require("../models/ProviderProfile");
const UserRequest_1 = require("../models/UserRequest");
const RequestDelivery_1 = require("../models/RequestDelivery");
const ServiceRequest_1 = require("../models/ServiceRequest");
const ServiceOffer_1 = require("../models/ServiceOffer");
/** Only called after conversation membership has been verified. Never returns chat content. */
async function chatRequestContext(conversation) {
    if (conversation.serviceId && !mongoose_1.Types.ObjectId.isValid(conversation.serviceId) && !conversation.requestDeliveryId)
        return null;
    const [seeker, provider] = await Promise.all([
        User_1.User.findOne({ uid: conversation.seekerUid }).select('_id').lean(),
        User_1.User.findOne({ uid: conversation.providerUid }).select('_id').lean(),
    ]);
    if (!seeker || !provider)
        return null;
    const [profiles, requests] = await Promise.all([
        ProviderProfile_1.ProviderProfile.find({ ownerUser: provider._id }).select('_id').lean(),
        UserRequest_1.UserRequest.find({ user: seeker._id, status: { $ne: 'draft' } }).select('_id problem status').lean(),
    ]);
    const deliveries = await RequestDelivery_1.RequestDelivery.find({
        providerProfile: { $in: profiles.map(p => p._id) }, request: { $in: requests.map(r => r._id) },
        ...(conversation.requestDeliveryId ? { _id: conversation.requestDeliveryId } : conversation.serviceId ? { serviceOffer: conversation.serviceId } : {}),
    }).sort({ sentAt: -1 }).limit(2).lean();
    // Existing pair-based threads may represent multiple requests. Do not guess a link.
    if (deliveries.length === 1) {
        const delivery = deliveries[0];
        const request = requests.find(r => String(r._id) === String(delivery.request));
        const offer = delivery.serviceOffer ? await ServiceOffer_1.ServiceOffer.findById(delivery.serviceOffer).select('name').lean() : null;
        return { id: String(delivery._id), title: offer?.name || request.problem, status: request.status === 'cancelled' ? 'cancelled' : delivery.status };
    }
    if (conversation.requestDeliveryId || deliveries.length > 1)
        return null;
    const legacy = await ServiceRequest_1.ServiceRequest.find({ seekerUid: conversation.seekerUid, providerUid: conversation.providerUid, ...(conversation.serviceId ? { serviceId: conversation.serviceId } : {}) }).limit(2).lean();
    return legacy.length === 1 ? { id: String(legacy[0]._id), title: legacy[0].serviceTitle || legacy[0].need, status: legacy[0].status } : null;
}
//# sourceMappingURL=chatContextService.js.map