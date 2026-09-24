"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.Appointment = exports.appointmentSchema = exports.APPOINTMENT_STATUSES = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const location_1 = require("./location");
exports.APPOINTMENT_STATUSES = ['pending', 'confirmed', 'completed', 'cancelled', 'no_show'];
exports.appointmentSchema = new mongoose_1.Schema({
    user: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    providerProfile: { type: mongoose_1.Schema.Types.ObjectId, ref: 'ProviderProfile', required: true },
    business: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Business' },
    serviceOffer: { type: mongoose_1.Schema.Types.ObjectId, ref: 'ServiceOffer' },
    userRequest: { type: mongoose_1.Schema.Types.ObjectId, ref: 'UserRequest' },
    requestDelivery: { type: mongoose_1.Schema.Types.ObjectId, ref: 'RequestDelivery' },
    availabilitySlot: { type: mongoose_1.Schema.Types.ObjectId, ref: 'AvailabilitySlot' },
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },
    timezone: { type: String, required: true, trim: true },
    mode: { type: String, enum: ['online', 'on_site'], required: true },
    location: { type: location_1.locationSchema },
    status: { type: String, enum: exports.APPOINTMENT_STATUSES, default: 'confirmed' },
    cancellation: {
        cancelledAt: Date,
        cancelledBy: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User' },
        reason: { type: String, trim: true, maxlength: 1000 },
    },
}, { timestamps: true });
exports.appointmentSchema.pre('validate', function () {
    if (this.startAt && this.endAt && this.endAt <= this.startAt)
        this.invalidate('endAt', 'End must follow start');
    if (this.timezone) {
        try {
            new Intl.DateTimeFormat('en-US', { timeZone: this.timezone });
        }
        catch {
            this.invalidate('timezone', 'Invalid IANA timezone');
        }
    }
    if (this.mode === 'on_site' && this.location?.online)
        this.invalidate('location', 'On-site appointment cannot be online');
    if (this.status === 'cancelled' && (!this.cancellation?.cancelledAt || !this.cancellation.cancelledBy))
        this.invalidate('cancellation', 'Cancellation audit is required');
});
exports.appointmentSchema.index({ user: 1, startAt: -1 });
exports.appointmentSchema.index({ providerProfile: 1, startAt: -1, status: 1 });
exports.appointmentSchema.index({ business: 1, startAt: -1 });
exports.appointmentSchema.index({ requestDelivery: 1 }, { unique: true, partialFilterExpression: { requestDelivery: { $exists: true } } });
exports.appointmentSchema.index({ availabilitySlot: 1, startAt: 1 });
exports.Appointment = mongoose_1.default.model('Appointment', exports.appointmentSchema);
//# sourceMappingURL=Appointment.js.map