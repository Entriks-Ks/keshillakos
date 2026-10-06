"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createExpert = createExpert;
exports.listExpertsByCompany = listExpertsByCompany;
exports.listActiveExperts = listActiveExperts;
exports.listExpertPage = listExpertPage;
const Business_1 = require("../models/Business");
const ProviderProfile_1 = require("../models/ProviderProfile");
const serviceOfferService_1 = require("./serviceOfferService");
const pagination_1 = require("./pagination");
const Expert_1 = require("../models/Expert");
const domainService_1 = require("./domainService");
const businessService_1 = require("./businessService");
const providerProfileService_1 = require("./providerProfileService");
function toExpert(doc) {
    return {
        id: doc._id.toString(),
        name: doc.name,
        title: doc.title,
        categoryId: doc.categoryId,
        categoryLabel: doc.categoryLabel,
        specialty: doc.specialty,
        bio: doc.bio,
        location: doc.location,
        licenseNumber: doc.licenseNumber,
        licenseVerified: doc.licenseVerified,
        languageFrom: doc.languageFrom,
        languageTo: doc.languageTo,
        deliveryModes: doc.deliveryModes,
        crossBorder: doc.crossBorder,
        companyUid: doc.companyUid,
        companyName: doc.companyName,
        active: doc.active,
        createdAt: doc.createdAt,
    };
}
async function createExpert(input) {
    const domain = await (0, domainService_1.findDomainById)(input.categoryId);
    if (!domain)
        throw new Error('Kategoria nuk ekziston');
    if (domain.requirements.includes('license_verification') && !input.licenseNumber?.trim()) {
        throw new Error('Për Ligj duhet numri i licencës së ekspertit');
    }
    if (domain.requirements.includes('language_pair') &&
        (!input.languageFrom?.trim() || !input.languageTo?.trim())) {
        throw new Error('Duhet kombinimi i gjuhëve për ekspertin e përkthimit');
    }
    if (domain.requirements.includes('delivery_mode') && !input.deliveryModes?.length) {
        throw new Error('Zgjidh Online / Fizikisht / Grup');
    }
    // Compatibility endpoint: attach to an existing managed Business — never invent a new company here.
    const businesses = await (0, businessService_1.listManagedBusinesses)(input.ownerUid);
    const business = businesses[0];
    if (!business)
        throw new Error('Krijo kompaninë para se të përdorësh këtë endpoint');
    const profile = await (0, providerProfileService_1.createProviderProfile)({
        ownerUid: input.ownerUid,
        providerType: 'individual',
        businessId: String(business._id),
        categories: [domain.id],
        languages: [input.languageFrom, input.languageTo].filter((value) => Boolean(value)),
        locations: [{ countryCode: 'XK', cityName: input.location.trim(), online: false }],
        serviceAreas: [{ countryCode: 'XK', cityName: input.location.trim(), online: Boolean(input.crossBorder) }],
        modes: (input.deliveryModes ?? []).filter((mode) => mode !== 'group').map((mode) => mode === 'physical' ? 'on_site' : 'online'),
        publicProfile: {
            displayName: input.name.trim(),
            title: input.title.trim(),
            shortDescription: input.specialty.trim(),
            description: input.bio.trim(),
        },
        qualificationClaims: input.licenseNumber?.trim() ? [{ categoryId: domain.id, referenceNumber: input.licenseNumber.trim(), status: 'unverified' }] : undefined,
    });
    const [result] = await (0, providerProfileService_1.providerProfilesToLegacyExperts)([profile]);
    return { ...result, categoryLabel: domain.labelSq, specialty: input.specialty.trim(), languageFrom: input.languageFrom, languageTo: input.languageTo, crossBorder: Boolean(input.crossBorder), licenseVerified: false };
}
async function listExpertsByCompany(companyUid) {
    const [legacy, profiles] = await Promise.all([
        Expert_1.Expert.find({ companyUid }).sort({ createdAt: -1 }),
        (0, providerProfileService_1.listMyProviderProfiles)(companyUid),
    ]);
    return [...(await (0, providerProfileService_1.providerProfilesToLegacyExperts)(profiles)), ...legacy.map(toExpert)];
}
async function listActiveExperts(cityId) {
    const [legacy, profiles] = await Promise.all([
        cityId ? Promise.resolve([]) : Expert_1.Expert.find({ active: true }).sort({ createdAt: -1 }),
        (0, providerProfileService_1.listPublishedProviderProfiles)(cityId),
    ]);
    return [...(await (0, providerProfileService_1.providerProfilesToLegacyExperts)(profiles)), ...legacy.map(toExpert)];
}
/** Compatibility directory: select IDs across both stores before serializing a page. */
async function listExpertPage(input, companyUid) {
    const managed = companyUid ? await (0, serviceOfferService_1.managedServiceOfferQuery)(companyUid) : undefined;
    const branches = managed?.$or;
    const profileQuery = branches ? { $or: branches.map((branch) => 'providerProfile' in branch ? { _id: branch.providerProfile } : branch) } : { status: 'published', 'moderation.status': 'approved' };
    const pipeline = [
        { $match: profileQuery },
        ...(!companyUid ? [
            { $lookup: { from: Business_1.Business.collection.name, localField: 'business', foreignField: '_id', as: '_business' } },
            { $match: { $or: [{ business: { $exists: false } }, { business: null }, { '_business.status': 'active' }] } },
        ] : []),
        { $project: { _id: 1, createdAt: 1, source: { $literal: 'profile' }, rank: { $literal: 0 } } },
        { $unionWith: { coll: Expert_1.Expert.collection.name, pipeline: [
                    { $match: companyUid ? { companyUid } : { active: true } },
                    { $project: { _id: 1, createdAt: 1, source: { $literal: 'legacy' }, rank: { $literal: 1 } } },
                ] } },
    ];
    const result = await (0, pagination_1.queryPage)(input, async () => (await ProviderProfile_1.ProviderProfile.aggregate([...pipeline, { $count: 'total' }]))[0]?.total ?? 0, (skip, limit) => ProviderProfile_1.ProviderProfile.aggregate([...pipeline, { $sort: { rank: 1, createdAt: -1, _id: -1 } }, { $skip: skip }, { $limit: limit }]));
    const [profiles, legacy] = await Promise.all([
        ProviderProfile_1.ProviderProfile.find({ _id: { $in: result.items.filter((item) => item.source === 'profile').map((item) => item._id) } }),
        Expert_1.Expert.find({ _id: { $in: result.items.filter((item) => item.source === 'legacy').map((item) => item._id) } }),
    ]);
    const cards = [...await (0, providerProfileService_1.providerProfilesToLegacyExperts)(profiles), ...legacy.map(toExpert)];
    const byId = new Map(cards.map((card) => [card.id, card]));
    return { items: result.items.flatMap((item) => { const card = byId.get(String(item._id)); return card ? [card] : []; }), pagination: result.pagination };
}
//# sourceMappingURL=expertService.js.map