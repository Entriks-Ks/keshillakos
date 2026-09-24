"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isCanonicalReviewSubmission = isCanonicalReviewSubmission;
exports.interactionQualifies = interactionQualifies;
exports.createReview = createReview;
exports.refreshRatingAggregate = refreshRatingAggregate;
exports.moderateReview = moderateReview;
exports.respondToReview = respondToReview;
exports.getProviderStats = getProviderStats;
exports.getStatsForProviders = getStatsForProviders;
exports.listProviderRatings = listProviderRatings;
exports.findMyRating = findMyRating;
exports.eligibleInteractions = eligibleInteractions;
exports.listModerationQueue = listModerationQueue;
exports.listRateableProviders = listRateableProviders;
const mongoose_1 = require("mongoose");
const Appointment_1 = require("../models/Appointment");
const Business_1 = require("../models/Business");
const ProviderProfile_1 = require("../models/ProviderProfile");
const RatingAggregate_1 = require("../models/RatingAggregate");
const RequestDelivery_1 = require("../models/RequestDelivery");
const Review_1 = require("../models/Review");
const ServiceOffer_1 = require("../models/ServiceOffer");
const User_1 = require("../models/User");
const UserRequest_1 = require("../models/UserRequest");
const businessService_1 = require("./businessService");
const domainService_1 = require("./domainService");
const providerProfileService_1 = require("./providerProfileService");
const policyService_1 = require("./policyService");
function isCanonicalReviewSubmission(body) {
    return Boolean(body.interactionId && mongoose_1.Types.ObjectId.isValid(body.interactionId)) &&
        (body.interactionKind === 'appointment' || body.interactionKind === 'request_delivery') &&
        Boolean(body.providerId) !== Boolean(body.businessId) &&
        mongoose_1.Types.ObjectId.isValid(body.providerId || body.businessId || '');
}
function interactionQualifies(status, reviewerId, ownerId) {
    return status === 'completed' && reviewerId === ownerId;
}
async function reviewInteraction(reviewer, subjectType, subjectId, kind, id) {
    if (!mongoose_1.Types.ObjectId.isValid(id))
        throw new Error('Interaction ID i pavlefshëm');
    if (kind === 'appointment') {
        const appointment = await Appointment_1.Appointment.findById(id);
        if (!appointment || !interactionQualifies(appointment.status, String(reviewer._id), String(appointment.user)))
            throw new Error('Kërkohet rezervim i përfunduar');
        const profile = await ProviderProfile_1.ProviderProfile.findById(appointment.providerProfile);
        if (!profile)
            throw new Error('Ofruesi nuk u gjet');
        if (subjectType === 'provider' && !appointment.providerProfile.equals(subjectId) || subjectType === 'business' && !appointment.business?.equals(subjectId))
            throw new Error('Subjekti nuk përputhet me rezervimin');
        const request = appointment.userRequest ? await UserRequest_1.UserRequest.findById(appointment.userRequest) : null;
        return { kind, ref: appointment._id, verified: true, userRequest: request?._id, category: request?.category, appointment: appointment._id, profile, portal: request?.portal || domainService_1.DEFAULT_PORTAL };
    }
    const delivery = await RequestDelivery_1.RequestDelivery.findById(id);
    if (!delivery || delivery.status !== 'completed')
        throw new Error('Kërkohet kërkesë e përfunduar');
    const [request, profile, linkedAppointment] = await Promise.all([
        UserRequest_1.UserRequest.findById(delivery.request), ProviderProfile_1.ProviderProfile.findById(delivery.providerProfile),
        Appointment_1.Appointment.findOne({ requestDelivery: delivery._id }),
    ]);
    if (!request || !profile || !interactionQualifies(delivery.status, String(reviewer._id), String(request.user)))
        throw new Error('Kërkesa nuk të përket');
    if (linkedAppointment)
        throw new Error('Përdor rezervimin e përfunduar për vlerësim');
    if (subjectType === 'provider' && !delivery.providerProfile.equals(subjectId))
        throw new Error('Subjekti nuk përputhet me kërkesën');
    if (subjectType === 'business') {
        const offer = delivery.serviceOffer ? await ServiceOffer_1.ServiceOffer.findById(delivery.serviceOffer).select('business').lean() : null;
        if (!offer?.business?.equals(subjectId))
            throw new Error('Biznesi nuk lidhet me këtë ndërveprim');
    }
    return { kind, ref: delivery._id, verified: false, userRequest: request._id, category: request.category, appointment: undefined, profile, portal: request.portal };
}
async function assertNotSelfReview(reviewerId, profile, businessId) {
    if (!profile || profile.ownerUser.equals(reviewerId))
        throw new Error('Nuk mund ta vlerësosh veten');
    if (businessId) {
        const business = await Business_1.Business.findById(businessId);
        if (!business || business.owners.some((id) => id.equals(reviewerId)) || business.members.some((member) => member.user.equals(reviewerId)))
            throw new Error('Nuk mund ta vlerësosh biznesin tënd');
    }
}
async function createReview(input) {
    if (Boolean(input.providerId) === Boolean(input.businessId))
        throw new Error('Zgjidh ProviderProfile ose Business');
    const subjectType = input.providerId ? 'provider' : 'business';
    const rawId = input.providerId || input.businessId;
    if (!mongoose_1.Types.ObjectId.isValid(rawId))
        throw new Error('Subject ID i pavlefshëm');
    const subjectId = new mongoose_1.Types.ObjectId(rawId);
    const reviewer = await User_1.User.findOne({ uid: input.reviewerUid }).select('_id').lean();
    if (!reviewer)
        throw new Error('Përdoruesi nuk u gjet');
    const interaction = await reviewInteraction(reviewer, subjectType, subjectId, input.interactionKind, input.interactionId);
    await assertNotSelfReview(reviewer._id, interaction.profile, subjectType === 'business' ? subjectId : undefined);
    const policySnapshot = await (0, policyService_1.resolvePolicySnapshot)(interaction.portal, interaction.category);
    const policy = policySnapshot.rules;
    if (interaction.kind === 'appointment' && !policy.reviewEligibility.completedAppointment || interaction.kind === 'request_delivery' && !policy.reviewEligibility.completedDelivery)
        throw new Error('Politika nuk lejon vlerësim për këtë ndërveprim');
    if (!Number.isInteger(input.stars) || input.stars < 1 || input.stars > 5)
        throw new Error('Vlerësimi duhet të jetë nga 1 deri në 5');
    const autoPublish = !policy.moderation.reviewRequiresApproval;
    const review = await Review_1.Review.create({
        reviewer: reviewer._id, subjectType, subjectId,
        providerProfile: subjectType === 'provider' ? subjectId : undefined,
        business: subjectType === 'business' ? subjectId : undefined,
        portal: interaction.portal, source: 'web',
        policy: policySnapshot.policyId, policyVersion: policySnapshot.version,
        interaction: { kind: interaction.kind, ref: interaction.ref, eligible: true, verified: interaction.verified },
        userRequest: interaction.userRequest, appointment: interaction.appointment,
        stars: input.stars, dimensions: input.dimensions ?? {}, text: input.text?.trim(), language: input.language,
        moderation: { status: autoPublish ? 'published' : 'pending' }, abuse: { status: 'clear' },
        publishedAt: autoPublish ? new Date() : undefined,
    });
    if (autoPublish)
        await refreshRatingAggregate(review.portal, review.subjectType, review.subjectId);
    return review;
}
let pendingPublicationBackfill = null;
/** Publish leftover pending reviews created under the unmoderated fallback policy. */
function backfillUnmoderatedPendingReviews() {
    if (!pendingPublicationBackfill) {
        pendingPublicationBackfill = (async () => {
            if (policyService_1.DEFAULT_POLICY_RULES.moderation.reviewRequiresApproval)
                return;
            const pending = await Review_1.Review.find({
                'moderation.status': 'pending',
                'abuse.status': 'clear',
                $or: [{ policy: { $exists: false } }, { policy: null }],
            }).limit(200);
            const subjects = new Map();
            for (const review of pending) {
                review.moderation.status = 'published';
                review.publishedAt = review.publishedAt || new Date();
                await review.save();
                subjects.set(`${review.portal}:${review.subjectType}:${String(review.subjectId)}`, review);
            }
            await Promise.all([...subjects.values()].map((review) => refreshRatingAggregate(review.portal, review.subjectType, review.subjectId)));
        })().catch((err) => {
            pendingPublicationBackfill = null;
            throw err;
        });
    }
    return pendingPublicationBackfill;
}
function dimensionEntries(dimensions) {
    return dimensions instanceof Map ? [...dimensions.entries()] : Object.entries(dimensions || {});
}
async function refreshRatingAggregate(portal, scope, subjectId) {
    const reviews = await Review_1.Review.find({ portal, subjectType: scope, subjectId, 'moderation.status': 'published', 'abuse.status': 'clear', 'interaction.eligible': true, publishedAt: { $exists: true } });
    const eligible = reviews.filter(Review_1.reviewIsAggregateEligible);
    const count = eligible.length;
    const average = count ? Math.round(eligible.reduce((sum, review) => sum + review.stars, 0) / count * 10) / 10 : 0;
    const verifiedCount = eligible.filter((review) => review.interaction.verified).length;
    const dimensions = new Map();
    const values = new Map();
    for (const review of eligible)
        for (const [key, value] of dimensionEntries(review.dimensions))
            values.set(key, [...(values.get(key) ?? []), value]);
    for (const [key, scores] of values)
        dimensions.set(key, { average: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length * 10) / 10, count: scores.length });
    return RatingAggregate_1.RatingAggregate.findOneAndUpdate({ portal, scope, subjectId }, {
        $set: { average, count, verifiedCount, dimensions, calculatedAt: new Date() },
    }, { upsert: true, new: true, setDefaultsOnInsert: true });
}
async function moderateReview(id, moderatorUid, decision, abuseStatus = 'clear', reason) {
    if (!mongoose_1.Types.ObjectId.isValid(id))
        throw new Error('Review ID i pavlefshëm');
    const [review, moderator] = await Promise.all([Review_1.Review.findById(id), User_1.User.findOne({ uid: moderatorUid }).select('_id').lean()]);
    if (!review || !moderator)
        throw new Error('Vlerësimi nuk u gjet');
    if (decision === 'published' && abuseStatus !== 'clear')
        throw new Error('Vlerësimet e shënuara për abuzim nuk mund të publikohen');
    review.moderation = { status: decision, reviewedAt: new Date(), reviewedBy: moderator._id, reason: reason?.trim() };
    review.abuse = { status: abuseStatus, reason: abuseStatus === 'clear' ? undefined : reason?.trim() };
    review.publishedAt = decision === 'published' && abuseStatus === 'clear' ? new Date() : undefined;
    await review.save();
    await refreshRatingAggregate(review.portal, review.subjectType, review.subjectId);
    return review;
}
async function respondToReview(uid, id, text) {
    if (!mongoose_1.Types.ObjectId.isValid(id))
        throw new Error('Review ID i pavlefshëm');
    const [review, responder] = await Promise.all([Review_1.Review.findById(id), User_1.User.findOne({ uid }).select('_id').lean()]);
    if (!review || !responder || review.moderation.status !== 'published')
        throw new Error('Vlerësimi nuk u gjet');
    if (review.subjectType === 'provider') {
        const profiles = await (0, providerProfileService_1.listMyProviderProfiles)(uid);
        if (!profiles.some((profile) => profile._id.equals(review.subjectId)))
            throw new Error('Nuk ke leje për këtë vlerësim');
    }
    else {
        const business = await Business_1.Business.findById(review.subjectId);
        if (!business || !(0, businessService_1.canManageBusiness)(business, responder._id))
            throw new Error('Nuk ke leje për këtë vlerësim');
    }
    review.response = { text: text.trim(), respondedBy: responder._id, respondedAt: new Date() };
    await review.save();
    return review;
}
async function profilesForUid(uid) {
    try {
        return await (0, providerProfileService_1.listMyProviderProfiles)(uid);
    }
    catch {
        return [];
    }
}
async function businessesForUid(uid) {
    try {
        return await (0, businessService_1.listManagedBusinesses)(uid);
    }
    catch {
        return [];
    }
}
function combinedAverage(aggregates) {
    const count = aggregates.reduce((sum, item) => sum + item.count, 0);
    return count
        ? Math.round(aggregates.reduce((sum, item) => sum + item.average * item.count, 0) / count * 10) / 10
        : 0;
}
async function getProviderStats(providerUid) {
    await backfillUnmoderatedPendingReviews();
    const [profiles, businesses] = await Promise.all([profilesForUid(providerUid), businessesForUid(providerUid)]);
    const aggregates = await RatingAggregate_1.RatingAggregate.find({
        portal: domainService_1.DEFAULT_PORTAL,
        $or: [
            { scope: 'provider', subjectId: { $in: profiles.map((profile) => profile._id) } },
            { scope: 'business', subjectId: { $in: businesses.map((business) => business._id) } },
        ],
    });
    const count = aggregates.reduce((sum, item) => sum + item.count, 0);
    return {
        providerUid,
        count,
        verifiedCount: aggregates.reduce((sum, item) => sum + item.verifiedCount, 0),
        average: combinedAverage(aggregates),
    };
}
async function getStatsForProviders(providerUids) {
    const unique = [...new Set(providerUids.filter(Boolean))];
    const pairs = await Promise.all(unique.map(async (uid) => [uid, await getProviderStats(uid)]));
    return new Map(pairs);
}
async function toLegacyRating(review, providerUid, providerName) {
    const request = review.userRequest ? await UserRequest_1.UserRequest.findById(review.userRequest).select('category').lean() : null;
    const policy = await (0, policyService_1.resolvePolicyRules)(review.portal, request?.category);
    const reviewer = policy.privacy.reviewerDisplay === 'first_name' ? await User_1.User.findById(review.reviewer).select('firstName').lean() : null;
    return { id: String(review._id), providerUid, providerName, raterUid: '', raterName: reviewer?.firstName || 'Përdorues', score: review.stars, comment: review.text, verified: review.interaction.verified, response: review.response?.text, createdAt: review.createdAt, updatedAt: review.updatedAt };
}
async function listProviderRatings(providerUid, limit = 20) {
    await backfillUnmoderatedPendingReviews();
    const [profiles, businesses] = await Promise.all([profilesForUid(providerUid), businessesForUid(providerUid)]);
    const names = new Map([
        ...profiles.map((profile) => [String(profile._id), profile.publicProfile.displayName]),
        ...businesses.map((business) => [String(business._id), business.publicName]),
    ]);
    const reviews = await Review_1.Review.find({
        portal: domainService_1.DEFAULT_PORTAL,
        $or: [
            { subjectType: 'provider', subjectId: { $in: profiles.map((profile) => profile._id) } },
            { subjectType: 'business', subjectId: { $in: businesses.map((business) => business._id) } },
        ],
        'moderation.status': 'published',
        'abuse.status': 'clear',
        'interaction.eligible': true,
        publishedAt: { $exists: true },
    }).sort({ publishedAt: -1 }).limit(limit);
    return Promise.all(reviews.map((review) => toLegacyRating(review, providerUid, names.get(String(review.subjectId)) || (review.subjectType === 'business' ? 'Kompani' : 'Ofrues'))));
}
async function findMyRating(raterUid, providerUid) {
    const [reviewer, profiles] = await Promise.all([User_1.User.findOne({ uid: raterUid }).select('_id').lean(), profilesForUid(providerUid)]);
    if (!reviewer)
        return null;
    const review = await Review_1.Review.findOne({ reviewer: reviewer._id, subjectType: 'provider', subjectId: { $in: profiles.map((profile) => profile._id) } }).sort({ createdAt: -1 });
    return review ? toLegacyRating(review, providerUid, profiles.find((profile) => profile._id.equals(review.subjectId))?.publicProfile.displayName || 'Ofrues') : null;
}
async function eligibleInteractions(uid, providerId) {
    const user = await User_1.User.findOne({ uid }).select('_id').lean();
    if (!user)
        return [];
    const appointments = await Appointment_1.Appointment.find({ user: user._id, status: 'completed', ...(providerId ? { providerProfile: providerId } : {}) }).sort({ endAt: -1 }).limit(100);
    const requests = await UserRequest_1.UserRequest.find({ user: user._id }).select('_id').lean();
    const deliveries = await RequestDelivery_1.RequestDelivery.find({ request: { $in: requests.map((request) => request._id) }, status: 'completed', ...(providerId ? { providerProfile: providerId } : {}) }).sort({ respondedAt: -1 }).limit(100);
    const linkedAppointments = await Appointment_1.Appointment.find({ requestDelivery: { $in: deliveries.map((delivery) => delivery._id) } }).select('requestDelivery').lean();
    const appointmentDeliveryIds = new Set(linkedAppointments.map((appointment) => String(appointment.requestDelivery)));
    const choices = [
        ...appointments.map((appointment) => ({ kind: 'appointment', id: String(appointment._id), providerId: String(appointment.providerProfile) })),
        ...deliveries.filter((delivery) => !appointmentDeliveryIds.has(String(delivery._id))).map((delivery) => ({ kind: 'request_delivery', id: String(delivery._id), providerId: String(delivery.providerProfile) })),
    ];
    const profiles = await ProviderProfile_1.ProviderProfile.find({ _id: { $in: choices.map((choice) => choice.providerId) } }).select('ownerUser').lean();
    const ownProfileIds = new Set(profiles.filter((profile) => profile.ownerUser.equals(user._id)).map((profile) => String(profile._id)));
    const reviewed = await Review_1.Review.find({ reviewer: user._id, 'interaction.ref': { $in: choices.map((choice) => new mongoose_1.Types.ObjectId(choice.id)) } }).select('interaction.ref').lean();
    const seen = new Set(reviewed.map((review) => String(review.interaction.ref)));
    return choices.filter((choice) => !seen.has(choice.id) && !ownProfileIds.has(choice.providerId));
}
async function toAdminReview(review) {
    const [reviewer, profile, business] = await Promise.all([
        User_1.User.findById(review.reviewer).select('firstName lastName').lean(),
        review.subjectType === 'provider'
            ? ProviderProfile_1.ProviderProfile.findById(review.subjectId).select('publicProfile.displayName').lean()
            : null,
        review.subjectType === 'business' ? Business_1.Business.findById(review.subjectId).select('publicName').lean() : null,
    ]);
    return {
        id: String(review._id),
        stars: review.stars,
        text: review.text,
        status: review.moderation.status,
        subjectName: profile?.publicProfile.displayName || business?.publicName || (review.subjectType === 'business' ? 'Kompani' : 'Ofrues'),
        reviewerName: [reviewer?.firstName, reviewer?.lastName].filter(Boolean).join(' ') || 'Përdorues',
        createdAt: review.createdAt,
    };
}
async function listModerationQueue() {
    await backfillUnmoderatedPendingReviews();
    const [pending, published] = await Promise.all([
        Review_1.Review.find({ 'moderation.status': 'pending' }).sort({ createdAt: 1 }).limit(100),
        Review_1.Review.find({ 'moderation.status': 'published' }).sort({ publishedAt: -1 }).limit(40),
    ]);
    return {
        pending: await Promise.all(pending.map((review) => toAdminReview(review))),
        published: await Promise.all(published.map((review) => toAdminReview(review))),
    };
}
async function listRateableProviders(uid) {
    const interactions = await eligibleInteractions(uid);
    const profileIds = [...new Set(interactions.map((item) => item.providerId))];
    const profiles = await ProviderProfile_1.ProviderProfile.find({ _id: { $in: profileIds } }).select('publicProfile.displayName ownerUser');
    const users = await User_1.User.find({ _id: { $in: profiles.map((profile) => profile.ownerUser) } }).select('uid').lean();
    const uidByUser = new Map(users.map((user) => [String(user._id), user.uid]));
    const aggregateByProfile = new Map((await RatingAggregate_1.RatingAggregate.find({ portal: domainService_1.DEFAULT_PORTAL, scope: 'provider', subjectId: { $in: profileIds } })).map((item) => [String(item.subjectId), item]));
    return profiles.map((profile) => {
        const aggregate = aggregateByProfile.get(String(profile._id));
        return { providerId: String(profile._id), providerUid: uidByUser.get(String(profile.ownerUser)) || '', providerName: profile.publicProfile.displayName, titles: [], average: aggregate?.average ?? 0, count: aggregate?.count ?? 0, verifiedCount: aggregate?.verifiedCount ?? 0, interaction: interactions.find((item) => item.providerId === String(profile._id)) };
    });
}
//# sourceMappingURL=ratingService.js.map