import { paginationInput, validatePagination } from '../services/pagination'
import { Router } from 'express'
import { requireAuth, requireRole } from '../middleware/auth'
import {
  deleteUpload,
  imageUpload,
  storeUploadedFile,
  withImageUpload,
} from '../services/mediaService'
import { acceptBusinessInvitation, businessTeam, cancelBusinessInvitation, createBusiness, inviteBusinessExpert, listManagedBusinesses, listMyBusinessInvitations, listMyBusinesses, lookupBusinessExpert, rejectBusinessInvitation, removeBusinessExpert, reviewBusiness, toPublicBusiness, updateBusiness } from '../services/businessService'
import type { Location } from '../models/location'

const router = Router()
router.use(validatePagination)

router.get('/managed', requireAuth, requireRole('company', 'admin'), async (req, res) => {
  try { return res.json({ businesses: await listManagedBusinesses(req.user!.uid) }) }
  catch (err) { return res.status(400).json({ message: err instanceof Error ? err.message : 'Bizneset nuk u ngarkuan' }) }
})

router.get('/invitations/mine', requireAuth, requireRole('provider'), async (req, res) => {
  try { const invitations = await listMyBusinessInvitations(req.user!.uid, paginationInput(req.query, 20)); return res.json({ invitations, pagination: invitations.pagination }) }
  catch (err) { return res.status(400).json({ message: err instanceof Error ? err.message : 'Ftesat nuk u ngarkuan' }) }
})

router.post('/:id/invitations/accept', requireAuth, requireRole('provider'), async (req, res) => {
  try { return res.json({ business: await acceptBusinessInvitation(req.user!.uid, String(req.params.id)) }) }
  catch (err) { return res.status(400).json({ message: err instanceof Error ? err.message : 'Ftesa nuk u pranua' }) }
})

router.post('/:id/invitations/reject', requireAuth, requireRole('provider'), async (req, res) => {
  try { return res.json({ business: await rejectBusinessInvitation(req.user!.uid, String(req.params.id)) }) }
  catch (err) { return res.status(400).json({ message: err instanceof Error ? err.message : 'Ftesa nuk u refuzua' }) }
})

router.get('/:id/team', requireAuth, requireRole('company', 'admin'), async (req, res) => {
  try { return res.json({ team: await businessTeam(req.user!.uid, String(req.params.id), paginationInput(req.query, 20), paginationInput({ ...req.query, page: req.query.invitationsPage }, 20)) }) }
  catch (err) { return res.status(400).json({ message: err instanceof Error ? err.message : 'Ekipi nuk u ngarkua' }) }
})

router.get('/:id/expert-lookup', requireAuth, requireRole('company', 'admin'), async (req, res) => {
  try {
    const email = String(req.query.email || '')
    if (!email.trim()) return res.status(400).json({ message: 'Email i ekspertit është i detyrueshëm' })
    return res.json({ match: await lookupBusinessExpert(req.user!.uid, String(req.params.id), email) })
  } catch (err) { return res.status(400).json({ message: err instanceof Error ? err.message : 'Eksperti nuk u kontrollua' }) }
})

router.post('/:id/invitations', requireAuth, requireRole('company', 'admin'), async (req, res) => {
  try {
    const email = (req.body as { email?: string }).email
    if (!email?.trim()) return res.status(400).json({ message: 'Email i ekspertit është i detyrueshëm' })
    return res.status(201).json({ team: await inviteBusinessExpert(req.user!.uid, String(req.params.id), email) })
  } catch (err) { return res.status(400).json({ message: err instanceof Error ? err.message : 'Ftesa nuk u dërgua' }) }
})

router.delete('/:id/invitations/:userId', requireAuth, requireRole('company', 'admin'), async (req, res) => {
  try { return res.json({ team: await cancelBusinessInvitation(req.user!.uid, String(req.params.id), String(req.params.userId)) }) }
  catch (err) { return res.status(400).json({ message: err instanceof Error ? err.message : 'Ftesa nuk u anulua' }) }
})

router.delete('/:id/members/:userId', requireAuth, requireRole('company', 'admin'), async (req, res) => {
  try { return res.json({ team: await removeBusinessExpert(req.user!.uid, String(req.params.id), String(req.params.userId)) }) }
  catch (err) { return res.status(400).json({ message: err instanceof Error ? err.message : 'Anëtari nuk u hoq' }) }
})

router.get('/mine', requireAuth, requireRole('company', 'admin'), async (req, res) => {
  try {
    const businesses = await listMyBusinesses(req.user!.uid)
    return res.json({ businesses: businesses.map(toPublicBusiness) })
  } catch (err) {
    return res.status(400).json({ message: err instanceof Error ? err.message : 'Bizneset nuk u ngarkuan' })
  }
})

