import jwt from 'jsonwebtoken'
import { query } from '../models/db.js'

// JWT signing secret. Prefer an env var; otherwise generate one and persist it in the
// app_config table so it stays stable across restarts (tokens don't get invalidated) and
// never lives in source control. Loaded once at startup via initAuth().
let JWT_SECRET = null

export async function initAuth() {
  if (process.env.JWT_SECRET) {
    JWT_SECRET = process.env.JWT_SECRET
    return
  }
  try {
    await query(`CREATE TABLE IF NOT EXISTS app_config (key VARCHAR(64) PRIMARY KEY, value TEXT NOT NULL)`)
    const existing = await query(`SELECT value FROM app_config WHERE key = 'jwt_secret'`)
    if (existing.rows.length > 0 && existing.rows[0].value) {
      JWT_SECRET = existing.rows[0].value
    } else {
      const secret = (await import('crypto')).randomBytes(48).toString('hex')
      await query(`INSERT INTO app_config (key, value) VALUES ('jwt_secret', $1) ON CONFLICT (key) DO NOTHING`, [secret])
      const row = await query(`SELECT value FROM app_config WHERE key = 'jwt_secret'`)
      JWT_SECRET = row.rows[0].value
    }
  } catch (e) {
    console.error('initAuth: falling back to ephemeral secret:', e.message)
    JWT_SECRET = (await import('crypto')).randomBytes(48).toString('hex')
  }
}

export function signToken(user) {
  return jwt.sign({ id: user.id, email: user.email, name: user.name, role: user.role }, JWT_SECRET, { expiresIn: '30d' })
}

// Express middleware: require a valid Bearer token. Sets req.user on success.
export function requireAuth(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) return res.status(401).json({ error: 'Not authenticated' })
  try {
    req.user = jwt.verify(token, JWT_SECRET)
    next()
  } catch (e) {
    return res.status(401).json({ error: 'Invalid or expired session' })
  }
}
