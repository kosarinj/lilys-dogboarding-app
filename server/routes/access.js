/**
 * Self-service access to the booking page.
 *
 * One shared link, /request, that Lily can put anywhere — a text, her Facebook
 * page, the fridge — instead of looking up and sending a personal link every
 * time. That link proves nothing by itself, so the caller proves the phone
 * number is theirs by receiving a code on it, and only then gets handed their
 * real booking link.
 *
 * A phone number is not a secret. Without the code step, anyone who knows one
 * of Lily's customers could type their number and read back their dogs, their
 * upcoming stays and what they owe. The code is what makes the shared link safe
 * to hand around.
 *
 * Deliberately NOT open to strangers: an unknown number is told to get in touch
 * rather than being allowed to create itself an account. That does reveal
 * whether a number is on file, which is unavoidable when the whole point is to
 * tell someone they need to call — and it is a far smaller thing to give away
 * than a customer's details.
 */
import express from 'express'
import { createHash, randomInt, timingSafeEqual } from 'node:crypto'
import { query } from '../models/db.js'
import { sendSms, isSmsEnabled, toE164 } from '../services/sms.js'

const router = express.Router()

const CODE_TTL_MINUTES = 10
const MAX_ATTEMPTS = 5           // per code, then it's dead
const MAX_SENDS_PER_HOUR = 4     // per number, so the link can't be used to spam someone

const hash = (code) => createHash('sha256').update(String(code)).digest('hex')

// Constant-time compare, so the number of correct leading digits can't be read
// off the response time. Cheap here, and the habit is worth keeping.
function codeMatches(supplied, storedHash) {
  const a = Buffer.from(hash(supplied), 'utf8')
  const b = Buffer.from(String(storedHash || ''), 'utf8')
  return a.length === b.length && timingSafeEqual(a, b)
}

/**
 * Find a customer by phone, however the number happens to be punctuated.
 *
 * Numbers in this database are free text — "(555) 123-4567", "555.1234 cell".
 * Comparing them raw would miss almost every match, so both sides are reduced
 * to their last ten digits, which is the part that identifies a US line.
 */
async function customerByPhone(raw) {
  const digits = String(raw || '').replace(/\D/g, '')
  if (digits.length < 10) return null
  const last10 = digits.slice(-10)
  const r = await query(
    `SELECT id, name, phone, booking_code FROM customers
     WHERE RIGHT(REGEXP_REPLACE(COALESCE(phone, ''), '[^0-9]', '', 'g'), 10) = $1
     LIMIT 1`,
    [last10]
  )
  return r.rows[0] || null
}

const NOT_ON_FILE =
  "We don't have that number on file. Please text or call Lily to get set up, " +
  'and you can book yourself in from then on.'

/** POST /api/access/start — { phone } → text them a code. */
router.post('/start', async (req, res) => {
  try {
    const { phone } = req.body || {}
    const e164 = toE164(phone)
    if (!e164) return res.status(400).json({ error: 'Please enter a 10-digit mobile number.' })

    const customer = await customerByPhone(phone)
    if (!customer) return res.status(404).json({ error: NOT_ON_FILE })

    // Texting off means no code can arrive, and a screen asking for one that
    // will never come is worse than saying so.
    if (!isSmsEnabled()) {
      return res.status(503).json({ error: 'Texting is not set up — please contact Lily directly.' })
    }

    const recent = await query(
      `SELECT COUNT(*) AS n FROM booking_access_codes
       WHERE phone = $1 AND created_at > NOW() - INTERVAL '1 hour'`,
      [e164]
    )
    if (Number(recent.rows[0].n) >= MAX_SENDS_PER_HOUR) {
      return res.status(429).json({
        error: 'Too many codes requested. Please wait an hour, or contact Lily directly.',
      })
    }

    // randomInt, not Math.random — same reasoning as the booking codes. Padded,
    // so 0042 stays four digits and the customer types what they were sent.
    const code = String(randomInt(10000)).padStart(4, '0')
    await query(
      `INSERT INTO booking_access_codes (customer_id, phone, code_hash, expires_at)
       VALUES ($1, $2, $3, NOW() + INTERVAL '${CODE_TTL_MINUTES} minutes')`,
      [customer.id, e164, hash(code)]
    )

    const sms = await sendSms(
      e164,
      `${code} is your code for Lily's Dog Boarding. It expires in ${CODE_TTL_MINUTES} minutes.`
    )
    if (!sms.sent) {
      return res.status(502).json({ error: `Couldn't send the code: ${sms.reason || 'unknown error'}` })
    }
    // The name is a reassurance that the right number was typed. First name
    // only — the full name is more than a wrong number should learn.
    res.json({ sent: true, name: String(customer.name || '').split(' ')[0] })
  } catch (e) {
    console.error('Access start error:', e.message)
    res.status(500).json({ error: e.message })
  }
})

/** POST /api/access/verify — { phone, code } → their booking code. */
router.post('/verify', async (req, res) => {
  try {
    const { phone, code } = req.body || {}
    const e164 = toE164(phone)
    if (!e164 || !/^\d{4}$/.test(String(code || ''))) {
      return res.status(400).json({ error: 'Enter the 4-digit code from the text.' })
    }

    const r = await query(
      `SELECT * FROM booking_access_codes
       WHERE phone = $1 AND used_at IS NULL AND expires_at > NOW() AND attempts < $2
       ORDER BY created_at DESC LIMIT 1`,
      [e164, MAX_ATTEMPTS]
    )
    const row = r.rows[0]
    if (!row) {
      return res.status(400).json({ error: 'That code has expired. Please request a new one.' })
    }

    // Counted before it's checked. Counting afterwards, or only on failure,
    // leaves a window where a crash or a race gives away a free guess.
    await query(`UPDATE booking_access_codes SET attempts = attempts + 1 WHERE id = $1`, [row.id])

    if (!codeMatches(code, row.code_hash)) {
      const left = MAX_ATTEMPTS - (row.attempts + 1)
      return res.status(400).json({
        error: left > 0
          ? `That code isn't right. ${left} attempt${left === 1 ? '' : 's'} left.`
          : 'Too many wrong attempts. Please request a new code.',
      })
    }

    // Burn it. A code that still works after it has been used is a code that
    // works for whoever else read the text.
    await query(`UPDATE booking_access_codes SET used_at = NOW() WHERE id = $1`, [row.id])

    const c = await query(`SELECT booking_code FROM customers WHERE id = $1`, [row.customer_id])
    res.json({ bookingCode: c.rows[0]?.booking_code })
  } catch (e) {
    console.error('Access verify error:', e.message)
    res.status(500).json({ error: e.message })
  }
})

export default router