router.post('/', requireAuth, requireRole('company', 'admin'), async (req, res) => {
  try {
    const { publicName, legalName, logoUrl, description, website, contactEmail, contactPhone, categoryIds, location, branches } = req.body as {
      publicName?: string
      legalName?: string
      logoUrl?: string
      description?: string
      website?: string
      contactEmail?: string
      contactPhone?: string
      categoryIds?: string[]
      location?: { countryId: string; cityId: string }
      branches?: Array<{ name: string; location: Location }>
    }
    if (!publicName?.trim() || (branches !== undefined && !Array.isArray(branches))) {
      return res.status(400).json({ message: 'Emri publik i biznesit është i detyrueshëm' })
    }
    const business = await createBusiness({
      ownerUid: req.user!.uid,
      publicName,
      legalName,
      logoUrl,
      description,
      website,
      contactEmail,
      contactPhone,
      categoryIds,
      location,
      branches,
    })
    return res.status(201).json({ business: toPublicBusiness(business) })
  } catch (err) {
    return res.status(400).json({ message: err instanceof Error ? err.message : 'Biznesi nuk u krijua' })
  }
})

router.patch('/:id', requireAuth, requireRole('company', 'admin'), async (req, res) => {
  try {
    const { publicName, legalName, logoUrl, description, website, contactEmail, contactPhone, categoryIds, location, socialLinks, branches } = req.body as {
      publicName?: string
      legalName?: string | null
      logoUrl?: string | null
      description?: string | null
      website?: string | null
      contactEmail?: string | null
      contactPhone?: string | null
      categoryIds?: string[]
      location?: { countryId: string; cityId: string } | null
      socialLinks?: Record<string, string | undefined> | null
      branches?: Array<{ name: string; location: Location }>
    }
    if (branches !== undefined && !Array.isArray(branches)) return res.status(400).json({ message: 'Degët nuk janë të vlefshme' })
    if (categoryIds !== undefined && !Array.isArray(categoryIds)) return res.status(400).json({ message: 'Kategoritë nuk janë të vlefshme' })
    const business = await updateBusiness(req.user!.uid, String(req.params.id), {
      publicName, legalName, logoUrl, description, website, contactEmail, contactPhone, categoryIds, location, socialLinks, branches,
    })
    return res.json({ business: toPublicBusiness(business) })
  } catch (err) { return res.status(400).json({ message: err instanceof Error ? err.message : 'Biznesi nuk u përditësua' }) }
})

router.post('/:id/logo', requireAuth, requireRole('company', 'admin'), withImageUpload(imageUpload), async (req, res) => {
  let logoUrl: string | undefined
  try {
    logoUrl = await storeUploadedFile(req, 'companies', String(req.params.id), 'Zgjidh një logo për kompaninë', { label: 'logo' })
    const business = await updateBusiness(req.user!.uid, String(req.params.id), { logoUrl })
    return res.json({ business: toPublicBusiness(business) })
  } catch (err) {
    await deleteUpload(logoUrl)
    return res.status(400).json({ message: err instanceof Error ? err.message : 'Ngarkimi i logos dështoi' })
  }
})

router.post('/:id/cover', requireAuth, requireRole('company', 'admin'), withImageUpload(imageUpload), async (req, res) => {
  let coverUrl: string | undefined
  try {
    coverUrl = await storeUploadedFile(req, 'companies', String(req.params.id), 'Zgjidh një foto për sfondin', { label: 'cover' })
    const business = await updateBusiness(req.user!.uid, String(req.params.id), { coverUrl })
    return res.json({ business: toPublicBusiness(business) })
  } catch (err) {
    await deleteUpload(coverUrl)
    return res.status(400).json({ message: err instanceof Error ? err.message : 'Ngarkimi i sfondit dështoi' })
  }
})

router.patch('/:id/review', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { status, verification } = req.body as { status?: 'active' | 'suspended'; verification?: 'unverified' | 'verified' | 'rejected' }
    if (!status || !['active', 'suspended'].includes(status) || (verification && !['unverified', 'verified', 'rejected'].includes(verification))) {
      return res.status(400).json({ message: 'Vendimi nuk është i vlefshëm' })
    }
    const business = await reviewBusiness(String(req.params.id), req.user!.uid, status, verification)
    return res.json({ business: toPublicBusiness(business) })
  } catch (err) { return res.status(400).json({ message: err instanceof Error ? err.message : 'Rishikimi dështoi' }) }
})

export default router
