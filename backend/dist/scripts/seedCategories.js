"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.catalog = exports.CATALOG_REQUIREMENTS = void 0;
exports.seedCategories = seedCategories;
require("dotenv/config");
const mongoose_1 = __importDefault(require("mongoose"));
const db_1 = require("../config/db");
const Category_1 = require("../models/Category");
const Subcategory_1 = require("../models/Subcategory");
const categoryConfiguration_1 = require("../services/categoryConfiguration");
const domainService_1 = require("../services/domainService");
/** Category-specific requirements for the bilingual catalog (universal fields live on the form). */
exports.CATALOG_REQUIREMENTS = {
    'legal-services': ['license_verification'],
    'accounting-and-business': ['documents_deadlines', 'audience_b2c_b2b'],
};
// Each entry is [English, Albanian]. Slugs derive from English names.
exports.catalog = [
    ['Legal Services', 'Shërbime Juridike', [
            ['Legal Consultation', 'Këshillim Juridik'], ['Criminal Law', 'E Drejta Penale'], ['Civil & Family Law', 'E Drejta Civile dhe Familjare'], ['Business & Property Law', 'E Drejta e Biznesit dhe Pronës'], ['Notary & Document Services', 'Shërbime Noteriale dhe të Dokumenteve'],
        ]],
    ['Accounting & Business', 'Kontabilitet dhe Biznes', [
            ['Accounting', 'Kontabilitet'], ['Tax Consulting', 'Këshillim Tatimor'], ['Business Registration', 'Regjistrim Biznesi'], ['Business Consulting', 'Këshillim për Biznes'], ['Payroll', 'Pagat'],
        ]],
];
function slugify(value) {
    return value.toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
// Reuse the identity of a related former legal specialty when renaming it.
const formerLegalSlugs = {
    'civil-and-family-law': 'family-and-inheritance-law',
    'business-and-property-law': 'business-and-employment-law',
    'notary-and-document-services': 'notary-services',
};
async function seedCategories() {
    for (const [index, [en, sq, children]] of exports.catalog.entries()) {
        const slug = slugify(en);
        const existing = await Category_1.Category.findOne({ portal: domainService_1.DEFAULT_PORTAL, $or: [{ stableId: slug }, { slug }] });
        const category = existing ?? new Category_1.Category({ portal: domainService_1.DEFAULT_PORTAL, stableId: slug, slug });
        const requirements = exports.CATALOG_REQUIREMENTS[slug] ?? [];
        category.set({
            name: { sq, en },
            labels: { sq, en },
            slug,
            order: index + 1,
            isActive: true,
            status: 'active',
            source: 'seed',
            requirements,
            extensionFields: (0, categoryConfiguration_1.legacyExtensionFields)(requirements),
        });
        await category.save();
        for (const [position, [childEn, childSq]] of children.entries()) {
            const childSlug = slugify(childEn);
            const child = await Subcategory_1.Subcategory.findOne({ categoryId: category._id, slug: childSlug })
                ?? (slug === 'legal-services' && formerLegalSlugs[childSlug]
                    ? await Subcategory_1.Subcategory.findOne({ categoryId: category._id, slug: formerLegalSlugs[childSlug] })
                    : null)
                ?? new Subcategory_1.Subcategory({ categoryId: category._id, slug: childSlug });
            child.set({ slug: childSlug, name: { sq: childSq, en: childEn }, order: position + 1, isActive: true });
            await child.save();
        }
        await Subcategory_1.Subcategory.updateMany({ categoryId: category._id, slug: { $nin: children.map(([childEn]) => slugify(childEn)) } }, { $set: { isActive: false } });
    }
    const activeSlugs = exports.catalog.map(([en]) => slugify(en));
    await Category_1.Category.updateMany({ portal: domainService_1.DEFAULT_PORTAL, slug: { $nin: activeSlugs } }, { $set: { isActive: false, status: 'archived' } });
    const archived = await Category_1.Category.find({ portal: domainService_1.DEFAULT_PORTAL, slug: { $nin: activeSlugs } }).select('_id');
    if (archived.length > 0) {
        await Subcategory_1.Subcategory.updateMany({ categoryId: { $in: archived.map((item) => item._id) } }, { $set: { isActive: false } });
    }
}
if (require.main === module) {
    (0, db_1.connectDB)().then(seedCategories).then(() => {
        console.log('Seeded legal and accounting categories');
    }).catch((err) => {
        console.error(err);
        process.exitCode = 1;
    }).finally(() => mongoose_1.default.disconnect());
}
//# sourceMappingURL=seedCategories.js.map