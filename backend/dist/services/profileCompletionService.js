"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseProfileType = parseProfileType;
exports.getProfileCompletion = getProfileCompletion;
const Business_1 = require("../models/Business");
const ProviderProfile_1 = require("../models/ProviderProfile");
const Service_1 = require("../models/Service");
const ServiceOffer_1 = require("../models/ServiceOffer");
const User_1 = require("../models/User");
const socialLinks_1 = require("../models/socialLinks");
const domainService_1 = require("./domainService");
const userService_1 = require("./userService");
const businessService_1 = require("./businessService");
function filledText(value) {
    return Boolean(value?.trim());
}
function field(key, label, required, filled, applicable = true) {
    return { key, label, required, filled, applicable };
}
function sectionPercent(fields) {
    const required = fields.filter((item) => item.applicable && item.required);
    if (!required.length)
        return 100;
    const filled = required.filter((item) => item.filled).length;
    return Math.round((filled / required.length) * 100);
}
function buildSection(type, label, exists, fields) {
    if (!exists) {
        return {
            type,
            label,
            applicable: false,
            exists: false,
            percent: null,
            filledRequired: 0,
            totalRequired: 0,
            fields: [],
            missingRequired: [],
        };
    }
    const visible = fields.filter((item) => item.applicable);
    const required = visible.filter((item) => item.required);
    return {
        type,
        label,
        applicable: true,
        exists: true,
        percent: sectionPercent(visible),
        filledRequired: required.filter((item) => item.filled).length,
        totalRequired: required.length,
        fields: visible,
        missingRequired: required.filter((item) => !item.filled).map((item) => ({ key: item.key, label: item.label })),
    };
}
function socialFields(links) {
    return socialLinks_1.SOCIAL_LINK_KEYS.map((key) => field(key, (0, socialLinks_1.socialLinkLabel)(key), false, Boolean(links?.[key]?.trim())));
}
function hasCity(user) {
    if (user.location?.cityId)
        return true;
    if (filledText(user.city))
        return true;
    return filledText(user.legacyLocation);
}
function providerHasServiceLocation(profile) {
    if (!profile)
        return false;
    if (profile.location?.cityId)
        return true;
    if (profile.serviceAreaCityIds?.length)
        return true;
    if (profile.locations?.length)
        return true;
    if (profile.serviceAreas?.length)
        return true;
    return profile.modes?.includes('online') ?? false;
}
function companyHasCity(business) {
    if (business.location?.cityId)
        return true;
    return business.branches.some((branch) => Boolean(branch.location?.cityName || branch.location?.cityId || branch.location?.address));
}
async function domainsRequire(categoryIds, requirement) {
    if (!categoryIds.length)
        return false;
    const domains = await Promise.all(categoryIds.map((id) => (0, domainService_1.findDomainById)(id)));
    return domains.some((domain) => domain?.requirements.includes(requirement));
}
function hasLicenseData(profile, services = []) {
    if (!profile)
        return false;
    if (profile.verification?.qualification === 'pending' || profile.verification?.qualification === 'verified')
        return true;
    if (profile.qualificationClaims?.some((claim) => filledText(claim.referenceNumber)))
        return true;
    return services.some((service) => filledText(service.details?.licenseNumber));
}
function hasPricing(services, offers) {
    if (services.some((service) => typeof service.priceFrom === 'number' && service.priceFrom >= 0))
        return true;
    return offers.some((offer) => {
        const model = offer.price?.model;
        if (model === 'free' || model === 'quote')
            return true;
        return typeof offer.price?.amountFrom === 'number';
    });
}
function privateSection(user) {
    return buildSection('private', 'Përdorues privat', true, [
        field('firstName', 'Emri', true, filledText(user.firstName)),
        field('lastName', 'Mbiemri', true, filledText(user.lastName)),
        field('profilePhoto', 'Foto profili', false, filledText(user.profilePhoto)),
        field('phone', 'Numri i telefonit', false, filledText(user.phone)),
        field('city', 'Qyteti', false, hasCity(user)),
        field('languages', 'Gjuhët', false, (user.languages?.length ?? 0) > 0),
        ...socialFields(user.socialLinks),
    ]);
}
async function expertSection(profile, services, offers) {
    if (!profile)
        return buildSection('expert', 'Ekspert', false, []);
    const categories = profile.categories ?? [];
    const title = profile.publicProfile?.title;
    const bio = profile.publicProfile?.description;
    const skills = profile.specializations ?? [];
    const hasSubcategory = (profile.subcategoryIds?.length ?? 0) > 0
        || services.some((service) => filledText(service.subcategoryId))
        || offers.some((offer) => Boolean(offer.subcategoryId));
    const yearsFilled = typeof profile.yearsOfExperience === 'number' && profile.yearsOfExperience >= 0;
    const licenseApplicable = await domainsRequire(categories, 'license_verification');
    const pricingApplicable = services.length > 0 || offers.length > 0 || await domainsRequire(categories, 'offer_type_packages');
    const verificationApplicable = licenseApplicable;
    return buildSection('expert', 'Ekspert', true, [
        field('profilePhoto', 'Foto profili', true, filledText(profile.publicProfile?.photoUrl)),
        field('title', 'Titulli profesional', true, filledText(title)),
        field('category', 'Kategoria', true, categories.length > 0),
        field('subcategory', 'Nënkategoria', true, hasSubcategory),
        field('bio', 'Bio / Përshkrimi', true, filledText(bio)),
        field('skills', 'Specializimet', true, skills.length > 0),
        field('yearsOfExperience', 'Vitet e përvojës', true, yearsFilled),
        field('serviceLocation', 'Qyteti / zona e shërbimit', true, providerHasServiceLocation(profile)),
        ...socialFields(profile.socialLinks),
        field('workExperience', 'Përvoja e punës', false, (profile.workExperience?.length ?? 0) > 0),
        field('education', 'Arsimi', false, (profile.education?.length ?? 0) > 0),
        field('certifications', 'Certifikimet', false, (profile.certifications?.length ?? 0) > 0),
        field('license', 'Licenca / certifikimi', true, hasLicenseData(profile, services), licenseApplicable),
        field('verification', 'Verifikimi', true, profile.verification.qualification !== 'unverified', verificationApplicable),
        field('pricing', 'Çmimi', true, hasPricing(services, offers), pricingApplicable),
    ]);
}
function companyHasAddress(business) {
    return business.branches?.some((branch) => filledText(branch.location?.address)) ?? false;
}
function companySection(business) {
    if (!business)
        return buildSection('company', 'Kompani', false, []);
    return buildSection('company', 'Kompani', true, [
        field('companyName', 'Emri i kompanisë', true, filledText(business.publicName)),
        field('logo', 'Logo', true, filledText(business.logoUrl)),
        field('companyEmail', 'Email i kompanisë', true, filledText(business.contactEmail)),
        field('companyPhone', 'Numri i telefonit', true, filledText(business.contactPhone)),
        field('companyCity', 'Qyteti', true, companyHasCity(business)),
        field('companyDescription', 'Përshkrimi', true, filledText(business.description)),
        field('companyCategory', 'Kategoria / industria', true, (business.categoryIds?.length ?? 0) > 0),
        field('website', 'Website', false, filledText(business.website)),
        field('address', 'Adresa', false, companyHasAddress(business)),
        ...socialFields(business.socialLinks),
    ]);
}
function parseProfileType(value) {
    if (value === 'expert' || value === 'company' || value === 'private')
        return value;
    return 'private';
}
async function getProfileCompletion(uid, profileType = 'private') {
    const user = await User_1.User.findOne({ uid });
    if (!user)
        throw new Error('Përdoruesi nuk u gjet');
    const userId = await (0, businessService_1.userIdForUid)(uid);
    let section;
    if (profileType === 'private') {
        section = privateSection(user);
    }
    else if (profileType === 'expert') {
        const individualProfile = await ProviderProfile_1.ProviderProfile.findOne({ ownerUser: userId, providerType: 'individual' });
        const services = individualProfile
            ? await Service_1.Service.find({ providerUid: uid, active: true }).select('priceFrom subcategoryId details').lean()
            : [];
        const offers = individualProfile
            ? await ServiceOffer_1.ServiceOffer.find({
                providerProfile: individualProfile._id,
                status: { $in: ['draft', 'pending', 'published'] },
            }).select('price subcategoryId').lean()
            : [];
        section = await expertSection(individualProfile, services, offers);
    }
    else {
        const business = await Business_1.Business.findOne({
            $or: [{ owners: userId }, { members: { $elemMatch: { user: userId, role: 'manager' } } }],
            status: { $ne: 'closed' },
        }).sort({ createdAt: 1 });
        section = companySection(business);
    }
    return {
        profileType,
        exists: section.exists,
        overallPercent: section.exists ? section.percent : null,
        filledRequired: section.filledRequired,
        totalRequired: section.totalRequired,
        section,
        user: (0, userService_1.toPublicUser)(user),
    };
}
//# sourceMappingURL=profileCompletionService.js.map