import express from 'express'
import { query } from '../models/db.js'

const router = express.Router()

// GET /api/rates - Get all rates
router.get('/', async (req, res) => {
  try {
    const result = await query(`
      SELECT * FROM rates
      ORDER BY
        CASE dog_size
          WHEN 'small' THEN 1
          WHEN 'medium' THEN 2
          WHEN 'large' THEN 3
        END,
        CASE rate_type
          WHEN 'regular' THEN 1
          WHEN 'holiday' THEN 2
        END
    `)
    res.json(result.rows)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// GET /api/rates/:id - Get rate by id
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const result = await query('SELECT * FROM rates WHERE id = $1', [id])
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Rate not found' })
    }
    res.json(result.rows[0])
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// PUT /api/rates/:id - Update rate
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const { price_per_day } = req.body

    if (!price_per_day || price_per_day <= 0) {
      return res.status(400).json({ error: 'Invalid price_per_day value' })
    }

    const result = await query(
      `UPDATE rates
       SET price_per_day = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [price_per_day, id]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Rate not found' })
    }

    res.json(result.rows[0])
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

export default router
