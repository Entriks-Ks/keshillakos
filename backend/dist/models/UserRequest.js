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
exports.UserRequest = exports.userRequestSchema = exports.CONTACT_PREFERENCES = exports.USER_REQUEST_STATUSES = void 0;
exports.normalizeContactPhone = normalizeContactPhone;
const mongoose_1 = __importStar(require("mongoose"));
const location_1 = require("./location");
exports.USER_REQUEST_STATUSES = ['draft', 'open', 'closed', 'cancelled'];
exports.CONTACT_PREFERENCES = ['chat', 'phone', 'email'];
exports.userRequestSchema = new mongoose_1.Schema({
    user: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    category: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Category', required: true },
    problem: { type: String, required: true, trim: true, minlength: 2, maxlength: 240 },
    description: { type: String, required: true, trim: true, minlength: 8, maxlength: 5000 },
    location: { type: location_1.locationSchema },
    language: { type: String, trim: true, lowercase: true, maxlength: 20 },
    budget: {
        min: { type: Number, min: 0 },
        max: { type: Number, min: 0 },
        currency: { type: String, uppercase: true, trim: true, match: /^[A-Z]{3}$/ },
    },
    urgency: { type: String, enum: ['today', 'this_week', 'flexible'], default: 'flexible' },
    preferredMode: { type: String, enum: ['online', 'on_site', 'either'], default: 'either' },
    contactPreference: { type: String, enum: exports.CONTACT_PREFERENCES, required: true },
    contactPhone: { type: String, trim: true, maxlength: 32 },
    contactEmail: { type: String, trim: true, lowercase: true, maxlength: 160 },
    portal: { type: String, required: true, trim: true, lowercase: true },
    source: { type: String, enum: ['web', 'admin', 'legacy'], default: 'web' },
    status: { type: String, enum: exports.USER_REQUEST_STATUSES, default: 'draft' },
}, { timestamps: true });
const PHONE_PATTERN = /^\+?[0-9]{8,15}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function normalizeContactPhone(value) {
    return value?.replace(/[\s()-]/g, '').trim() || undefined;
}
exports.userRequestSchema.pre('validate', function () {
    if (this.budget && this.budget.min !== undefined && this.budget.max !== undefined && this.budget.max < this.budget.min) {
        this.invalidate('budget.max', 'Maximum budget cannot be below minimum budget');
    }
    if (this.budget && (this.budget.min !== undefined || this.budget.max !== undefined) && !this.budget.currency) {
        this.invalidate('budget.currency', 'Budget currency is required');
    }
    const phone = normalizeContactPhone(this.contactPhone);
    this.contactPhone = phone;
    const email = this.contactEmail?.trim().toLowerCase() || undefined;
    this.contactEmail = email;
    if (!phone)
        this.invalidate('contactPhone', 'Numri i telefonit është i detyrueshëm');
    else if (!PHONE_PATTERN.test(phone))
        this.invalidate('contactPhone', 'Numri i telefonit nuk është i vlefshëm');
    if (this.contactPreference === 'email') {
        if (!email)
            this.invalidate('contactEmail', 'Email-i është i detyrueshëm');
        else if (!EMAIL_PATTERN.test(email))
            this.invalidate('contactEmail', 'Email-i nuk është i vlefshëm');
    }
});
exports.userRequestSchema.index({ user: 1, createdAt: -1 });
exports.userRequestSchema.index({ portal: 1, category: 1, status: 1, createdAt: -1 });
exports.UserRequest = mongoose_1.default.model('UserRequest', exports.userRequestSchema);
//# sourceMappingURL=UserRequest.js.map