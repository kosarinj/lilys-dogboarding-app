import express from 'express'
import { query } from '../models/db.js'

const router = express.Router()

// Helper function to get fees from settings
async function getFees() {
  const result = await query('SELECT setting_key, setting_value FROM settings WHERE setting_key IN ($1, $2)', ['dropoff_fee', 'pickup_fee'])
  const fees = {}
  result.rows.forEach(row => {
    fees[row.setting_key] = parseFloat(row.setting_value)
  })
  return {
    dropoff: fees.dropoff_fee || 15.00,
    pickup: fees.pickup_fee || 15.00
  }
}

// GET /api/stays
router.get('/', async (req, res) => {
  try {
    const result = await query(`
      SELECT s.*, d.name as dog_name, d.size as dog_size, d.photo_url as dog_photo_url,
             c.name as customer_name, c.phone as customer_phone
      FROM stays s
      JOIN dogs d ON s.dog_id = d.id
      JOIN customers c ON d.customer_id = c.id
      ORDER BY s.check_in_date DESC
    `)
    res.json(result.rows)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// GET /api/stays/:id
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const result = await query(`
      SELECT s.*, d.name as dog_name, d.size as dog_size, d.photo_url as dog_photo_url,
             c.name as customer_name, c.phone as customer_phone
      FROM stays s
      JOIN dogs d ON s.dog_id = d.id
      JOIN customers c ON d.customer_id = c.id
      WHERE s.id = $1
    `, [id])
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Stay not found' })
    }
    res.json(result.rows[0])
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// POST /api/stays
router.post('/', async (req, res) => {
  try {
    const { dog_id, check_in_date, check_out_date, rate_type, notes, requires_dropoff, requires_pickup } = req.body

    // Calculate days
    const checkIn = new Date(check_in_date)
    const checkOut = new Date(check_out_date)
    const days_count = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24))

    if (days_count <= 0) {
      return res.status(400).json({ error: 'Check-out must be after check-in' })
    }

    // Get dog size to determine rate
    const dogResult = await query('SELECT size FROM dogs WHERE id = $1', [dog_id])
    if (dogResult.rows.length === 0) {
      return res.status(404).json({ error: 'Dog not found' })
    }
    const dog_size = dogResult.rows[0].size

    // Get daily rate
    const rateResult = await query(
      'SELECT price_per_day FROM rates WHERE dog_size = $1 AND rate_type = $2',
      [dog_size, rate_type]
    )

    if (rateResult.rows.length === 0) {
      return res.status(404).json({ error: 'Rate not found for this dog size and rate type' })
    }

    const daily_rate = parseFloat(rateResult.rows[0].price_per_day)

    // Get current fees from settings
    const fees = await getFees()

    // Calculate fees
    const dropoff_fee = requires_dropoff ? fees.dropoff : 0
    const pickup_fee = requires_pickup ? fees.pickup : 0

    // Total cost = (daily rate × days) + dropoff fee + pickup fee
    const boarding_cost = daily_rate * days_count
    const total_cost = boarding_cost + dropoff_fee + pickup_fee

    // Determine status based on dates
    const now = new Date()
    let status = 'upcoming'
    if (checkIn <= now && checkOut >= now) {
      status = 'active'
    } else if (checkOut < now) {
      status = 'completed'
    }

    const result = await query(
      `INSERT INTO stays (dog_id, check_in_date, check_out_date, rate_type, days_count, daily_rate, total_cost, notes, status, requires_dropoff, requires_pickup, dropoff_fee, pickup_fee)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
      [dog_id, check_in_date, check_out_date, rate_type, days_count, daily_rate, total_cost, notes, status, requires_dropoff, requires_pickup, dropoff_fee, pickup_fee]
    )

    res.status(201).json(result.rows[0])
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// PUT /api/stays/:id
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const { dog_id, check_in_date, check_out_date, rate_type, notes, status, requires_dropoff, requires_pickup } = req.body

    // Calculate days
    const checkIn = new Date(check_in_date)
    const checkOut = new Date(check_out_date)
    const days_count = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24))

    // Get dog size
    const dogResult = await query('SELECT size FROM dogs WHERE id = $1', [dog_id])
    const dog_size = dogResult.rows[0].size

    // Get daily rate
    const rateResult = await query(
      'SELECT price_per_day FROM rates WHERE dog_size = $1 AND rate_type = $2',
      [dog_size, rate_type]
    )
    const daily_rate = parseFloat(rateResult.rows[0].price_per_day)

    // Get current fees from settings
    const fees = await getFees()

    // Calculate fees
    const dropoff_fee = requires_dropoff ? fees.dropoff : 0
    const pickup_fee = requires_pickup ? fees.pickup : 0

    // Total cost = (daily rate × days) + dropoff fee + pickup fee
    const boarding_cost = daily_rate * days_count
    const total_cost = boarding_cost + dropoff_fee + pickup_fee

    const result = await query(
      `UPDATE stays
       SET dog_id = $1, check_in_date = $2, check_out_date = $3, rate_type = $4,
           days_count = $5, daily_rate = $6, total_cost = $7, notes = $8, status = $9,
           requires_dropoff = $10, requires_pickup = $11, dropoff_fee = $12, pickup_fee = $13,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $14 RETURNING *`,
      [dog_id, check_in_date, check_out_date, rate_type, days_count, daily_rate, total_cost, notes, status, requires_dropoff, requires_pickup, dropoff_fee, pickup_fee, id]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Stay not found' })
    }
    res.json(result.rows[0])
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// DELETE /api/stays/:id
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const result = await query('DELETE FROM stays WHERE id = $1 RETURNING *', [id])
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Stay not found' })
    }
    res.json({ message: 'Stay deleted successfully' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

export default router
