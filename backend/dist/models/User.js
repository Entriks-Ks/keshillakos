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
exports.User = exports.userSchema = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const roles_1 = require("../types/roles");
const optionalText = (max) => ({
    type: String,
    trim: true,
    maxlength: max,
    set: (value) => typeof value === 'string' ? value.trim() || undefined : value,
});
const savedLocationSchema = new mongoose_1.Schema({
    countryId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Country', required: true },
    cityId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'City', required: true },
}, { _id: false });
exports.userSchema = new mongoose_1.Schema({
    uid: { type: String, required: true, unique: true, trim: true },
    email: {
        type: String, required: true, unique: true, trim: true, lowercase: true,
        validate: { validator: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), message: 'Invalid email' },
    },
    name: { type: String, required: true, trim: true, maxlength: 160 },
    firstName: optionalText(80),
    lastName: optionalText(80),
    phone: { ...optionalText(32), match: /^\+[1-9]\d{1,14}$/ },
    locale: optionalText(35),
    country: { ...optionalText(2), uppercase: true, match: /^[A-Z]{2}$/ },
    city: optionalText(120),
    role: { type: String, enum: roles_1.ROLES, required: true, default: 'user' },
    roles: { type: [{ type: String, enum: roles_1.ROLES }], default: undefined },
    requestedRole: { type: String, enum: roles_1.ROLES },
    verification: {
        email: { type: Boolean, default: false },
        phone: { type: Boolean, default: false },
        identity: { type: Boolean, default: false },
    },
    privacy: {
        profileVisibility: { type: String, enum: ['public', 'private'], default: 'private' },
        marketingConsent: { type: Boolean, default: false },
    },
    accountStatus: { type: String, enum: ['active', 'suspended', 'closed'], default: 'active' },
    // Existing documents retain these fields; new account writes do not populate them.
    headline: String,
    bio: String,
    location: { type: savedLocationSchema, default: undefined },
    legacyLocation: String,
    skills: { type: [String], default: undefined },
    languages: { type: [String], default: undefined },
    profilePhoto: String,
}, { timestamps: true });
exports.userSchema.pre('init', (raw) => {
    if (typeof raw.location === 'string') {
        raw.legacyLocation = raw.location;
        delete raw.location;
    }
});
// Unverified phone numbers must not reserve a unique identity.
exports.userSchema.index({ phone: 1 }, { sparse: true });
exports.userSchema.index({ roles: 1, accountStatus: 1 });
exports.User = mongoose_1.default.model('User', exports.userSchema);
//# sourceMappingURL=User.js.map