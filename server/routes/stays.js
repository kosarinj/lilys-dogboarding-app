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

    // Update status based on current date
    const now = new Date()
    const stays = result.rows.map(stay => {
      const checkIn = new Date(stay.check_in_date)
      const checkOut = new Date(stay.check_out_date)

      let status = 'upcoming'
      if (checkIn <= now && checkOut >= now) {
        status = 'active'
      } else if (checkOut < now) {
        status = 'completed'
      }

      return { ...stay, status }
    })

    res.json(stays)
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

    // Update status based on current date
    const stay = result.rows[0]
    const now = new Date()
    const checkIn = new Date(stay.check_in_date)
    const checkOut = new Date(stay.check_out_date)

    let status = 'upcoming'
    if (checkIn <= now && checkOut >= now) {
      status = 'active'
    } else if (checkOut < now) {
      status = 'completed'
    }

    res.json({ ...stay, status })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// POST /api/stays
router.post('/', async (req, res) => {
  try {
    const { dog_id, check_in_date, check_out_date, check_in_time, check_out_time, stay_type, rate_type, special_price, special_price_comments, notes, requires_dropoff, requires_pickup, extra_charge, extra_charge_comments, rover } = req.body

    // Calculate days
    const checkIn = new Date(check_in_date)
    const checkOut = new Date(check_out_date)
    let days_count = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24))

    // If checkout time is after checkin time, add 1 day (staying past normal checkin time)
    if (check_in_time && check_out_time) {
      const [inHour, inMin] = check_in_time.split(':').map(Number)
      const [outHour, outMin] = check_out_time.split(':').map(Number)
      const inMinutes = inHour * 60 + inMin
      const outMinutes = outHour * 60 + outMin

      if (outMinutes > inMinutes) {
        // Checkout time is after checkin time, so add an extra day
        days_count += 1
      }
    }

    // For daycare, same-day check-in/check-out is allowed (counts as 1 day)
    // For boarding, check-out must be after check-in (at least 1 night)
    if (stay_type === 'daycare') {
      if (days_count === 0) {
        days_count = 1 // Same day counts as 1 day for daycare
      }
    } else {
      // Boarding requires at least 1 night
      if (days_count <= 0) {
        return res.status(400).json({ error: 'For boarding, check-out must be after check-in (at least 1 night)' })
      }
    }

    // Get dog size to determine rate
    const dogResult = await query('SELECT size FROM dogs WHERE id = $1', [dog_id])
    if (dogResult.rows.length === 0) {
      return res.status(404).json({ error: 'Dog not found' })
    }
    const dog_size = dogResult.rows[0].size

    // Get daily rate based on dog size and rate type
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
    const extra_charge_amount = extra_charge ? parseFloat(extra_charge) : 0

    // Total cost = (daily rate × days) + dropoff fee + pickup fee + extra charge
    const boarding_cost = daily_rate * days_count
    const total_cost = boarding_cost + dropoff_fee + pickup_fee + extra_charge_amount

    // Determine status based on dates
    const now = new Date()
    let status = 'upcoming'
    if (checkIn <= now && checkOut >= now) {
      status = 'active'
    } else if (checkOut < now) {
      status = 'completed'
    }

    // Use special_price if provided, otherwise use calculated total_cost
    let final_total = special_price ? parseFloat(special_price) : total_cost

    // Apply 20% Rover discount if checked
    if (rover) {
      final_total = final_total * 0.8
    }

    const result = await query(
      `INSERT INTO stays (dog_id, check_in_date, check_out_date, check_in_time, check_out_time, stay_type, rate_type, days_count, daily_rate, total_cost, special_price, special_price_comments, notes, status, requires_dropoff, requires_pickup, dropoff_fee, pickup_fee, extra_charge, extra_charge_comments, rover)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21) RETURNING *`,
      [dog_id, check_in_date, check_out_date, check_in_time || null, check_out_time || null, stay_type || 'boarding', rate_type, days_count, daily_rate, final_total, special_price || null, special_price_comments || null, notes, status, requires_dropoff, requires_pickup, dropoff_fee, pickup_fee, extra_charge || null, extra_charge_comments || null, rover || false]
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
    const { dog_id, check_in_date, check_out_date, check_in_time, check_out_time, stay_type, rate_type, special_price, special_price_comments, notes, status, requires_dropoff, requires_pickup, extra_charge, extra_charge_comments, rover } = req.body

    // Calculate days
    const checkIn = new Date(check_in_date)
    const checkOut = new Date(check_out_date)
    let days_count = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24))

    // If checkout time is after checkin time, add 1 day (staying past normal checkin time)
    if (check_in_time && check_out_time) {
      const [inHour, inMin] = check_in_time.split(':').map(Number)
      const [outHour, outMin] = check_out_time.split(':').map(Number)
      const inMinutes = inHour * 60 + inMin
      const outMinutes = outHour * 60 + outMin

      if (outMinutes > inMinutes) {
        // Checkout time is after checkin time, so add an extra day
        days_count += 1
      }
    }

    // For daycare, same-day check-in/check-out is allowed (counts as 1 day)
    // For boarding, check-out must be after check-in (at least 1 night)
    if (stay_type === 'daycare') {
      if (days_count === 0) {
        days_count = 1 // Same day counts as 1 day for daycare
      }
    } else {
      // Boarding requires at least 1 night
      if (days_count <= 0) {
        return res.status(400).json({ error: 'For boarding, check-out must be after check-in (at least 1 night)' })
      }
    }

    // Get dog size
    const dogResult = await query('SELECT size FROM dogs WHERE id = $1', [dog_id])
    const dog_size = dogResult.rows[0].size

    // Get daily rate based on dog size and rate type
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
    const extra_charge_amount = extra_charge ? parseFloat(extra_charge) : 0

    // Total cost = (daily rate × days) + dropoff fee + pickup fee + extra charge
    const boarding_cost = daily_rate * days_count
    const calculated_total = boarding_cost + dropoff_fee + pickup_fee + extra_charge_amount

    // Use special_price if provided, otherwise use calculated total_cost
    let final_total = special_price ? parseFloat(special_price) : calculated_total

    // Apply 20% Rover discount if checked
    if (rover) {
      final_total = final_total * 0.8
    }

    const result = await query(
      `UPDATE stays
       SET dog_id = $1, check_in_date = $2, check_out_date = $3, check_in_time = $4, check_out_time = $5,
           stay_type = $6, rate_type = $7, days_count = $8, daily_rate = $9, total_cost = $10,
           special_price = $11, special_price_comments = $12, notes = $13, status = $14, requires_dropoff = $15, requires_pickup = $16,
           dropoff_fee = $17, pickup_fee = $18, extra_charge = $19, extra_charge_comments = $20, rover = $21, updated_at = CURRENT_TIMESTAMP
       WHERE id = $22 RETURNING *`,
      [dog_id, check_in_date, check_out_date, check_in_time || null, check_out_time || null, stay_type || 'boarding', rate_type, days_count, daily_rate, final_total, special_price || null, special_price_comments || null, notes, status, requires_dropoff, requires_pickup, dropoff_fee, pickup_fee, extra_charge || null, extra_charge_comments || null, rover || false, id]
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
