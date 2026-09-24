"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.filterMatchCandidates = filterMatchCandidates;
exports.matchExperts = matchExperts;
const generative_ai_1 = require("@google/generative-ai");
const mongoose_1 = require("mongoose");
const Category_1 = require("../models/Category");
const Subcategory_1 = require("../models/Subcategory");
const expertService_1 = require("./expertService");
const providerPublicService_1 = require("./providerPublicService");
const serviceService_1 = require("./serviceService");
function normalize(text) {
    return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}
function languageLabel(code) {
    switch (code) {
        case 'Albanian':
            return ['Shqip', 'Albanian', 'Albanisch'];
        case 'German':
            return ['Gjermanisht', 'German', 'Deutsch'];
        case 'English':
            return ['Anglisht', 'English', 'Englisch'];
    }
}
function filterMatchCandidates(candidates, filters) {
    const category = filters.categoryId && normalize(filters.categoryId);
    const names = filters.subcategoryNames?.map(normalize) ?? [];
    return candidates.filter((candidate) => {
        if (filters.serviceId && (candidate.source !== 'service' || candidate.id !== filters.serviceId))
            return false;
        if (category && ![candidate.categoryId || '', candidate.categoryLabel || ''].some((value) => normalize(value) === category))
            return false;
        if (names.length && !names.some((name) => normalize(`${candidate.specialty || ''} ${candidate.title}`).includes(name)))
            return false;
        return true;
    });
}
async function loadCandidates(intake) {
    const [experts, services] = await Promise.all([
        intake.serviceId ? Promise.resolve([]) : (0, expertService_1.listActiveExperts)(intake.cityId),
        (0, serviceService_1.listActiveServices)({ cityId: intake.cityId, categoryId: intake.categoryId, subcategoryId: intake.subcategoryId, serviceId: intake.serviceId }),
    ]);
    const fromExperts = experts.map((e) => ({
        id: e.id,
        source: 'expert',
        providerUid: e.companyUid,
        providerId: 'providerId' in e ? e.providerId : undefined,
        name: e.name,
        title: e.title,
        categoryId: e.categoryId,
        categoryLabel: e.categoryLabel,
        specialty: e.specialty,
        location: e.location,
        languages: [e.languageFrom, e.languageTo].filter(Boolean),
        verified: Boolean(e.licenseVerified),
        bio: e.bio,
        companyName: e.companyName,
        providerEmail: 'providerId' in e ? e.publicEmail : undefined,
    }));
    const fromServices = services.map((s) => ({
        id: s.id,
        source: 'service',
        providerUid: s.providerUid,
        providerId: 'providerId' in s ? s.providerId : undefined,
        name: s.provider?.name || s.providerName,
        title: s.title,
        categoryId: s.categoryId,
        categoryLabel: s.categoryLabel,
        specialty: s.subcategory,
        location: s.location,
        languages: [
            s.details?.languageFrom,
            s.details?.languageTo,
            ...(Array.isArray(s.details?.supportLanguages) ? s.details.supportLanguages : []),
        ].filter((value) => typeof value === 'string'),
        verified: s.details?.licenseVerified === true,
        bio: s.description,
        priceFrom: s.priceFrom,
        companyName: s.provider?.name || s.providerName,
        providerEmail: s.provider?.email,
        providerRole: s.provider?.role,
        providerRoleLabel: s.provider?.roleLabel,
        ratingAverage: s.provider?.ratingAverage,
        ratingCount: s.provider?.ratingCount,
    }));
    let categoryId = intake.categoryId;
    if (categoryId && mongoose_1.Types.ObjectId.isValid(categoryId)) {
        const category = await Category_1.Category.findById(categoryId).select('stableId').lean();
        categoryId = category?.stableId ?? categoryId;
    }
    let subcategoryNames;
    if (intake.subcategoryId) {
        const subcategory = await Subcategory_1.Subcategory.findById(intake.subcategoryId).lean();
        if (!subcategory?.isActive)
            return [];
        subcategoryNames = [subcategory.name.sq, subcategory.name.en];
        if (!categoryId) {
            const parent = await Category_1.Category.findById(subcategory.categoryId).select('stableId').lean();
            categoryId = parent?.stableId;
        }
    }
    const all = filterMatchCandidates([...fromExperts, ...fromServices], { categoryId, subcategoryNames, serviceId: intake.serviceId });
    const fallbackNames = new Map(all.map((c) => [c.providerUid, c.companyName || c.name]));
    const providers = await (0, providerPublicService_1.getProvidersPublicDetails)(all.map((c) => c.providerUid), fallbackNames);
    return all.map((c) => {
        const provider = providers.get(c.providerUid);
        return {
            ...c,
            companyName: c.source === 'expert' ? c.companyName : provider?.name || c.companyName,
            ratingAverage: provider?.ratingAverage ?? 0,
            ratingCount: provider?.ratingCount ?? 0,
            providerEmail: c.source === 'expert' && c.providerId ? c.providerEmail || '' : provider?.email || '',
            providerRole: provider?.role || 'unknown',
            providerRoleLabel: provider?.roleLabel || 'Ofrues',
        };
    });
}
function heuristicMatch(intake, candidates) {
    const need = normalize(intake.need);
    const loc = normalize(intake.location);
    const langs = languageLabel(intake.language).map(normalize);
    const scored = candidates
        .map((c) => {
        let score = 0;
        const hay = normalize(`${c.name} ${c.title} ${c.categoryLabel} ${c.specialty} ${c.bio} ${c.location} ${c.languages.join(' ')}`);
        for (const token of need.split(/\s+/).filter((t) => t.length > 3)) {
            if (hay.includes(token))
                score += 2;
        }
        if (intake.cityId) {
            score += 5; // Candidates were already filtered by provider service-area IDs.
        }
        else if (loc === 'online') {
            if (normalize(c.location).includes('online'))
                score += 4;
        }
        else if (normalize(c.location).includes(loc)) {
            score += 5;
        }
        if (c.languages.some((l) => langs.includes(normalize(l))) || langs.some((l) => hay.includes(l))) {
            score += 3;
        }
        if (c.verified)
            score += 2;
        if (intake.audience === 'business' && /biznes|kompani|b2b|business|lawyer|avokat|kontabil/.test(hay)) {
            score += 2;
        }
        if (intake.urgency === 'today')
            score += c.verified ? 1 : 0;
        return { candidate: c, score };
    })
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 12);
    return scored.map(({ candidate, score }) => ({
        ...candidate,
        score,
        rating: candidate.ratingAverage && candidate.ratingCount
            ? candidate.ratingAverage
            : 0,
        ratingCount: candidate.ratingCount ?? 0,
        respondsWithin: intake.urgency === 'today'
            ? 'Përgjigjet brenda 1 ore'
            : intake.urgency === 'this_week'
                ? 'Përgjigjet brenda 24 orëve'
                : 'Përgjigjet brenda 2–3 ditëve',
        reason: 'Përputhet me nevojën, lokacionin dhe gjuhën e kërkuar.',
    }));
}
function extractJson(text) {
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const raw = fenced?.[1]?.trim() || text.trim();
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start === -1 || end === -1)
        throw new Error('Gemini nuk ktheu JSON të vlefshëm');
    return JSON.parse(raw.slice(start, end + 1));
}
async function geminiMatch(intake, candidates) {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey)
        throw new Error('GEMINI_API_KEY mungon');
    const genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
        model: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
    });
    const prompt = `Ti je sistemi i matching për marketplace-in KëshillaKos (Kosovë).
Përdoruesi ka plotësuar këtë intake:

${JSON.stringify(intake, null, 2)}

Kandidatët e disponueshëm:
${JSON.stringify(candidates, null, 2)}

Zgjidh deri në 8 kandidatët më të mirë.
Kthe VETËM JSON me këtë formë:
{
  "matches": [
    {
      "id": "string",
      "source": "expert" | "service",
      "score": 0-100,
      "respondsWithin": "string në shqip, p.sh. Përgjigjet brenda 1 ore",
      "reason": "1 fjali pse përputhet"
    }
  ]
}

Rregulla:
- Prefero verified / me licencë për Ligj & Taksa.
- Prefero ratingAverage më të lartë dhe ratingCount > 0 kur është e mundur.
- Respekto lokacionin (përfshi Online).
- Kur cityId është zgjedhur, kandidatët janë filtruar sipas zonave të shërbimit; lokacioni bazë i ofruesit nuk është filtër.
- Respekto gjuhën.
- Nëse urgency = today, favorizo përgjigje të shpejtë.
- Mos invento id që nuk ekzistojnë në listë.
- Mos invento rating — rating vjen nga databaza.`;
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const parsed = extractJson(text);
    const byKey = new Map(candidates.map((c) => [`${c.source}:${c.id}`, c]));
    const matches = (parsed.matches ?? [])
        .map((m) => {
        const base = byKey.get(`${m.source}:${m.id}`);
        if (!base)
            return null;
        return {
            ...base,
            score: typeof m.score === 'number' ? m.score : 50,
            rating: base.ratingAverage ?? 0,
            ratingCount: base.ratingCount ?? 0,
            respondsWithin: m.respondsWithin || 'Përgjigjet brenda 24 orëve',
            reason: m.reason || 'Përputhet me kërkesën tënde.',
        };
    })
        .filter(Boolean);
    return matches.sort((a, b) => b.score - a.score).slice(0, 8);
}
async function matchExperts(intake) {
    const candidates = await loadCandidates(intake);
    if (candidates.length === 0) {
        return {
            engine: 'none',
            count: 0,
            matches: [],
            message: 'Ende nuk ka ekspertë ose shërbime të publikuara.',
        };
    }
    try {
        const matches = await geminiMatch(intake, candidates);
        if (matches.length > 0) {
            return {
                engine: 'gemini',
                count: matches.length,
                matches,
                message: `Gjetëm ${matches.length} ekspertë për ty`,
            };
        }
    }
    catch (err) {
        console.warn('Gemini match failed, using heuristic:', err);
    }
    const matches = heuristicMatch(intake, candidates);
    return {
        engine: 'heuristic',
        count: matches.length,
        matches,
        message: matches.length > 0
            ? `Gjetëm ${matches.length} ekspertë për ty`
            : 'Nuk gjetëm përputhje. Provo të ndryshosh lokacionin ose përshkrimin.',
    };
}
//# sourceMappingURL=matchService.js.map