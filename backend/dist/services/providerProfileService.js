"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateProviderLocations = validateProviderLocations;
exports.createProviderProfile = createProviderProfile;
exports.listMyProviderProfiles = listMyProviderProfiles;
exports.listPublishedProviderProfiles = listPublishedProviderProfiles;
exports.assertCanManageProvider = assertCanManageProvider;
exports.toPublicProvider = toPublicProvider;
exports.updateProviderProfile = updateProviderProfile;
exports.updateProviderPhoto = updateProviderPhoto;
exports.moderateProviderProfile = moderateProviderProfile;
exports.providerProfilesToLegacyExperts = providerProfilesToLegacyExperts;
const mongoose_1 = require("mongoose");
const Business_1 = require("../models/Business");
const Category_1 = require("../models/Category");
const City_1 = require("../models/City");
const Country_1 = require("../models/Country");
const ProviderProfile_1 = require("../models/ProviderProfile");
const Subcategory_1 = require("../models/Subcategory");
const User_1 = require("../models/User");
const socialLinks_1 = require("../models/socialLinks");
const providerCareer_1 = require("../models/providerCareer");
const domainService_1 = require("./domainService");
const businessService_1 = require("./businessService");
const mediaService_1 = require("./mediaService");
async function validateSubcategoryIds(categoryStableIds, subcategoryIds) {
    if (subcategoryIds === undefined)
        return;
    if (subcategoryIds.some((id) => !mongoose_1.Types.ObjectId.isValid(id)) || new Set(subcategoryIds).size !== subcategoryIds.length) {
        throw new Error('Nënkategoritë janë të pavlefshme');
    }
    if (!subcategoryIds.length)
        return;
    const categories = await Category_1.Category.find({ portal: domainService_1.DEFAULT_PORTAL, stableId: { $in: categoryStableIds }, status: 'active' }).select('_id').lean();
    const categoryObjectIds = new Set(categories.map((category) => String(category._id)));
    if (!categoryObjectIds.size)
        throw new Error('Kategoria nuk ekziston');
    const children = await Subcategory_1.Subcategory.find({ _id: { $in: subcategoryIds }, isActive: true }).select('categoryId').lean();
    if (children.length !== subcategoryIds.length || children.some((child) => !categoryObjectIds.has(String(child.categoryId)))) {
        throw new Error('Nënkategoria nuk përputhet me kategorinë');
    }
}
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
    if (!input.publicProfile?.displayName?.trim() && input.providerType === 'business') {
        throw new Error('Emri publik është i detyrueshëm');
    }
    if (input.providerType === 'business' && !input.businessId)
        throw new Error('Biznesi është i detyrueshëm');
    if (input.businessId)
        await (0, businessService_1.ownedBusinessById)(input.ownerUid, input.businessId);
    await validateProviderLocations(input.location, input.serviceAreaCityIds);
    await validateSubcategoryIds(categories, input.subcategoryIds);
    const owner = await User_1.User.findById(ownerUser).select('firstName lastName name profilePhoto').lean();
    if (!owner)
        throw new Error('Përdoruesi nuk u gjet');
    const displayName = [owner.firstName, owner.lastName].filter(Boolean).join(' ').trim()
        || owner.name?.trim()
        || input.publicProfile.displayName?.trim();
    if (!displayName)
        throw new Error('Emri i përdoruesit është i detyrueshëm');
    const publicProfile = {
        ...input.publicProfile,
        displayName,
        photoUrl: input.publicProfile.photoUrl || owner.profilePhoto,
    };
    return ProviderProfile_1.ProviderProfile.create({
        providerType: input.providerType,
        ownerUser,
        business: input.businessId ? new mongoose_1.Types.ObjectId(input.businessId) : undefined,
        categories,
        subcategoryIds: (input.subcategoryIds ?? []).map((id) => new mongoose_1.Types.ObjectId(id)),
        languages: uniqueText(input.languages),
        locations: input.locations ?? [],
        serviceAreas: input.serviceAreas ?? [],
        location: input.location,
        serviceAreaCityIds: input.serviceAreaCityIds ?? [],
        modes: [...new Set(input.modes ?? [])],
        experience: input.experience?.trim() || undefined,
        publicProfile,
        qualificationClaims: input.qualificationClaims,
        // Ownership exists immediately; verification/moderation stay separate from capability.
        status: 'draft',
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
async function loadManagedProvider(uid, id) {
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
    return profile;
}
async function assertCanManageProvider(uid, id) {
    await loadManagedProvider(uid, id);
}
function toPublicProvider(profile) {
    return {
        id: String(profile._id),
        _id: String(profile._id),
        providerType: profile.providerType,
        businessId: profile.business ? String(profile.business) : undefined,
        categories: profile.categories,
        subcategoryIds: (profile.subcategoryIds ?? []).map(String),
        languages: profile.languages,
        locations: profile.locations,
        serviceAreas: profile.serviceAreas,
        location: profile.location
            ? { countryId: String(profile.location.countryId), cityId: String(profile.location.cityId) }
            : undefined,
        serviceAreaCityIds: (profile.serviceAreaCityIds ?? []).map(String),
        modes: profile.modes,
        yearsOfExperience: profile.yearsOfExperience,
        experience: profile.experience || '',
        specializations: profile.specializations ?? [],
        socialLinks: profile.socialLinks || {},
        workExperience: profile.workExperience ?? [],
        education: profile.education ?? [],
        certifications: profile.certifications ?? [],
        publicProfile: profile.publicProfile,
        verification: profile.verification,
        qualificationClaims: profile.qualificationClaims,
        updatedAt: profile.updatedAt,
    };
}
async function updateProviderProfile(uid, id, changes) {
    const profile = await loadManagedProvider(uid, id);
    await validateProviderLocations(changes.location, changes.serviceAreaCityIds);
    if (changes.categories !== undefined) {
        const categories = uniqueText(changes.categories);
        if (!categories.length || !(await Promise.all(categories.map((id) => (0, domainService_1.findDomainById)(id)))).every(Boolean))
            throw new Error('Kategoria nuk ekziston');
        profile.categories = categories;
    }
    await validateSubcategoryIds(profile.categories, changes.subcategoryIds);
    if (changes.subcategoryIds !== undefined) {
        profile.subcategoryIds = changes.subcategoryIds.map((id) => new mongoose_1.Types.ObjectId(id));
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
    if (changes.experience !== undefined)
        profile.experience = changes.experience.trim() || undefined;
    if (changes.yearsOfExperience !== undefined) {
        if (changes.yearsOfExperience === null) {
            profile.yearsOfExperience = undefined;
        }
        else {
            const years = Number(changes.yearsOfExperience);
            if (!Number.isFinite(years) || years < 0 || years > 60 || !Number.isInteger(years)) {
                throw new Error('Vitet e përvojës duhet të jenë një numër i plotë 0–60');
            }
            profile.yearsOfExperience = years;
        }
    }
    if (changes.specializations !== undefined) {
        profile.specializations = uniqueText(changes.specializations).slice(0, 30);
    }
    if (changes.socialLinks !== undefined) {
        const normalized = (0, socialLinks_1.normalizeSocialLinks)(changes.socialLinks);
        profile.socialLinks = (0, socialLinks_1.applySocialLinks)(profile.socialLinks, normalized || {});
    }
    if (changes.workExperience !== undefined)
        profile.workExperience = (0, providerCareer_1.normalizeWorkExperience)(changes.workExperience);
    if (changes.education !== undefined)
        profile.education = (0, providerCareer_1.normalizeEducation)(changes.education);
    if (changes.certifications !== undefined) {
        profile.certifications = (0, providerCareer_1.normalizeCertifications)(changes.certifications);
    }
    if (changes.qualificationClaims !== undefined)
        profile.qualificationClaims = changes.qualificationClaims;
    if (changes.publicProfile !== undefined) {
        for (const key of ['displayName', 'title', 'shortDescription', 'description', 'photoUrl', 'publicEmail', 'publicPhone']) {
            if (changes.publicProfile[key] !== undefined) {
                const value = changes.publicProfile[key];
                if (key === 'photoUrl' && value) {
                    const path = (0, mediaService_1.normalizeUploadPath)(value);
                    if (!path)
                        throw new Error('Fotoja e profilit nuk është e vlefshme');
                    profile.set(`publicProfile.${key}`, path);
                }
                else {
                    profile.set(`publicProfile.${key}`, value);
                }
            }
        }
    }
    profile.status = 'pending';
    profile.moderation = { status: 'pending' };
    await profile.save();
    return profile;
}
async function updateProviderPhoto(uid, id, photoUrl) {
    const path = (0, mediaService_1.normalizeUploadPath)(photoUrl);
    if (!path)
        throw new Error('Rruga e fotos nuk është e vlefshme');
    return updateProviderProfile(uid, id, { publicProfile: { photoUrl: path } });
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