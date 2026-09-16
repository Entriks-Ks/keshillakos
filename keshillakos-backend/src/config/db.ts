import mongoose from 'mongoose'

export async function connectDB() {
  const uri = process.env.MONGODB_URI

  if (!uri) {
    throw new Error('MONGODB_URI is missing in .env')
  }

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 15000,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    throw new Error(
      `Nuk u lidh me MongoDB. Kontrollo MONGODB_URI dhe Network Access në Atlas. Detaje: ${message}`,
    )
  }

  console.log(`MongoDB connected: ${mongoose.connection.name}`)
}

export function isMongoReady() {
  return mongoose.connection.readyState === 1
}
