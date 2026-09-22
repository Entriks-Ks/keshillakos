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
exports.ProviderProfile = exports.providerProfileSchema = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const location_1 = require("./location");
const verificationStates = ['unverified', 'pending', 'verified', 'rejected'];
const baseLocationSchema = new mongoose_1.Schema({
    countryId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Country', required: true },
    cityId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'City', required: true },
}, { _id: false });
exports.providerProfileSchema = new mongoose_1.Schema({
    providerType: { type: String, enum: ['individual', 'business'], required: true },
    ownerUser: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    business: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Business', required: function () { return this.providerType === 'business'; } },
    categories: { type: [{ type: String, trim: true }], required: true, validate: [(value) => value.length > 0 && value.every(Boolean), 'At least one category is required'] },
    languages: { type: [{ type: String, trim: true }], default: [] },
    locations: { type: [location_1.locationSchema], default: [] },
    serviceAreas: { type: [location_1.locationSchema], default: [] },
    location: { type: baseLocationSchema, default: undefined },
    serviceAreaCityIds: { type: [{ type: mongoose_1.Schema.Types.ObjectId, ref: 'City' }], default: [] },
    modes: { type: [{ type: String, enum: ['online', 'on_site'] }], default: [] },
    publicProfile: {
        displayName: { type: String, required: true, trim: true, minlength: 1, maxlength: 160 },
        title: { type: String, trim: true, maxlength: 160 },
        shortDescription: { type: String, trim: true, maxlength: 300 },
        description: { type: String, trim: true, maxlength: 3000 },
        photoUrl: { type: String, trim: true, maxlength: 500 },
        publicEmail: { type: String, trim: true, lowercase: true },
        publicPhone: { type: String, trim: true },
    },
    status: { type: String, enum: ['draft', 'pending', 'published', 'suspended'], default: 'pending' },
    verification: {
        identity: { type: String, enum: verificationStates, default: 'unverified' },
        business: { type: String, enum: verificationStates, default: 'unverified' },
        qualification: { type: String, enum: verificationStates, default: 'unverified' },
    },
    qualificationClaims: {
        type: [{ categoryId: { type: String, required: true, trim: true }, referenceNumber: { type: String, trim: true }, status: { type: String, enum: ['unverified', 'verified', 'rejected'], default: 'unverified' } }],
        default: undefined,
    },
    moderation: {
        status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
        reviewedAt: Date,
        reviewedBy: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User' },
        reason: { type: String, trim: true, maxlength: 500 },
    },
}, { timestamps: true });
exports.providerProfileSchema.pre('validate', function () {
    if (this.modes.includes('on_site') && !this.location && this.locations.length === 0) {
        this.invalidate('location', 'On-site providers require a location');
    }
    if (new Set(this.serviceAreaCityIds.map(String)).size !== this.serviceAreaCityIds.length)
        this.invalidate('serviceAreaCityIds', 'Duplicate service-area cities');
});
exports.providerProfileSchema.index({ ownerUser: 1, status: 1 });
exports.providerProfileSchema.index({ business: 1, status: 1 });
exports.providerProfileSchema.index({ categories: 1, status: 1 });
exports.providerProfileSchema.index({ status: 1, 'moderation.status': 1, updatedAt: -1 });
exports.providerProfileSchema.index({ business: 1, providerType: 1 }, { unique: true, partialFilterExpression: { providerType: 'business' } });
exports.providerProfileSchema.index({ 'location.countryId': 1, 'location.cityId': 1, status: 1 });
exports.providerProfileSchema.index({ serviceAreaCityIds: 1, status: 1 });
exports.ProviderProfile = mongoose_1.default.model('ProviderProfile', exports.providerProfileSchema);
//# sourceMappingURL=ProviderProfile.js.map