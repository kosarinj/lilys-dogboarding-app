import express from 'express'
import bcrypt from 'bcryptjs'
import { query } from '../models/db.js'
import { requireAuth, signToken } from '../middleware/auth.js'

const router = express.Router()

const publicUser = (u) => ({ id: u.id, email: u.email, name: u.name, role: u.role, created_at: u.created_at })

// GET /api/auth/status — is any admin account set up yet? (drives the first-run flow)
router.get('/status', async (req, res) => {
  try {
    const r = await query('SELECT COUNT(*)::int AS count FROM admin_users')
    res.json({ needsSetup: r.rows[0].count === 0 })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// POST /api/auth/bootstrap — create the FIRST admin account. Only works when none exist.
router.post('/bootstrap', async (req, res) => {
  try {
    const { email, password, name } = req.body
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' })
    if (String(password).length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' })
    const count = await query('SELECT COUNT(*)::int AS count FROM admin_users')
    if (count.rows[0].count > 0) return res.status(403).json({ error: 'Setup already completed — ask an existing admin to add you.' })
    const hash = await bcrypt.hash(password, 10)
    const r = await query(
      `INSERT INTO admin_users (email, password_hash, name, role) VALUES ($1, $2, $3, 'admin') RETURNING *`,
      [String(email).toLowerCase().trim(), hash, name?.trim() || 'Admin']
    )
    const user = r.rows[0]
    res.json({ token: signToken(user), user: publicUser(user) })
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'That email is already registered' })
    res.status(500).json({ error: error.message })
  }
})

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' })
    const r = await query('SELECT * FROM admin_users WHERE email = $1', [String(email).toLowerCase().trim()])
    const user = r.rows[0]
    if (!user) return res.status(401).json({ error: 'Invalid email or password' })
    const ok = await bcrypt.compare(password, user.password_hash)
    if (!ok) return res.status(401).json({ error: 'Invalid email or password' })
    res.json({ token: signToken(user), user: publicUser(user) })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// POST /api/auth/logout — stateless JWT, so this is a no-op the client can call
router.post('/logout', (req, res) => res.json({ success: true }))

// GET /api/auth/me — validate the current token
router.get('/me', requireAuth, async (req, res) => {
  try {
    const r = await query('SELECT * FROM admin_users WHERE id = $1', [req.user.id])
    if (r.rows.length === 0) return res.status(401).json({ error: 'Account no longer exists' })
    res.json({ user: publicUser(r.rows[0]) })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// GET /api/auth/users — list all admin users
router.get('/users', requireAuth, async (req, res) => {
  try {
    const r = await query('SELECT id, email, name, role, created_at FROM admin_users ORDER BY created_at ASC')
    res.json(r.rows)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// POST /api/auth/users — add a new user (any logged-in admin can add users)
router.post('/users', requireAuth, async (req, res) => {
  try {
    const { email, password, name } = req.body
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' })
    if (String(password).length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' })
    const hash = await bcrypt.hash(password, 10)
    const r = await query(
      `INSERT INTO admin_users (email, password_hash, name, role) VALUES ($1, $2, $3, 'admin')
       RETURNING id, email, name, role, created_at`,
      [String(email).toLowerCase().trim(), hash, name?.trim() || 'User']
    )
    res.json(r.rows[0])
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'That email is already registered' })
    res.status(500).json({ error: error.message })
  }
})

// DELETE /api/auth/users/:id — remove a user (can't delete yourself or the last user)
router.delete('/users/:id', requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    if (id === req.user.id) return res.status(400).json({ error: "You can't delete your own account" })
    const count = await query('SELECT COUNT(*)::int AS count FROM admin_users')
    if (count.rows[0].count <= 1) return res.status(400).json({ error: "Can't delete the last remaining user" })
    const r = await query('DELETE FROM admin_users WHERE id = $1 RETURNING id', [id])
    if (r.rows.length === 0) return res.status(404).json({ error: 'User not found' })
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// POST /api/auth/change-password — change your own password
router.post('/change-password', requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body
    if (!newPassword || String(newPassword).length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters' })
    const r = await query('SELECT * FROM admin_users WHERE id = $1', [req.user.id])
    const user = r.rows[0]
    if (!user) return res.status(401).json({ error: 'Account no longer exists' })
    const ok = await bcrypt.compare(currentPassword || '', user.password_hash)
    if (!ok) return res.status(401).json({ error: 'Current password is incorrect' })
    const hash = await bcrypt.hash(newPassword, 10)
    await query('UPDATE admin_users SET password_hash = $1 WHERE id = $2', [hash, req.user.id])
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

export default router
