import { Schema } from 'mongoose'

export type Location = {
  countryCode: string
  regionId?: string
  cityId?: string
  cityName?: string
  address?: string
  approximateCoordinates?: { latitude: number; longitude: number }
  online: boolean
}

export const locationSchema = new Schema<Location>(
  {
    countryCode: { type: String, required: true, trim: true, uppercase: true, match: /^[A-Z]{2}$/ },
    regionId: { type: String, trim: true },
    cityId: { type: String, trim: true },
    cityName: { type: String, trim: true, maxlength: 120 },
    address: { type: String, trim: true, maxlength: 240 },
    approximateCoordinates: {
      latitude: { type: Number, min: -90, max: 90 },
      longitude: { type: Number, min: -180, max: 180 },
    },
    online: { type: Boolean, default: false },
  },
  { _id: false },
)
