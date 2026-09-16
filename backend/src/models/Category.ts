import mongoose, { Schema, Types } from 'mongoose'

export type ExtensionField = {
  key: string
  type: 'string' | 'number' | 'boolean' | 'stringArray'
  required?: boolean
  mustBeTrue?: boolean
  allowedValues?: string[]
  oneOfGroup?: string
  defaultValue?: unknown
}

export type CategoryDoc = {
  portal: string
  stableId: string
  slug: string
  parent?: Types.ObjectId
  labels: Map<string, string>
  guidelines?: Map<string, string>
  examples: string[]
  keywords: string[]
  order: number
  status: 'draft' | 'active' | 'archived'
  source: 'seed' | 'legacy' | 'admin'
  version: number
  requirements: string[] // Compatibility metadata, not runtime validation logic.
  extensionFields: ExtensionField[]
  configRefs: {
    serviceSchema?: string
    providerSchema?: string
    verification?: string
    review?: string
    policy?: string
  }
  createdAt: Date
  updatedAt: Date
}

const extensionFieldSchema = new Schema<ExtensionField>({
  key: { type: String, required: true, trim: true, match: /^[a-z][A-Za-z0-9]*$/ },
  type: { type: String, required: true, enum: ['string', 'number', 'boolean', 'stringArray'] },
  required: Boolean,
  mustBeTrue: Boolean,
  allowedValues: { type: [String], default: undefined },
  oneOfGroup: String,
  defaultValue: Schema.Types.Mixed,
}, { _id: false })

export const categorySchema = new Schema<CategoryDoc>({
  portal: { type: String, required: true, trim: true, lowercase: true, match: /^[a-z][a-z0-9-]*$/ },
  stableId: { type: String, required: true, trim: true, lowercase: true, match: /^[a-z][a-z0-9-]*$/ },
  slug: { type: String, required: true, trim: true, lowercase: true, match: /^[a-z][a-z0-9-]*$/ },
  parent: { type: Schema.Types.ObjectId, ref: 'Category' },
  labels: { type: Map, of: String, required: true, validate: [(value: Map<string, string>) => Boolean(value?.get('sq')?.trim()), 'SQ label is required'] },
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
}, { timestamps: true })

categorySchema.pre('validate', function () {
  if (this.parent?.equals(this._id)) this.invalidate('parent', 'Category cannot parent itself')
  const keys = this.extensionFields.map((field) => field.key)
  if (new Set(keys).size !== keys.length) this.invalidate('extensionFields', 'Extension field keys must be unique')
})
categorySchema.index({ portal: 1, stableId: 1 }, { unique: true })
categorySchema.index({ portal: 1, slug: 1 }, { unique: true })
categorySchema.index({ portal: 1, parent: 1, status: 1, order: 1 })

export const Category = mongoose.model<CategoryDoc>('Category', categorySchema)
