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

    if (!setting_value || setting_value <= 0) {
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

export default router
