"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLivekitConfig = getLivekitConfig;
exports.generateLivekitToken = generateLivekitToken;
const livekit_server_sdk_1 = require("livekit-server-sdk");
const dotenv_1 = __importDefault(require("dotenv"));
function getLivekitConfig() {
    if (!process.env.LIVEKIT_URL ||
        !process.env.LIVEKIT_API_KEY ||
        process.env.LIVEKIT_API_KEY === 'devkey' ||
        process.env.LIVEKIT_URL === 'ws://127.0.0.1:7880') {
        dotenv_1.default.config({ override: true });
    }
    const url = process.env.LIVEKIT_URL || process.env.LIVEKIT_HOST || 'ws://127.0.0.1:7880';
    const apiKey = process.env.LIVEKIT_API_KEY || 'devkey';
    const apiSecret = process.env.LIVEKIT_API_SECRET || 'secret';
    return {
        url,
        apiKey,
        apiSecret,
        isConfigured: Boolean(url && apiKey && apiSecret),
    };
}
async function generateLivekitToken({ roomName, identity, name, ttl = '2h', }) {
    const { apiKey, apiSecret } = getLivekitConfig();
    if (!apiKey || !apiSecret) {
        throw new Error('Konfigurimi i LiveKit mungon (LIVEKIT_API_KEY / LIVEKIT_API_SECRET)');
    }
    const at = new livekit_server_sdk_1.AccessToken(apiKey, apiSecret, {
        identity,
        name: name || identity,
        ttl: typeof ttl === 'string' ? ttl : `${ttl}s`,
    });
    at.addGrant({
        room: roomName,
        roomJoin: true,
        canPublish: true,
        canSubscribe: true,
        canPublishData: true,
    });
    return at.toJwt();
}
//# sourceMappingURL=livekitService.js.map