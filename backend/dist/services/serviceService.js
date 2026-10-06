"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.filterDiscoveredServices = filterDiscoveredServices;
exports.isActiveDiscoveryCity = isActiveDiscoveryCity;
exports.validateServiceDetails = validateServiceDetails;
exports.createService = createService;
exports.updateService = updateService;
exports.deleteService = deleteService;
exports.listServicesByProvider = listServicesByProvider;
exports.listProviderServicePage = listProviderServicePage;
exports.listActiveServices = listActiveServices;
exports.listPublicServicePage = listPublicServicePage;
exports.getActiveServiceById = getActiveServiceById;
exports.listActiveServicesByProvider = listActiveServicesByProvider;
const ratingService_1 = require("./ratingService");
const marketplaceQuery_1 = require("./marketplaceQuery");
const pagination_1 = require("./pagination");
const mongoose_1 = __importStar(require("mongoose"));
const Category_1 = require("../models/Category");
const City_1 = require("../models/City");
const Country_1 = require("../models/Country");
const ProviderProfile_1 = require("../models/ProviderProfile");
const Service_1 = require("../models/Service");
const ServiceOffer_1 = require("../models/ServiceOffer");
const Subcategory_1 = require("../models/Subcategory");
const User_1 = require("../models/User");
const categoryConfiguration_1 = require("./categoryConfiguration");
const domainService_1 = require("./domainService");
const mediaService_1 = require("./mediaService");
const businessService_1 = require("./businessService");
const providerProfileService_1 = require("./providerProfileService");
const serviceOfferService_1 = require("./serviceOfferService");
const providerPublicService_1 = require("./providerPublicService");
async function resolveCatalogSubcategory(categoryId, subcategoryId, subcategory) {
    if (!subcategoryId?.trim())
        return { subcategory: subcategory.trim(), subcategoryId: undefined };
    if (!mongoose_1.Types.ObjectId.isValid(subcategoryId))
        throw new Error('Nënkategoria nuk është e vlefshme');
    const category = await Category_1.Category.findOne({
        status: 'active',
        $or: [{ _id: categoryId }, { stableId: categoryId }, { slug: categoryId }],
    }).select('_id');
    if (!category)
        throw new Error('Kategoria nuk ekziston');
    const child = await Subcategory_1.Subcategory.findOne({ _id: subcategoryId, categoryId: category._id, isActive: true });
    if (!child)
        throw new Error('Nënkategoria nuk ekziston');
    return { subcategory: child.name.sq, subcategoryId: String(child._id) };
}
function normalized(value) {
    return (value ?? '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}
function filterDiscoveredServices(services, filters) {
    const category = normalized(filters.categoryId || '');
    const names = filters.subcategoryNames?.map(normalized) ?? [];
    const query = normalized(filters.q || '');
    return services.filter((service) => {
        if (filters.serviceId && service.id !== filters.serviceId)
            return false;
        if (category && ![service.categoryId, service.categoryLabel].some((value) => normalized(value) === category))
            return false;
        if (names.length && !names.includes(normalized(service.subcategory)))
            return false;
        if (query && !normalized([service.title, service.description, service.subcategory, service.categoryLabel, service.providerName].join(' ')).includes(query))
            return false;
        return true;
    });
}
async function isActiveDiscoveryCity(cityId) {
    if (!mongoose_1.Types.ObjectId.isValid(cityId))
        throw new Error('City ID i pavlefshëm');
    const city = await City_1.City.findOne({ _id: cityId, isActive: true }).select('countryId').lean();
    return Boolean(city && await Country_1.Country.exists({ _id: city.countryId, isActive: true }));
}
function legacyService(doc, provider) {
    return {
        id: doc._id.toString(), title: doc.title, description: doc.description,
        categoryId: doc.categoryId, categoryLabel: doc.categoryLabel, category: doc.categoryLabel,
        subcategory: doc.subcategory, location: doc.location, priceFrom: doc.priceFrom,
        details: doc.details ?? {}, providerUid: doc.providerUid,
        providerName: provider?.name || doc.providerName,
        provider: provider ?? { uid: doc.providerUid, name: doc.providerName, email: '', role: 'unknown', roleLabel: 'Ofrues', headline: '', bio: '', location: '', skills: [], languages: [], profilePhoto: '', coverPhoto: '', ratingAverage: 0, ratingCount: 0 },
        active: doc.active, createdAt: doc.createdAt,
    };
}
async function withLegacyProviders(docs) {
    const providers = await (0, providerPublicService_1.getProvidersPublicDetails)(docs.map((doc) => doc.providerUid), new Map(docs.map((doc) => [doc.providerUid, doc.providerName])));
    return docs.map((doc) => legacyService(doc, providers.get(doc.providerUid)));
}
/** Handled by the universal service form — not rendered as category-specific fields. */
const UNIVERSAL_DETAIL_KEYS = new Set([
    'deliveryModes',
    'supportLanguages',
    'crossBorder',
    'portfolioUrl',
    'references',
    'experience',
    'availabilityMode',
    'priceTo',
    'photos',
]);
/** Removed from the universal form; never required via category extension fields. */
const REMOVED_DETAIL_KEYS = new Set(['languageFrom', 'languageTo', 'certifiedTranslation']);
async function validateServiceDetails(categoryId, details = {}) {
    const category = await (0, domainService_1.findDomainById)(categoryId);
    if (!category)
        throw new Error('Kategoria nuk ekziston');
    // This field is a legacy client claim, never a source of verification truth.
    const { licenseVerified: _ignored, photos: _photos, ...raw } = details;
    return (0, categoryConfiguration_1.validateExtensions)(category.extensionFields, raw);
}
function cleanPhotos(photos) {
    return (0, mediaService_1.sanitizeUploadPaths)(photos);
}
async function resolveLegacyProvider(uid, providerName, categoryId, location) {
    const user = await User_1.User.findOne({ uid }).select('_id').lean();
    if (!user)
        throw new Error('Llogaria nuk u gjet');
    const profile = await ProviderProfile_1.ProviderProfile.findOne({ ownerUser: user._id, providerType: 'individual', business: { $exists: false } }).sort({ createdAt: 1 });
    if (profile)
        return String(profile._id);
    const online = location.trim().toLowerCase() === 'online';
    const created = await (0, providerProfileService_1.createProviderProfile)({
        ownerUid: uid, providerType: 'individual', categories: [categoryId],
        languages: [],
        locations: online ? [] : [{ countryCode: 'XK', cityName: location, online: false }],
        serviceAreas: [{ countryCode: 'XK', cityName: online ? undefined : location, online }],
        modes: online ? ['online'] : ['on_site'],
        publicProfile: { displayName: providerName },
    });
    return String(created._id);
}
async function createService(input) {
    const category = await (0, domainService_1.findDomainById)(input.categoryId);
    if (!category)
        throw new Error('Kategoria nuk ekziston');
    const resolved = await resolveCatalogSubcategory(input.categoryId, input.subcategoryId, input.subcategory);
    const extensions = await validateServiceDetails(input.categoryId, input.details);
    let providerId = input.providerId;
    let businessId = input.businessId;
    if (!providerId && businessId) {
        const profile = await (0, providerProfileService_1.ensureBusinessProviderProfile)(input.providerUid, businessId, category.id);
        providerId = String(profile._id);
    }
    if (!providerId) {
        providerId = await resolveLegacyProvider(input.providerUid, input.providerName, input.categoryId, input.location);
    }
    const modeValues = Array.isArray(extensions.deliveryModes) ? extensions.deliveryModes : [];
    const online = input.location.trim().toLowerCase() === 'online';
    const modes = [...new Set(modeValues.filter((mode) => mode !== 'group').map((mode) => mode === 'physical' ? 'on_site' : 'online'))];
    if (!modes.length)
        modes.push(online ? 'online' : 'on_site');
    const languages = (Array.isArray(extensions.supportLanguages) ? extensions.supportLanguages : [])
        .filter((value) => typeof value === 'string');
    const availabilityMode = extensions.availabilityMode === 'by_arrangement' || extensions.availabilityMode === 'slots'
        ? extensions.availabilityMode
        : 'request';
    const offer = await (0, serviceOfferService_1.createServiceOffer)({
        ownerUid: input.providerUid, providerId, businessId, staffUserId: input.staffUserId,
        categoryId: category.id,
        name: input.title, subtitle: resolved.subcategory, description: input.description,
        price: input.priceFrom === undefined ? { model: 'quote' } : { model: 'starting_at', amountFrom: input.priceFrom, currency: 'EUR', amountTo: typeof extensions.priceTo === 'number' ? extensions.priceTo : undefined },
        formats: modeValues.includes('group') ? ['group'] : ['individual'],
        modes, languages,
        serviceAreas: [{ countryCode: 'XK', cityName: online ? undefined : input.location, online }],
        photos: cleanPhotos(input.details?.photos),
        subcategoryId: resolved.subcategoryId,
        availabilityMode, extensions, allowCategoryExpansion: true,
    });
    const [result] = await (0, serviceOfferService_1.offersToLegacyServices)([offer]);
    return result;
}
async function updateService(id, uid, input) {
    const category = await (0, domainService_1.findDomainById)(input.categoryId);
    if (!category)
        throw new Error('Kategoria nuk ekziston');
    const resolved = await resolveCatalogSubcategory(input.categoryId, input.subcategoryId, input.subcategory);
    const extensions = await validateServiceDetails(input.categoryId, input.details);
    const modeValues = Array.isArray(extensions.deliveryModes) ? extensions.deliveryModes : [];
    const online = input.location.trim().toLowerCase() === 'online';
    const modes = [...new Set(modeValues.filter((mode) => mode !== 'group').map((mode) => mode === 'physical' ? 'on_site' : 'online'))];
    if (!modes.length)
        modes.push(online ? 'online' : 'on_site');
    const languages = (Array.isArray(extensions.supportLanguages) ? extensions.supportLanguages : [])
        .filter((value) => typeof value === 'string');
    const availabilityMode = extensions.availabilityMode === 'by_arrangement' || extensions.availabilityMode === 'slots'
        ? extensions.availabilityMode
        : 'request';
    const offer = await ServiceOffer_1.ServiceOffer.findById(id);
    if (offer) {
        const updated = await (0, serviceOfferService_1.updateServiceOffer)(uid, id, {
            categoryId: category.id,
            name: input.title, subtitle: resolved.subcategory, description: input.description,
            price: input.priceFrom === undefined ? { model: 'quote' } : { model: 'starting_at', amountFrom: input.priceFrom, currency: 'EUR', amountTo: typeof extensions.priceTo === 'number' ? extensions.priceTo : undefined },
            formats: modeValues.includes('group') ? ['group'] : ['individual'],
            modes, languages,
            serviceAreas: [{ countryCode: 'XK', cityName: online ? undefined : input.location, online }],
            photos: cleanPhotos(input.details?.photos),
            subcategoryId: resolved.subcategoryId,
            availabilityMode,
            extensions,
            staffUserId: input.staffUserId,
        });
        const [result] = await (0, serviceOfferService_1.offersToLegacyServices)([updated]);
        return result;
    }
    const service = await Service_1.Service.findById(id);
    if (!service)
        throw new Error('Shërbimi nuk u gjet');
    if (service.providerUid !== uid)
        throw new Error('Nuk ke leje për këtë shërbim');
    service.title = input.title;
    service.description = input.description;
    service.categoryId = category.id;
    service.categoryLabel = category.labelSq;
    service.subcategory = resolved.subcategory;
    service.subcategoryId = resolved.subcategoryId;
    service.location = input.location;
    service.priceFrom = input.priceFrom;
    const nextPhotos = cleanPhotos(input.details?.photos);
    const previousPhotos = [...(service.details?.photos || [])];
    service.details = { ...extensions, photos: nextPhotos };
    await service.save();
    await (0, mediaService_1.deleteRemovedUploads)(previousPhotos, nextPhotos);
    const [result] = await withLegacyProviders([service]);
    return result;
}
async function deleteService(id, uid) {
    const offer = await ServiceOffer_1.ServiceOffer.findById(id);
    if (offer) {
        await (0, serviceOfferService_1.deleteServiceOffer)(uid, id);
        return { deleted: true, id };
    }
    const service = await Service_1.Service.findById(id);
    if (!service)
        throw new Error('Shërbimi nuk u gjet');
    if (service.providerUid !== uid)
        throw new Error('Nuk ke leje për këtë shërbim');
    const photos = [...(service.details?.photos || [])];
    await service.deleteOne();
    await (0, mediaService_1.deleteUploads)(photos);
    return { deleted: true, id };
}
async function listServicesByProvider(providerUid) {
    const [legacy, offers] = await Promise.all([
        Service_1.Service.find({ providerUid }).sort({ createdAt: -1 }),
        (0, serviceOfferService_1.listMyServiceOffers)(providerUid),
    ]);
    return [...(await (0, serviceOfferService_1.offersToLegacyServices)(offers)), ...(await withLegacyProviders(legacy))];
}
async function listProviderServicePage(providerUid, input, publicOnly = false) {
    const offerQuery = { ...await (0, serviceOfferService_1.managedServiceOfferQuery)(providerUid), ...(publicOnly ? { status: 'published', visibility: 'public', 'moderation.status': 'approved' } : {}) };
    const pipeline = [
        { $match: offerQuery },
        { $project: { _id: 1, source: { $literal: 'offer' }, createdAt: 1, active: { $and: [{ $eq: ['$status', 'published'] }, { $eq: ['$moderation.status', 'approved'] }] } } },
        { $unionWith: { coll: Service_1.Service.collection.name, pipeline: [
                    { $match: { providerUid, ...(publicOnly ? { active: true } : {}) } },
                    { $project: { _id: 1, source: { $literal: 'legacy' }, createdAt: 1, active: 1 } },
                ] } },
    ];
    const totals = (await ServiceOffer_1.ServiceOffer.aggregate([...pipeline, { $group: { _id: null, total: { $sum: 1 }, active: { $sum: { $cond: ['$active', 1, 0] } } } }]))[0];
    const result = await (0, pagination_1.queryPage)(input, () => Promise.resolve(totals?.total ?? 0), (skip, limit) => ServiceOffer_1.ServiceOffer.aggregate([...pipeline, { $sort: { createdAt: -1, _id: -1 } }, { $skip: skip }, { $limit: limit }]));
    const [offers, legacy] = await Promise.all([
        ServiceOffer_1.ServiceOffer.find({ _id: { $in: result.items.filter((row) => row.source === 'offer').map((row) => row._id) } }),
        Service_1.Service.find({ _id: { $in: result.items.filter((row) => row.source === 'legacy').map((row) => row._id) } }),
    ]);
    const byId = new Map([...await (0, serviceOfferService_1.offersToLegacyServices)(offers, publicOnly), ...await withLegacyProviders(legacy)].map((card) => [card.id, card]));
    return { services: result.items.flatMap((row) => { const card = byId.get(String(row._id)); return card ? [card] : []; }), pagination: result.pagination, summary: { total: totals?.total ?? 0, active: totals?.active ?? 0 } };
}
async function listActiveServices(filters = {}) {
    let providerIds;
    let providerUids;
    if (filters.cityId) {
        if (!await isActiveDiscoveryCity(filters.cityId))
            return [];
        const profiles = await ProviderProfile_1.ProviderProfile.find({
            serviceAreaCityIds: new mongoose_1.Types.ObjectId(filters.cityId),
            status: 'published', 'moderation.status': 'approved',
        }).select('_id ownerUser').lean();
        if (!profiles.length)
            return [];
        providerIds = profiles.map((profile) => profile._id);
        const users = await User_1.User.find({ _id: { $in: profiles.map((profile) => profile.ownerUser) } }).select('uid').lean();
        providerUids = users.map((user) => user.uid);
    }
    const [legacy, offers] = await Promise.all([
        Service_1.Service.find({ active: true, ...(providerUids ? { providerUid: { $in: providerUids } } : {}) })
            .sort({ createdAt: -1 }),
        (0, serviceOfferService_1.listPublishedServiceOffers)(providerIds),
    ]);
    let categoryId = filters.categoryId;
    if (categoryId && mongoose_1.Types.ObjectId.isValid(categoryId)) {
        const category = await Category_1.Category.findById(categoryId).select('stableId').lean();
        categoryId = category?.stableId ?? categoryId;
    }
    let subcategoryNames;
    if (filters.subcategoryId) {
        const subcategory = mongoose_1.Types.ObjectId.isValid(filters.subcategoryId)
            ? await Subcategory_1.Subcategory.findById(filters.subcategoryId).lean()
            : await Subcategory_1.Subcategory.findOne({ slug: filters.subcategoryId }).lean();
        if (!subcategory?.isActive)
            return [];
        subcategoryNames = [subcategory.name.sq, subcategory.name.en];
        if (!categoryId) {
            const parent = await Category_1.Category.findById(subcategory.categoryId).select('stableId').lean();
            categoryId = parent?.stableId;
        }
    }
    const services = [...(await (0, serviceOfferService_1.offersToLegacyServices)(offers, true)), ...(await withLegacyProviders(legacy))];
    return filterDiscoveredServices(services, { ...filters, categoryId, subcategoryNames });
}
async function listPublicServicePage(query, input) {
    if (typeof query.cityId === 'string' && !await isActiveDiscoveryCity(query.cityId)) {
        const result = await (0, pagination_1.queryPage)(input, () => Promise.resolve(0), () => Promise.resolve([]));
        return { services: [], pagination: result.pagination, summary: { total: 0, active: 0 } };
    }
    await (0, ratingService_1.backfillUnmoderatedPendingReviews)();
    const pipeline = (0, marketplaceQuery_1.publicServicesPipeline)(query);
    const count = async () => (await ServiceOffer_1.ServiceOffer.aggregate([...pipeline, { $count: 'total' }]))[0]?.total ?? 0;
    if (query.countsOnly === 'true') {
        const total = await count();
        return { services: [], pagination: (0, pagination_1.paginationMeta)(input, total), summary: { total, active: total } };
    }
    const result = await (0, pagination_1.queryPage)(input, count, (skip, limit) => ServiceOffer_1.ServiceOffer.aggregate([...pipeline, { $skip: skip }, { $limit: limit }, { $project: { _id: 1, source: 1, ratingAverage: 1, ratingCount: 1 } }]));
    const [offers, legacy] = await Promise.all([
        ServiceOffer_1.ServiceOffer.find({ _id: { $in: result.items.filter((row) => row.source === 'offer').map((row) => row._id) } }),
        Service_1.Service.find({ _id: { $in: result.items.filter((row) => row.source === 'legacy').map((row) => row._id) } }),
    ]);
    const ratings = new Map(result.items.map((row) => [String(row._id), { average: row.ratingAverage, count: row.ratingCount }]));
    const [offerCards, legacyCards] = await Promise.all([(0, serviceOfferService_1.offersToLegacyServices)(offers, true, ratings), withLegacyProviders(legacy)]);
    const cards = [...offerCards, ...legacyCards];
    const byId = new Map(cards.map((card) => [card.id, card]));
    const services = result.items.flatMap((row) => { const card = byId.get(String(row._id)); return card ? [card] : []; });
    return { services, pagination: result.pagination, summary: { total: result.pagination.total, active: result.pagination.total } };
}
async function getActiveServiceById(id, input = { page: 1, limit: 12 }) {
    if (!mongoose_1.default.isValidObjectId(id))
        return null;
    const offer = await ServiceOffer_1.ServiceOffer.findOne({
        _id: id,
        status: 'published',
        visibility: 'public',
        'moderation.status': 'approved',
    });
    if (offer) {
        const [enriched] = await (0, serviceOfferService_1.offersToLegacyServices)([offer], true);
        if (enriched?.active)
            return withCompanyExperts(enriched, input);
    }
    const service = await Service_1.Service.findOne({ _id: id, active: true });
    if (!service)
        return null;
    const [enriched] = await withLegacyProviders([service]);
    if (!enriched)
        return null;
    return withCompanyExperts(enriched, input);
}
async function withCompanyExperts(service, input) {
    const result = await (0, businessService_1.publicExpertPageForOwner)(service.providerUid || '', input);
    return { ...service, experts: result.experts, expertsPagination: result.pagination };
}
async function listActiveServicesByProvider(providerUid) {
    const [legacy, offers] = await Promise.all([
        Service_1.Service.find({ providerUid, active: true }).sort({ createdAt: -1 }),
        (0, serviceOfferService_1.listMyServiceOffers)(providerUid),
    ]);
    const publishedOffers = offers.filter((offer) => offer.status === 'published' && offer.moderation.status === 'approved' && offer.visibility === 'public');
    return [
        ...(await (0, serviceOfferService_1.offersToLegacyServices)(publishedOffers, true)),
        ...(await withLegacyProviders(legacy)),
    ];
}
//# sourceMappingURL=serviceService.js.map