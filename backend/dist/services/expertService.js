"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createExpert = createExpert;
exports.listExpertsByCompany = listExpertsByCompany;
exports.listActiveExperts = listActiveExperts;
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
    // Compatibility endpoint: create a real Business ID before a managed individual profile.
    // The account name is only an initial public label, never the canonical identity.
    const businesses = await (0, businessService_1.listManagedBusinesses)(input.ownerUid);
    const business = businesses[0] ?? await (0, businessService_1.createBusiness)({ ownerUid: input.ownerUid, publicName: input.ownerName });
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
        cityId ? Promise.resolve([]) : Expert_1.Expert.find({ active: true }).sort({ createdAt: -1 }).limit(50),
        (0, providerProfileService_1.listPublishedProviderProfiles)(cityId),
    ]);
    return [...(await (0, providerProfileService_1.providerProfilesToLegacyExperts)(profiles)), ...legacy.map(toExpert)];
}
//# sourceMappingURL=expertService.js.map