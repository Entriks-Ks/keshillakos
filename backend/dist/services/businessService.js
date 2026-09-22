"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.userIdForUid = userIdForUid;
exports.canManageBusiness = canManageBusiness;
exports.createBusiness = createBusiness;
exports.listMyBusinesses = listMyBusinesses;
exports.listManagedBusinesses = listManagedBusinesses;
exports.businessTeam = businessTeam;
exports.inviteBusinessExpert = inviteBusinessExpert;
exports.listMyBusinessInvitations = listMyBusinessInvitations;
exports.acceptBusinessInvitation = acceptBusinessInvitation;
exports.removeBusinessExpert = removeBusinessExpert;
exports.ownedBusinessById = ownedBusinessById;
exports.updateBusiness = updateBusiness;
exports.reviewBusiness = reviewBusiness;
const mongoose_1 = require("mongoose");
const Business_1 = require("../models/Business");
const User_1 = require("../models/User");
const ProviderProfile_1 = require("../models/ProviderProfile");
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
async function createBusiness(input) {
    const owner = await userIdForUid(input.ownerUid);
    return Business_1.Business.create({
        publicName: input.publicName,
        legalName: input.legalName?.trim() || undefined,
        logoUrl: input.logoUrl?.trim() || undefined,
        owners: [owner],
        branches: input.branches ?? [],
        status: 'draft',
    });
}
async function listMyBusinesses(uid) {
    const userId = await userIdForUid(uid);
    return Business_1.Business.find({ $or: [{ owners: userId }, { 'members.user': userId }] }).sort({ createdAt: -1 });
}
async function listManagedBusinesses(uid) {
    const userId = await userIdForUid(uid);
    return Business_1.Business.find({ $or: [{ owners: userId }, { members: { $elemMatch: { user: userId, role: 'manager' } } }] }).sort({ createdAt: 1 });
}
async function businessTeam(uid, businessId) {
    const { business } = await ownedBusinessById(uid, businessId);
    const ids = [...business.owners, ...business.members.map((member) => member.user), ...business.invitations.map((invite) => invite.user)];
    const users = await User_1.User.find({ _id: { $in: ids } }).select('name email roles role').lean();
    const byId = new Map(users.map((user) => [String(user._id), user]));
    const person = (id) => {
        const user = byId.get(String(id));
        return { id: String(id), name: user?.name || 'Ekspert', email: user?.email || '' };
    };
    return {
        business: { id: String(business._id), publicName: business.publicName },
        owners: business.owners.map(person),
        members: business.members.map((member) => ({ ...person(member.user), role: member.role })),
        invitations: business.invitations.map((invite) => ({ ...person(invite.user), invitedAt: invite.invitedAt })),
    };
}
async function inviteBusinessExpert(uid, businessId, email) {
    const { business, userId } = await ownedBusinessById(uid, businessId);
    const expert = await User_1.User.findOne({ email: email.trim().toLowerCase(), accountStatus: 'active' });
    if (!expert || !(0, userService_1.effectiveRoles)(expert).includes('provider'))
        throw new Error('Eksperti me këtë email nuk u gjet');
    const profile = await ProviderProfile_1.ProviderProfile.exists({ ownerUser: expert._id, providerType: 'individual' });
    if (!profile)
        throw new Error('Përdoruesi nuk ka profil eksperti');
    if (business.owners.some((owner) => owner.equals(expert._id)) || business.members.some((member) => member.user.equals(expert._id))) {
        throw new Error('Eksperti është tashmë pjesë e kompanisë');
    }
    const updated = await Business_1.Business.findOneAndUpdate({ _id: business._id, 'invitations.user': { $ne: expert._id }, 'members.user': { $ne: expert._id } }, { $push: { invitations: { user: expert._id, invitedBy: userId, invitedAt: new Date() } } }, { new: true, runValidators: true });
    if (!updated)
        throw new Error('Ftesa ekziston tashmë');
    return businessTeam(uid, businessId);
}
async function listMyBusinessInvitations(uid) {
    const userId = await userIdForUid(uid);
    const businesses = await Business_1.Business.find({ 'invitations.user': userId, status: { $nin: ['suspended', 'closed'] } }).select('publicName invitations').lean();
    return businesses.map((business) => ({ id: String(business._id), publicName: business.publicName }));
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
    if (changes.logoUrl !== undefined)
        business.logoUrl = changes.logoUrl?.trim() || undefined;
    if (changes.branches !== undefined)
        business.branches = changes.branches;
    // Verification is an admin decision; an edited business must be reviewed again.
    if (business.verification.status === 'verified')
        business.verification.status = 'pending';
    business.status = 'draft';
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
    business.status = status;
    if (verification) {
        business.verification = { status: verification, reviewedAt: new Date(), reviewedBy: reviewer };
    }
    await business.save();
    return business;
}
//# sourceMappingURL=businessService.js.map