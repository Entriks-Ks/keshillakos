"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectDB = connectDB;
exports.isMongoReady = isMongoReady;
const mongoose_1 = __importDefault(require("mongoose"));
async function connectDB() {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
        throw new Error('MONGODB_URI is missing in .env');
    }
    try {
        await mongoose_1.default.connect(uri, {
            serverSelectionTimeoutMS: 15000,
        });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        throw new Error(`Nuk u lidh me MongoDB. Kontrollo MONGODB_URI dhe Network Access në Atlas. Detaje: ${message}`);
    }
    console.log(`MongoDB connected: ${mongoose_1.default.connection.name}`);
}
function isMongoReady() {
    return mongoose_1.default.connection.readyState === 1;
}
//# sourceMappingURL=db.js.map