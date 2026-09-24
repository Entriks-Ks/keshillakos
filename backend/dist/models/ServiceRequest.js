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
exports.ServiceRequest = exports.CONTACT_METHODS = exports.REQUEST_STATUSES = void 0;
const mongoose_1 = __importStar(require("mongoose"));
exports.REQUEST_STATUSES = ['pending', 'accepted', 'rejected', 'completed'];
exports.CONTACT_METHODS = ['chat', 'phone', 'email'];
const serviceRequestSchema = new mongoose_1.Schema({
    seekerUid: { type: String, required: true, index: true },
    seekerName: { type: String, required: true },
    seekerEmail: { type: String, required: true },
    providerUid: { type: String, required: true, index: true },
    providerName: { type: String, required: true },
    serviceId: { type: String },
    serviceTitle: { type: String },
    need: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    location: { type: String },
    language: { type: String },
    urgency: { type: String },
    contactMethod: {
        type: String,
        enum: exports.CONTACT_METHODS,
        required: true,
    },
    status: {
        type: String,
        enum: exports.REQUEST_STATUSES,
        default: 'pending',
        index: true,
    },
    providerNote: { type: String, trim: true },
    slotId: { type: String, index: true },
    requestedStartAt: { type: Date },
    requestedEndAt: { type: Date },
}, { timestamps: true });
exports.ServiceRequest = mongoose_1.default.model('ServiceRequest', serviceRequestSchema);
//# sourceMappingURL=ServiceRequest.js.map