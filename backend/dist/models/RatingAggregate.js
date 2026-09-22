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
exports.RatingAggregate = exports.ratingAggregateSchema = void 0;
const mongoose_1 = __importStar(require("mongoose"));
exports.ratingAggregateSchema = new mongoose_1.Schema({
    portal: { type: String, required: true, trim: true, lowercase: true },
    scope: { type: String, enum: ['provider', 'business'], required: true },
    subjectId: { type: mongoose_1.Schema.Types.ObjectId, required: true },
    average: { type: Number, min: 0, max: 5, default: 0 },
    count: { type: Number, min: 0, default: 0 },
    verifiedCount: { type: Number, min: 0, default: 0 },
    dimensions: { type: Map, of: new mongoose_1.Schema({ average: { type: Number, min: 0, max: 5 }, count: { type: Number, min: 0 } }, { _id: false }), default: {} },
    calculatedAt: { type: Date, required: true, default: Date.now },
}, { timestamps: false });
exports.ratingAggregateSchema.pre('validate', function () {
    if (this.verifiedCount > this.count)
        this.invalidate('verifiedCount', 'Verified count exceeds count');
});
exports.ratingAggregateSchema.index({ portal: 1, scope: 1, subjectId: 1 }, { unique: true });
exports.RatingAggregate = mongoose_1.default.model('RatingAggregate', exports.ratingAggregateSchema);
//# sourceMappingURL=RatingAggregate.js.map