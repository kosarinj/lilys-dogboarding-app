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

// POST /api/rates/initialize - Initialize all missing rates
router.post('/initialize', async (req, res) => {
  try {
    const sizes = ['small', 'medium', 'large']
    const rateTypes = ['regular', 'holiday']
    const serviceTypes = ['boarding', 'daycare']

    // Default prices (can be adjusted)
    const defaultPrices = {
      boarding: {
        small: { regular: 40.00, holiday: 60.00 },
        medium: { regular: 50.00, holiday: 75.00 },
        large: { regular: 60.00, holiday: 90.00 }
      },
      daycare: {
        small: { regular: 30.00, holiday: 45.00 },
        medium: { regular: 35.00, holiday: 52.50 },
        large: { regular: 40.00, holiday: 60.00 }
      }
    }

    let created = 0
    let existing = 0

    for (const serviceType of serviceTypes) {
      for (const size of sizes) {
        for (const rateType of rateTypes) {
          // Check if rate already exists
          const checkResult = await query(
            'SELECT id FROM rates WHERE dog_size = $1 AND rate_type = $2 AND service_type = $3',
            [size, rateType, serviceType]
          )

          if (checkResult.rows.length === 0) {
            // Create the rate
            const price = defaultPrices[serviceType][size][rateType]
            await query(
              `INSERT INTO rates (dog_size, rate_type, service_type, price_per_day)
               VALUES ($1, $2, $3, $4)`,
              [size, rateType, serviceType, price]
            )
            created++
          } else {
            existing++
          }
        }
      }
    }

    res.json({
      success: true,
      message: `Initialized rates: ${created} created, ${existing} already existed`,
      created,
      existing
    })
  } catch (error) {
    console.error('Error initializing rates:', error)
    res.status(500).json({ error: error.message })
  }
})

export default router
