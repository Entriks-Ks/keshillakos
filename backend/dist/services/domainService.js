"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_PORTAL = void 0;
exports.ensureCategoryCatalog = ensureCategoryCatalog;
exports.listAllDomains = listAllDomains;
exports.findDomainById = findDomainById;
exports.findCategoryById = findCategoryById;
exports.createCategory = createCategory;
exports.updateCategory = updateCategory;
exports.createCustomDomain = createCustomDomain;
const mongoose_1 = require("mongoose");
const domains_1 = require("../data/domains");
const Category_1 = require("../models/Category");
const CustomCategory_1 = require("../models/CustomCategory");
const categoryConfiguration_1 = require("./categoryConfiguration");
exports.DEFAULT_PORTAL = 'keshillakos';
function slugify(input) {
    return input.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
}
let importPromise;
// Retain both legacy sources, but import them into Category once. All runtime reads use Category.
function ensureCategoryCatalog() {
    if (!importPromise) {
        importPromise = (async () => {
            for (const [order, domain] of domains_1.SYSTEM_DOMAINS.entries()) {
                await Category_1.Category.updateOne({ portal: exports.DEFAULT_PORTAL, stableId: domain.id }, {
                    $setOnInsert: {
                        portal: exports.DEFAULT_PORTAL, stableId: domain.id, slug: domain.id,
                        labels: { sq: domain.labelSq, de: domain.labelDe },
                        guidelines: domain.requirements.includes('coaching_boundary') ? { sq: domains_1.COACHING_DISCLAIMER }
                            : domain.requirements.includes('regulatory_notice') ? { sq: domains_1.FINANCE_REGULATORY_NOTICE } : undefined,
                        examples: domain.examples, keywords: domain.keywords,
                        requirements: domain.requirements,
                        extensionFields: (0, categoryConfiguration_1.legacyExtensionFields)(domain.requirements),
                        order: domain.id === 'other' ? 10000 : order,
                        status: 'active', source: 'seed', version: 1,
                    },
                }, { upsert: true, runValidators: true });
            }
            const legacy = await CustomCategory_1.CustomCategory.find().lean();
            for (const category of legacy) {
                await Category_1.Category.updateOne({ portal: exports.DEFAULT_PORTAL, stableId: category.slug }, {
                    $setOnInsert: {
                        portal: exports.DEFAULT_PORTAL, stableId: category.slug, slug: category.slug,
                        labels: { sq: category.labelSq, de: category.labelDe },
                        examples: category.examples, keywords: category.keywords,
                        requirements: [], extensionFields: [], order: 5000,
                        status: category.active ? 'active' : 'archived', source: 'legacy', version: 1,
                    },
                }, { upsert: true, runValidators: true });
            }
        })().catch((err) => { importPromise = undefined; throw err; });
    }
    return importPromise;
}
function toCategoryView(category) {
    const labels = Object.fromEntries(category.labels);
    return {
        id: category.stableId,
        categoryRef: String(category._id),
        portal: category.portal,
        stableId: category.stableId,
        slug: category.slug,
        parent: category.parent ? String(category.parent) : undefined,
        labels,
        guidelines: category.guidelines ? Object.fromEntries(category.guidelines) : undefined,
        labelSq: labels.sq || category.slug,
        labelDe: labels.de || labels.en || labels.sq || category.slug,
        examples: category.examples,
        keywords: category.keywords,
        requirements: category.requirements,
        system: category.source === 'seed',
        order: category.order,
        status: category.status,
        version: category.version,
        extensionFields: category.extensionFields,
        configRefs: category.configRefs,
    };
}
async function listAllDomains(portal = exports.DEFAULT_PORTAL) {
    await ensureCategoryCatalog();
    const categories = await Category_1.Category.find({ portal, status: 'active' }).sort({ order: 1, stableId: 1 });
    return categories.map(toCategoryView);
}
async function findDomainById(id, portal = exports.DEFAULT_PORTAL) {
    await ensureCategoryCatalog();
    const category = await Category_1.Category.findOne({ portal, status: 'active', $or: [{ stableId: id }, { slug: id }] });
    return category ? toCategoryView(category) : null;
}
async function findCategoryById(id, portal = exports.DEFAULT_PORTAL) {
    await ensureCategoryCatalog();
    return Category_1.Category.findOne({ portal, status: 'active', $or: [{ stableId: id }, { slug: id }] });
}
async function createCategory(input) {
    await ensureCategoryCatalog();
    let parent;
    if (input.parent) {
        if (!mongoose_1.Types.ObjectId.isValid(input.parent))
            throw new Error('Parent ID i pavlefshëm');
        const existing = await Category_1.Category.findById(input.parent);
        if (!existing || existing.portal !== input.portal)
            throw new Error('Parent must belong to the same portal');
        parent = existing._id;
    }
    const category = await Category_1.Category.create({
        portal: input.portal,
        stableId: input.stableId,
        slug: input.slug || input.stableId,
        labels: input.labels,
        guidelines: input.guidelines,
        parent,
        order: input.order ?? 0,
        status: input.status ?? 'active',
        examples: input.examples ?? [],
        keywords: input.keywords ?? [],
        requirements: input.requirements ?? [],
        extensionFields: input.extensionFields ?? [],
        configRefs: input.configRefs,
        version: 1,
    });
    return toCategoryView(category);
}
async function updateCategory(id, input) {
    await ensureCategoryCatalog();
    if (!mongoose_1.Types.ObjectId.isValid(id))
        throw new Error('Category ID i pavlefshëm');
    const category = await Category_1.Category.findById(id);
    if (!category)
        throw new Error('Kategoria nuk u gjet');
    if (input.parent) {
        const parent = await Category_1.Category.findById(input.parent);
        if (!parent || parent.portal !== category.portal || parent.id === category.id)
            throw new Error('Parent i pavlefshëm');
        let cursor = parent;
        while (cursor.parent) {
            if (cursor.parent.equals(category._id))
                throw new Error('Category hierarchy cycle');
            const next = await Category_1.Category.findById(cursor.parent);
            if (!next)
                break;
            cursor = next;
        }
        category.parent = parent._id;
    }
    for (const key of ['slug', 'labels', 'guidelines', 'order', 'status', 'examples', 'keywords', 'requirements', 'extensionFields', 'configRefs']) {
        if (input[key] !== undefined)
            category.set(key, input[key]);
    }
    category.version += 1;
    await category.save();
    return toCategoryView(category);
}
async function createCustomDomain(input) {
    await ensureCategoryCatalog();
    const base = slugify(input.labelSq) || slugify(input.labelDe) || `custom-${Date.now()}`;
    let slug = base;
    let suffix = 1;
    while (await Category_1.Category.exists({ portal: exports.DEFAULT_PORTAL, $or: [{ slug }, { stableId: slug }] }))
        slug = `${base}-${suffix++}`;
    return createCategory({
        portal: exports.DEFAULT_PORTAL, stableId: slug, labels: { sq: input.labelSq.trim(), de: input.labelDe.trim() || input.labelSq.trim() },
        examples: input.examples?.map((value) => value.trim()).filter(Boolean),
        keywords: input.keywords?.map((value) => value.trim().toLowerCase()).filter(Boolean),
        order: 5000,
    });
}
//# sourceMappingURL=domainService.js.map