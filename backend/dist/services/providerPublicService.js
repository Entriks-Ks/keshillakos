"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProvidersPublicDetails = getProvidersPublicDetails;
exports.getPublicProviderProfile = getPublicProviderProfile;
const roles_1 = require("../types/roles");
const ratingService_1 = require("./ratingService");
const userService_1 = require("./userService");
const PUBLIC_PROFILE_ROLES = ['provider', 'company', 'admin'];
async function getProvidersPublicDetails(providerUids, fallbackNames = new Map()) {
    const unique = [...new Set(providerUids.filter(Boolean))];
    const map = new Map();
    if (unique.length === 0)
        return map;
    const [users, stats] = await Promise.all([
        (0, userService_1.findUsersByUids)(unique),
        (0, ratingService_1.getStatsForProviders)(unique),
    ]);
    for (const uid of unique) {
        const user = users.get(uid);
        const rating = stats.get(uid);
        const role = user?.role ?? 'unknown';
        map.set(uid, {
            uid,
            name: user?.name || fallbackNames.get(uid) || 'Ofrues',
            email: user?.email || '',
            role,
            roleLabel: role === 'unknown' ? 'Ofrues' : roles_1.ROLE_LABELS[role],
            headline: user?.headline || '',
            bio: user?.bio || '',
            location: user?.location || '',
            skills: user?.skills ?? [],
            languages: user?.languages ?? [],
            profilePhoto: user?.profilePhoto || '',
            ratingAverage: rating?.average ?? 0,
            ratingCount: rating?.count ?? 0,
        });
    }
    return map;
}
/** Public profile page payload (no email). */
async function getPublicProviderProfile(uid) {
    if (!uid?.trim())
        return null;
    const user = await (0, userService_1.findUserByUid)(uid.trim());
    if (!user || !PUBLIC_PROFILE_ROLES.includes(user.role))
        return null;
    const details = await getProvidersPublicDetails([user.uid]);
    const provider = details.get(user.uid);
    if (!provider)
        return null;
    return {
        uid: provider.uid,
        name: provider.name,
        role: provider.role,
        roleLabel: provider.roleLabel,
        headline: provider.headline,
        bio: provider.bio,
        location: provider.location,
        skills: provider.skills,
        languages: provider.languages,
        profilePhoto: provider.profilePhoto,
        ratingAverage: provider.ratingAverage,
        ratingCount: provider.ratingCount,
    };
}
//# sourceMappingURL=providerPublicService.js.map