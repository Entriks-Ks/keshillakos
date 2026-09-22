"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.confirmAppointmentFromDelivery = confirmAppointmentFromDelivery;
exports.completeAppointmentFromDelivery = completeAppointmentFromDelivery;
exports.listMyAppointments = listMyAppointments;
exports.listProviderAppointments = listProviderAppointments;
exports.cancelAppointment = cancelAppointment;
const mongoose_1 = require("mongoose");
const Appointment_1 = require("../models/Appointment");
const AvailabilitySlot_1 = require("../models/AvailabilitySlot");
const RequestDelivery_1 = require("../models/RequestDelivery");
const ProviderProfile_1 = require("../models/ProviderProfile");
const User_1 = require("../models/User");
const UserRequest_1 = require("../models/UserRequest");
const availabilityService_1 = require("./availabilityService");
const providerProfileService_1 = require("./providerProfileService");
async function confirmAppointmentFromDelivery(deliveryId) {
    if (!mongoose_1.Types.ObjectId.isValid(deliveryId))
        throw new Error('Delivery ID i pavlefshëm');
    const delivery = await RequestDelivery_1.RequestDelivery.findById(deliveryId);
    if (!delivery?.slotId || !mongoose_1.Types.ObjectId.isValid(delivery.slotId))
        throw new Error('Nuk ka termin të zgjedhur');
    const [request, slot] = await Promise.all([
        UserRequest_1.UserRequest.findById(delivery.request), AvailabilitySlot_1.AvailabilitySlot.findById(delivery.slotId),
    ]);
    if (!request || !slot)
        throw new Error('Termini nuk u gjet');
    if (slot.providerProfile) {
        if (!slot.providerProfile.equals(delivery.providerProfile))
            throw new Error('Termini nuk i përket dërgesës');
    }
    else {
        const profile = await ProviderProfile_1.ProviderProfile.findById(delivery.providerProfile).select('ownerUser').lean();
        const owner = profile ? await User_1.User.findById(profile.ownerUser).select('uid').lean() : null;
        if (!owner || slot.providerUid !== owner.uid)
            throw new Error('Termini nuk i përket dërgesës');
    }
    const hold = slot.holds.find((item) => item.requestId === deliveryId);
    if (!hold)
        throw new Error('Termini nuk mbahet më për këtë kërkesë');
    let appointment = await Appointment_1.Appointment.findOne({ requestDelivery: delivery._id });
    if (appointment?.status === 'confirmed' || appointment?.status === 'completed')
        return appointment;
    if (appointment?.status === 'cancelled')
        throw new Error('Rezervimi është anuluar');
    if (!appointment) {
        try {
            appointment = await Appointment_1.Appointment.create({
                user: request.user, providerProfile: delivery.providerProfile,
                business: slot.business, serviceOffer: delivery.serviceOffer || slot.serviceOffer,
                userRequest: request._id, requestDelivery: delivery._id, availabilitySlot: slot._id,
                startAt: slot.startAt, endAt: slot.endAt, timezone: slot.timezone || 'Europe/Belgrade',
                mode: slot.mode || 'online', location: slot.location, status: 'pending',
            });
        }
        catch (err) {
            if (err.code !== 11000)
                throw err;
            appointment = await Appointment_1.Appointment.findOne({ requestDelivery: delivery._id });
            if (!appointment)
                throw err;
        }
    }
    const booked = hold.state === 'booked' ? slot : await (0, availabilityService_1.syncSlotWithRequestStatus)({ requestId: deliveryId, status: 'accepted' });
    if (!booked)
        throw new Error('Termini nuk u konfirmua');
    appointment.status = 'confirmed';
    await appointment.save();
    return appointment;
}
async function completeAppointmentFromDelivery(deliveryId) {
    const appointment = await Appointment_1.Appointment.findOne({ requestDelivery: deliveryId });
    if (!appointment || appointment.status !== 'confirmed')
        throw new Error('Rezervimi nuk është konfirmuar');
    appointment.status = 'completed';
    await appointment.save();
    return appointment;
}
async function listMyAppointments(uid) {
    const user = await User_1.User.findOne({ uid }).select('_id').lean();
    if (!user)
        return [];
    return Appointment_1.Appointment.find({ user: user._id, status: { $ne: 'pending' } }).sort({ startAt: -1 }).limit(100);
}
async function listProviderAppointments(uid) {
    const profiles = await (0, providerProfileService_1.listMyProviderProfiles)(uid);
    return Appointment_1.Appointment.find({ providerProfile: { $in: profiles.map((profile) => profile._id) }, status: { $ne: 'pending' } }).sort({ startAt: -1 }).limit(100);
}
async function cancelAppointment(uid, id, reason, asAdmin = false) {
    if (!mongoose_1.Types.ObjectId.isValid(id))
        throw new Error('Appointment ID i pavlefshëm');
    const [user, appointment] = await Promise.all([
        User_1.User.findOne({ uid }).select('_id').lean(), Appointment_1.Appointment.findById(id),
    ]);
    if (!user || !appointment)
        throw new Error('Rezervimi nuk u gjet');
    const profiles = asAdmin ? [] : await (0, providerProfileService_1.listMyProviderProfiles)(uid);
    const owns = appointment.user.equals(user._id) || profiles.some((profile) => profile._id.equals(appointment.providerProfile));
    if (!asAdmin && !owns)
        throw new Error('Nuk ke leje për këtë rezervim');
    if (appointment.status === 'completed' || appointment.status === 'no_show')
        throw new Error('Rezervimi ka përfunduar');
    if (appointment.status !== 'cancelled') {
        appointment.status = 'cancelled';
        appointment.cancellation = { cancelledAt: new Date(), cancelledBy: user._id, reason: reason?.trim() };
        await appointment.save();
    }
    if (appointment.requestDelivery)
        await (0, availabilityService_1.syncSlotWithRequestStatus)({ requestId: String(appointment.requestDelivery), status: 'rejected' });
    return appointment;
}
//# sourceMappingURL=appointmentService.js.map