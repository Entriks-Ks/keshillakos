import { Router } from 'express'
import { requireAuth, requireRole } from '../middleware/auth'
import { createBusiness, listMyBusinesses, reviewBusiness, updateBusiness } from '../services/businessService'
import type { Location } from '../models/location'

const router = Router()

router.get('/mine', requireAuth, requireRole('company', 'admin'), async (req, res) => {
  try {
    const businesses = await listMyBusinesses(req.user!.uid)
    return res.json({ businesses })
  } catch (err) {
    return res.status(400).json({ message: err instanceof Error ? err.message : 'Bizneset nuk u ngarkuan' })
  }
})

router.post('/', requireAuth, requireRole('company', 'admin'), async (req, res) => {
  try {
    const { publicName, legalName, logoUrl, branches } = req.body as {
      publicName?: string; legalName?: string; logoUrl?: string
      branches?: Array<{ name: string; location: Location }>
    }
    if (!publicName?.trim() || (branches !== undefined && !Array.isArray(branches))) {
      return res.status(400).json({ message: 'Emri publik i biznesit është i detyrueshëm' })
    }
    const business = await createBusiness({ ownerUid: req.user!.uid, publicName, legalName, logoUrl, branches })
    return res.status(201).json({ business })
  } catch (err) {
    return res.status(400).json({ message: err instanceof Error ? err.message : 'Biznesi nuk u krijua' })
  }
})

router.patch('/:id', requireAuth, requireRole('company', 'admin'), async (req, res) => {
  try {
    const { publicName, legalName, logoUrl, branches } = req.body as {
      publicName?: string; legalName?: string | null; logoUrl?: string | null
      branches?: Array<{ name: string; location: Location }>
    }
    if (branches !== undefined && !Array.isArray(branches)) return res.status(400).json({ message: 'Degët nuk janë të vlefshme' })
    const business = await updateBusiness(req.user!.uid, String(req.params.id), { publicName, legalName, logoUrl, branches })
    return res.json({ business })
  } catch (err) { return res.status(400).json({ message: err instanceof Error ? err.message : 'Biznesi nuk u përditësua' }) }
})

router.patch('/:id/review', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { status, verification } = req.body as { status?: 'active' | 'suspended'; verification?: 'unverified' | 'verified' | 'rejected' }
    if (!status || !['active', 'suspended'].includes(status) || (verification && !['unverified', 'verified', 'rejected'].includes(verification))) {
      return res.status(400).json({ message: 'Vendimi nuk është i vlefshëm' })
    }
    const business = await reviewBusiness(String(req.params.id), req.user!.uid, status, verification)
    return res.json({ business })
  } catch (err) { return res.status(400).json({ message: err instanceof Error ? err.message : 'Rishikimi dështoi' }) }
})

export default router
