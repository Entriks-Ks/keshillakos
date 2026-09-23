"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.userIdForUid = userIdForUid;
exports.canManageBusiness = canManageBusiness;
exports.toPublicBusiness = toPublicBusiness;
exports.createBusiness = createBusiness;
exports.findOwnedOpenBusiness = findOwnedOpenBusiness;
exports.listMyBusinesses = listMyBusinesses;
exports.listManagedBusinesses = listManagedBusinesses;
exports.businessTeam = businessTeam;
exports.inviteBusinessExpert = inviteBusinessExpert;
exports.listMyBusinessInvitations = listMyBusinessInvitations;
exports.acceptBusinessInvitation = acceptBusinessInvitation;
exports.rejectBusinessInvitation = rejectBusinessInvitation;
exports.cancelBusinessInvitation = cancelBusinessInvitation;
exports.removeBusinessExpert = removeBusinessExpert;
exports.ownedBusinessById = ownedBusinessById;
exports.updateBusiness = updateBusiness;
exports.reviewBusiness = reviewBusiness;
const mongoose_1 = require("mongoose");
const Business_1 = require("../models/Business");
const City_1 = require("../models/City");
const Country_1 = require("../models/Country");
const User_1 = require("../models/User");
const ProviderProfile_1 = require("../models/ProviderProfile");
const socialLinks_1 = require("../models/socialLinks");
const domainService_1 = require("./domainService");
const mediaService_1 = require("./mediaService");
const userService_1 = require("./userService");
async function userIdForUid(uid) {
    const user = await User_1.User.findOne({ uid }).select('_id').lean();
    if (!user)
        throw new Error('Llogaria nuk u gjet');
    return user._id;
}
function canManageBusiness(business, userId) {
    return business.owners.some((owner) => owner.equals(userId)) ||
        business.members.some((member) => member.user.equals(userId) && member.role === 'manager');
}
function toPublicBusiness(business) {
    return {
        id: String(business._id),
        _id: String(business._id),
        publicName: business.publicName,
        legalName: business.legalName,
        logoUrl: business.logoUrl,
        description: business.description,
        website: business.website,
        contactEmail: business.contactEmail,
        contactPhone: business.contactPhone,
        categoryIds: business.categoryIds ?? [],
        location: business.location
            ? { countryId: String(business.location.countryId), cityId: String(business.location.cityId) }
            : undefined,
        socialLinks: business.socialLinks || {},
        branches: business.branches ?? [],
        verification: business.verification,
        status: business.status,
        createdAt: business.createdAt,
        updatedAt: business.updatedAt,
    };
}
function normalizeWebsite(value) {
    if (value === undefined)
        return undefined;
    if (value === null)
        return null;
    const website = value.trim();
    if (!website)
        return null;
    if (!/^https?:\/\/.+/i.test(website)) {
        throw new Error('Website duhet të fillojë me http:// ose https://');
    }
    let url;
    try {
        url = new URL(website);
    }
    catch {
        throw new Error('Website nuk është i vlefshëm');
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        throw new Error('Website duhet të fillojë me http:// ose https://');
    }
    return url.toString();
}
async function createBusiness(input) {
    const owner = await userIdForUid(input.ownerUid);
    const existing = await Business_1.Business.findOne({ owners: owner, status: { $ne: 'closed' } }).select('_id publicName status').lean();
    if (existing)
        throw new Error('Ke tashmë një kompani. Mund të krijosh vetëm një.');
    const publicName = input.publicName.trim();
    if (!publicName)
        throw new Error('Emri i kompanisë është i detyrueshëm');
    const contactEmail = input.contactEmail?.trim().toLowerCase();
    if (!contactEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
        throw new Error('Email i kontaktit është i detyrueshëm dhe duhet të jetë i vlefshëm');
    }
    const contactPhone = input.contactPhone?.trim();
    if (!contactPhone || !/^\+[1-9]\d{1,14}$/.test(contactPhone)) {
        throw new Error('Numri i telefonit duhet të jetë në formatin ndërkombëtar (+383…)');
    }
    const description = input.description?.trim();
    if (!description)
        throw new Error('Përshkrimi është i detyrueshëm');
    const categoryIds = [...new Set((input.categoryIds ?? []).map((id) => id.trim()).filter(Boolean))];
    if (!categoryIds.length || !(await Promise.all(categoryIds.map((id) => (0, domainService_1.findDomainById)(id)))).every(Boolean)) {
        throw new Error('Kategoria është e detyrueshme');
    }
    if (!input.location)
        throw new Error('Qyteti është i detyrueshëm');
    const { countryId, cityId } = input.location;
    if (!mongoose_1.Types.ObjectId.isValid(countryId) || !mongoose_1.Types.ObjectId.isValid(cityId))
        throw new Error('Lokacioni është i pavlefshëm');
    const [country, city] = await Promise.all([
        Country_1.Country.exists({ _id: countryId, isActive: true }),
        City_1.City.exists({ _id: cityId, countryId, isActive: true }),
    ]);
    if (!country || !city)
        throw new Error('Qyteti dhe shteti nuk përputhen ose nuk janë aktivë');
    const website = normalizeWebsite(input.website ?? null) || undefined;
    return Business_1.Business.create({
        publicName,
        legalName: input.legalName?.trim() || undefined,
        logoUrl: input.logoUrl?.trim() || undefined,
        description,
        website,
        contactEmail,
        contactPhone,
        categoryIds,
        location: { countryId: new mongoose_1.Types.ObjectId(countryId), cityId: new mongoose_1.Types.ObjectId(cityId) },
        owners: [owner],
        branches: input.branches ?? [],
        // Company exists immediately; verification stays separate from lifecycle status.
        status: 'active',
        verification: { status: 'unverified' },
    });
}
async function findOwnedOpenBusiness(uid) {
    const userId = await userIdForUid(uid);
    return Business_1.Business.findOne({ owners: userId, status: { $ne: 'closed' } }).sort({ createdAt: 1 });
}
async function listMyBusinesses(uid) {
    const userId = await userIdForUid(uid);
    return Business_1.Business.find({
        $or: [{ owners: userId }, { 'members.user': userId }],
        status: { $ne: 'closed' },
    }).sort({ createdAt: -1 });
}
async function listManagedBusinesses(uid) {
    const userId = await userIdForUid(uid);
    return Business_1.Business.find({ $or: [{ owners: userId }, { members: { $elemMatch: { user: userId, role: 'manager' } } }] }).sort({ createdAt: 1 });
}
async function businessTeam(uid, businessId) {
    const { business } = await ownedBusinessById(uid, businessId);
    const ids = [...business.owners, ...business.members.map((member) => member.user), ...business.invitations.map((invite) => invite.user)];
    const users = await User_1.User.find({ _id: { $in: ids } }).select('uid name firstName lastName email headline profilePhoto roles role').lean();
    const profiles = await ProviderProfile_1.ProviderProfile.find({
        ownerUser: { $in: ids },
        providerType: 'individual',
    }).select('ownerUser publicProfile categories languages status').lean();
    const byId = new Map(users.map((user) => [String(user._id), user]));
    const profileByOwner = new Map(profiles.map((profile) => [String(profile.ownerUser), profile]));
    const person = (id) => {
        const user = byId.get(String(id));
        const profile = profileByOwner.get(String(id));
        const userName = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim() || user?.name;
        return {
            id: String(id),
            uid: user?.uid || '',
            name: userName || profile?.publicProfile?.displayName || 'Ekspert',
            email: user?.email || '',
            headline: profile?.publicProfile?.title || user?.headline || '',
            photoUrl: profile?.publicProfile?.photoUrl || user?.profilePhoto || '',
            categories: profile?.categories ?? [],
            languages: profile?.languages ?? [],
            profileStatus: profile?.status || null,
        };
    };
    return {
        business: { id: String(business._id), publicName: business.publicName },
        owners: business.owners.map(person),
        members: business.members.map((member) => ({ ...person(member.user), role: member.role })),
        invitations: business.invitations.map((invite) => ({
            ...person(invite.user),
            invitedAt: invite.invitedAt,
            status: 'pending',
        })),
    };
}
async function inviteBusinessExpert(uid, businessId, email) {
    const { business, userId } = await ownedBusinessById(uid, businessId);
    if (business.status === 'suspended' || business.status === 'closed') {
        throw new Error('Kompania e pezulluar ose e mbyllur nuk mund të ftojë ekspertë');
    }
    const expert = await User_1.User.findOne({ email: email.trim().toLowerCase(), accountStatus: 'active' });
    if (!expert || !(0, userService_1.effectiveRoles)(expert).includes('provider'))
        throw new Error('Eksperti me këtë email nuk u gjet');
    const profile = await ProviderProfile_1.ProviderProfile.exists({ ownerUser: expert._id, providerType: 'individual' });
    if (!profile)
        throw new Error('Përdoruesi nuk ka profil eksperti');
    if (business.owners.some((owner) => owner.equals(expert._id)) || business.members.some((member) => member.user.equals(expert._id))) {
        throw new Error('Eksperti është tashmë pjesë e kompanisë');
    }
    if (business.invitations.some((invite) => invite.user.equals(expert._id))) {
        throw new Error('Ftesa ekziston tashmë');
    }
    // In-app invitation only for now. Hook future email/notification delivery here without changing membership rules.
    const updated = await Business_1.Business.findOneAndUpdate({
        _id: business._id,
        status: { $nin: ['suspended', 'closed'] },
        'invitations.user': { $ne: expert._id },
        'members.user': { $ne: expert._id },
    }, { $push: { invitations: { user: expert._id, invitedBy: userId, invitedAt: new Date() } } }, { new: true, runValidators: true });
    if (!updated)
        throw new Error('Ftesa nuk u dërgua');
    return businessTeam(uid, businessId);
}
async function listMyBusinessInvitations(uid) {
    const userId = await userIdForUid(uid);
    const businesses = await Business_1.Business.find({ 'invitations.user': userId, status: { $nin: ['suspended', 'closed'] } })
        .select('publicName invitations')
        .lean();
    return businesses.map((business) => {
        const invite = business.invitations.find((item) => String(item.user) === String(userId));
        return {
            id: String(business._id),
            publicName: business.publicName,
            invitedAt: invite?.invitedAt ?? null,
            status: 'pending',
        };
    });
}
async function acceptBusinessInvitation(uid, businessId) {
    if (!mongoose_1.Types.ObjectId.isValid(businessId))
        throw new Error('Business ID i pavlefshëm');
    const userId = await userIdForUid(uid);
    const user = await User_1.User.findById(userId);
    if (!user || !(0, userService_1.effectiveRoles)(user).includes('provider'))
        throw new Error('Vetëm ekspertët mund ta pranojnë ftesën');
    const business = await Business_1.Business.findOneAndUpdate({ _id: businessId, 'invitations.user': userId, status: { $nin: ['suspended', 'closed'] } }, { $pull: { invitations: { user: userId } }, $addToSet: { members: { user: userId, role: 'member' } } }, { new: true, runValidators: true });
    if (!business)
        throw new Error('Ftesa nuk u gjet');
    return { id: String(business._id), publicName: business.publicName };
}
async function rejectBusinessInvitation(uid, businessId) {
    if (!mongoose_1.Types.ObjectId.isValid(businessId))
        throw new Error('Business ID i pavlefshëm');
    const userId = await userIdForUid(uid);
    const user = await User_1.User.findById(userId);
    if (!user || !(0, userService_1.effectiveRoles)(user).includes('provider'))
        throw new Error('Vetëm ekspertët mund ta refuzojnë ftesën');
    const business = await Business_1.Business.findOneAndUpdate({ _id: businessId, 'invitations.user': userId, status: { $nin: ['suspended', 'closed'] } }, { $pull: { invitations: { user: userId } } }, { new: true, runValidators: true });
    if (!business)
        throw new Error('Ftesa nuk u gjet');
    return { id: String(business._id), publicName: business.publicName };
}
async function cancelBusinessInvitation(uid, businessId, inviteeUserId) {
    const { business } = await ownedBusinessById(uid, businessId);
    if (!mongoose_1.Types.ObjectId.isValid(inviteeUserId))
        throw new Error('User ID i pavlefshëm');
    const invite = business.invitations.find((item) => String(item.user) === inviteeUserId);
    if (!invite)
        throw new Error('Ftesa nuk u gjet');
    business.invitations = business.invitations.filter((item) => String(item.user) !== inviteeUserId);
    await business.save();
    return businessTeam(uid, businessId);
}
async function removeBusinessExpert(uid, businessId, memberId) {
    const { business } = await ownedBusinessById(uid, businessId);
    if (!mongoose_1.Types.ObjectId.isValid(memberId))
        throw new Error('User ID i pavlefshëm');
    const member = business.members.find((item) => String(item.user) === memberId);
    if (!member)
        throw new Error('Anëtari nuk u gjet');
    business.members = business.members.filter((item) => String(item.user) !== memberId);
    await business.save();
    return businessTeam(uid, businessId);
}
async function ownedBusinessById(uid, businessId) {
    if (!mongoose_1.Types.ObjectId.isValid(businessId))
        throw new Error('Business ID i pavlefshëm');
    const userId = await userIdForUid(uid);
    const business = await Business_1.Business.findById(businessId);
    if (!business || !canManageBusiness(business, userId) || ['suspended', 'closed'].includes(business.status)) {
        throw new Error('Nuk ke leje për këtë biznes');
    }
    return { business, userId };
}
async function updateBusiness(uid, businessId, changes) {
    const { business } = await ownedBusinessById(uid, businessId);
    if (changes.publicName !== undefined)
        business.publicName = changes.publicName.trim();
    if (changes.legalName !== undefined)
        business.legalName = changes.legalName?.trim() || undefined;
    if (changes.logoUrl !== undefined) {
        if (changes.logoUrl === null || !changes.logoUrl.trim()) {
            business.logoUrl = undefined;
        }
        else {
            const path = (0, mediaService_1.normalizeUploadPath)(changes.logoUrl);
            if (!path)
                throw new Error('Logoja nuk është e vlefshme');
            business.logoUrl = path;
        }
    }
    if (changes.description !== undefined)
        business.description = changes.description?.trim() || undefined;
    if (changes.website !== undefined) {
        const website = normalizeWebsite(changes.website);
        business.website = website || undefined;
    }
    if (changes.contactEmail !== undefined)
        business.contactEmail = changes.contactEmail?.trim().toLowerCase() || undefined;
    if (changes.contactPhone !== undefined) {
        const phone = changes.contactPhone?.trim() || undefined;
        if (phone && !/^\+[1-9]\d{1,14}$/.test(phone))
            throw new Error('Numri i telefonit duhet të jetë në formatin ndërkombëtar (+383…)');
        business.contactPhone = phone;
    }
    if (changes.categoryIds !== undefined) {
        const categoryIds = [...new Set(changes.categoryIds.map((id) => id.trim()).filter(Boolean))];
        if (categoryIds.length && !(await Promise.all(categoryIds.map((id) => (0, domainService_1.findDomainById)(id)))).every(Boolean)) {
            throw new Error('Kategoria nuk ekziston');
        }
        business.categoryIds = categoryIds;
    }
    if (changes.location !== undefined) {
        if (changes.location === null) {
            business.location = undefined;
        }
        else {
            const { countryId, cityId } = changes.location;
            if (!mongoose_1.Types.ObjectId.isValid(countryId) || !mongoose_1.Types.ObjectId.isValid(cityId))
                throw new Error('Lokacioni është i pavlefshëm');
            const [country, city] = await Promise.all([
                Country_1.Country.exists({ _id: countryId, isActive: true }),
                City_1.City.exists({ _id: cityId, countryId, isActive: true }),
            ]);
            if (!country || !city)
                throw new Error('Qyteti dhe shteti nuk përputhen ose nuk janë aktivë');
            business.location = { countryId: new mongoose_1.Types.ObjectId(countryId), cityId: new mongoose_1.Types.ObjectId(cityId) };
        }
    }
    if (changes.socialLinks !== undefined) {
        const normalized = (0, socialLinks_1.normalizeSocialLinks)(changes.socialLinks);
        business.socialLinks = (0, socialLinks_1.applySocialLinks)(business.socialLinks, normalized || {});
    }
    if (changes.branches !== undefined)
        business.branches = changes.branches;
    // Verification is separate from lifecycle status; edits do not demote an active company.
    if (business.verification.status === 'verified')
        business.verification.status = 'pending';
    await business.save();
    return business;
}
async function reviewBusiness(id, reviewerUid, status, verification) {
    if (!mongoose_1.Types.ObjectId.isValid(id))
        throw new Error('Business ID i pavlefshëm');
    const reviewer = await userIdForUid(reviewerUid);
    const business = await Business_1.Business.findById(id);
    if (!business)
        throw new Error('Biznesi nuk u gjet');
    // Admin can suspend/reactivate; verification badges are optional and independent.
    business.status = status;
    if (verification) {
        business.verification = { status: verification, reviewedAt: new Date(), reviewedBy: reviewer };
    }
    await business.save();
    return business;
}
//# sourceMappingURL=businessService.js.map