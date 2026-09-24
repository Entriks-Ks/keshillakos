"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedCatalogOptions = seedCatalogOptions;
require("dotenv/config");
const mongoose_1 = __importDefault(require("mongoose"));
const db_1 = require("../config/db");
const serviceOptions_1 = require("../data/serviceOptions");
const catalogOptionService_1 = require("../services/catalogOptionService");
async function seedCatalogOptions() {
    await (0, catalogOptionService_1.ensureCatalogOptions)();
}
if (require.main === module) {
    (0, db_1.connectDB)().then(seedCatalogOptions).then(() => {
        console.log(`Seeded ${serviceOptions_1.SERVICE_OPTIONS_SEED.length} catalog options`);
    }).catch((err) => {
        console.error(err);
        process.exitCode = 1;
    }).finally(() => mongoose_1.default.disconnect());
}
//# sourceMappingURL=seedCatalogOptions.js.map