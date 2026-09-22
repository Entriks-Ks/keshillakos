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
exports.Service = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const serviceSchema = new mongoose_1.Schema({
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    categoryId: { type: String, required: true, index: true },
    categoryLabel: { type: String, required: true, trim: true },
    subcategory: { type: String, required: true, trim: true },
    subcategoryId: { type: String, trim: true, index: true },
    location: { type: String, required: true, trim: true },
    priceFrom: { type: Number, min: 0 },
    details: {
        type: new mongoose_1.Schema({
            licenseNumber: String,
            licenseVerified: { type: Boolean, default: false },
            documentsNote: String,
            deadlineNote: String,
            serviceTypeDetail: String,
            audience: { type: String, enum: ['b2c', 'b2b', 'both'] },
            deliveryModes: [{ type: String, enum: ['online', 'physical', 'group'] }],
            languageFrom: String,
            languageTo: String,
            certifiedTranslation: Boolean,
            offerType: { type: String, enum: ['package', 'project', 'service'] },
            priceTo: { type: Number, min: 0 },
            portfolioUrl: String,
            references: String,
            regulatoryNotice: String,
            coachingDisclaimerAccepted: Boolean,
            crossBorder: Boolean,
            supportLanguages: [String],
            experience: String,
            availabilityMode: { type: String, enum: ['by_arrangement', 'request', 'slots'] },
            photos: [String],
        }, { _id: false }),
        default: {},
    },
    providerUid: { type: String, required: true, index: true },
    providerName: { type: String, required: true },
    active: { type: Boolean, default: true, index: true },
}, { timestamps: true });
exports.Service = mongoose_1.default.model('Service', serviceSchema);
//# sourceMappingURL=Service.js.map