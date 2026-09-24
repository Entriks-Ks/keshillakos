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
exports.ServiceOffer = exports.serviceOfferSchema = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const location_1 = require("./location");
exports.serviceOfferSchema = new mongoose_1.Schema({
    portal: { type: String, required: true, trim: true, lowercase: true },
    providerProfile: { type: mongoose_1.Schema.Types.ObjectId, ref: 'ProviderProfile', required: true },
    business: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Business' },
    category: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Category', required: true },
    categoryVersion: { type: Number, required: true, min: 1 },
    name: { type: String, required: true, trim: true, minlength: 1, maxlength: 160 },
    subtitle: { type: String, trim: true, maxlength: 160 },
    description: { type: String, required: true, trim: true, minlength: 1, maxlength: 5000 },
    price: {
        model: { type: String, enum: ['free', 'fixed', 'hourly', 'starting_at', 'quote'], required: true },
        amountFrom: { type: Number, min: 0 },
        amountTo: { type: Number, min: 0 },
        currency: { type: String, uppercase: true, trim: true, match: /^[A-Z]{3}$/ },
    },
    durationMinutes: { type: Number, min: 1 },
    formats: { type: [{ type: String, enum: ['individual', 'group', 'project', 'course'] }], default: [] },
    modes: { type: [{ type: String, enum: ['online', 'on_site'] }], default: [] },
    languages: { type: [String], default: [] },
    serviceAreas: { type: [location_1.locationSchema], default: [] },
    photos: { type: [String], default: [] },
    subcategoryId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Subcategory' },
    availabilityMode: { type: String, enum: ['by_arrangement', 'request', 'slots'], default: 'request' },
    status: { type: String, enum: ['draft', 'pending', 'published', 'suspended'], default: 'pending' },
    visibility: { type: String, enum: ['public', 'unlisted', 'private'], default: 'public' },
    extensions: { type: mongoose_1.Schema.Types.Mixed, default: {} },
    moderation: {
        status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
        reviewedAt: Date,
        reviewedBy: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User' },
    },
}, { timestamps: true });
exports.serviceOfferSchema.pre('validate', function () {
    const { model, amountFrom, amountTo, currency } = this.price ?? {};
    if (['fixed', 'hourly', 'starting_at'].includes(model) && (amountFrom === undefined || !currency)) {
        this.invalidate('price', 'Priced offers require amount and currency');
    }
    if (amountFrom !== undefined && amountTo !== undefined && amountTo < amountFrom) {
        this.invalidate('price.amountTo', 'Maximum price cannot be below minimum price');
    }
});
exports.serviceOfferSchema.index({ providerProfile: 1, status: 1, updatedAt: -1 });
exports.serviceOfferSchema.index({ portal: 1, category: 1, status: 1, visibility: 1 });
exports.serviceOfferSchema.index({ business: 1, status: 1 });
exports.ServiceOffer = mongoose_1.default.model('ServiceOffer', exports.serviceOfferSchema);
//# sourceMappingURL=ServiceOffer.js.map