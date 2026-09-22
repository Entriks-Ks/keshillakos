"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.locations = void 0;
exports.citySlug = citySlug;
exports.seedLocations = seedLocations;
require("dotenv/config");
const mongoose_1 = __importDefault(require("mongoose"));
const db_1 = require("../config/db");
const City_1 = require("../models/City");
const Country_1 = require("../models/Country");
// A deliberately small initial city catalog; not a complete list of settlements.
exports.locations = [
    { slug: 'kosovo', name: ['Kosovë', 'Kosovo'], cities: [
            ['Prishtinë', 'Pristina'], ['Prizren', 'Prizren'], ['Pejë', 'Peja'],
            ['Gjakovë', 'Gjakova'], ['Ferizaj', 'Ferizaj'], ['Gjilan', 'Gjilan'], ['Mitrovicë', 'Mitrovica'],
        ] },
    { slug: 'albania', name: ['Shqipëri', 'Albania'], cities: [
            ['Tiranë', 'Tirana'], ['Durrës', 'Durres'], ['Vlorë', 'Vlore'],
            ['Shkodër', 'Shkoder'], ['Elbasan', 'Elbasan'], ['Fier', 'Fier'], ['Korçë', 'Korce'],
        ] },
    { slug: 'north-macedonia', name: ['Maqedonia e Veriut', 'North Macedonia'], cities: [
            ['Shkup', 'Skopje'], ['Kumanovë', 'Kumanovo'], ['Manastir', 'Bitola'],
            ['Tetovë', 'Tetovo'], ['Prilep', 'Prilep'], ['Ohër', 'Ohrid'], ['Strugë', 'Struga'],
        ] },
    { slug: 'montenegro', name: ['Mali i Zi', 'Montenegro'], cities: [
            ['Podgoricë', 'Podgorica'], ['Nikshiq', 'Niksic'], ['Tivar', 'Bar'],
            ['Budvë', 'Budva'], ['Kotor', 'Kotor'], ['Bijelo Polje', 'Bijelo Polje'], ['Herceg Novi', 'Herceg Novi'],
        ] },
    { slug: 'bosnia-and-herzegovina', name: ['Bosnja dhe Hercegovina', 'Bosnia & Herzegovina'], cities: [
            ['Sarajevë', 'Sarajevo'], ['Banja Luka', 'Banja Luka'], ['Mostar', 'Mostar'],
            ['Tuzla', 'Tuzla'], ['Zenicë', 'Zenica'], ['Bihaq', 'Bihac'], ['Doboj', 'Doboj'],
        ] },
    { slug: 'croatia', name: ['Kroaci', 'Croatia'], cities: [
            ['Zagreb', 'Zagreb'], ['Split', 'Split'], ['Rijekë', 'Rijeka'],
            ['Osijek', 'Osijek'], ['Zadar', 'Zadar'], ['Dubrovnik', 'Dubrovnik'], ['Pula', 'Pula'],
        ] },
    { slug: 'slovenia', name: ['Slloveni', 'Slovenia'], cities: [
            ['Lubjanë', 'Ljubljana'], ['Maribor', 'Maribor'], ['Kranj', 'Kranj'],
            ['Celje', 'Celje'], ['Koper', 'Koper'], ['Novo Mesto', 'Novo Mesto'], ['Velenje', 'Velenje'],
        ] },
];
function citySlug(en) {
    return en.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
async function seedLocations() {
    for (const [countryIndex, item] of exports.locations.entries()) {
        const country = await Country_1.Country.findOneAndUpdate({ slug: item.slug }, {
            $set: {
                name: { sq: item.name[0], en: item.name[1] },
                order: countryIndex + 1,
                isActive: true,
            },
            $setOnInsert: { slug: item.slug },
        }, { upsert: true, new: true, runValidators: true });
        if (!country)
            throw new Error(`Could not seed country ${item.slug}`);
        for (const [cityIndex, [sq, en]] of item.cities.entries()) {
            const slug = citySlug(en);
            await City_1.City.updateOne({ countryId: country._id, slug }, {
                $set: { name: { sq, en }, order: cityIndex + 1, isActive: true },
                $setOnInsert: { countryId: country._id, slug },
            }, { upsert: true, runValidators: true });
        }
    }
}
if (require.main === module) {
    (0, db_1.connectDB)().then(seedLocations).then(() => {
        console.log(`Seeded ${exports.locations.length} countries and ${exports.locations.reduce((count, item) => count + item.cities.length, 0)} cities`);
    }).catch((err) => {
        console.error(err);
        process.exitCode = 1;
    }).finally(() => mongoose_1.default.disconnect());
}
//# sourceMappingURL=seedLocations.js.map