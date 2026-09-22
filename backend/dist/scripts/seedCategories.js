"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.catalog = void 0;
exports.seedCategories = seedCategories;
require("dotenv/config");
const mongoose_1 = __importDefault(require("mongoose"));
const db_1 = require("../config/db");
const Category_1 = require("../models/Category");
const Subcategory_1 = require("../models/Subcategory");
const domainService_1 = require("../services/domainService");
// Each entry is [English, Albanian]. Slugs derive from English names.
exports.catalog = [
    ['Home & Property', 'Shtëpi dhe Pronë', [
            ['House Cleaning', 'Pastrim Shtëpie'], ['Plumbing', 'Hidraulikë'], ['Electrical Services', 'Shërbime Elektrike'], ['Painting & Renovation', 'Lyerje dhe Renovim'], ['Handyman', 'Riparime të Përgjithshme'],
        ]],
    ['Gardening & Outdoor', 'Kopshtari dhe Hapësira të Jashtme', [
            ['Garden Maintenance', 'Mirëmbajtje Kopshti'], ['Landscaping', 'Rregullim Peizazhi'], ['Tree Services', 'Shërbime për Pemët'], ['Irrigation', 'Ujitje'], ['Outdoor Cleaning', 'Pastrim i Hapësirave të Jashtme'],
        ]],
    ['Auto & Transportation', 'Automjete dhe Transport', [
            ['Car Repair', 'Riparim Automjetesh'], ['Auto Diagnostics', 'Diagnostikim Automjetesh'], ['Car Detailing', 'Pastrim dhe Kujdes për Automjete'], ['Towing', 'Shërbim Rimorkimi'], ['Moving & Delivery', 'Zhvendosje dhe Dërgesa'],
        ]],
    ['Legal Services', 'Shërbime Juridike', [
            ['Legal Consultation', 'Këshillim Juridik'], ['Criminal Law', 'E Drejta Penale'], ['Civil & Family Law', 'E Drejta Civile dhe Familjare'], ['Business & Property Law', 'E Drejta e Biznesit dhe Pronës'], ['Notary & Document Services', 'Shërbime Noteriale dhe të Dokumenteve'],
        ]],
    ['Accounting & Business', 'Kontabilitet dhe Biznes', [
            ['Accounting', 'Kontabilitet'], ['Tax Consulting', 'Këshillim Tatimor'], ['Business Registration', 'Regjistrim Biznesi'], ['Business Consulting', 'Këshillim për Biznes'], ['HR & Recruitment', 'Burime Njerëzore dhe Rekrutim'],
        ]],
    ['IT & Technology', 'IT dhe Teknologji', [
            ['Computer & Phone Repair', 'Riparim Kompjuterësh dhe Telefonash'], ['Website Development', 'Zhvillim Faqesh Interneti'], ['App & Software Development', 'Zhvillim Aplikacionesh dhe Softueri'], ['IT Support', 'Mbështetje IT'], ['Cybersecurity', 'Siguri Kibernetike'],
        ]],
    ['Marketing & Creative', 'Marketing dhe Krijimtari', [
            ['Digital Marketing', 'Marketing Digjital'], ['Social Media Management', 'Menaxhim i Rrjeteve Sociale'], ['Graphic Design & Branding', 'Dizajn Grafik dhe Identitet i Markës'], ['Photography & Videography', 'Fotografi dhe Videografi'], ['Content Creation', 'Krijim Përmbajtjeje'],
        ]],
    ['Education & Tutoring', 'Arsim dhe Mësim Privat', [
            ['School Tutoring', 'Mësim Plotësues Shkollor'], ['Language Lessons', 'Mësime Gjuhësh'], ['Exam Preparation', 'Përgatitje për Provime'], ['Music & Art Lessons', 'Mësime Muzike dhe Arti'], ['Professional Training', 'Trajnime Profesionale'],
        ]],
    ['Translation & Language', 'Përkthim dhe Gjuhë', [
            ['Document Translation', 'Përkthim Dokumentesh'], ['Certified Translation', 'Përkthim i Certifikuar'], ['Business Translation', 'Përkthim për Biznes'], ['Interpretation', 'Interpretim'], ['Proofreading', 'Korrekturë Gjuhësore'],
        ]],
    ['Career Development', 'Zhvillim Karriere', [
            ['CV Writing', 'Hartim CV-je'], ['Interview Preparation', 'Përgatitje për Intervistë'], ['Career Coaching', 'Këshillim për Karrierë'], ['LinkedIn Branding', 'Ndërtim Profili në LinkedIn'], ['Skills Development', 'Zhvillim Aftësish'],
        ]],
    ['Real Estate', 'Patundshmëri', [
            ['Real Estate Agents', 'Agjentë të Patundshmërive'], ['Sales & Rentals', 'Shitje dhe Qiradhënie'], ['Property Management', 'Menaxhim Pronash'], ['Property Valuation', 'Vlerësim Pronash'], ['Real Estate Consulting', 'Këshillim për Patundshmëri'],
        ]],
    ['Architecture & Engineering', 'Arkitekturë dhe Inxhinieri', [
            ['Architecture', 'Arkitekturë'], ['Interior Design', 'Dizajn i Brendshëm'], ['Construction Engineering', 'Inxhinieri Ndërtimi'], ['3D Modeling', 'Modelim 3D'], ['Land Surveying', 'Matje Gjeodezike'],
        ]],
    ['Finance & Insurance', 'Financa dhe Sigurime', [
            ['Financial Consulting', 'Këshillim Financiar'], ['Personal Budgeting', 'Planifikim Buxheti Personal'], ['Insurance Consulting', 'Këshillim për Sigurime'], ['Loans & Financing', 'Kredi dhe Financim'], ['Business Financial Planning', 'Planifikim Financiar për Biznes'],
        ]],
    ['Beauty & Personal Care', 'Bukuri dhe Kujdes Personal', [
            ['Hairdressing', 'Parukeri'], ['Makeup & Bridal Beauty', 'Grim dhe Bukuri për Nuse'], ['Nails & Beauty Treatments', 'Thonj dhe Trajtime Bukurie'], ['Skincare', 'Kujdes për Lëkurën'], ['Personal Styling', 'Stilim Personal'],
        ]],
    ['Fitness & Wellness', 'Fitnes dhe Mirëqenie', [
            ['Personal Training', 'Trajnim Personal'], ['Yoga & Pilates', 'Joga dhe Pilates'], ['Sports Coaching', 'Trajnim Sportiv'], ['Nutrition & Wellness', 'Ushqyerje dhe Mirëqenie'], ['Dance & Martial Arts', 'Vallëzim dhe Arte Marciale'],
        ]],
    ['Events & Weddings', 'Ngjarje dhe Dasma', [
            ['Event Planning', 'Planifikim Ngjarjesh'], ['Photography & Videography', 'Fotografi dhe Videografi'], ['Catering & Cakes', 'Katering dhe Torta'], ['Decoration', 'Dekorim'], ['DJs & Entertainment', 'DJ dhe Argëtim'],
        ]],
    ['Family & Care', 'Familje dhe Përkujdesje', [
            ['Babysitting', 'Kujdes për Fëmijë'], ['Elder Care', 'Kujdes për të Moshuar'], ['Home Care', 'Përkujdesje në Shtëpi'], ['Pet Sitting', 'Kujdes për Kafshë Shtëpiake'], ['Pet Grooming & Training', 'Kujdes Estetik dhe Trajnim për Kafshë'],
        ]],
    ['Diaspora & Relocation', 'Diasporë dhe Zhvendosje', [
            ['Property Assistance', 'Ndihmë për Prona'], ['Document Assistance', 'Ndihmë me Dokumente'], ['Relocation', 'Shërbime Zhvendosjeje'], ['Business Setup', 'Hapje Biznesi'], ['Vehicle & Local Support', 'Ndihmë për Automjete dhe Çështje Lokale'],
        ]],
    ['Personal & Lifestyle', 'Shërbime Personale dhe Stil Jete', [
            ['Personal Assistance', 'Asistencë Personale'], ['Travel Planning', 'Planifikim Udhëtimesh'], ['Personal Shopping', 'Blerje Personale'], ['Home Organization', 'Organizim Shtëpie'], ['Tailoring', 'Rrobaqepësi'],
        ]],
    ['Other Services', 'Shërbime të Tjera', [
            ['General Consultation', 'Këshillim i Përgjithshëm'], ['Professional Services', 'Shërbime Profesionale'], ['Home Services', 'Shërbime për Shtëpi'], ['Personal Services', 'Shërbime Personale'], ['Business Services', 'Shërbime për Biznes'],
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
        category.set({ name: { sq, en }, labels: { sq, en }, slug, order: index + 1, isActive: true, status: 'active', source: 'seed' });
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
        if (slug === 'legal-services') {
            await Subcategory_1.Subcategory.deleteMany({
                categoryId: category._id,
                slug: { $nin: children.map(([childEn]) => slugify(childEn)) },
            });
        }
    }
}
if (require.main === module) {
    (0, db_1.connectDB)().then(seedCategories).then(() => {
        console.log('Seeded 20 categories and 100 subcategories');
    }).catch((err) => {
        console.error(err);
        process.exitCode = 1;
    }).finally(() => mongoose_1.default.disconnect());
}
//# sourceMappingURL=seedCategories.js.map