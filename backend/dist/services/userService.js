"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.effectiveRoles = effectiveRoles;
exports.toPublicUser = toPublicUser;
exports.upsertUser = upsertUser;
exports.grantCapability = grantCapability;
exports.setActiveContext = setActiveContext;
exports.requestRoleChange = requestRoleChange;
exports.listPendingRoleRequests = listPendingRoleRequests;
exports.reviewRoleRequest = reviewRoleRequest;
exports.findUserByUid = findUserByUid;
exports.findUsersByUids = findUsersByUids;
exports.listUsers = listUsers;
exports.updateOwnProfile = updateOwnProfile;
exports.updateProfilePhoto = updateProfilePhoto;
exports.updateUserByUid = updateUserByUid;
exports.deleteUserByUid = deleteUserByUid;
exports.countUsersByRole = countUsersByRole;
const User_1 = require("../models/User");
const ProviderProfile_1 = require("../models/ProviderProfile");
const City_1 = require("../models/City");
const Country_1 = require("../models/Country");
const mongoose_1 = require("mongoose");
const socialLinks_1 = require("../models/socialLinks");
const roles_1 = require("../types/roles");
const mediaService_1 = require("./mediaService");
function effectiveRoles(user) {
    const granted = user.roles?.filter(roles_1.isUserRole);
    if (granted)
        return [...new Set(['user', ...granted])];
    // Existing admin accounts were not available through public registration.
    return user.role === 'admin' ? ['user', 'admin'] : ['user'];
}
function cleanOptional(value) {
    return value?.trim() || undefined;
}
function splitName(name) {
    const parts = name.trim().split(/\s+/);
    return { firstName: parts.shift() || undefined, lastName: parts.join(' ') || undefined };
}
function toPublicUser(user) {
    const roles = effectiveRoles({ role: user.role ?? 'user', roles: user.roles });
    const requestedContext = user.activeContext;
    const activeContext = requestedContext && (requestedContext === 'user' || roles.includes(requestedContext))
        ? requestedContext
        : 'user';
    return {
        uid: user.uid,
        email: user.email,
        name: user.name,
        role: activeContext === 'user' ? (roles.includes('admin') ? 'admin' : 'user') : activeContext,
        roles,
        activeContext,
        requestedRole: user.requestedRole,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        locale: user.locale,
        country: user.country,
        city: user.city,
        verification: user.verification,
        privacy: user.privacy,
        accountStatus: user.accountStatus ?? 'active',
        headline: user.headline || '',
        bio: user.bio || '',
        location: typeof user.location === 'string' ? user.location : user.legacyLocation || '',
        savedLocation: user.savedLocation ?? (user.location && typeof user.location !== 'string'
            ? { countryId: String(user.location.countryId), cityId: String(user.location.cityId) }
            : undefined),
        skills: user.skills ?? [],
        languages: user.languages ?? [],
        profilePhoto: user.profilePhoto || '',
        socialLinks: user.socialLinks || {},
        createdAt: user.createdAt ?? new Date(),
        updatedAt: user.updatedAt ?? user.createdAt ?? new Date(),
    };
}
async function upsertUser(input) {
    const email = input.email.trim().toLowerCase();
    const name = input.name.trim() || input.email.split('@')[0] || 'User';
    const $set = { email };
    if (input.updateName)
        Object.assign($set, {
            name,
            firstName: input.firstName ?? splitName(name).firstName,
            lastName: input.lastName ?? splitName(name).lastName,
        });
    // MongoDB forbids the same path in both $set and $setOnInsert
    const $setOnInsert = {
        uid: input.uid,
        role: input.grantedRoles?.find((role) => role !== 'user') ?? 'user',
        roles: input.grantedRoles ?? ['user'],
        requestedRole: input.requestedRole,
    };
    if (!input.updateName)
        Object.assign($setOnInsert, { name, ...splitName(name) });
    const user = await User_1.User.findOneAndUpdate({ uid: input.uid }, { $set, $setOnInsert }, { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true });
    return toPublicUser(user);
}
async function grantCapability(uid, role) {
    const existing = await User_1.User.findOne({ uid, accountStatus: 'active' });
    if (!existing)
        throw new Error('Llogaria nuk u gjet ose nuk është aktive');
    existing.roles = [...new Set(['user', ...(existing.roles?.filter(roles_1.isUserRole) ?? []), role])];
    if (existing.role !== 'admin')
        existing.role = role;
    existing.activeContext = role;
    existing.requestedRole = undefined;
    await existing.save();
    return toPublicUser(existing);
}
async function setActiveContext(uid, context) {
    const existing = await User_1.User.findOne({ uid, accountStatus: 'active' });
    if (!existing)
        throw new Error('Llogaria nuk u gjet ose nuk është aktive');
    const roles = effectiveRoles(existing);
    if (context !== 'user' && !roles.includes(context)) {
        throw new Error('Nuk ke këtë kontekst ende. Krijo profilin përkatës.');
    }
    existing.activeContext = context;
    if (existing.role !== 'admin') {
        existing.role = context === 'user' ? 'user' : context;
    }
    await existing.save();
    return toPublicUser(existing);
}
async function requestRoleChange(uid, role) {
    const existing = await User_1.User.findOne({ uid });
    if (!existing)
        throw new Error('Përdoruesi nuk u gjet');
    if (existing.accountStatus && existing.accountStatus !== 'active') {
        throw new Error('Llogaria nuk është aktive');
    }
    const roles = effectiveRoles(existing);
    if (roles.includes(role))
        throw new Error('Ke tashmë këtë rol');
    if (existing.requestedRole && existing.requestedRole !== role && !roles.includes(existing.requestedRole)) {
        throw new Error('Ke tashmë një kërkesë roli në pritje');
    }
    existing.requestedRole = role;
    await existing.save();
    return toPublicUser(existing);
}
async function listPendingRoleRequests() {
    const users = await User_1.User.find({ requestedRole: { $in: ['provider', 'company'] } }).sort({ updatedAt: -1 }).lean();
    return users.map(toPublicUser).filter((user) => user.requestedRole && !(user.roles ?? []).includes(user.requestedRole));
}
async function reviewRoleRequest(uid, action) {
    const existing = await User_1.User.findOne({ uid });
    if (!existing)
        throw new Error('Përdoruesi nuk u gjet');
    const requested = existing.requestedRole;
    if (requested !== 'provider' && requested !== 'company') {
        throw new Error('Nuk ka kërkesë në pritje');
    }
    if (action === 'reject') {
        existing.requestedRole = undefined;
        await existing.save();
        return toPublicUser(existing);
    }
    return grantCapability(uid, requested);
}
async function findUserByUid(uid) {
    const user = await User_1.User.findOne({ uid }).lean();
    if (!user)
        return null;
    return toPublicUser(user);
}
async function findUsersByUids(uids) {
    const unique = [...new Set(uids.filter(Boolean))];
    if (unique.length === 0)
        return new Map();
    const users = await User_1.User.find({ uid: { $in: unique } }).lean();
    const map = new Map();
    for (const user of users) {
        map.set(user.uid, toPublicUser(user));
    }
    return map;
}
async function listUsers(filters) {
    const query = {};
    if (filters?.role && (0, roles_1.isUserRole)(filters.role)) {
        query.$or = filters.role === 'user'
            ? [{ roles: 'user' }, { roles: { $exists: false } }]
            : filters.role === 'admin'
                ? [{ roles: 'admin' }, { role: 'admin', roles: { $exists: false } }]
                : [{ roles: filters.role }];
    }
    if (filters?.q?.trim()) {
        const q = filters.q.trim();
        query.$and = [{ $or: [
                    { name: { $regex: q, $options: 'i' } },
                    { email: { $regex: q, $options: 'i' } },
                    { uid: { $regex: q, $options: 'i' } },
                ] }];
    }
    const users = await User_1.User.find(query).sort({ createdAt: -1 }).lean();
    return users.map((u) => toPublicUser(u));
}
function cleanStringList(values, maxItems = 20, itemMax = 48) {
    if (!values)
        return undefined;
    return [...new Set(values.map((value) => value.trim()).filter(Boolean).map((value) => value.slice(0, itemMax)))].slice(0, maxItems);
}
async function updateOwnProfile(uid, input) {
    const existing = await User_1.User.findOne({ uid });
    if (!existing)
        throw new Error('Përdoruesi nuk u gjet');
    if (input.firstName !== undefined) {
        const firstName = input.firstName.trim();
        if (!firstName || firstName.length > 80)
            throw new Error('Emri duhet të jetë 1–80 karaktere');
        existing.firstName = firstName;
    }
    if (input.lastName !== undefined) {
        const lastName = input.lastName.trim();
        if (!lastName || lastName.length > 80)
            throw new Error('Mbiemri duhet të jetë 1–80 karaktere');
        existing.lastName = lastName;
    }
    if (input.firstName !== undefined || input.lastName !== undefined) {
        // Retain the legacy display name for existing consumers; the profile API uses separate fields.
        existing.name = [existing.firstName, existing.lastName].filter(Boolean).join(' ');
    }
    if (input.phone !== undefined) {
        const phone = cleanOptional(input.phone ?? undefined);
        if (phone && !/^\+[1-9]\d{1,14}$/.test(phone)) {
            throw new Error('Numri i telefonit duhet të jetë në formatin ndërkombëtar (+383…)');
        }
        existing.phone = phone;
    }
    if (input.locale !== undefined)
        existing.locale = cleanOptional(input.locale);
    if (input.country !== undefined)
        existing.country = cleanOptional(input.country)?.toUpperCase();
    if (input.city !== undefined)
        existing.city = cleanOptional(input.city);
    if (input.profileVisibility !== undefined) {
        existing.set('privacy.profileVisibility', input.profileVisibility);
    }
    if (input.marketingConsent !== undefined) {
        existing.set('privacy.marketingConsent', input.marketingConsent);
    }
    if (input.savedLocation !== undefined) {
        if (existing.legacyLocation)
            existing.markModified('legacyLocation');
        if (input.savedLocation === null) {
            existing.location = undefined;
        }
        else {
            const { countryId, cityId } = input.savedLocation;
            if (!mongoose_1.Types.ObjectId.isValid(countryId) || !mongoose_1.Types.ObjectId.isValid(cityId))
                throw new Error('Lokacioni është i pavlefshëm');
            const [country, city] = await Promise.all([
                Country_1.Country.exists({ _id: countryId, isActive: true }),
                City_1.City.exists({ _id: cityId, countryId, isActive: true }),
            ]);
            if (!country || !city)
                throw new Error('Qyteti dhe shteti nuk përputhen ose nuk janë aktivë');
            existing.location = { countryId: new mongoose_1.Types.ObjectId(countryId), cityId: new mongoose_1.Types.ObjectId(cityId) };
        }
    }
    if (input.headline !== undefined) {
        const headline = input.headline.trim();
        if (headline.length > 160)
            throw new Error('Titulli duhet të jetë deri në 160 karaktere');
        existing.headline = headline || undefined;
    }
    if (input.bio !== undefined) {
        const bio = input.bio.trim();
        if (bio.length > 3000)
            throw new Error('Përshkrimi duhet të jetë deri në 3000 karaktere');
        existing.bio = bio || undefined;
    }
    if (input.skills !== undefined)
        existing.skills = cleanStringList(input.skills);
    if (input.languages !== undefined)
        existing.languages = cleanStringList(input.languages, 12, 40);
    if (input.legacyLocation !== undefined)
        existing.legacyLocation = cleanOptional(input.legacyLocation);
    if (input.socialLinks !== undefined) {
        const normalized = (0, socialLinks_1.normalizeSocialLinks)(input.socialLinks);
        existing.socialLinks = (0, socialLinks_1.applySocialLinks)(existing.socialLinks, normalized || {});
    }
    await existing.save();
    const publicFields = {};
    if (input.firstName !== undefined || input.lastName !== undefined) {
        publicFields['publicProfile.displayName'] = existing.name;
    }
    if (input.headline !== undefined)
        publicFields['publicProfile.title'] = existing.headline || '';
    if (input.bio !== undefined) {
        publicFields['publicProfile.description'] = existing.bio || '';
        publicFields['publicProfile.shortDescription'] = (existing.bio || '').slice(0, 300);
    }
    if (input.languages !== undefined)
        publicFields.languages = existing.languages || [];
    if (Object.keys(publicFields).length) {
        await ProviderProfile_1.ProviderProfile.updateMany({ ownerUser: existing._id, providerType: 'individual' }, { $set: publicFields });
    }
    return toPublicUser(existing);
}
async function updateProfilePhoto(uid, profilePhoto) {
    const existing = await User_1.User.findOne({ uid });
    if (!existing)
        throw new Error('Përdoruesi nuk u gjet');
    const nextPhoto = (0, mediaService_1.normalizeUploadPath)(profilePhoto);
    if (!nextPhoto)
        throw new Error('Rruga e fotos nuk është e vlefshme');
    const previous = existing.profilePhoto;
    existing.profilePhoto = nextPhoto;
    await existing.save();
    await ProviderProfile_1.ProviderProfile.updateMany({ ownerUser: existing._id }, { $set: { 'publicProfile.photoUrl': nextPhoto } });
    if (previous && previous !== nextPhoto) {
        await (0, mediaService_1.deleteUpload)(previous);
    }
    return toPublicUser(existing);
}
async function updateUserByUid(uid, input) {
    const existing = await User_1.User.findOne({ uid });
    if (!existing)
        throw new Error('Përdoruesi nuk u gjet');
    if (input.role !== undefined && !(0, roles_1.isUserRole)(input.role)) {
        throw new Error('Roli nuk është i vlefshëm');
    }
    if (input.roles && input.roles.some((role) => !(0, roles_1.isUserRole)(role))) {
        throw new Error('Rolet nuk janë të vlefshme');
    }
    if (input.email?.trim()) {
        const email = input.email.trim().toLowerCase();
        const clash = await User_1.User.findOne({ email, uid: { $ne: uid } });
        if (clash)
            throw new Error('Ky email është i përdorur nga një llogari tjetër');
        existing.email = email;
    }
    if (input.name?.trim()) {
        existing.name = input.name.trim();
        Object.assign(existing, splitName(existing.name));
    }
    if (input.role && !input.roles) {
        existing.role = input.role;
        existing.roles = input.role === 'user' ? ['user'] : ['user', input.role];
        if (existing.requestedRole && (input.role === existing.requestedRole || input.role === 'user')) {
            existing.requestedRole = undefined;
        }
    }
    if (input.roles) {
        existing.roles = [...new Set(['user', ...input.roles])];
        existing.role = existing.roles.find((role) => role !== 'user') ?? 'user';
    }
    if (input.accountStatus !== undefined)
        existing.accountStatus = input.accountStatus;
    await existing.save();
    return toPublicUser(existing);
}
async function deleteUserByUid(uid) {
    const result = await User_1.User.deleteOne({ uid });
    if (result.deletedCount === 0)
        throw new Error('Përdoruesi nuk u gjet');
    return { deleted: true, uid };
}
async function countUsersByRole() {
    const rows = await User_1.User.aggregate([
        { $project: { countedRoles: { $ifNull: ['$roles', { $cond: [{ $eq: ['$role', 'admin'] }, ['user', 'admin'], ['user']] }] } } },
        { $unwind: '$countedRoles' },
        { $group: { _id: '$countedRoles', count: { $sum: 1 } } },
    ]);
    const counts = {
        user: 0,
        provider: 0,
        company: 0,
        admin: 0,
    };
    for (const row of rows) {
        if ((0, roles_1.isUserRole)(row._id))
            counts[row._id] = row.count;
    }
    return counts;
}
//# sourceMappingURL=userService.js.map