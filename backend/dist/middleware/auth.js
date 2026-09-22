"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = requireAuth;
exports.requireRole = requireRole;
const firebaseAuth_1 = require("../services/firebaseAuth");
const userService_1 = require("../services/userService");
async function requireAuth(req, res, next) {
    try {
        const header = req.headers.authorization;
        if (!header?.startsWith('Bearer ')) {
            return res.status(401).json({ message: 'Mungon tokeni i autentifikimit' });
        }
        const idToken = header.slice('Bearer '.length).trim();
        const firebaseUser = await (0, firebaseAuth_1.firebaseVerifyIdToken)(idToken);
        const dbUser = await (0, userService_1.findUserByUid)(firebaseUser.localId);
        const publicUser = (0, userService_1.toPublicUser)({
            uid: firebaseUser.localId,
            email: firebaseUser.email || dbUser?.email || '',
            name: dbUser?.name || firebaseUser.displayName || 'User',
            role: dbUser?.role ?? 'user',
            roles: dbUser?.roles,
            requestedRole: dbUser?.requestedRole,
            firstName: dbUser?.firstName,
            lastName: dbUser?.lastName,
            phone: dbUser?.phone,
            locale: dbUser?.locale,
            country: dbUser?.country,
            city: dbUser?.city,
            verification: dbUser?.verification,
            privacy: dbUser?.privacy,
            accountStatus: dbUser?.accountStatus,
            headline: dbUser?.headline,
            bio: dbUser?.bio,
            location: dbUser?.location,
            savedLocation: dbUser?.savedLocation,
            skills: dbUser?.skills,
            languages: dbUser?.languages,
            profilePhoto: dbUser?.profilePhoto,
            createdAt: dbUser?.createdAt,
        });
        if (publicUser.accountStatus !== 'active') {
            return res.status(403).json({ message: 'Llogaria nuk është aktive' });
        }
        req.user = {
            uid: publicUser.uid,
            email: publicUser.email,
            name: publicUser.name,
            firstName: publicUser.firstName,
            lastName: publicUser.lastName,
            phone: publicUser.phone,
            locale: publicUser.locale,
            country: publicUser.country,
            city: publicUser.city,
            verification: publicUser.verification,
            privacy: publicUser.privacy,
            role: publicUser.role,
            roles: publicUser.roles ?? ['user'],
            requestedRole: publicUser.requestedRole,
            accountStatus: publicUser.accountStatus ?? 'active',
            headline: publicUser.headline || '',
            bio: publicUser.bio || '',
            location: publicUser.location || '',
            savedLocation: publicUser.savedLocation,
            skills: publicUser.skills ?? [],
            languages: publicUser.languages ?? [],
            profilePhoto: publicUser.profilePhoto || '',
        };
        next();
    }
    catch (err) {
        return res.status(401).json({
            message: err instanceof Error ? err.message : 'Autentifikim i dështuar',
        });
    }
}
function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ message: 'Mungon autentifikimi' });
        }
        if (!roles.some((role) => req.user.roles.includes(role))) {
            return res.status(403).json({ message: 'Nuk ke leje për këtë veprim' });
        }
        next();
    };
}
//# sourceMappingURL=auth.js.map