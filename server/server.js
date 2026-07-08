import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import { runMigrations } from './migrations.js'
import { requireAuth, initAuth } from './middleware/auth.js'

// Import routes
import authRoutes from './routes/auth.js'
import customersRoutes from './routes/customers.js'
import dogsRoutes from './routes/dogs.js'
import staysRoutes from './routes/stays.js'
import billsRoutes from './routes/bills.js'
import paymentsRoutes from './routes/payments.js'
import ratesRoutes from './routes/rates.js'
import settingsRoutes from './routes/settings.js'
import analyticsRoutes from './routes/analytics.js'
import uploadRoutes from './routes/upload.js'

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = process.env.PORT || 5000

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true
}))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Serve uploaded files from Railway volume in production, local directory in development
const uploadsPath = process.env.NODE_ENV === 'production'
  ? '/data/uploads'
  : path.join(__dirname, 'uploads')
app.use('/uploads', express.static(uploadsPath))

// API Routes
// Public: auth (login/bootstrap/status) and the guest bill view/payment flow.
// Everything admin-facing is gated by requireAuth. bills & settings are gated
// selectively inside their routers so guests can still view/pay a bill by code.
app.use('/api/auth', authRoutes)
app.use('/api/customers', requireAuth, customersRoutes)
app.use('/api/dogs', requireAuth, dogsRoutes)
app.use('/api/stays', requireAuth, staysRoutes)
app.use('/api/bills', billsRoutes)
app.use('/api/payments', paymentsRoutes)
app.use('/api/rates', requireAuth, ratesRoutes)
app.use('/api/settings', settingsRoutes)
app.use('/api/analytics', requireAuth, analyticsRoutes)
app.use('/api/upload', requireAuth, uploadRoutes)

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'client/dist')))

  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'client/dist/index.html'))
  })
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err.stack)
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error'
  })
})

app.listen(PORT, async () => {
  console.log(`🚀 Server running on port ${PORT}`)
  console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`)

  // Run database migrations, then load the JWT secret
  await runMigrations()
  await initAuth()
  console.log('✓ Auth initialized')
})
