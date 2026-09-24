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
exports.Business = exports.businessSchema = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const location_1 = require("./location");
const socialLinks_1 = require("./socialLinks");
const businessLocationSchema = new mongoose_1.Schema({
    countryId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Country', required: true },
    cityId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'City', required: true },
}, { _id: false });
exports.businessSchema = new mongoose_1.Schema({
    publicName: { type: String, required: true, trim: true, minlength: 1, maxlength: 160 },
    legalName: { type: String, trim: true, maxlength: 200 },
    logoUrl: { type: String, trim: true, maxlength: 500 },
    description: { type: String, trim: true, maxlength: 3000 },
    website: { type: String, trim: true, maxlength: 500 },
    contactEmail: {
        type: String,
        trim: true,
        lowercase: true,
        maxlength: 160,
        validate: {
            validator: (value) => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
            message: 'Invalid email',
        },
    },
    contactPhone: {
        type: String,
        trim: true,
        maxlength: 32,
        validate: {
            validator: (value) => !value || /^\+[1-9]\d{1,14}$/.test(value),
            message: 'Invalid phone',
        },
    },
    categoryIds: { type: [{ type: String, trim: true }], default: [] },
    location: { type: businessLocationSchema, default: undefined },
    socialLinks: { type: (0, socialLinks_1.socialLinksSchemaDefinition)(), default: undefined },
    owners: { type: [{ type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true }], required: true, validate: [(value) => value.length > 0 && new Set(value.map(String)).size === value.length, 'At least one distinct owner is required'] },
    members: {
        type: [{ user: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true }, role: { type: String, enum: ['manager', 'member'], required: true } }],
        default: [],
    },
    invitations: {
        type: [{
                user: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
                invitedBy: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
                invitedAt: { type: Date, required: true },
            }],
        default: [],
    },
    branches: {
        type: [{ name: { type: String, required: true, trim: true }, location: { type: location_1.locationSchema, required: true } }],
        default: [],
    },
    verification: {
        status: { type: String, enum: ['unverified', 'pending', 'verified', 'rejected'], default: 'unverified' },
        reviewedAt: Date,
        reviewedBy: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User' },
    },
    status: { type: String, enum: ['draft', 'active', 'suspended', 'closed'], default: 'draft' },
}, { timestamps: true });
exports.businessSchema.index({ owners: 1, status: 1 });
exports.businessSchema.index({ 'members.user': 1, status: 1 });
exports.businessSchema.index({ 'invitations.user': 1 });
exports.businessSchema.index({ status: 1, publicName: 1 });
exports.businessSchema.pre('validate', function () {
    if (this.verification?.status === 'verified' && !this.legalName?.trim()) {
        this.invalidate('legalName', 'Verified businesses require a legal name');
    }
});
exports.Business = mongoose_1.default.model('Business', exports.businessSchema);
//# sourceMappingURL=Business.js.map