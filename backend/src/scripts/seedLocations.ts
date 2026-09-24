import 'dotenv/config'
import mongoose from 'mongoose'
import { connectDB } from '../config/db'
import { City } from '../models/City'
import { Country } from '../models/Country'

type PlaceName = readonly [sq: string, en: string]
type SeedCountry = { slug: string; name: PlaceName; cities: readonly PlaceName[] }

// A deliberately small initial city catalog; not a complete list of settlements.
export const locations: readonly SeedCountry[] = [
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
]

export function citySlug(en: string) {
  return en.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export async function seedLocations() {
  for (const [countryIndex, item] of locations.entries()) {
    const country = await Country.findOneAndUpdate({ slug: item.slug }, {
      $set: {
        name: { sq: item.name[0], en: item.name[1] },
        order: countryIndex + 1,
        isActive: true,
      },
      $setOnInsert: { slug: item.slug },
    }, { upsert: true, new: true, runValidators: true })
    if (!country) throw new Error(`Could not seed country ${item.slug}`)

    for (const [cityIndex, [sq, en]] of item.cities.entries()) {
      const slug = citySlug(en)
      await City.updateOne({ countryId: country._id, slug }, {
        $set: { name: { sq, en }, order: cityIndex + 1, isActive: true },
        $setOnInsert: { countryId: country._id, slug },
      }, { upsert: true, runValidators: true })
    }
  }
}

if (require.main === module) {
  connectDB().then(seedLocations).then(() => {
    console.log(`Seeded ${locations.length} countries and ${locations.reduce((count, item) => count + item.cities.length, 0)} cities`)
  }).catch((err) => {
    console.error(err)
    process.exitCode = 1
  }).finally(() => mongoose.disconnect())
}
