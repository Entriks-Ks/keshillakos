"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const firebaseAuth_1 = require("../services/firebaseAuth");
const userService_1 = require("../services/userService");
const roles_1 = require("../types/roles");
const router = (0, express_1.Router)();
router.use(auth_1.requireAuth, (0, auth_1.requireRole)('admin'));
router.get('/meta', async (_req, res) => {
    try {
        const counts = await (0, userService_1.countUsersByRole)();
        return res.json({
            roles: roles_1.ROLES.map((id) => ({ id, label: roles_1.ROLE_LABELS[id] })),
            counts,
        });
    }
    catch (err) {
        return res.status(500).json({
            message: err instanceof Error ? err.message : 'Nuk u ngarkuan statistikat',
        });
    }
});
router.get('/', async (req, res) => {
    try {
        const role = typeof req.query.role === 'string' ? req.query.role : undefined;
        const q = typeof req.query.q === 'string' ? req.query.q : undefined;
        if (role && !(0, roles_1.isUserRole)(role)) {
            return res.status(400).json({ message: 'Roli i filtrit nuk është i vlefshëm' });
        }
        const users = await (0, userService_1.listUsers)({
            role: role && (0, roles_1.isUserRole)(role) ? role : undefined,
            q,
        });
        return res.json({ users });
    }
    catch (err) {
        return res.status(500).json({
            message: err instanceof Error ? err.message : 'Nuk u ngarkuan përdoruesit',
        });
    }
});
router.get('/role-requests', async (_req, res) => {
    try {
        const users = await (0, userService_1.listPendingRoleRequests)();
        return res.json({ users });
    }
    catch (err) {
        return res.status(500).json({
            message: err instanceof Error ? err.message : 'Nuk u ngarkuan kërkesat',
        });
    }
});
router.post('/:uid/role-request', async (req, res) => {
    try {
        const action = req.body?.action;
        if (action !== 'accept' && action !== 'reject') {
            return res.status(400).json({ message: 'Zgjidh pranim ose refuzim' });
        }
        const user = await (0, userService_1.reviewRoleRequest)(String(req.params.uid), action);
        return res.json({ user });
    }
    catch (err) {
        return res.status(400).json({
            message: err instanceof Error ? err.message : 'Shqyrtimi dështoi',
        });
    }
});
router.post('/', async (req, res) => {
    try {
        const { name, email, password, role } = req.body;
        if (!name?.trim() || !email?.trim() || !password) {
            return res.status(400).json({
                message: 'Emri, email dhe fjalëkalimi janë të detyrueshme',
            });
        }
        if (password.length < 6) {
            return res.status(400).json({ message: 'Fjalëkalimi duhet të ketë të paktën 6 karaktere' });
        }
        if (!(0, roles_1.isUserRole)(role)) {
            return res.status(400).json({ message: 'Zgjidh një rol të vlefshëm' });
        }
        const auth = await (0, firebaseAuth_1.firebaseSignUp)(email.trim(), password, name.trim());
        // Force role on create (including admin)
        await (0, userService_1.upsertUser)({
            uid: auth.localId,
            email: auth.email,
            name: name.trim(),
            grantedRoles: role === 'user' ? ['user'] : ['user', role],
        });
        const saved = await (0, userService_1.updateUserByUid)(auth.localId, {
            name: name.trim(),
            email: auth.email,
            role,
        });
        return res.status(201).json({ user: saved });
    }
    catch (err) {
        return res.status(400).json({
            message: err instanceof Error ? err.message : 'Krijimi i përdoruesit dështoi',
        });
    }
});
router.patch('/:uid', async (req, res) => {
    try {
        const { name, email, role, roles, accountStatus } = req.body;
        if (role !== undefined && !(0, roles_1.isUserRole)(role)) {
            return res.status(400).json({ message: 'Roli nuk është i vlefshëm' });
        }
        if (roles !== undefined && (!Array.isArray(roles) || roles.some((value) => !(0, roles_1.isUserRole)(value)))) {
            return res.status(400).json({ message: 'Rolet nuk janë të vlefshme' });
        }
        if (accountStatus !== undefined && !['active', 'suspended', 'closed'].includes(accountStatus)) {
            return res.status(400).json({ message: 'Statusi nuk është i vlefshëm' });
        }
        if (req.params.uid === req.user.uid && ((role && role !== 'admin') || (roles && !roles.includes('admin')) || (accountStatus && accountStatus !== 'active'))) {
            return res.status(400).json({
                message: 'Nuk mund ta heqësh rolin admin nga llogaria jote',
            });
        }
        const user = await (0, userService_1.updateUserByUid)(req.params.uid, {
            name,
            email,
            role: role && (0, roles_1.isUserRole)(role) ? role : undefined,
            roles: roles,
            accountStatus,
        });
        return res.json({ user });
    }
    catch (err) {
        return res.status(400).json({
            message: err instanceof Error ? err.message : 'Përditësimi dështoi',
        });
    }
});
router.delete('/:uid', async (req, res) => {
    try {
        if (req.params.uid === req.user.uid) {
            return res.status(400).json({ message: 'Nuk mund ta fshish llogarinë tënde' });
        }
        await (0, userService_1.deleteUserByUid)(req.params.uid);
        return res.json({ ok: true });
    }
    catch (err) {
        return res.status(400).json({
            message: err instanceof Error ? err.message : 'Fshirja dështoi',
        });
    }
});
exports.default = router;
//# sourceMappingURL=adminUsers.routes.js.map