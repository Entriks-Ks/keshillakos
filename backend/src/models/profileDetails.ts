import { z } from 'zod'
import { CatalogOption } from './CatalogOption'
import { normalizeWorkExperience } from './providerCareer'

export const PROFICIENCIES = ['beginner', 'elementary', 'intermediate', 'upper_intermediate', 'advanced', 'native'] as const
export type LanguageSkill = { language: string; proficiency?: typeof PROFICIENCIES[number] }
export const languageSkillSchema = {
  language: { type: String, required: true, trim: true, maxlength: 80 },
  proficiency: { type: String, enum: PROFICIENCIES },
}
export const languageSkillsInput = z.array(z.object({
  language: z.string().trim().min(1).max(80),
  proficiency: z.enum(PROFICIENCIES).optional(),
}).strict()).max(12)
const monthYear = z.object({ month: z.number().int().min(1).max(12), year: z.number().int().min(1950).max(2100) })
export const workExperienceInput = z.array(z.object({
  position: z.string().trim().min(1).max(160), organization: z.string().trim().min(1).max(160),
  from: monthYear, to: monthYear.optional(), current: z.boolean().default(false),
  description: z.string().trim().max(2000).optional(),
}).refine(row => row.current || Boolean(row.to && row.to.year * 12 + row.to.month >= row.from.year * 12 + row.from.month), 'profileDetails.invalidExperience')).max(30)

export function validatedExperience(input: unknown) {
  const parsed = workExperienceInput.safeParse(input)
  if (!parsed.success) throw new Error('profileDetails.invalidExperience')
  return normalizeWorkExperience(parsed.data)
}

/** Legacy web writes still use string arrays; retain proficiency for surviving names. */
export function reconcileLanguageSkills(names: string[], skills: LanguageSkill[] = []): LanguageSkill[] {
  return names.map(language => ({ language, proficiency: skills.find(skill => skill.language.toLowerCase() === language.toLowerCase())?.proficiency }))
}
export async function validatedLanguageSkills(input: unknown, previousNames: string[] = []) {
  const parsed = languageSkillsInput.safeParse(input)
  if (!parsed.success) throw new Error('profileDetails.invalidLanguages')
  const names = parsed.data.map(row => row.language.toLowerCase())
  if (new Set(names).size !== names.length) throw new Error('profileDetails.duplicateLanguage')
  const options = await CatalogOption.find({ group: 'language', isActive: true }).select('name.sq').lean()
  const canonical = new Map([...previousNames, ...options.map(option => option.name.sq)].map(name => [name.toLowerCase(), name]))
  const allowed = new Set(canonical.keys())
  if (names.some(name => !allowed.has(name))) throw new Error('profileDetails.invalidLanguages')
  if (parsed.data.some(row => !row.proficiency && !previousNames.some(name => name.toLowerCase() === row.language.toLowerCase()))) throw new Error('profileDetails.invalidLanguages')
  return parsed.data.map(row => ({ ...row, language: canonical.get(row.language.toLowerCase())! }))
}
