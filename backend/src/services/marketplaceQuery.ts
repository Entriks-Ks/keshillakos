import { Types, type PipelineStage } from 'mongoose'
import { Business } from '../models/Business'
import { Category } from '../models/Category'
import { City } from '../models/City'
import { ProviderProfile } from '../models/ProviderProfile'
import { RatingAggregate } from '../models/RatingAggregate'
import { Service } from '../models/Service'
import { ServiceOffer } from '../models/ServiceOffer'
import { User } from '../models/User'
import { marketplaceFilters, marketplaceSort } from './marketplaceFilters'

const publishedProfile = { status: 'published', 'moderation.status': 'approved' }
const publishedOffer = { status: 'published', visibility: 'public', 'moderation.status': 'approved' }
const first = (field: string, fallback: unknown = '') => ({ $ifNull: [{ $arrayElemAt: [field, 0] }, fallback] })
const text = (fields: unknown[]) => ({ $reduce: { input: fields.map((field) => ({ $ifNull: [field, ''] })), initialValue: '', in: { $concat: ['$$value', ' ', '$$this'] } } })
const words = (field: string) => ({ $reduce: { input: { $ifNull: [field, []] }, initialValue: '', in: { $concat: ['$$value', ' ', '$$this'] } } })
const escaped = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Match the existing account-wide rating, including profiles the owner manages. */
function ratingStages(owner: string): PipelineStage[] {
  return [
    { $lookup: { from: Business.collection.name, let: { owner }, pipeline: [
      { $match: { $expr: { $or: [
        { $in: ['$$owner', '$owners'] },
        { $anyElementTrue: { $map: { input: '$members', as: 'member', in: { $and: [{ $eq: ['$$member.user', '$$owner'] }, { $eq: ['$$member.role', 'manager'] }] } } } },
      ] } } }, { $project: { _id: 1 } },
    ], as: '_managedBusinesses' } },
    { $lookup: { from: ProviderProfile.collection.name, let: { owner, businesses: '$_managedBusinesses._id' }, pipeline: [
      { $match: { $expr: { $or: [{ $eq: ['$ownerUser', '$$owner'] }, { $in: ['$business', '$$businesses'] }] } } }, { $project: { _id: 1 } },
    ], as: '_managedProfiles' } },
    { $lookup: { from: RatingAggregate.collection.name, let: { profiles: '$_managedProfiles._id', businesses: '$_managedBusinesses._id' }, pipeline: [
      { $match: { portal: 'keshillakos', $expr: { $or: [
        { $and: [{ $eq: ['$scope', 'provider'] }, { $in: ['$subjectId', '$$profiles'] }] },
        { $and: [{ $eq: ['$scope', 'business'] }, { $in: ['$subjectId', '$$businesses'] }] },
      ] } } },
      { $group: { _id: null, count: { $sum: '$count' }, weight: { $sum: { $multiply: ['$average', '$count'] } } } },
    ], as: '_ratings' } },
    { $set: { ratingCount: first('$_ratings.count', 0), ratingWeight: first('$_ratings.weight', 0) } },
    { $set: { ratingAverage: { $cond: [{ $gt: ['$ratingCount', 0] }, { $divide: [{ $round: [{ $multiply: [{ $divide: ['$ratingWeight', '$ratingCount'] }, 10] }, 0] }, 10] }, 0] } } },
  ]
}

function businessStages(localField: string): PipelineStage[] {
  return [
    { $lookup: { from: Business.collection.name, localField, foreignField: '_id', as: '_business' } },
    { $match: { $or: [{ [localField]: { $exists: false } }, { [localField]: null }, { '_business.status': 'active' }] } },
  ]
}

