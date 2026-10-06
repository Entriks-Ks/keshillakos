"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isVerified = isVerified;
exports.formatServicePrice = formatServicePrice;
exports.filterVisibleServices = filterVisibleServices;
exports.filterMarketplaceProviders = filterMarketplaceProviders;
exports.sortServices = sortServices;
exports.sortProviders = sortProviders;
exports.marketplaceSort = marketplaceSort;
exports.marketplaceFilters = marketplaceFilters;
function isVerified(provider) {
    const v = provider?.verification;
    if (!v)
        return false;
    return v.identity === 'verified' || v.business === 'verified' || v.qualification === 'verified';
}
function formatServicePrice(service) {
    const from = service.priceFrom;
    const to = service.details?.priceTo;
    if (from == null && to == null)
        return null;
    if (from != null && to != null)
        return `€${from} – €${to}`;
    if (from != null)
        return `nga €${from}`;
    return `deri €${to}`;
}
function matchesQuery(haystack, query) {
    if (!query)
        return true;
    return haystack.filter(Boolean).join(' ').toLowerCase().includes(query);
}
function filterVisibleServices(services, filters) {
    const q = filters.query.trim().toLowerCase();
    const minPrice = filters.priceMin.trim() ? Number(filters.priceMin) : null;
    const maxPrice = filters.priceMax.trim() ? Number(filters.priceMax) : null;
    const minRating = filters.minRating.trim() ? Number(filters.minRating) : null;
    return services.filter((service) => {
        if (filters.categoryId !== 'all') {
            const matchesCategory = service.categoryId === filters.categoryId
                || service.categoryLabel === filters.categoryId
                || service.category === filters.categoryId;
            if (!matchesCategory)
                return false;
        }
        if (filters.subcategoryId !== 'all') {
            const matchesSub = service.subcategoryId === filters.subcategoryId
                || service.subcategory === filters.subcategoryId;
            if (!matchesSub)
                return false;
        }
        if (filters.delivery !== 'all' && !(service.details?.deliveryModes || []).includes(filters.delivery))
            return false;
        if (filters.language !== 'all') {
            const langs = service.details?.supportLanguages || service.provider?.languages || [];
            if (!langs.includes(filters.language))
                return false;
        }
        if (minPrice != null && !Number.isNaN(minPrice) && (service.priceFrom == null || service.priceFrom < minPrice))
            return false;
        if (maxPrice != null && !Number.isNaN(maxPrice)) {
            const top = service.details?.priceTo ?? service.priceFrom;
            if (top == null || top > maxPrice)
                return false;
        }
        if (minRating != null && !Number.isNaN(minRating) && (service.provider?.ratingAverage ?? 0) < minRating)
            return false;
        if (filters.verification === 'verified' && !isVerified(service.provider))
            return false;
        if (filters.availability !== 'all' && service.details?.availabilityMode !== filters.availability)
            return false;
        return matchesQuery([
            service.title,
            service.description,
            service.subcategory,
            service.categoryLabel,
            service.category,
            service.location,
            service.providerName,
            service.provider?.name,
            service.provider?.headline,
            service.responsibleExpert?.name,
        ], q);
    });
}
function filterMarketplaceProviders(providers, filters, tab) {
    const q = filters.query.trim().toLowerCase();
    const minRating = filters.minRating.trim() ? Number(filters.minRating) : null;
    const type = tab === 'experts' ? 'individual' : 'business';
    return providers.filter((provider) => {
        if (provider.providerType !== type)
            return false;
        if (filters.categoryId !== 'all' && !provider.categories.includes(filters.categoryId)
            && !provider.categoryLabels.includes(filters.categoryId))
            return false;
        if (filters.subcategoryId !== 'all' && !provider.subcategoryIds.includes(filters.subcategoryId))
            return false;
        if (filters.delivery === 'online' && !provider.modes.includes('online'))
            return false;
        if (filters.delivery === 'physical' && !provider.modes.includes('on_site'))
            return false;
        if (filters.language !== 'all' && !provider.languages.includes(filters.language))
            return false;
        if (minRating != null && !Number.isNaN(minRating) && (provider.ratingAverage ?? 0) < minRating)
            return false;
        if (filters.verification === 'verified' && !isVerified(provider))
            return false;
        return matchesQuery([
            provider.name,
            provider.title,
            provider.description,
            provider.location,
            ...provider.categoryLabels,
            ...provider.specializations,
            ...provider.languages,
        ], q);
    });
}
function sortServices(services, sort, query) {
    const q = query.trim().toLowerCase();
    const scored = [...services];
    scored.sort((a, b) => {
        if (sort === 'newest') {
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() || b.id.localeCompare(a.id);
        }
        if (sort === 'rating') {
            return (b.provider?.ratingAverage ?? 0) - (a.provider?.ratingAverage ?? 0)
                || (b.provider?.ratingCount ?? 0) - (a.provider?.ratingCount ?? 0);
        }
        if (sort === 'reviews') {
            return (b.provider?.ratingCount ?? 0) - (a.provider?.ratingCount ?? 0)
                || (b.provider?.ratingAverage ?? 0) - (a.provider?.ratingAverage ?? 0);
        }
        if (!q)
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() || b.id.localeCompare(a.id);
        const score = (item) => {
            const title = item.title.toLowerCase();
            const provider = (item.providerName || item.provider?.name || '').toLowerCase();
            if (title === q)
                return 3;
            if (title.includes(q))
                return 2;
            if (provider.includes(q))
                return 1;
            return 0;
        };
        return score(b) - score(a) || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() || b.id.localeCompare(a.id);
    });
    return scored;
}
function sortProviders(providers, sort, query) {
    const q = query.trim().toLowerCase();
    const scored = [...providers];
    scored.sort((a, b) => {
        if (sort === 'newest') {
            return new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime() || b.id.localeCompare(a.id);
        }
        if (sort === 'rating') {
            return (b.ratingAverage ?? 0) - (a.ratingAverage ?? 0) || (b.ratingCount ?? 0) - (a.ratingCount ?? 0);
        }
        if (sort === 'reviews') {
            return (b.ratingCount ?? 0) - (a.ratingCount ?? 0) || (b.ratingAverage ?? 0) - (a.ratingAverage ?? 0);
        }
        if (!q)
            return (b.ratingCount ?? 0) - (a.ratingCount ?? 0);
        const score = (item) => {
            const name = item.name.toLowerCase();
            if (name === q)
                return 3;
            if (name.includes(q))
                return 2;
            if ((item.title || '').toLowerCase().includes(q))
                return 1;
            return 0;
        };
        return score(b) - score(a) || (b.ratingAverage ?? 0) - (a.ratingAverage ?? 0);
    });
    return scored;
}
function marketplaceSort(value) {
    return value === 'newest' || value === 'rating' || value === 'reviews' ? value : 'relevance';
}
function marketplaceFilters(query) {
    const value = (key, fallback = 'all') => typeof query[key] === 'string' ? query[key] : fallback;
    return { query: value('q', ''), categoryId: value('categoryId'), subcategoryId: value('subcategoryId'), delivery: value('delivery') === 'online' ? 'online' : value('delivery') === 'physical' ? 'physical' : 'all', language: value('language'), priceMin: value('priceMin', ''), priceMax: value('priceMax', ''), minRating: value('minRating', ''), verification: value('verification') === 'verified' ? 'verified' : 'all', availability: 'all' };
}
//# sourceMappingURL=marketplaceFilters.js.map