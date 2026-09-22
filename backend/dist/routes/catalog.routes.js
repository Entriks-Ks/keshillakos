"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const mongoose_1 = require("mongoose");
const zod_1 = require("zod");
const auth_1 = require("../middleware/auth");
const serviceOptions_1 = require("../data/serviceOptions");
const Category_1 = require("../models/Category");
const City_1 = require("../models/City");
const Country_1 = require("../models/Country");
const Subcategory_1 = require("../models/Subcategory");
const catalogOptionService_1 = require("../services/catalogOptionService");
const domainService_1 = require("../services/domainService");
const router = (0, express_1.Router)();
const admin = [auth_1.requireAuth, (0, auth_1.requireRole)('admin')];
const slug = zod_1.z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const name = zod_1.z.object({ sq: zod_1.z.string().trim().min(1), en: zod_1.z.string().trim().min(1) });
const fields = { name, slug, order: zod_1.z.number().int(), isActive: zod_1.z.boolean() };
const categoryInput = zod_1.z.object(fields);
const subcategoryInput = zod_1.z.object({ ...fields, categoryId: zod_1.z.string().refine(mongoose_1.Types.ObjectId.isValid, 'Invalid category ID') });
const optionGroup = zod_1.z.enum(serviceOptions_1.CATALOG_OPTION_GROUPS);
function failure(res, err) {
    if (err instanceof zod_1.z.ZodError)
        return res.status(400).json({ message: 'Të dhëna të pavlefshme', errors: err.issues });
    if (err instanceof Error && 'code' in err && err.code === 11000)
        return res.status(409).json({ message: 'Slug ekziston tashmë' });
    if (err instanceof mongoose_1.Error.ValidationError)
        return res.status(400).json({ message: err.message });
    return res.status(500).json({ message: err instanceof Error ? err.message : 'Server error' });
}
function validId(id, res) {
    if (mongoose_1.Types.ObjectId.isValid(id))
        return true;
    res.status(400).json({ message: 'ID i pavlefshëm' });
    return false;
}
router.get('/countries', async (_req, res) => {
    try {
        const countries = await Country_1.Country.find({ isActive: true }).sort({ order: 1, slug: 1 });
        return res.json({ countries });
    }
    catch (err) {
        return failure(res, err);
    }
});
router.get('/countries/:slug/cities', async (req, res) => {
    try {
        const parsed = slug.safeParse(req.params.slug);
        if (!parsed.success)
            return res.status(400).json({ message: 'Slug i pavlefshëm', errors: parsed.error.issues });
        const country = await Country_1.Country.findOne({ slug: parsed.data, isActive: true });
        if (!country)
            return res.status(404).json({ message: 'Shteti nuk u gjet' });
        const cities = await City_1.City.find({ countryId: country._id, isActive: true }).sort({ order: 1, slug: 1 });
        return res.json({ cities });
    }
    catch (err) {
        return failure(res, err);
    }
});
router.get('/cities/:slug', async (req, res) => {
    try {
        const parsed = slug.safeParse(req.params.slug);
        const countrySlug = req.query.country === undefined ? undefined : slug.safeParse(req.query.country);
        if (!parsed.success || (countrySlug && !countrySlug.success))
            return res.status(400).json({ message: 'Slug i pavlefshëm' });
        const countries = countrySlug
            ? await Country_1.Country.find({ slug: countrySlug.data, isActive: true }).select('_id')
            : await Country_1.Country.find({ isActive: true }).select('_id');
        const cities = await City_1.City.find({
            slug: parsed.data,
            countryId: { $in: countries.map((country) => country._id) },
            isActive: true,
        }).limit(2);
        if (!cities.length)
            return res.status(404).json({ message: 'Qyteti nuk u gjet' });
        if (cities.length > 1)
            return res.status(409).json({ message: 'Slug i paqartë; specifikoni country' });
        return res.json({ city: cities[0] });
    }
    catch (err) {
        return failure(res, err);
    }
});
router.get('/catalog-options', async (req, res) => {
    try {
        const group = req.query.group === undefined ? undefined : optionGroup.parse(req.query.group);
        const options = await (0, catalogOptionService_1.listCatalogOptions)(group);
        return res.json({ options });
    }
    catch (err) {
        return failure(res, err);
    }
});
router.get('/categories', async (_req, res) => {
    try {
        const categories = await Category_1.Category.find({ portal: domainService_1.DEFAULT_PORTAL, isActive: true, status: 'active', name: { $exists: true } }).sort({ order: 1, slug: 1 });
        return res.json({ categories });
    }
    catch (err) {
        return failure(res, err);
    }
});
router.get('/categories/:categoryId/subcategories', async (req, res) => {
    try {
        const categoryId = String(req.params.categoryId);
        if (!validId(categoryId, res))
            return;
        const category = await Category_1.Category.findOne({ _id: categoryId, portal: domainService_1.DEFAULT_PORTAL, isActive: true, status: 'active' });
        if (!category)
            return res.status(404).json({ message: 'Kategoria nuk u gjet' });
        const subcategories = await Subcategory_1.Subcategory.find({ categoryId, isActive: true }).sort({ order: 1, slug: 1 });
        return res.json({ subcategories });
    }
    catch (err) {
        return failure(res, err);
    }
});
router.get('/categories/:slug', async (req, res) => {
    try {
        const category = await Category_1.Category.findOne({ portal: domainService_1.DEFAULT_PORTAL, slug: req.params.slug, isActive: true, status: 'active', name: { $exists: true } });
        if (!category)
            return res.status(404).json({ message: 'Kategoria nuk u gjet' });
        return res.json({ category });
    }
    catch (err) {
        return failure(res, err);
    }
});
router.post('/categories', ...admin, async (req, res) => {
    try {
        const input = categoryInput.parse(req.body);
        const category = await Category_1.Category.create({ ...input, portal: domainService_1.DEFAULT_PORTAL, stableId: input.slug, labels: input.name, status: input.isActive ? 'active' : 'archived', source: 'admin' });
        return res.status(201).json({ category });
    }
    catch (err) {
        return failure(res, err);
    }
});
router.put('/categories/:id', ...admin, async (req, res) => {
    try {
        if (!validId(String(req.params.id), res))
            return;
        const input = categoryInput.partial().refine((value) => Object.keys(value).length > 0).parse(req.body);
        const category = await Category_1.Category.findOne({ _id: req.params.id, portal: domainService_1.DEFAULT_PORTAL });
        if (!category)
            return res.status(404).json({ message: 'Kategoria nuk u gjet' });
        if (input.slug !== undefined)
            category.slug = input.slug;
        if (input.name !== undefined) {
            category.name = input.name;
            category.labels = new Map(Object.entries(input.name));
        }
        if (input.order !== undefined)
            category.order = input.order;
        if (input.isActive !== undefined) {
            category.isActive = input.isActive;
            category.status = input.isActive ? 'active' : 'archived';
        }
        await category.save();
        return res.json({ category });
    }
    catch (err) {
        return failure(res, err);
    }
});
router.delete('/categories/:id', ...admin, async (req, res) => {
    try {
        if (!validId(String(req.params.id), res))
            return;
        const category = await Category_1.Category.findOne({ _id: req.params.id, portal: domainService_1.DEFAULT_PORTAL });
        if (!category)
            return res.status(404).json({ message: 'Kategoria nuk u gjet' });
        if (await Subcategory_1.Subcategory.exists({ categoryId: category._id }))
            return res.status(409).json({ message: 'Fshini së pari nënkategoritë' });
        await category.deleteOne();
        return res.json({ message: 'Kategoria u fshi' });
    }
    catch (err) {
        return failure(res, err);
    }
});
router.get('/subcategories', async (req, res) => {
    try {
        const categoryId = req.query.categoryId;
        if (categoryId !== undefined && (typeof categoryId !== 'string' || !validId(categoryId, res)))
            return;
        const categories = await Category_1.Category.find({ portal: domainService_1.DEFAULT_PORTAL, isActive: true, status: 'active' }).select('_id');
        const ids = categories.map((category) => category._id);
        const subcategories = await Subcategory_1.Subcategory.find({ categoryId: categoryId ? { $in: ids.filter((id) => String(id) === categoryId) } : { $in: ids }, isActive: true }).sort({ order: 1, slug: 1 });
        return res.json({ subcategories });
    }
    catch (err) {
        return failure(res, err);
    }
});
router.get('/subcategories/:slug', async (req, res) => {
    try {
        const categoryId = req.query.categoryId;
        if (categoryId !== undefined && (typeof categoryId !== 'string' || !validId(categoryId, res)))
            return;
        const categories = await Category_1.Category.find({ portal: domainService_1.DEFAULT_PORTAL, isActive: true, status: 'active' }).select('_id');
        const ids = categories.map((category) => category._id);
        const matches = await Subcategory_1.Subcategory.find({ slug: req.params.slug, categoryId: categoryId ? { $in: ids.filter((id) => String(id) === categoryId) } : { $in: ids }, isActive: true }).limit(2);
        if (!matches.length)
            return res.status(404).json({ message: 'Nënkategoria nuk u gjet' });
        if (matches.length > 1)
            return res.status(409).json({ message: 'Slug i paqartë; specifikoni categoryId' });
        return res.json({ subcategory: matches[0] });
    }
    catch (err) {
        return failure(res, err);
    }
});
router.post('/subcategories', ...admin, async (req, res) => {
    try {
        const input = subcategoryInput.parse(req.body);
        if (!await Category_1.Category.exists({ _id: input.categoryId, portal: domainService_1.DEFAULT_PORTAL }))
            return res.status(404).json({ message: 'Kategoria nuk u gjet' });
        const subcategory = await Subcategory_1.Subcategory.create(input);
        return res.status(201).json({ subcategory });
    }
    catch (err) {
        return failure(res, err);
    }
});
router.put('/subcategories/:id', ...admin, async (req, res) => {
    try {
        if (!validId(String(req.params.id), res))
            return;
        const input = subcategoryInput.partial().refine((value) => Object.keys(value).length > 0).parse(req.body);
        const subcategory = await Subcategory_1.Subcategory.findById(req.params.id);
        if (!subcategory)
            return res.status(404).json({ message: 'Nënkategoria nuk u gjet' });
        if (!await Category_1.Category.exists({ _id: subcategory.categoryId, portal: domainService_1.DEFAULT_PORTAL }))
            return res.status(404).json({ message: 'Nënkategoria nuk u gjet' });
        if (input.categoryId && !await Category_1.Category.exists({ _id: input.categoryId, portal: domainService_1.DEFAULT_PORTAL }))
            return res.status(404).json({ message: 'Kategoria nuk u gjet' });
        subcategory.set(input);
        await subcategory.save();
        return res.json({ subcategory });
    }
    catch (err) {
        return failure(res, err);
    }
});
router.delete('/subcategories/:id', ...admin, async (req, res) => {
    try {
        if (!validId(String(req.params.id), res))
            return;
        const subcategory = await Subcategory_1.Subcategory.findById(req.params.id);
        if (!subcategory)
            return res.status(404).json({ message: 'Nënkategoria nuk u gjet' });
        if (!await Category_1.Category.exists({ _id: subcategory.categoryId, portal: domainService_1.DEFAULT_PORTAL }))
            return res.status(404).json({ message: 'Nënkategoria nuk u gjet' });
        await subcategory.deleteOne();
        return res.json({ message: 'Nënkategoria u fshi' });
    }
    catch (err) {
        return failure(res, err);
    }
});
exports.default = router;
//# sourceMappingURL=catalog.routes.js.map