function filterAndSort(query: Record<string, unknown>, provider: boolean): PipelineStage[] {
  const filters = marketplaceFilters(query)
  const match: Record<string, unknown> = {}
  if (filters.categoryId !== 'all') match.categories = filters.categoryId
  if (filters.subcategoryId !== 'all') match.subcategoryIds = filters.subcategoryId
  if (filters.delivery !== 'all') match.deliveryModes = filters.delivery
  if (filters.language !== 'all') match.languages = filters.language
  if (filters.minRating) match.ratingAverage = { $gte: Number(filters.minRating) }
  if (filters.verification === 'verified') match.$or = [
    { 'verification.identity': 'verified' }, { 'verification.business': 'verified' }, { 'verification.qualification': 'verified' },
  ]
  if (filters.query.trim()) match.searchText = { $regex: escaped(filters.query.trim()), $options: 'i' }
  if (typeof query.serviceId === 'string' && Types.ObjectId.isValid(query.serviceId)) match._id = new Types.ObjectId(query.serviceId)
  const sort = marketplaceSort(query.sort)
  const q = filters.query.trim().toLowerCase()
  const relevance: PipelineStage[] = q ? [{ $set: { relevance: { $switch: { branches: [
    { case: { $eq: [{ $toLower: provider ? '$name' : '$title' }, q] }, then: 3 },
    { case: { $regexMatch: { input: provider ? '$name' : '$title', regex: escaped(q), options: 'i' } }, then: 2 },
    { case: { $regexMatch: { input: provider ? '$title' : '$providerName', regex: escaped(q), options: 'i' } }, then: 1 },
  ], default: 0 } } } }] : []
  const order: Record<string, 1 | -1> = sort === 'rating' ? { ratingAverage: -1, ratingCount: -1 }
    : sort === 'reviews' ? { ratingCount: -1, ratingAverage: -1 }
      : sort === 'newest' ? { [provider ? 'updatedAt' : 'createdAt']: -1 }
        : q ? { relevance: -1, [provider ? 'ratingAverage' : 'createdAt']: -1 }
          : provider ? { ratingCount: -1 } : { createdAt: -1 }
  return [{ $match: match }, ...relevance, { $sort: { ...order, _id: -1 } }]
}

/** Join only searchable card fields. Skip/limit happens before card enrichment. */
export function providerDirectoryPipeline(query: Record<string, unknown>): PipelineStage[] {
  const cityId = typeof query.cityId === 'string' && Types.ObjectId.isValid(query.cityId) ? new Types.ObjectId(query.cityId) : undefined
  return [
    { $match: { ...publishedProfile, ...(cityId ? { serviceAreaCityIds: cityId } : {}) } },
    ...businessStages('business'),
    { $lookup: { from: User.collection.name, localField: 'ownerUser', foreignField: '_id', as: '_owner' } },
    { $match: { '_owner.uid': { $exists: true, $ne: '' }, '_owner.role': { $ne: 'admin' }, '_owner.roles': { $ne: 'admin' } } },
    { $lookup: { from: Category.collection.name, let: { keys: '$categories' }, pipeline: [
      { $match: { $expr: { $or: [{ $in: ['$stableId', '$$keys'] }, { $in: ['$slug', '$$keys'] }, { $in: [{ $toString: '$_id' }, '$$keys'] }] } } },
      { $project: { label: { $ifNull: ['$labels.sq', '$name.sq'] } } },
    ], as: '_categories' } },
    { $lookup: { from: City.collection.name, let: { ids: { $concatArrays: [{ $ifNull: ['$serviceAreaCityIds', []] }, [{ $ifNull: ['$location.cityId', null] }]] } }, pipeline: [{ $match: { $expr: { $in: ['$_id', '$$ids'] } } }, { $project: { 'name.sq': 1 } }], as: '_cities' } },
    { $lookup: { from: ServiceOffer.collection.name, let: { profile: '$_id' }, pipeline: [
      { $match: { ...publishedOffer, $expr: { $eq: ['$providerProfile', '$$profile'] } } },
      { $group: { _id: null, subcategories: { $addToSet: '$subcategoryId' } } },
    ], as: '_offers' } },
    ...ratingStages('$ownerUser'),
    { $set: {
      name: { $cond: [{ $eq: ['$providerType', 'business'] }, first('$_business.publicName', '$publicProfile.displayName'), '$publicProfile.displayName'] },
      title: { $ifNull: ['$publicProfile.title', ''] },
      categories: { $concatArrays: ['$categories', '$_categories.label'] },
      subcategoryIds: { $map: { input: { $setUnion: [{ $ifNull: ['$subcategoryIds', []] }, first('$_offers.subcategories', [])] }, as: 'id', in: { $toString: '$$id' } } },
      deliveryModes: { $map: { input: '$modes', as: 'mode', in: { $cond: [{ $eq: ['$$mode', 'on_site'] }, 'physical', '$$mode'] } } },
    } },
    { $set: { searchText: text(['$name', '$title', '$publicProfile.shortDescription', '$publicProfile.description', '$experience', words('$specializations'), words('$languages'), words('$_categories.label'), words('$_cities.name.sq'), words('$serviceAreas.cityName'), words('$locations.cityName')]) } },
    ...filterAndSort(query, true),
  ]
}

