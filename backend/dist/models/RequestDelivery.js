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
exports.RequestDelivery = exports.requestDeliverySchema = exports.DELIVERY_STATUSES = void 0;
const mongoose_1 = __importStar(require("mongoose"));
exports.DELIVERY_STATUSES = ['pending', 'read', 'accepted', 'rejected', 'completed', 'withdrawn'];
exports.requestDeliverySchema = new mongoose_1.Schema({
    request: { type: mongoose_1.Schema.Types.ObjectId, ref: 'UserRequest', required: true },
    providerProfile: { type: mongoose_1.Schema.Types.ObjectId, ref: 'ProviderProfile', required: true },
    serviceOffer: { type: mongoose_1.Schema.Types.ObjectId, ref: 'ServiceOffer' },
    status: { type: String, enum: exports.DELIVERY_STATUSES, default: 'pending' },
    sentAt: { type: Date, required: true, default: Date.now },
    readAt: Date,
    respondedAt: Date,
    response: { type: String, trim: true, maxlength: 3000 },
    offer: {
        description: { type: String, trim: true, maxlength: 2000 },
        amount: { type: Number, min: 0 },
        currency: { type: String, uppercase: true, trim: true, match: /^[A-Z]{3}$/ },
    },
    slotId: String,
    requestedStartAt: Date,
    requestedEndAt: Date,
}, { timestamps: true });
exports.requestDeliverySchema.pre('validate', function () {
    if (this.offer?.amount !== undefined && !this.offer.currency)
        this.invalidate('offer.currency', 'Offer currency is required');
});
exports.requestDeliverySchema.index({ request: 1, providerProfile: 1 }, { unique: true });
exports.requestDeliverySchema.index({ providerProfile: 1, status: 1, sentAt: -1 });
exports.requestDeliverySchema.index({ request: 1, sentAt: -1 });
exports.RequestDelivery = mongoose_1.default.model('RequestDelivery', exports.requestDeliverySchema);
//# sourceMappingURL=RequestDelivery.js.map