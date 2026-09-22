"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateProviderLocations = validateProviderLocations;
exports.createProviderProfile = createProviderProfile;
exports.listMyProviderProfiles = listMyProviderProfiles;
exports.listPublishedProviderProfiles = listPublishedProviderProfiles;
exports.toPublicProvider = toPublicProvider;
exports.updateProviderProfile = updateProviderProfile;
exports.moderateProviderProfile = moderateProviderProfile;
exports.providerProfilesToLegacyExperts = providerProfilesToLegacyExperts;
const mongoose_1 = require("mongoose");
const Business_1 = require("../models/Business");
const City_1 = require("../models/City");
const Country_1 = require("../models/Country");
const ProviderProfile_1 = require("../models/ProviderProfile");
const User_1 = require("../models/User");
const domainService_1 = require("./domainService");
const businessService_1 = require("./businessService");
function uniqueText(values = []) {
    return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}
async function validateProviderLocations(location, serviceAreaCityIds) {
    if (location) {
        if (!mongoose_1.Types.ObjectId.isValid(location.countryId) || !mongoose_1.Types.ObjectId.isValid(location.cityId))
            throw new Error('Lokacioni është i pavlefshëm');
        const [country, city] = await Promise.all([
            Country_1.Country.exists({ _id: location.countryId, isActive: true }),
            City_1.City.exists({ _id: location.cityId, countryId: location.countryId, isActive: true }),
        ]);
        if (!country || !city)
            throw new Error('Qyteti dhe shteti nuk përputhen ose nuk janë aktivë');
    }
    if (serviceAreaCityIds !== undefined) {
        if (serviceAreaCityIds.some((id) => !mongoose_1.Types.ObjectId.isValid(id)) || new Set(serviceAreaCityIds).size !== serviceAreaCityIds.length)
            throw new Error('Qytetet e zonës së shërbimit janë të pavlefshme');
        if (serviceAreaCityIds.length) {
            const cities = await City_1.City.find({ _id: { $in: serviceAreaCityIds }, isActive: true }).select('countryId').lean();
            const countries = await Country_1.Country.find({ _id: { $in: cities.map((city) => city.countryId) }, isActive: true }).select('_id').lean();
            const activeCountryIds = new Set(countries.map((country) => String(country._id)));
            if (cities.length !== serviceAreaCityIds.length || cities.some((city) => !activeCountryIds.has(String(city.countryId))))
                throw new Error('Zona e shërbimit përmban qytete joaktive ose të pavlefshme');
        }
    }
}
async function createProviderProfile(input) {
    const ownerUser = await (0, businessService_1.userIdForUid)(input.ownerUid);
    const categories = uniqueText(input.categories);
    if (!categories.length || !(await Promise.all(categories.map((id) => (0, domainService_1.findDomainById)(id)))).every(Boolean)) {
        throw new Error('Kategoria nuk ekziston');
    }
    if (!input.publicProfile?.displayName?.trim())
        throw new Error('Emri publik është i detyrueshëm');
    if (input.providerType === 'business' && !input.businessId)
        throw new Error('Biznesi është i detyrueshëm');
    if (input.businessId)
        await (0, businessService_1.ownedBusinessById)(input.ownerUid, input.businessId);
    await validateProviderLocations(input.location, input.serviceAreaCityIds);
    const owner = await User_1.User.findById(ownerUser).select('profilePhoto').lean();
    const publicProfile = {
        ...input.publicProfile,
        photoUrl: input.publicProfile.photoUrl || owner?.profilePhoto,
    };
    return ProviderProfile_1.ProviderProfile.create({
        providerType: input.providerType,
        ownerUser,
        business: input.businessId ? new mongoose_1.Types.ObjectId(input.businessId) : undefined,
        categories,
        languages: uniqueText(input.languages),
        locations: input.locations ?? [],
        serviceAreas: input.serviceAreas ?? [],
        location: input.location,
        serviceAreaCityIds: input.serviceAreaCityIds ?? [],
        modes: [...new Set(input.modes ?? [])],
        publicProfile,
        qualificationClaims: input.qualificationClaims,
        status: 'pending',
        moderation: { status: 'pending' },
    });
}
async function listMyProviderProfiles(uid) {
    const userId = await (0, businessService_1.userIdForUid)(uid);
    const managedBusinesses = await Business_1.Business.find({ $or: [{ owners: userId }, { members: { $elemMatch: { user: userId, role: 'manager' } } }] }).select('_id').lean();
    return ProviderProfile_1.ProviderProfile.find({ $or: [
            { ownerUser: userId },
            { business: { $in: managedBusinesses.map((business) => business._id) } },
        ] }).sort({ createdAt: -1 });
}
async function listPublishedProviderProfiles(cityId) {
    const profiles = await ProviderProfile_1.ProviderProfile.find({
        status: 'published', 'moderation.status': 'approved',
        ...(cityId ? { serviceAreaCityIds: new mongoose_1.Types.ObjectId(cityId) } : {}),
    })
        .select('-qualificationClaims -moderation.reason')
        .sort({ updatedAt: -1 }).limit(50);
    const ids = profiles.map((profile) => profile.business).filter((id) => Boolean(id));
    if (!ids.length)
        return profiles;
    const activeBusinesses = await Business_1.Business.find({ _id: { $in: ids }, status: 'active' }).select('_id').lean();
    const activeIds = new Set(activeBusinesses.map((business) => String(business._id)));
    return profiles.filter((profile) => !profile.business || activeIds.has(String(profile.business)));
}
function toPublicProvider(profile) {
    return {
        id: String(profile._id),
        providerType: profile.providerType,
        businessId: profile.business ? String(profile.business) : undefined,
        categories: profile.categories,
        languages: profile.languages,
        locations: profile.locations,
        serviceAreas: profile.serviceAreas,
        location: profile.location,
        serviceAreaCityIds: profile.serviceAreaCityIds,
        modes: profile.modes,
        publicProfile: profile.publicProfile,
        verification: profile.verification,
        updatedAt: profile.updatedAt,
    };
}
async function updateProviderProfile(uid, id, changes) {
    if (!mongoose_1.Types.ObjectId.isValid(id))
        throw new Error('Provider ID i pavlefshëm');
    const userId = await (0, businessService_1.userIdForUid)(uid);
    const profile = await ProviderProfile_1.ProviderProfile.findById(id);
    if (!profile)
        throw new Error('Profili nuk u gjet');
    const business = profile.business ? await Business_1.Business.findById(profile.business) : null;
    if (!profile.ownerUser.equals(userId) && (!business || !(0, businessService_1.canManageBusiness)(business, userId))) {
        throw new Error('Nuk ke leje për këtë profil');
    }
    await validateProviderLocations(changes.location, changes.serviceAreaCityIds);
    if (changes.categories !== undefined) {
        const categories = uniqueText(changes.categories);
        if (!categories.length || !(await Promise.all(categories.map((id) => (0, domainService_1.findDomainById)(id)))).every(Boolean))
            throw new Error('Kategoria nuk ekziston');
        profile.categories = categories;
    }
    if (changes.languages !== undefined)
        profile.languages = uniqueText(changes.languages);
    if (changes.locations !== undefined)
        profile.locations = changes.locations;
    if (changes.serviceAreas !== undefined)
        profile.serviceAreas = changes.serviceAreas;
    if (changes.location !== undefined)
        profile.location = changes.location === null ? undefined : {
            countryId: new mongoose_1.Types.ObjectId(changes.location.countryId), cityId: new mongoose_1.Types.ObjectId(changes.location.cityId),
        };
    if (changes.serviceAreaCityIds !== undefined)
        profile.serviceAreaCityIds = changes.serviceAreaCityIds.map((id) => new mongoose_1.Types.ObjectId(id));
    if (changes.modes !== undefined)
        profile.modes = [...new Set(changes.modes)];
    if (changes.publicProfile !== undefined) {
        for (const key of ['displayName', 'title', 'shortDescription', 'description', 'photoUrl', 'publicEmail', 'publicPhone']) {
            if (changes.publicProfile[key] !== undefined)
                profile.set(`publicProfile.${key}`, changes.publicProfile[key]);
        }
    }
    profile.status = 'pending';
    profile.moderation = { status: 'pending' };
    await profile.save();
    return profile;
}
async function moderateProviderProfile(id, reviewerUid, decision, reason) {
    if (!mongoose_1.Types.ObjectId.isValid(id))
        throw new Error('Provider ID i pavlefshëm');
    const reviewer = await (0, businessService_1.userIdForUid)(reviewerUid);
    const profile = await ProviderProfile_1.ProviderProfile.findById(id);
    if (!profile)
        throw new Error('Profili nuk u gjet');
    if (decision === 'approved' && profile.business) {
        const business = await Business_1.Business.findById(profile.business);
        if (!business || business.status !== 'active')
            throw new Error('Biznesi duhet të jetë aktiv');
    }
    profile.moderation = { status: decision, reviewedAt: new Date(), reviewedBy: reviewer, reason: reason?.trim() || undefined };
    profile.status = decision === 'approved' ? 'published' : 'draft';
    await profile.save();
    return profile;
}
async function providerProfilesToLegacyExperts(profiles) {
    const ownerIds = [...new Set(profiles.map((profile) => String(profile.ownerUser)))];
    const businessIds = [...new Set(profiles.map((profile) => profile.business && String(profile.business)).filter((value) => Boolean(value)))];
    const categoryIds = [...new Set(profiles.flatMap((profile) => profile.categories))];
    const [users, businesses, domains, cities] = await Promise.all([
        User_1.User.find({ _id: { $in: ownerIds } }).select('uid').lean(),
        Business_1.Business.find({ _id: { $in: businessIds } }).select('publicName').lean(),
        Promise.all(categoryIds.map((id) => (0, domainService_1.findDomainById)(id))),
        City_1.City.find({ _id: { $in: profiles.flatMap((profile) => profile.location ? [profile.location.cityId] : []) } }).select('name.sq').lean(),
    ]);
    const uidById = new Map(users.map((user) => [String(user._id), user.uid]));
    const businessById = new Map(businesses.map((business) => [String(business._id), business.publicName]));
    const categoryLabelById = new Map(domains.filter((domain) => domain !== null).map((domain) => [domain.id, domain.labelSq]));
    const cityNameById = new Map(cities.map((city) => [String(city._id), city.name.sq]));
    return profiles.map((profile) => ({
        id: String(profile._id),
        providerId: String(profile._id),
        name: profile.publicProfile.displayName,
        title: profile.publicProfile.title || '',
        categoryId: profile.categories[0] || '',
        categoryLabel: categoryLabelById.get(profile.categories[0]) || profile.categories[0] || '',
        specialty: profile.publicProfile.shortDescription || '',
        bio: profile.publicProfile.description || '',
        location: (profile.location && cityNameById.get(String(profile.location.cityId))) || profile.locations[0]?.cityName || profile.serviceAreas[0]?.cityName || (profile.modes.includes('online') ? 'Online' : ''),
        licenseVerified: profile.verification.qualification === 'verified',
        languageFrom: profile.languages[0],
        languageTo: profile.languages[1],
        licenseNumber: undefined,
        publicEmail: profile.publicProfile.publicEmail,
        deliveryModes: profile.modes.map((mode) => mode === 'on_site' ? 'physical' : 'online'),
        companyUid: uidById.get(String(profile.ownerUser)) || '', // Legacy API alias, not canonical identity.
        companyName: profile.business ? businessById.get(String(profile.business)) || '' : profile.publicProfile.displayName,
        active: profile.status === 'published' && profile.moderation.status === 'approved',
        createdAt: profile.createdAt,
    }));
}
//# sourceMappingURL=providerProfileService.js.map