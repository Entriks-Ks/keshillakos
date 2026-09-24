"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const cors_1 = __importDefault(require("cors"));
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const mongoose_1 = __importDefault(require("mongoose"));
const db_1 = require("./config/db");
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const adminUsers_routes_1 = __importDefault(require("./routes/adminUsers.routes"));
const availability_routes_1 = __importDefault(require("./routes/availability.routes"));
const domain_routes_1 = __importDefault(require("./routes/domain.routes"));
const catalog_routes_1 = __importDefault(require("./routes/catalog.routes"));
const expert_routes_1 = __importDefault(require("./routes/expert.routes"));
const business_routes_1 = __importDefault(require("./routes/business.routes"));
const providerProfile_routes_1 = __importDefault(require("./routes/providerProfile.routes"));
const match_routes_1 = __importDefault(require("./routes/match.routes"));
const rating_routes_1 = __importDefault(require("./routes/rating.routes"));
const request_routes_1 = __importDefault(require("./routes/request.routes"));
const provider_routes_1 = __importDefault(require("./routes/provider.routes"));
const appointment_routes_1 = __importDefault(require("./routes/appointment.routes"));
const onboarding_routes_1 = __importDefault(require("./routes/onboarding.routes"));
const service_routes_1 = __importDefault(require("./routes/service.routes"));
const serviceOffer_routes_1 = __importDefault(require("./routes/serviceOffer.routes"));
const chat_routes_1 = __importDefault(require("./routes/chat.routes"));
const feedback_routes_1 = __importDefault(require("./routes/feedback.routes"));
const chatSocket_1 = require("./services/chatSocket");
const mediaService_1 = require("./services/mediaService");
const app = (0, express_1.default)();
const PORT = Number(process.env.PORT) || 4000;
app.use((0, cors_1.default)({ origin: true, credentials: true }));
app.use(express_1.default.json());
app.use('/uploads', express_1.default.static(mediaService_1.UPLOADS_ROOT));
app.get('/api/health', (_req, res) => {
    res.json({
        ok: true,
        mongo: (0, db_1.isMongoReady)() ? 'connected' : 'disconnected',
        db: mongoose_1.default.connection.name || null,
    });
});
app.use('/api/auth', auth_routes_1.default);
app.use('/api/onboarding', onboarding_routes_1.default);
app.use('/api/admin/users', adminUsers_routes_1.default);
app.use('/api/availability', availability_routes_1.default);
app.use('/api/domains', domain_routes_1.default);
app.use('/api/v1', catalog_routes_1.default);
app.use('/api/services', service_routes_1.default);
app.use('/api/service-offers', serviceOffer_routes_1.default);
app.use('/api/experts', expert_routes_1.default);
app.use('/api/businesses', business_routes_1.default);
app.use('/api/providers', providerProfile_routes_1.default);
app.use('/api/providers', provider_routes_1.default);
app.use('/api/match', match_routes_1.default);
app.use('/api/ratings', rating_routes_1.default);
app.use('/api/requests', request_routes_1.default);
app.use('/api/appointments', appointment_routes_1.default);
app.use('/api/chat', chat_routes_1.default);
app.use('/api/feedback', feedback_routes_1.default);
app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ message: err.message || 'Server error' });
});
async function start() {
    try {
        await (0, db_1.connectDB)();
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error('MongoDB connection failed:', message);
        if (message.includes('IP') || message.includes('whitelist')) {
            console.error('Hap MongoDB Atlas → Network Access → Add IP Address → Allow Access from Anywhere (0.0.0.0/0) ose shto IP-në tënde.');
        }
        process.exit(1);
    }
    const server = http_1.default.createServer(app);
    (0, chatSocket_1.attachChatSocket)(server);
    server.listen(PORT, () => {
        console.log(`API running on http://localhost:${PORT}`);
    });
}
start().catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
});
//# sourceMappingURL=index.js.map