"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.locationSchema = void 0;
const mongoose_1 = require("mongoose");
exports.locationSchema = new mongoose_1.Schema({
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
}, { _id: false });
//# sourceMappingURL=location.js.map