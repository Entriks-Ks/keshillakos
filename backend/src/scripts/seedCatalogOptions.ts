import 'dotenv/config'
import mongoose from 'mongoose'
import { connectDB } from '../config/db'
import { SERVICE_OPTIONS_SEED } from '../data/serviceOptions'
import { ensureCatalogOptions } from '../services/catalogOptionService'

export async function seedCatalogOptions() {
  await ensureCatalogOptions()
}

if (require.main === module) {
  connectDB().then(seedCatalogOptions).then(() => {
    console.log(`Seeded ${SERVICE_OPTIONS_SEED.length} catalog options`)
  }).catch((err) => {
    console.error(err)
    process.exitCode = 1
  }).finally(() => mongoose.disconnect())
}
