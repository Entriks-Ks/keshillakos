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
exports.Category = exports.categorySchema = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const extensionFieldSchema = new mongoose_1.Schema({
    key: { type: String, required: true, trim: true, match: /^[a-z][A-Za-z0-9]*$/ },
    type: { type: String, required: true, enum: ['string', 'number', 'boolean', 'stringArray'] },
    required: Boolean,
    mustBeTrue: Boolean,
    allowedValues: { type: [String], default: undefined },
    oneOfGroup: String,
    defaultValue: mongoose_1.Schema.Types.Mixed,
}, { _id: false });
exports.categorySchema = new mongoose_1.Schema({
    name: {
        sq: { type: String, trim: true },
        en: { type: String, trim: true },
    },
    isActive: { type: Boolean, default: true },
    portal: { type: String, required: true, trim: true, lowercase: true, match: /^[a-z][a-z0-9-]*$/ },
    stableId: { type: String, required: true, trim: true, lowercase: true, match: /^[a-z][a-z0-9-]*$/ },
    slug: { type: String, required: true, trim: true, lowercase: true, match: /^[a-z][a-z0-9-]*$/ },
    parent: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Category' },
    labels: { type: Map, of: String, required: true, validate: [(value) => Boolean(value?.get('sq')?.trim()), 'SQ label is required'] },
    guidelines: { type: Map, of: String },
    examples: { type: [String], default: [] },
    keywords: { type: [String], default: [] },
    order: { type: Number, default: 0 },
    status: { type: String, enum: ['draft', 'active', 'archived'], default: 'draft' },
    source: { type: String, enum: ['seed', 'legacy', 'admin'], default: 'admin' },
    version: { type: Number, min: 1, default: 1 },
    requirements: { type: [String], default: [] },
    extensionFields: { type: [extensionFieldSchema], default: [] },
    configRefs: {
        serviceSchema: { type: String, trim: true },
        providerSchema: { type: String, trim: true },
        verification: { type: String, trim: true },
        review: { type: String, trim: true },
        policy: { type: String, trim: true },
    },
}, { timestamps: true });
exports.categorySchema.pre('validate', function () {
    if (this.parent?.equals(this._id))
        this.invalidate('parent', 'Category cannot parent itself');
    const keys = this.extensionFields.map((field) => field.key);
    if (new Set(keys).size !== keys.length)
        this.invalidate('extensionFields', 'Extension field keys must be unique');
});
exports.categorySchema.index({ portal: 1, stableId: 1 }, { unique: true });
exports.categorySchema.index({ portal: 1, slug: 1 }, { unique: true });
exports.categorySchema.index({ slug: 1 }, { unique: true });
exports.categorySchema.index({ isActive: 1, order: 1 });
exports.categorySchema.index({ portal: 1, parent: 1, status: 1, order: 1 });
exports.Category = mongoose_1.default.model('Category', exports.categorySchema);
//# sourceMappingURL=Category.js.map