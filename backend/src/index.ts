import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import http from 'http'
import mongoose from 'mongoose'
import path from 'path'
import { connectDB, isMongoReady } from './config/db'
import authRoutes from './routes/auth.routes'
import adminUsersRoutes from './routes/adminUsers.routes'
import availabilityRoutes from './routes/availability.routes'
import domainRoutes from './routes/domain.routes'
import catalogRoutes from './routes/catalog.routes'
import expertRoutes from './routes/expert.routes'
import businessRoutes from './routes/business.routes'
import providerProfileRoutes from './routes/providerProfile.routes'
import matchRoutes from './routes/match.routes'
import ratingRoutes from './routes/rating.routes'
import requestRoutes from './routes/request.routes'
import providerRoutes from './routes/provider.routes'
import appointmentRoutes from './routes/appointment.routes'
import onboardingRoutes from './routes/onboarding.routes'
import serviceRoutes from './routes/service.routes'
import serviceOfferRoutes from './routes/serviceOffer.routes'
import chatRoutes from './routes/chat.routes'
import { attachChatSocket } from './services/chatSocket'

const app = express()
const PORT = Number(process.env.PORT) || 4000

app.use(cors({ origin: true, credentials: true }))
app.use(express.json())
app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads')))

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    mongo: isMongoReady() ? 'connected' : 'disconnected',
    db: mongoose.connection.name || null,
  })
})

app.use('/api/auth', authRoutes)
app.use('/api/onboarding', onboardingRoutes)
app.use('/api/admin/users', adminUsersRoutes)
app.use('/api/availability', availabilityRoutes)
app.use('/api/domains', domainRoutes)
app.use('/api/v1', catalogRoutes)
app.use('/api/services', serviceRoutes)
app.use('/api/service-offers', serviceOfferRoutes)
app.use('/api/experts', expertRoutes)
app.use('/api/businesses', businessRoutes)
app.use('/api/providers', providerProfileRoutes)
app.use('/api/providers', providerRoutes)
app.use('/api/match', matchRoutes)
app.use('/api/ratings', ratingRoutes)
app.use('/api/requests', requestRoutes)
app.use('/api/appointments', appointmentRoutes)
app.use('/api/chat', chatRoutes)

app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    console.error(err)
    res.status(500).json({ message: err.message || 'Server error' })
  },
)

async function start() {
  try {
    await connectDB()
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('MongoDB connection failed:', message)
    if (message.includes('IP') || message.includes('whitelist')) {
      console.error(
        'Hap MongoDB Atlas → Network Access → Add IP Address → Allow Access from Anywhere (0.0.0.0/0) ose shto IP-në tënde.',
      )
    }
    process.exit(1)
  }

  const server = http.createServer(app)
  attachChatSocket(server)

  server.listen(PORT, () => {
    console.log(`API running on http://localhost:${PORT}`)
  })
}

start().catch((err) => {
  console.error('Failed to start server:', err)
  process.exit(1)
})
