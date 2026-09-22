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
exports.AvailabilitySlot = exports.availabilitySlotSchema = exports.SLOT_STATUSES = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const location_1 = require("./location");
exports.SLOT_STATUSES = ['open', 'held', 'booked', 'cancelled'];
exports.availabilitySlotSchema = new mongoose_1.Schema({
    providerUid: { type: String, index: true }, // Historical API alias, never a canonical provider ID.
    providerName: { type: String },
    providerProfile: { type: mongoose_1.Schema.Types.ObjectId, ref: 'ProviderProfile' },
    business: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Business' },
    serviceOffer: { type: mongoose_1.Schema.Types.ObjectId, ref: 'ServiceOffer' },
    staffUser: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User' },
    resourceKey: { type: String, trim: true, maxlength: 120 },
    startAt: { type: Date, required: true, index: true },
    endAt: { type: Date, required: true },
    timezone: { type: String, trim: true, default: 'Europe/Belgrade' },
    mode: { type: String, enum: ['online', 'on_site'], default: 'online' },
    location: { type: location_1.locationSchema },
    capacity: { type: Number, min: 1, max: 100, default: 1 },
    holds: { type: [{ requestId: { type: String, required: true }, state: { type: String, enum: ['held', 'booked'], required: true }, heldAt: { type: Date, required: true } }], default: [] },
    status: {
        type: String,
        enum: exports.SLOT_STATUSES,
        default: 'open',
        index: true,
    },
    note: { type: String, trim: true },
    requestId: { type: String },
}, { timestamps: true });
exports.availabilitySlotSchema.index({ providerUid: 1, startAt: 1, status: 1 });
exports.availabilitySlotSchema.index({ providerProfile: 1, startAt: 1, endAt: 1, status: 1 });
exports.availabilitySlotSchema.index({ providerProfile: 1, staffUser: 1, resourceKey: 1, startAt: 1 });
exports.availabilitySlotSchema.index({ 'holds.requestId': 1 }, { sparse: true });
exports.availabilitySlotSchema.pre('validate', function () {
    if (!this.providerProfile && !this.providerUid?.trim())
        this.invalidate('providerProfile', 'ProviderProfile or legacy provider UID is required');
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
    if (this.holds.length > this.capacity)
        this.invalidate('holds', 'Holds exceed capacity');
    if (this.mode === 'on_site' && this.location?.online)
        this.invalidate('location', 'On-site slot cannot be online');
});
exports.AvailabilitySlot = mongoose_1.default.model('AvailabilitySlot', exports.availabilitySlotSchema);
//# sourceMappingURL=AvailabilitySlot.js.map