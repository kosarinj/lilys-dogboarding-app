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
import bookingRoutes from './routes/booking.js'
import accessRoutes from './routes/access.js'
import holidaysRoutes from './routes/holidays.js'
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
// The Stripe webhook must see the RAW body: signature verification hashes the
// exact bytes Stripe sent, and express.json() rewrites them. Mounted ahead of
// the JSON parser because the first matching body parser wins.
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }))
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
// Public: reachable only with a booking code Lily handed out, same access model
// as the guest bill page.
app.use('/api/book', bookingRoutes)
// Public and unauthenticated by design: this is how someone who has lost their
// link gets it back. Rate limited per number inside the route.
app.use('/api/access', accessRoutes)
app.use('/api/holidays', holidaysRoutes)
app.use('/api/rates', requireAuth, ratesRoutes)
app.use('/api/settings', settingsRoutes)
app.use('/api/analytics', requireAuth, analyticsRoutes)
app.use('/api/upload', requireAuth, uploadRoutes)

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Serve static files in production
//
// index.html is never cached; everything under assets/ is cached forever.
//
// Those two rules go together: Vite puts a content hash in every asset
// filename, so a new build produces new names and can never be served a stale
// one — but only if the page that names them is fresh. Without this the whole
// shell was cacheable, and an iPhone home-screen copy kept serving a build from
// weeks earlier: the invoice's Venmo and Zelle buttons were missing on the
// phone while the same invoice showed them in a browser.
if (process.env.NODE_ENV === 'production') {
  const clientDist = path.join(__dirname, 'client/dist')
  app.use(express.static(clientDist, {
    setHeaders: (res, filePath) => {
      const parts = filePath.split(path.sep)
      if (parts[parts.length - 1] === 'index.html') {
        res.setHeader('Cache-Control', 'no-store, must-revalidate')
      } else if (parts.includes('assets')) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
      }
    },
  }))

  app.get('*', (req, res) => {
    // A request for a FILE that isn't there must 404, never fall through to the
    // HTML shell.
    //
    // Every deploy renames the hashed bundle, so a phone holding a cached page
    // asks for its old one. Answering that with index.html returned HTML with a
    // 200 and a JS content type: the browser parsed the page as a module, hit a
    // syntax error, and rendered nothing — the app looked completely broken and
    // could not recover, because the copy it needed to replace was the very page
    // it had cached. A 404 lets the browser fail honestly and refetch the shell,
    // which is now no-store.
    if (req.path.startsWith('/assets/') || path.extname(req.path)) {
      return res.status(404).type('txt').send('Not found')
    }
    // Real app routes get the shell, under the same no-cache rule as index.html.
    res.setHeader('Cache-Control', 'no-store, must-revalidate')
    res.sendFile(path.join(clientDist, 'index.html'))
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
