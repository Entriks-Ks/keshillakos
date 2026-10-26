"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const aiChatService_1 = require("../services/aiChatService");
const aiTrustScoreService_1 = require("../services/aiTrustScoreService");
const firebaseAuth_1 = require("../services/firebaseAuth");
const router = (0, express_1.Router)();
router.post('/chat', async (req, res) => {
    try {
        const { messages, context } = req.body;
        if (!Array.isArray(messages) || messages.length === 0) {
            return res.status(400).json({ message: 'Mesazhet janë të detyrueshme' });
        }
        const validatedMessages = [];
        for (const msg of messages) {
            if (typeof msg === 'object' &&
                msg !== null &&
                'role' in msg &&
                'content' in msg &&
                (msg.role === 'user' || msg.role === 'assistant') &&
                typeof msg.content === 'string') {
                validatedMessages.push({
                    role: msg.role,
                    content: msg.content.slice(0, 2000).trim(),
                });
            }
        }
        if (validatedMessages.length === 0) {
            return res.status(400).json({ message: 'Të paktën një mesazh i vlefshëm kërkohet' });
        }
        const result = await (0, aiChatService_1.chatWithAssistant)(validatedMessages, context);
        return res.json(result);
    }
    catch (err) {
        console.error('Error in /api/ai/chat:', err);
        return res.status(500).json({
            message: err instanceof Error ? err.message : 'Ndodhi një gabim gjatë procesimit të bisedës',
        });
    }
});
router.get('/suggestions', (_req, res) => {
    return res.json({
        topics: [
            {
                id: 'business',
                label: 'Regjistrim Biznesi',
                prompt: 'Si të regjistroj një biznes në Kosovë (Sh.p.k.) dhe çfarë dokumentesh më duhen?',
                icon: 'briefcase',
            },
            {
                id: 'lawyer',
                label: 'Gjej Avokat',
                prompt: 'Më duhet një avokat i licencuar në Prishtinë për çështje kontratash pune.',
                icon: 'scale',
            },
            {
                id: 'taxes',
                label: 'Taksa & ATK',
                prompt: 'Cilat janë normat e TVSH-së dhe tatimit në korporata në Kosovë?',
                icon: 'calculator',
            },
            {
                id: 'platform',
                label: 'Planet e KeshillaKos',
                prompt: 'Çfarë përfitimesh ofron Plani Pro për ekspertët në KeshillaKos?',
                icon: 'sparkles',
            },
        ],
    });
});
router.get('/trust-score/:uid', async (req, res) => {
    try {
        const { uid } = req.params;
        if (!uid?.trim()) {
            return res.status(400).json({ message: 'UID i ofruesit kërkohet' });
        }
        const trustScore = await (0, aiTrustScoreService_1.calculateProviderTrustScore)(uid);
        if (!trustScore) {
            return res.status(404).json({ message: 'Ofruesi nuk u gjet' });
        }
        return res.json(trustScore);
    }
    catch (err) {
        console.error('Error in /api/ai/trust-score:', err);
        return res.status(500).json({
            message: err instanceof Error ? err.message : 'Dështoi llogaritja e vlerësimit të sigurisë',
        });
    }
});
router.get(['/trust-recommendations', '/trust-recommendations/:uid'], async (req, res) => {
    try {
        let targetUid = req.params.uid?.trim();
        if (!targetUid) {
            const authHeader = req.headers.authorization;
            if (authHeader?.startsWith('Bearer ')) {
                const token = authHeader.slice(7).trim();
                const decoded = await (0, firebaseAuth_1.firebaseVerifyIdToken)(token).catch(() => null);
                if (decoded?.localId) {
                    targetUid = decoded.localId;
                }
            }
        }
        if (!targetUid) {
            return res.status(400).json({ message: 'UID i ofruesit kërkohet' });
        }
        const forceRefresh = req.query.refresh === 'true';
        const recs = await (0, aiTrustScoreService_1.generateProviderTrustRecommendations)(targetUid, { forceRefresh });
        if (!recs) {
            return res.status(404).json({ message: 'Ofruesi nuk u gjet' });
        }
        return res.json(recs);
    }
    catch (err) {
        console.error('Error in /api/ai/trust-recommendations:', err);
        return res.status(500).json({
            message: err instanceof Error ? err.message : 'Dështoi gjenerimi i rekomandimeve të sigurisë',
        });
    }
});
exports.default = router;
//# sourceMappingURL=aiChat.routes.js.map