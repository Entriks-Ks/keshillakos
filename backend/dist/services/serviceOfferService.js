"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createServiceOffer = createServiceOffer;
exports.listMyServiceOffers = listMyServiceOffers;
exports.listPublishedServiceOffers = listPublishedServiceOffers;
exports.toPublicServiceOffer = toPublicServiceOffer;
exports.reviewServiceOffer = reviewServiceOffer;
exports.updateServiceOffer = updateServiceOffer;
exports.deleteServiceOffer = deleteServiceOffer;
exports.offersToLegacyServices = offersToLegacyServices;
const mongoose_1 = require("mongoose");
const Business_1 = require("../models/Business");
const Category_1 = require("../models/Category");
const ProviderProfile_1 = require("../models/ProviderProfile");
const City_1 = require("../models/City");
const ServiceOffer_1 = require("../models/ServiceOffer");
const User_1 = require("../models/User");
const categoryConfiguration_1 = require("./categoryConfiguration");
const businessService_1 = require("./businessService");
const domainService_1 = require("./domainService");
const mediaService_1 = require("./mediaService");
const providerProfileService_1 = require("./providerProfileService");
const ratingService_1 = require("./ratingService");
async function managedProfile(ownerUid, providerId) {
    if (!mongoose_1.Types.ObjectId.isValid(providerId))
        throw new Error('Provider ID i pavlefshëm');
    const userId = await (0, businessService_1.userIdForUid)(ownerUid);
    const profile = await ProviderProfile_1.ProviderProfile.findById(providerId);
    if (!profile || profile.status === 'suspended')
        throw new Error('Profili nuk u gjet');
    const business = profile.business ? await Business_1.Business.findById(profile.business) : null;
    if (!profile.ownerUser.equals(userId) && (!business || !(0, businessService_1.canManageBusiness)(business, userId))) {
        throw new Error('Nuk ke leje për këtë profil');
    }
    if (business && ['suspended', 'closed'].includes(business.status))
        throw new Error('Biznesi nuk është aktiv');
    return profile;
}
async function createServiceOffer(input) {
    const portal = input.portal || domainService_1.DEFAULT_PORTAL;
    const [profile, category] = await Promise.all([
        managedProfile(input.ownerUid, input.providerId),
        (0, domainService_1.findCategoryById)(input.categoryId, portal),
    ]);
    if (!category)
        throw new Error('Kategoria nuk ekziston');
    if (!profile.categories.includes(category.stableId)) {
        if (!input.allowCategoryExpansion)
            throw new Error('Profili nuk e mbulon këtë kategori');
        profile.categories.push(category.stableId);
    }
    // Marketplace MVP: publish profile + offer so services appear on home immediately.
    // Admin can still suspend later via moderation endpoints.
    if (profile.status !== 'suspended') {
        profile.status = 'published';
        profile.moderation = { status: 'approved', reviewedAt: new Date() };
    }
    await profile.save();
    // Heal earlier posts that stayed pending under the old moderation flow.
    await ServiceOffer_1.ServiceOffer.updateMany({
        providerProfile: profile._id,
        visibility: 'public',
        $or: [{ status: 'pending' }, { 'moderation.status': 'pending' }],
    }, {
        $set: {
            status: 'published',
            moderation: { status: 'approved', reviewedAt: new Date() },
        },
    });
    const extensions = (0, categoryConfiguration_1.validateExtensions)(category.extensionFields, input.extensions);
    const visibility = input.visibility ?? 'public';
    return ServiceOffer_1.ServiceOffer.create({
        portal, providerProfile: profile._id, business: profile.business,
        category: category._id, categoryVersion: category.version,
        name: input.name.trim(), subtitle: input.subtitle?.trim(), description: input.description.trim(),
        price: input.price, durationMinutes: input.durationMinutes,
        formats: input.formats ?? [], modes: input.modes ?? [],
        languages: input.languages?.map((value) => value.trim()).filter(Boolean) ?? [],
        serviceAreas: input.serviceAreas ?? [],
        photos: (0, mediaService_1.sanitizeUploadPaths)(input.photos),
        availabilityMode: input.availabilityMode ?? 'request',
        visibility,
        extensions,
        status: visibility === 'public' ? 'published' : 'draft',
        moderation: {
            status: visibility === 'public' ? 'approved' : 'pending',
            reviewedAt: visibility === 'public' ? new Date() : undefined,
        },
    });
}
async function listMyServiceOffers(uid) {
    const profiles = await (0, providerProfileService_1.listMyProviderProfiles)(uid);
    return ServiceOffer_1.ServiceOffer.find({ providerProfile: { $in: profiles.map((profile) => profile._id) } }).sort({ createdAt: -1 });
}
async function listPublishedServiceOffers(providerIds) {
    const offers = await ServiceOffer_1.ServiceOffer.find({
        status: 'published', visibility: 'public', 'moderation.status': 'approved',
        ...(providerIds ? { providerProfile: { $in: providerIds } } : {}),
    }).sort({ updatedAt: -1 }).limit(providerIds ? 0 : 50);
    const [profiles, categories, businesses] = await Promise.all([
        ProviderProfile_1.ProviderProfile.find({ _id: { $in: offers.map((offer) => offer.providerProfile) }, status: 'published', 'moderation.status': 'approved' }).select('_id'),
        Category_1.Category.find({ _id: { $in: offers.map((offer) => offer.category) }, status: 'active' }).select('_id'),
        Business_1.Business.find({ _id: { $in: offers.map((offer) => offer.business).filter(Boolean) }, status: 'active' }).select('_id'),
    ]);
    const profileIds = new Set(profiles.map((profile) => String(profile._id)));
    const categoryIds = new Set(categories.map((category) => String(category._id)));
    const businessIds = new Set(businesses.map((business) => String(business._id)));
    return offers.filter((offer) => profileIds.has(String(offer.providerProfile)) && categoryIds.has(String(offer.category)) && (!offer.business || businessIds.has(String(offer.business))));
}
function toPublicServiceOffer(offer) {
    const extensions = { ...offer.extensions };
    delete extensions.licenseNumber;
    return {
        id: String(offer._id), portal: offer.portal,
        providerId: String(offer.providerProfile),
        businessId: offer.business ? String(offer.business) : undefined,
        categoryId: String(offer.category), categoryVersion: offer.categoryVersion,
        name: offer.name, subtitle: offer.subtitle, description: offer.description,
        price: offer.price, durationMinutes: offer.durationMinutes,
        formats: offer.formats, modes: offer.modes, languages: offer.languages,
        serviceAreas: offer.serviceAreas, availabilityMode: offer.availabilityMode,
        extensions, updatedAt: offer.updatedAt,
    };
}
async function reviewServiceOffer(id, reviewerUid, decision) {
    if (!mongoose_1.Types.ObjectId.isValid(id))
        throw new Error('Service ID i pavlefshëm');
    const reviewer = await (0, businessService_1.userIdForUid)(reviewerUid);
    const offer = await ServiceOffer_1.ServiceOffer.findById(id);
    if (!offer)
        throw new Error('Shërbimi nuk u gjet');
    if (decision === 'approved') {
        const [profile, category, business] = await Promise.all([
            ProviderProfile_1.ProviderProfile.findById(offer.providerProfile), Category_1.Category.findById(offer.category),
            offer.business ? Business_1.Business.findById(offer.business) : Promise.resolve(null),
        ]);
        if (profile?.status !== 'published' || profile.moderation.status !== 'approved' || category?.status !== 'active' || (offer.business && business?.status !== 'active')) {
            throw new Error('Profili, biznesi dhe kategoria duhet të jenë aktive');
        }
    }
    offer.status = decision === 'approved' ? 'published' : 'draft';
    offer.moderation = { status: decision, reviewedAt: new Date(), reviewedBy: reviewer };
    await offer.save();
    return offer;
}
async function updateServiceOffer(uid, id, changes) {
    if (!mongoose_1.Types.ObjectId.isValid(id))
        throw new Error('Service ID i pavlefshëm');
    const offer = await ServiceOffer_1.ServiceOffer.findById(id);
    if (!offer)
        throw new Error('Shërbimi nuk u gjet');
    await managedProfile(uid, String(offer.providerProfile));
    if (changes.categoryId) {
        const nextCategory = await (0, domainService_1.findCategoryById)(changes.categoryId, offer.portal);
        if (!nextCategory)
            throw new Error('Kategoria nuk ekziston');
        offer.category = nextCategory._id;
        offer.categoryVersion = nextCategory.version;
    }
    const category = await Category_1.Category.findById(offer.category);
    if (!category)
        throw new Error('Kategoria nuk u gjet');
    for (const key of ['name', 'subtitle', 'description', 'price', 'durationMinutes', 'formats', 'modes', 'languages', 'serviceAreas', 'availabilityMode', 'visibility']) {
        if (changes[key] !== undefined)
            offer.set(key, changes[key]);
    }
    if (changes.photos !== undefined) {
        const nextPhotos = (0, mediaService_1.sanitizeUploadPaths)(changes.photos);
        await (0, mediaService_1.deleteRemovedUploads)(offer.photos, nextPhotos);
        offer.photos = nextPhotos;
    }
    if (changes.extensions !== undefined)
        offer.extensions = (0, categoryConfiguration_1.validateExtensions)(category.extensionFields, changes.extensions);
    offer.categoryVersion = category.version;
    if (offer.visibility === 'public') {
        offer.status = 'published';
        offer.moderation = { status: 'approved', reviewedAt: new Date() };
    }
    await offer.save();
    return offer;
}
async function deleteServiceOffer(uid, id) {
    if (!mongoose_1.Types.ObjectId.isValid(id))
        throw new Error('Service ID i pavlefshëm');
    const offer = await ServiceOffer_1.ServiceOffer.findById(id);
    if (!offer)
        throw new Error('Shërbimi nuk u gjet');
    await managedProfile(uid, String(offer.providerProfile));
    const photos = [...(offer.photos || [])];
    await offer.deleteOne();
    await (0, mediaService_1.deleteUploads)(photos);
    return { deleted: true, id };
}
async function offersToLegacyServices(offers, publicOnly = false) {
    const [profiles, categories, businesses] = await Promise.all([
        ProviderProfile_1.ProviderProfile.find({ _id: { $in: offers.map((offer) => offer.providerProfile) } }),
        Category_1.Category.find({ _id: { $in: offers.map((offer) => offer.category) } }),
        Business_1.Business.find({ _id: { $in: offers.map((offer) => offer.business).filter(Boolean) } }).select('publicName'),
    ]);
    const profileById = new Map(profiles.map((profile) => [String(profile._id), profile]));
    const cityIds = profiles.flatMap((profile) => [profile.location?.cityId, ...profile.serviceAreaCityIds].filter((id) => Boolean(id)));
    const cities = cityIds.length ? await City_1.City.find({ _id: { $in: cityIds } }).select('name.sq').lean() : [];
    const cityNameById = new Map(cities.map((city) => [String(city._id), city.name.sq]));
    const categoryById = new Map(categories.map((category) => [String(category._id), category]));
    const businessById = new Map(businesses.map((business) => [String(business._id), business]));
    const users = await User_1.User.find({ _id: { $in: profiles.map((profile) => profile.ownerUser) } }).select('uid profilePhoto headline bio skills languages').lean();
    const ownerById = new Map(users.map((user) => [String(user._id), user]));
    const ratings = await (0, ratingService_1.getStatsForProviders)(users.map((user) => user.uid).filter(Boolean));
    return offers.map((offer) => {
        const profile = profileById.get(String(offer.providerProfile));
        const category = categoryById.get(String(offer.category));
        const business = offer.business ? businessById.get(String(offer.business)) : undefined;
        const owner = profile ? ownerById.get(String(profile.ownerUser)) : undefined;
        const uid = owner?.uid || '';
        const rating = ratings.get(uid);
        const providerName = profile?.publicProfile.displayName || business?.publicName || '';
        const extensions = { ...offer.extensions };
        if (publicOnly)
            delete extensions.licenseNumber;
        if (offer.photos?.length)
            extensions.photos = offer.photos;
        const area = offer.serviceAreas[0]?.cityName || (profile?.serviceAreaCityIds[0] && cityNameById.get(String(profile.serviceAreaCityIds[0]))) ||
            (profile?.location?.cityId && cityNameById.get(String(profile.location.cityId))) || (offer.modes.includes('online') ? 'Online' : '');
        return {
            id: String(offer._id),
            serviceOfferId: String(offer._id),
            providerId: String(offer.providerProfile), businessId: offer.business ? String(offer.business) : undefined,
            title: offer.name, description: offer.description,
            categoryId: category?.stableId || '', categoryLabel: category?.labels.get('sq') || '', category: category?.labels.get('sq') || '',
            subcategory: offer.subtitle || '', location: area,
            priceFrom: offer.price.amountFrom, details: extensions,
            providerUid: uid, providerName,
            provider: {
                uid, name: providerName, email: profile?.publicProfile.publicEmail || '',
                role: profile?.providerType === 'business' ? 'company' : 'provider', roleLabel: 'Ofrues',
                headline: profile?.publicProfile.title || owner?.headline || '', bio: profile?.publicProfile.description || owner?.bio || '',
                location: area, skills: owner?.skills || [], languages: profile?.languages?.length ? profile.languages : owner?.languages || [],
                profilePhoto: profile?.publicProfile.photoUrl || owner?.profilePhoto || '',
                ratingAverage: rating?.average ?? 0, ratingCount: rating?.count ?? 0,
            },
            active: offer.status === 'published' && offer.moderation.status === 'approved',
            createdAt: offer.createdAt,
        };
    });
}
//# sourceMappingURL=serviceOfferService.js.map