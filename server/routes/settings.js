import express from 'express'
import { query } from '../models/db.js'

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
router.put('/:key', async (req, res) => {
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
router.post('/initialize', async (req, res) => {
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

export default router
