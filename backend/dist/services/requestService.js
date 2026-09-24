"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createServiceRequest = createServiceRequest;
exports.listRequestsBySeeker = listRequestsBySeeker;
exports.listRequestsByProvider = listRequestsByProvider;
exports.listAllRequests = listAllRequests;
exports.updateRequestStatus = updateRequestStatus;
exports.countPendingForProvider = countPendingForProvider;
const ServiceRequest_1 = require("../models/ServiceRequest");
const availabilityService_1 = require("./availabilityService");
function toRequest(doc) {
    return {
        id: doc._id.toString(),
        seekerUid: doc.seekerUid,
        seekerName: doc.seekerName,
        seekerEmail: doc.seekerEmail,
        providerUid: doc.providerUid,
        providerName: doc.providerName,
        serviceId: doc.serviceId,
        serviceTitle: doc.serviceTitle,
        need: doc.need,
        message: doc.message,
        location: doc.location,
        language: doc.language,
        urgency: doc.urgency,
        contactMethod: doc.contactMethod,
        status: doc.status,
        providerNote: doc.providerNote,
        slotId: doc.slotId,
        requestedStartAt: doc.requestedStartAt?.toISOString(),
        requestedEndAt: doc.requestedEndAt?.toISOString(),
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
    };
}
async function createServiceRequest(input) {
    if (input.seekerUid === input.providerUid) {
        throw new Error('Nuk mund t’i dërgosh kërkesë vetes');
    }
    let requestedStartAt;
    let requestedEndAt;
    const slotId = input.slotId?.trim();
    if (slotId) {
        const slot = await (0, availabilityService_1.getSlotById)(slotId);
        if (!slot)
            throw new Error('Termini i zgjedhur nuk ekziston');
        if (slot.providerUid !== input.providerUid) {
            throw new Error('Termini nuk i përket këtij ofruesi');
        }
        if (slot.status !== 'open') {
            throw new Error('Ky termin nuk është më i lirë');
        }
        requestedStartAt = new Date(slot.startAt);
        requestedEndAt = new Date(slot.endAt);
    }
    const doc = await ServiceRequest_1.ServiceRequest.create({
        ...input,
        need: input.need.trim(),
        message: input.message.trim(),
        slotId: slotId || undefined,
        requestedStartAt,
        requestedEndAt,
        status: 'pending',
    });
    if (slotId) {
        try {
            await (0, availabilityService_1.holdSlotForRequest)({
                slotId,
                providerUid: input.providerUid,
                requestId: doc._id.toString(),
            });
        }
        catch (err) {
            await ServiceRequest_1.ServiceRequest.findByIdAndDelete(doc._id);
            throw err;
        }
    }
    return toRequest(doc);
}
async function listRequestsBySeeker(seekerUid) {
    const docs = await ServiceRequest_1.ServiceRequest.find({ seekerUid }).sort({ createdAt: -1 });
    return docs.map((d) => toRequest(d));
}
async function listRequestsByProvider(providerUid) {
    const docs = await ServiceRequest_1.ServiceRequest.find({ providerUid }).sort({ createdAt: -1 });
    return docs.map((d) => toRequest(d));
}
async function listAllRequests() {
    const docs = await ServiceRequest_1.ServiceRequest.find({}).sort({ createdAt: -1 }).limit(100);
    return docs.map((d) => toRequest(d));
}
async function updateRequestStatus(input) {
    const doc = await ServiceRequest_1.ServiceRequest.findById(input.id);
    if (!doc)
        throw new Error('Kërkesa nuk u gjet');
    if (!input.asAdmin && doc.providerUid !== input.providerUid) {
        throw new Error('Nuk ke leje për këtë kërkesë');
    }
    doc.status = input.status;
    if (input.providerNote !== undefined) {
        doc.providerNote = input.providerNote.trim();
    }
    await doc.save();
    if (doc.slotId || doc.id) {
        await (0, availabilityService_1.syncSlotWithRequestStatus)({
            requestId: doc._id.toString(),
            status: input.status,
        });
    }
    return toRequest(doc);
}
async function countPendingForProvider(providerUid) {
    return ServiceRequest_1.ServiceRequest.countDocuments({ providerUid, status: 'pending' });
}
//# sourceMappingURL=requestService.js.map