export function publicServicesPipeline(query: Record<string, unknown>): PipelineStage[] {
  const cityId = typeof query.cityId === 'string' && Types.ObjectId.isValid(query.cityId) ? new Types.ObjectId(query.cityId) : undefined
  const canonical: PipelineStage[] = [
    { $match: publishedOffer },
    { $lookup: { from: ProviderProfile.collection.name, localField: 'providerProfile', foreignField: '_id', as: '_profile' } },
    { $unwind: '$_profile' },
    { $match: { '_profile.status': 'published', '_profile.moderation.status': 'approved' } },
    ...businessStages('business'),
    { $lookup: { from: Category.collection.name, localField: 'category', foreignField: '_id', as: '_category' } },
    { $unwind: '$_category' }, { $match: { '_category.status': 'active' } },
    { $lookup: { from: User.collection.name, localField: 'staffUser', foreignField: '_id', as: '_staff' } },
    { $set: {
      source: { $literal: 'offer' }, title: '$name', categoryId: '$_category.stableId', categoryLabel: { $ifNull: ['$_category.labels.sq', '$_category.name.sq'] },
      providerName: { $cond: [{ $eq: ['$_profile.providerType', 'business'] }, first('$_business.publicName', '$_profile.publicProfile.displayName'), '$_profile.publicProfile.displayName'] },
      details: '$extensions', subcategory: { $ifNull: ['$subtitle', ''] },
    } },
  ]
  const legacy: PipelineStage.UnionWithPipelineStage[] = [
    { $match: { active: true } },
    { $lookup: { from: User.collection.name, localField: 'providerUid', foreignField: 'uid', as: '_owner' } },
    { $lookup: { from: ProviderProfile.collection.name, let: { owners: '$_owner._id' }, pipeline: [
      { $match: { ...publishedProfile, ...(cityId ? { serviceAreaCityIds: cityId } : {}), $expr: { $in: ['$ownerUser', '$$owners'] } } }, { $sort: { updatedAt: -1 } }, { $limit: 1 },
    ], as: '_profile' } },
    { $set: { _profile: first('$_profile', {}), source: { $literal: 'legacy' }, languages: { $ifNull: ['$details.supportLanguages', first('$_owner.languages', [])] } } },
  ]
  return [
    ...canonical,
    { $unionWith: { coll: Service.collection.name, pipeline: legacy } },
    ...(cityId ? [{ $match: { '_profile.serviceAreaCityIds': cityId } } as PipelineStage] : []),
    ...ratingStages('$_profile.ownerUser'),
    { $lookup: { from: City.collection.name, let: { ids: { $concatArrays: [{ $ifNull: ['$_profile.serviceAreaCityIds', []] }, [{ $ifNull: ['$_profile.location.cityId', null] }]] } }, pipeline: [{ $match: { $expr: { $in: ['$_id', '$$ids'] } } }, { $project: { 'name.sq': 1 } }], as: '_cities' } },
    { $set: {
      location: { $ifNull: ['$location', { $ifNull: [first('$serviceAreas.cityName', null), first('$_cities.name.sq', { $cond: [{ $in: ['online', { $ifNull: ['$modes', []] }] }, 'Online', ''] })] }] },
      categories: ['$categoryId', '$categoryLabel', { $toString: '$_category._id' }, '$_category.slug'], subcategoryIds: [{ $toString: '$subcategoryId' }, '$subcategory'],
      languages: { $ifNull: ['$details.supportLanguages', { $ifNull: ['$languages', '$_profile.languages'] }] },
      deliveryModes: { $ifNull: ['$details.deliveryModes', []] }, verification: '$_profile.verification',
    } },
    { $set: { searchText: text(['$title', '$description', '$subcategory', '$categoryLabel', '$location', '$providerName', '$_profile.publicProfile.title', words('$_cities.name.sq'), first('$_staff.name')]) } },
    ...filterAndSort(query, false),
  ]
}
