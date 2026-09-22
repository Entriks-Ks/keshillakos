"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SERVICE_OPTIONS_SEED = exports.CATALOG_OPTION_GROUPS = void 0;
exports.serviceOptionValue = serviceOptionValue;
exports.serviceOptionValues = serviceOptionValues;
exports.CATALOG_OPTION_GROUPS = ['language', 'delivery-mode', 'audience', 'offer-type', 'availability'];
/** Authoritative seed for service/domain form options. Runtime reads come from CatalogOption. */
exports.SERVICE_OPTIONS_SEED = [
    { group: 'language', slug: 'albanian', name: { sq: 'Shqip', en: 'Albanian' }, order: 1 },
    { group: 'language', slug: 'german', name: { sq: 'Gjermanisht', en: 'German' }, order: 2 },
    { group: 'language', slug: 'english', name: { sq: 'Anglisht', en: 'English' }, order: 3 },
    { group: 'language', slug: 'turkish', name: { sq: 'Turqisht', en: 'Turkish' }, order: 4 },
    { group: 'language', slug: 'french', name: { sq: 'Frëngjisht', en: 'French' }, order: 5 },
    { group: 'delivery-mode', slug: 'online', name: { sq: 'Online', en: 'Online' }, order: 1 },
    { group: 'delivery-mode', slug: 'physical', name: { sq: 'Fizikisht', en: 'In person' }, order: 2 },
    { group: 'delivery-mode', slug: 'group', name: { sq: 'Grup', en: 'Group' }, order: 3 },
    { group: 'audience', slug: 'b2c', name: { sq: 'B2C — individ', en: 'B2C — individual' }, order: 1 },
    { group: 'audience', slug: 'b2b', name: { sq: 'B2B — kompani', en: 'B2B — company' }, order: 2 },
    { group: 'audience', slug: 'both', name: { sq: 'B2C dhe B2B', en: 'B2C and B2B' }, order: 3 },
    { group: 'offer-type', slug: 'package', name: { sq: 'Paketë shërbimi', en: 'Service package' }, order: 1 },
    { group: 'offer-type', slug: 'project', name: { sq: 'Projekt', en: 'Project' }, order: 2 },
    { group: 'offer-type', slug: 'service', name: { sq: 'Shërbim i thjeshtë', en: 'Simple service' }, order: 3 },
    { group: 'availability', slug: 'request', name: { sq: 'Me kërkesë', en: 'On request' }, order: 1 },
    { group: 'availability', slug: 'by_arrangement', name: { sq: 'Me marrëveshje', en: 'By arrangement' }, order: 2 },
    { group: 'availability', slug: 'slots', name: { sq: 'Orare fikse', en: 'Fixed slots' }, order: 3 },
];
/** Stored form/API value: languages keep Albanian labels for legacy data; other groups use slug. */
function serviceOptionValue(option) {
    return option.group === 'language' ? option.name.sq : option.slug;
}
function serviceOptionValues(group) {
    return exports.SERVICE_OPTIONS_SEED.filter((item) => item.group === group).map(serviceOptionValue);
}
//# sourceMappingURL=serviceOptions.js.map