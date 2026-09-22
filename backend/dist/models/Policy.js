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
exports.Policy = exports.policySchema = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const policyKey = /^[a-z][a-z0-9-]*$/;
const fieldKey = /^[a-z][A-Za-z0-9.]*$/;
const days = { type: Number, min: 1, max: 36500 };
exports.policySchema = new mongoose_1.Schema({
    portal: { type: String, required: true, trim: true, lowercase: true, match: policyKey },
    key: { type: String, required: true, trim: true, lowercase: true, match: policyKey },
    category: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Category' },
    version: { type: Number, required: true, min: 1, validate: Number.isInteger },
    status: { type: String, enum: ['draft', 'active', 'retired'], default: 'draft' },
    effectiveFrom: Date,
    effectiveUntil: Date,
    supersedes: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Policy' },
    rules: {
        privacy: {
            requireConsent: { type: Boolean, default: true },
            reviewerDisplay: { type: String, enum: ['first_name', 'anonymous'], default: 'anonymous' },
            contactDisclosure: { type: String, enum: ['never', 'after_interaction'], default: 'after_interaction' },
        },
        sensitiveData: {
            publicRedactions: { type: [String], default: [] },
            prohibitFreeTextSecrets: { type: Boolean, default: true },
            exportRequiresApproval: { type: Boolean, default: true },
        },
        providerVerification: {
            requiredChecks: { type: [{ type: String, enum: ['identity', 'business', 'qualification'] }], default: [] },
            requireBusinessVerification: { type: Boolean, default: false },
        },
        reviewEligibility: {
            completedDelivery: { type: Boolean, default: true },
            completedAppointment: { type: Boolean, default: true },
        },
        moderation: {
            reviewRequiresApproval: { type: Boolean, default: true },
            abuseBlocksPublication: { type: Boolean, default: true },
            responseRequiresApproval: { type: Boolean, default: false },
        },
        retention: {
            userRequestDays: days, deliveryDays: days, appointmentDays: days, reviewDays: days,
            legalHold: { type: Boolean, default: false },
        },
        categoryRequirements: {
            requiredProviderFields: { type: [String], default: [] },
            requiredOfferExtensions: { type: [String], default: [] },
            allowedModes: { type: [{ type: String, enum: ['online', 'on_site'] }], default: ['online', 'on_site'] },
        },
    },
    publishedAt: Date,
}, { timestamps: true });
exports.policySchema.pre('validate', function () {
    if (this.effectiveFrom && this.effectiveUntil && this.effectiveUntil <= this.effectiveFrom)
        this.invalidate('effectiveUntil', 'Policy end must follow start');
    if (this.status === 'active' && !this.publishedAt)
        this.invalidate('publishedAt', 'Active policy requires publication time');
    if (this.supersedes?.equals(this._id))
        this.invalidate('supersedes', 'Policy cannot supersede itself');
    for (const value of [
        ...(this.rules?.sensitiveData?.publicRedactions ?? []),
        ...(this.rules?.categoryRequirements?.requiredProviderFields ?? []),
        ...(this.rules?.categoryRequirements?.requiredOfferExtensions ?? []),
    ])
        if (!fieldKey.test(value))
            this.invalidate('rules', `Invalid policy field reference: ${value}`);
});
exports.policySchema.index({ portal: 1, key: 1, category: 1, version: 1 }, { unique: true });
exports.policySchema.index({ portal: 1, key: 1, category: 1 }, { unique: true, partialFilterExpression: { status: 'active' } });
exports.policySchema.index({ portal: 1, category: 1, status: 1, effectiveFrom: -1 });
exports.Policy = mongoose_1.default.model('Policy', exports.policySchema);
//# sourceMappingURL=Policy.js.map