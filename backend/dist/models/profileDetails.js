"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.workExperienceInput = exports.languageSkillsInput = exports.languageSkillSchema = exports.PROFICIENCIES = void 0;
exports.validatedExperience = validatedExperience;
exports.reconcileLanguageSkills = reconcileLanguageSkills;
exports.validatedLanguageSkills = validatedLanguageSkills;
const zod_1 = require("zod");
const CatalogOption_1 = require("./CatalogOption");
const providerCareer_1 = require("./providerCareer");
exports.PROFICIENCIES = ['beginner', 'elementary', 'intermediate', 'upper_intermediate', 'advanced', 'native'];
exports.languageSkillSchema = {
    language: { type: String, required: true, trim: true, maxlength: 80 },
    proficiency: { type: String, enum: exports.PROFICIENCIES },
};
exports.languageSkillsInput = zod_1.z.array(zod_1.z.object({
    language: zod_1.z.string().trim().min(1).max(80),
    proficiency: zod_1.z.enum(exports.PROFICIENCIES).optional(),
}).strict()).max(12);
const monthYear = zod_1.z.object({ month: zod_1.z.number().int().min(1).max(12), year: zod_1.z.number().int().min(1950).max(2100) });
exports.workExperienceInput = zod_1.z.array(zod_1.z.object({
    position: zod_1.z.string().trim().min(1).max(160), organization: zod_1.z.string().trim().min(1).max(160),
    from: monthYear, to: monthYear.optional(), current: zod_1.z.boolean().default(false),
    description: zod_1.z.string().trim().max(2000).optional(),
}).refine(row => row.current || Boolean(row.to && row.to.year * 12 + row.to.month >= row.from.year * 12 + row.from.month), 'profileDetails.invalidExperience')).max(30);
function validatedExperience(input) {
    const parsed = exports.workExperienceInput.safeParse(input);
    if (!parsed.success)
        throw new Error('profileDetails.invalidExperience');
    return (0, providerCareer_1.normalizeWorkExperience)(parsed.data);
}
/** Legacy web writes still use string arrays; retain proficiency for surviving names. */
function reconcileLanguageSkills(names, skills = []) {
    return names.map(language => ({ language, proficiency: skills.find(skill => skill.language.toLowerCase() === language.toLowerCase())?.proficiency }));
}
async function validatedLanguageSkills(input, previousNames = []) {
    const parsed = exports.languageSkillsInput.safeParse(input);
    if (!parsed.success)
        throw new Error('profileDetails.invalidLanguages');
    const names = parsed.data.map(row => row.language.toLowerCase());
    if (new Set(names).size !== names.length)
        throw new Error('profileDetails.duplicateLanguage');
    const options = await CatalogOption_1.CatalogOption.find({ group: 'language', isActive: true }).select('name.sq').lean();
    const canonical = new Map([...previousNames, ...options.map(option => option.name.sq)].map(name => [name.toLowerCase(), name]));
    const allowed = new Set(canonical.keys());
    if (names.some(name => !allowed.has(name)))
        throw new Error('profileDetails.invalidLanguages');
    if (parsed.data.some(row => !row.proficiency && !previousNames.some(name => name.toLowerCase() === row.language.toLowerCase())))
        throw new Error('profileDetails.invalidLanguages');
    return parsed.data.map(row => ({ ...row, language: canonical.get(row.language.toLowerCase()) }));
}
//# sourceMappingURL=profileDetails.js.map