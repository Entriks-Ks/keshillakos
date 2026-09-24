"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.certificationEntrySchema = exports.educationEntrySchema = exports.workExperienceEntrySchema = void 0;
exports.normalizeWorkExperience = normalizeWorkExperience;
exports.normalizeEducation = normalizeEducation;
exports.normalizeCertifications = normalizeCertifications;
const monthYearSchema = {
    month: { type: Number, required: true, min: 1, max: 12 },
    year: { type: Number, required: true, min: 1950, max: 2100 },
};
exports.workExperienceEntrySchema = {
    position: { type: String, required: true, trim: true, maxlength: 160 },
    organization: { type: String, required: true, trim: true, maxlength: 160 },
    from: { type: monthYearSchema, required: true },
    to: { type: monthYearSchema, required: false },
    current: { type: Boolean, default: false },
    description: { type: String, trim: true, maxlength: 2000 },
};
exports.educationEntrySchema = {
    institution: { type: String, required: true, trim: true, maxlength: 160 },
    degree: { type: String, required: true, trim: true, maxlength: 160 },
    fieldOfStudy: { type: String, required: true, trim: true, maxlength: 160 },
    from: { type: monthYearSchema, required: true },
    to: { type: monthYearSchema, required: false },
    current: { type: Boolean, default: false },
};
exports.certificationEntrySchema = {
    name: { type: String, required: true, trim: true, maxlength: 160 },
    issuer: { type: String, required: true, trim: true, maxlength: 160 },
    year: { type: Number, required: true, min: 1950, max: 2100 },
    credentialUrl: { type: String, trim: true, maxlength: 500 },
};
function isMonthYear(value) {
    if (!value || typeof value !== 'object')
        return false;
    const entry = value;
    return Number.isInteger(entry.month) && entry.month >= 1 && entry.month <= 12
        && Number.isInteger(entry.year) && entry.year >= 1950 && entry.year <= 2100;
}
function cleanText(value, max) {
    if (typeof value !== 'string')
        return '';
    return value.trim().slice(0, max);
}
function assertPeriod(from, to, current, label) {
    if (current)
        return;
    if (!to)
        throw new Error(`${label}: zgjidh datën e përfundimit ose shëno si aktuale`);
    const fromValue = from.year * 12 + from.month;
    const toValue = to.year * 12 + to.month;
    if (toValue < fromValue)
        throw new Error(`${label}: data e përfundimit nuk mund të jetë para fillimit`);
}
function normalizeWorkExperience(input) {
    if (input === undefined)
        return [];
    if (!Array.isArray(input))
        throw new Error('Përvoja e punës nuk është e vlefshme');
    return input.slice(0, 30).map((raw, index) => {
        const row = (raw || {});
        const position = cleanText(row.position, 160);
        const organization = cleanText(row.organization, 160);
        if (!position || !organization)
            throw new Error(`Përvoja #${index + 1}: pozita dhe kompania janë të detyrueshme`);
        if (!isMonthYear(row.from))
            throw new Error(`Përvoja #${index + 1}: data e fillimit nuk është e vlefshme`);
        const current = Boolean(row.current);
        const to = current ? undefined : (isMonthYear(row.to) ? row.to : undefined);
        assertPeriod(row.from, to, current, `Përvoja #${index + 1}`);
        const description = cleanText(row.description, 2000) || undefined;
        return { position, organization, from: row.from, to, current, description };
    });
}
function normalizeEducation(input) {
    if (input === undefined)
        return [];
    if (!Array.isArray(input))
        throw new Error('Arsimi nuk është i vlefshëm');
    return input.slice(0, 20).map((raw, index) => {
        const row = (raw || {});
        const institution = cleanText(row.institution, 160);
        const degree = cleanText(row.degree, 160);
        const fieldOfStudy = cleanText(row.fieldOfStudy, 160);
        if (!institution || !degree || !fieldOfStudy) {
            throw new Error(`Arsimi #${index + 1}: institucioni, diploma dhe fusha janë të detyrueshme`);
        }
        if (!isMonthYear(row.from))
            throw new Error(`Arsimi #${index + 1}: data e fillimit nuk është e vlefshme`);
        const current = Boolean(row.current);
        const to = current ? undefined : (isMonthYear(row.to) ? row.to : undefined);
        assertPeriod(row.from, to, current, `Arsimi #${index + 1}`);
        return { institution, degree, fieldOfStudy, from: row.from, to, current };
    });
}
function normalizeCredentialUrl(value, index) {
    const raw = cleanText(value, 500);
    if (!raw)
        return undefined;
    let url;
    try {
        url = new URL(raw);
    }
    catch {
        throw new Error(`Certifikimi #${index + 1}: URL e kredencialit nuk është e vlefshme`);
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        throw new Error(`Certifikimi #${index + 1}: URL duhet të fillojë me http:// ose https://`);
    }
    return url.toString();
}
function normalizeCertifications(input) {
    if (input === undefined)
        return [];
    if (!Array.isArray(input))
        throw new Error('Certifikimet nuk janë të vlefshme');
    const currentYear = new Date().getFullYear();
    return input.slice(0, 30).map((raw, index) => {
        const row = (raw || {});
        const name = cleanText(row.name, 160);
        const issuer = cleanText(row.issuer, 160);
        const year = Number(row.year);
        if (!name || !issuer) {
            throw new Error(`Certifikimi #${index + 1}: emri dhe institucioni janë të detyrueshme`);
        }
        if (!Number.isInteger(year) || year < 1950 || year > currentYear + 1) {
            throw new Error(`Certifikimi #${index + 1}: viti nuk është i vlefshëm`);
        }
        return {
            name,
            issuer,
            year,
            credentialUrl: normalizeCredentialUrl(row.credentialUrl, index),
        };
    });
}
//# sourceMappingURL=providerCareer.js.map