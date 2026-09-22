"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureCatalogOptions = ensureCatalogOptions;
exports.listCatalogOptions = listCatalogOptions;
exports.listCatalogOptionValues = listCatalogOptionValues;
const serviceOptions_1 = require("../data/serviceOptions");
const CatalogOption_1 = require("../models/CatalogOption");
let seedPromise;
async function ensureCatalogOptions() {
    if (!seedPromise) {
        seedPromise = (async () => {
            for (const option of serviceOptions_1.SERVICE_OPTIONS_SEED) {
                await CatalogOption_1.CatalogOption.updateOne({ group: option.group, slug: option.slug }, {
                    $set: {
                        name: option.name,
                        order: option.order,
                        isActive: true,
                    },
                    $setOnInsert: {
                        group: option.group,
                        slug: option.slug,
                    },
                }, { upsert: true, runValidators: true });
            }
        })().catch((err) => {
            seedPromise = undefined;
            throw err;
        });
    }
    return seedPromise;
}
function toView(doc) {
    return {
        _id: String(doc._id),
        group: doc.group,
        name: doc.name,
        slug: doc.slug,
        order: doc.order,
        isActive: doc.isActive,
    };
}
async function listCatalogOptions(group) {
    await ensureCatalogOptions();
    const filter = {
        isActive: true,
        ...(group ? { group } : { group: { $in: [...serviceOptions_1.CATALOG_OPTION_GROUPS] } }),
    };
    const options = await CatalogOption_1.CatalogOption.find(filter).sort({ group: 1, order: 1, slug: 1 });
    return options.map(toView);
}
async function listCatalogOptionValues(group) {
    const options = await listCatalogOptions(group);
    return options.map((option) => (option.group === 'language' ? option.name.sq : option.slug));
}
//# sourceMappingURL=catalogOptionService.js.map