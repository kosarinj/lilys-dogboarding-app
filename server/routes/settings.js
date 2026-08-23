import express from 'express'
import { query } from '../models/db.js'
import { requireAuth } from '../middleware/auth.js'
import { sendSms, isSmsEnabled, toE164 } from '../services/sms.js'

const router = express.Router()

// GET /api/settings - Get all settings
router.get('/', async (req, res) => {
  try {
    const result = await query('SELECT * FROM settings ORDER BY setting_key')
    res.json(result.rows)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// GET /api/settings/:key - Get setting by key
router.get('/:key', async (req, res) => {
  try {
    const { key } = req.params
    const result = await query('SELECT * FROM settings WHERE setting_key = $1', [key])
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Setting not found' })
    }
    res.json(result.rows[0])
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// PUT /api/settings/:key - Update setting
router.put('/:key', requireAuth, async (req, res) => {
  try {
    const { key } = req.params
    const { setting_value } = req.body

    if (setting_value === undefined || setting_value === null || setting_value < 0) {
      return res.status(400).json({ error: 'Invalid setting_value' })
    }

    const result = await query(
      `UPDATE settings
       SET setting_value = $1, updated_at = CURRENT_TIMESTAMP
       WHERE setting_key = $2
       RETURNING *`,
      [setting_value, key]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Setting not found' })
    }

    res.json(result.rows[0])
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// POST /api/settings/initialize - Create any missing default settings
router.post('/initialize', requireAuth, async (req, res) => {
  try {
    const defaultSettings = [
      { key: 'dropoff_fee', value: 15.00, description: 'Fee for drop-off service' },
      { key: 'pickup_fee', value: 15.00, description: 'Fee for pick-up service' },
      { key: 'boarding_puppy_fee_regular', value: 10.00, description: 'Additional daily fee for puppies (boarding - regular)' },
      { key: 'boarding_puppy_fee_holiday', value: 15.00, description: 'Additional daily fee for puppies (boarding - holiday)' },
      { key: 'daycare_puppy_fee_regular', value: 10.00, description: 'Additional daily fee for puppies (daycare - regular)' },
      { key: 'daycare_puppy_fee_holiday', value: 15.00, description: 'Additional daily fee for puppies (daycare - holiday)' }
    ]

    // Remove old puppy fee settings if they exist (from previous version)
    await query(`DELETE FROM settings WHERE setting_key IN ('boarding_puppy_fee', 'daycare_puppy_fee')`)

    let created = 0
    let existing = 0

    for (const setting of defaultSettings) {
      const checkResult = await query(
        'SELECT id FROM settings WHERE setting_key = $1',
        [setting.key]
      )

      if (checkResult.rows.length === 0) {
        await query(
          `INSERT INTO settings (setting_key, setting_value, description)
           VALUES ($1, $2, $3)`,
          [setting.key, setting.value, setting.description]
        )
        created++
        console.log(`Created setting: ${setting.key} = ${setting.value}`)
      } else {
        existing++
      }
    }

    res.json({
      success: true,
      message: `Settings initialized: ${created} created, ${existing} already existed`,
      created,
      existing
    })
  } catch (error) {
    console.error('Error initializing settings:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * GET /api/settings/sms/status — is texting actually configured?
 *
 * Reports which pieces are present without ever returning the auth token.
 * "Nothing arrived" has several possible causes and they need different fixes;
 * this separates "not configured" from "configured but the send failed".
 */
router.get('/sms/status', requireAuth, (req, res) => {
  const from = process.env.TWILIO_PHONE_NUMBER || null
  res.json({
    enabled: isSmsEnabled(),
    accountSid: process.env.TWILIO_ACCOUNT_SID
      ? `${String(process.env.TWILIO_ACCOUNT_SID).slice(0, 6)}…` : null,
    authTokenSet: !!process.env.TWILIO_AUTH_TOKEN,
    fromNumber: from,
    // Twilio rejects anything not in E.164, and a from-number typed as
    // 855-801-9854 fails every send with an error that doesn't mention it.
    fromLooksValid: !!from && /^\+\d{10,15}$/.test(from),
  })
})

/**
 * POST /api/settings/sms/test — send one text and report exactly what happened.
 *
 * Takes Twilio out of the booking flow so a failure can be attributed. Returns
 * Twilio's own error verbatim, because "unverified", "not a mobile number" and
 * "blocked as spam" each need a different response and a generic failure
 * message hides which one it was.
 */
router.post('/sms/test', requireAuth, async (req, res) => {
  try {
    const { phone } = req.body || {}
    if (!phone) return res.status(400).json({ error: 'phone is required' })
    const normalized = toE164(phone)
    const result = await sendSms(phone, "Test from Lily's Dog Boarding — if you got this, texting works.")
    res.json({ input: phone, normalized, ...result })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

export default router
