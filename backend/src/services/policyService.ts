import { Types } from 'mongoose'
import { Category } from '../models/Category'
import { Policy, type PolicyRules } from '../models/Policy'

// Secure baseline for portals that have not yet published a versioned policy.
export const DEFAULT_POLICY_RULES: PolicyRules = {
  privacy: { requireConsent: true, reviewerDisplay: 'anonymous', contactDisclosure: 'after_interaction' },
  sensitiveData: { publicRedactions: ['licenseNumber'], prohibitFreeTextSecrets: true, exportRequiresApproval: true },
  providerVerification: { requiredChecks: [], requireBusinessVerification: false },
  reviewEligibility: { completedDelivery: true, completedAppointment: true },
  moderation: { reviewRequiresApproval: true, abuseBlocksPublication: true, responseRequiresApproval: false },
  retention: { legalHold: false },
  categoryRequirements: { requiredProviderFields: [], requiredOfferExtensions: [], allowedModes: ['online', 'on_site'] },
}

export async function resolvePolicySnapshot(portal: string, categoryId?: Types.ObjectId) {
  const now = new Date()
  let key = 'platform'
  if (categoryId) {
    const category = await Category.findById(categoryId).select('portal configRefs.policy').lean()
    if (!category || category.portal !== portal) throw new Error('Policy category does not belong to portal')
    key = category.configRefs?.policy || key
  }
  const effective = { status: 'active' as const, $and: [
    { $or: [{ effectiveFrom: { $exists: false } }, { effectiveFrom: { $lte: now } }] },
    { $or: [{ effectiveUntil: { $exists: false } }, { effectiveUntil: { $gt: now } }] },
  ] }
  const specific = categoryId ? await Policy.findOne({ portal, key, category: categoryId, ...effective }).sort({ version: -1 }) : null
  if (specific) return { rules: specific.rules, policyId: specific._id, version: specific.version }
  const global = await Policy.findOne({ portal, key, category: null, ...effective }).sort({ version: -1 })
  if (global) return { rules: global.rules, policyId: global._id, version: global.version }
  if (key !== 'platform') {
    const fallback = await Policy.findOne({ portal, key: 'platform', category: null, ...effective }).sort({ version: -1 })
    if (fallback) return { rules: fallback.rules, policyId: fallback._id, version: fallback.version }
  }
  return { rules: DEFAULT_POLICY_RULES, policyId: undefined, version: undefined }
}

export async function resolvePolicyRules(portal: string, categoryId?: Types.ObjectId): Promise<PolicyRules> {
  return (await resolvePolicySnapshot(portal, categoryId)).rules
}
