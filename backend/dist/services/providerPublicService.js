"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.publicProfileRole = publicProfileRole;
exports.getProvidersPublicDetails = getProvidersPublicDetails;
exports.getPublicProviderProfile = getPublicProviderProfile;
const Business_1 = require("../models/Business");
const ProviderProfile_1 = require("../models/ProviderProfile");
const User_1 = require("../models/User");
const roles_1 = require("../types/roles");
const ratingService_1 = require("./ratingService");
const userService_1 = require("./userService");
const PUBLIC_PROFILE_ROLES = ['provider', 'company', 'admin'];
/**
 * `role` follows the dashboard context the user last switched to, so an expert
 * browsing in client mode reports `user`. Public visibility must follow the
 * granted capabilities in `roles` instead.
 */
function publicProfileRole(user) {
    const granted = user.roles ?? [];
    if (user.role && granted.includes(user.role) && PUBLIC_PROFILE_ROLES.includes(user.role))
        return user.role;
    return PUBLIC_PROFILE_ROLES.find((role) => granted.includes(role)) ?? null;
}
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
            coverPhoto: '',
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
    const role = user ? publicProfileRole(user) : null;
    if (!user || !role)
        return null;
    const details = await getProvidersPublicDetails([user.uid]);
    const provider = details.get(user.uid);
    if (!provider)
        return null;
    const owner = await User_1.User.findOne({ uid: user.uid }).select('_id').lean();
    let coverPhoto = '';
    let profilePhoto = provider.profilePhoto;
    let name = provider.name;
    let bio = provider.bio;
    if (owner) {
        if (role === 'company') {
            const business = await Business_1.Business.findOne({ owners: owner._id }).select('publicName description coverUrl logoUrl').lean();
            coverPhoto = business?.coverUrl || '';
            profilePhoto = business?.logoUrl || profilePhoto;
            name = business?.publicName || name;
            bio = business?.description || bio;
        }
        else {
            const profile = await ProviderProfile_1.ProviderProfile.findOne({ ownerUser: owner._id, providerType: 'individual' }).select('publicProfile.coverUrl publicProfile.photoUrl').lean();
            coverPhoto = profile?.publicProfile?.coverUrl || '';
            profilePhoto = profilePhoto || profile?.publicProfile?.photoUrl || '';
        }
    }
    return {
        uid: provider.uid,
        name,
        role,
        roleLabel: roles_1.ROLE_LABELS[role],
        headline: provider.headline,
        bio,
        location: provider.location,
        skills: provider.skills,
        languages: provider.languages,
        profilePhoto,
        coverPhoto,
        ratingAverage: provider.ratingAverage,
        ratingCount: provider.ratingCount,
    };
}
//# sourceMappingURL=providerPublicService.js.map