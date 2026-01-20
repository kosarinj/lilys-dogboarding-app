import express from 'express'
import { query } from '../models/db.js'

const router = express.Router()

// Helper function to get fees from settings
async function getFees() {
  const result = await query(`SELECT setting_key, setting_value FROM settings WHERE setting_key IN (
    'dropoff_fee', 'pickup_fee',
    'boarding_puppy_fee_regular', 'boarding_puppy_fee_holiday',
    'daycare_puppy_fee_regular', 'daycare_puppy_fee_holiday'
  )`)
  const fees = {}
  result.rows.forEach(row => {
    fees[row.setting_key] = parseFloat(row.setting_value)
  })
  return {
    dropoff: fees.dropoff_fee || 15.00,
    pickup: fees.pickup_fee || 15.00,
    boardingPuppyRegular: fees.boarding_puppy_fee_regular || 0,
    boardingPuppyHoliday: fees.boarding_puppy_fee_holiday || 0,
    daycarePuppyRegular: fees.daycare_puppy_fee_regular || 0,
    daycarePuppyHoliday: fees.daycare_puppy_fee_holiday || 0
  }
}

// Helper function to get puppy fee based on stay type and rate type
function getPuppyFee(fees, stay_type, rate_type) {
  if (stay_type === 'boarding') {
    return rate_type === 'holiday' ? fees.boardingPuppyHoliday : fees.boardingPuppyRegular
  } else {
    return rate_type === 'holiday' ? fees.daycarePuppyHoliday : fees.daycarePuppyRegular
  }
}

// Helper function to calculate daycare rate multiplier based on hours
// 2-7 hours = 50% of daily rate, 8+ hours = 100%
function getDaycareRateMultiplier(stay_type, check_in_time, check_out_time) {
  if (stay_type !== 'daycare' || !check_in_time || !check_out_time) {
    return 1.0 // Default to full rate
  }

  const [inHour, inMin] = check_in_time.split(':').map(Number)
  const [outHour, outMin] = check_out_time.split(':').map(Number)
  const inMinutes = inHour * 60 + inMin
  const outMinutes = outHour * 60 + outMin
  const hours = (outMinutes - inMinutes) / 60

  if (hours >= 8) {
    return 1.0 // Full day rate
  } else if (hours >= 2) {
    return 0.5 // Half day rate
  }
  return 1.0 // Default to full rate for very short stays
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
    const { dog_id, check_in_date, check_out_date, check_in_time, check_out_time, stay_type, rate_type, special_price, special_price_comments, notes, requires_dropoff, requires_pickup, extra_charge, extra_charge_comments, rover, is_puppy, days_count: manual_days_count } = req.body

    // Calculate days from date range
    const checkIn = new Date(check_in_date)
    const checkOut = new Date(check_out_date)
    let calculated_days = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24))

    // If checkout time is after checkin time, add 1 day (staying past normal checkin time)
    if (check_in_time && check_out_time) {
      const [inHour, inMin] = check_in_time.split(':').map(Number)
      const [outHour, outMin] = check_out_time.split(':').map(Number)
      const inMinutes = inHour * 60 + inMin
      const outMinutes = outHour * 60 + outMin

      if (outMinutes > inMinutes) {
        // Checkout time is after checkin time, so add an extra day
        calculated_days += 1
      }
    }

    // For daycare, allow manual days_count override (for non-consecutive days within date range)
    // For boarding, always use calculated days from date range
    let days_count
    if (stay_type === 'daycare') {
      // Use manual days_count if provided, otherwise use calculated
      days_count = manual_days_count ? parseInt(manual_days_count) : calculated_days
      if (days_count === 0) {
        days_count = 1 // Same day counts as 1 day for daycare
      }
    } else {
      // Boarding: always use calculated days (must be consecutive nights)
      days_count = calculated_days
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

    // Get daily rate based on dog size, rate type, and service type
    const rateResult = await query(
      'SELECT price_per_day FROM rates WHERE dog_size = $1 AND rate_type = $2 AND service_type = $3',
      [dog_size, rate_type, stay_type]
    )

    if (rateResult.rows.length === 0) {
      return res.status(404).json({ error: 'Rate not found for this dog size, rate type, and service type' })
    }

    const daily_rate = parseFloat(rateResult.rows[0].price_per_day)

    // Get current fees from settings
    const fees = await getFees()

    // Calculate fees
    // For daycare: multiply fees by days_count (each day needs drop-off/pick-up)
    // For boarding: fees are one-time (single drop-off at start, single pick-up at end)
    const fee_multiplier = stay_type === 'daycare' ? days_count : 1
    const dropoff_fee = requires_dropoff ? fees.dropoff * fee_multiplier : 0
    const pickup_fee = requires_pickup ? fees.pickup * fee_multiplier : 0
    const extra_charge_amount = extra_charge ? parseFloat(extra_charge) : 0

    // Calculate daycare rate multiplier based on hours (2-7 hrs = 50%, 8+ hrs = 100%)
    const daycareRateMultiplier = getDaycareRateMultiplier(stay_type, check_in_time, check_out_time)
    const puppy_fee = is_puppy ? getPuppyFee(fees, stay_type, rate_type) * days_count * daycareRateMultiplier : 0

    console.log('Fee calculation debug:', {
      stay_type,
      days_count,
      fee_multiplier,
      daycareRateMultiplier,
      base_dropoff: fees.dropoff,
      base_pickup: fees.pickup,
      calculated_dropoff_fee: dropoff_fee,
      calculated_pickup_fee: pickup_fee,
      puppy_fee,
      is_puppy,
      requires_dropoff,
      requires_pickup
    })

    // Total cost = (daily rate × days × daycare multiplier) + fees + puppy fee + extra charge
    const boarding_cost = daily_rate * days_count * daycareRateMultiplier
    const total_cost = boarding_cost + dropoff_fee + pickup_fee + puppy_fee + extra_charge_amount

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
      `INSERT INTO stays (dog_id, check_in_date, check_out_date, check_in_time, check_out_time, stay_type, rate_type, days_count, daily_rate, total_cost, special_price, special_price_comments, notes, status, requires_dropoff, requires_pickup, dropoff_fee, pickup_fee, extra_charge, extra_charge_comments, rover, is_puppy, puppy_fee)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23) RETURNING *`,
      [dog_id, check_in_date, check_out_date, check_in_time || null, check_out_time || null, stay_type || 'boarding', rate_type, days_count, daily_rate, final_total, special_price || null, special_price_comments || null, notes, status, requires_dropoff, requires_pickup, dropoff_fee, pickup_fee, extra_charge || null, extra_charge_comments || null, rover || false, is_puppy || false, puppy_fee]
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
    const { dog_id, check_in_date, check_out_date, check_in_time, check_out_time, stay_type, rate_type, special_price, special_price_comments, notes, status, requires_dropoff, requires_pickup, extra_charge, extra_charge_comments, rover, is_puppy, days_count: manual_days_count } = req.body

    // Calculate days from date range
    const checkIn = new Date(check_in_date)
    const checkOut = new Date(check_out_date)
    let calculated_days = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24))

    // If checkout time is after checkin time, add 1 day (staying past normal checkin time)
    if (check_in_time && check_out_time) {
      const [inHour, inMin] = check_in_time.split(':').map(Number)
      const [outHour, outMin] = check_out_time.split(':').map(Number)
      const inMinutes = inHour * 60 + inMin
      const outMinutes = outHour * 60 + outMin

      if (outMinutes > inMinutes) {
        // Checkout time is after checkin time, so add an extra day
        calculated_days += 1
      }
    }

    // For daycare, allow manual days_count override (for non-consecutive days within date range)
    // For boarding, always use calculated days from date range
    let days_count
    if (stay_type === 'daycare') {
      // Use manual days_count if provided, otherwise use calculated
      days_count = manual_days_count ? parseInt(manual_days_count) : calculated_days
      if (days_count === 0) {
        days_count = 1 // Same day counts as 1 day for daycare
      }
    } else {
      // Boarding: always use calculated days (must be consecutive nights)
      days_count = calculated_days
      if (days_count <= 0) {
        return res.status(400).json({ error: 'For boarding, check-out must be after check-in (at least 1 night)' })
      }
    }

    // Get dog size
    const dogResult = await query('SELECT size FROM dogs WHERE id = $1', [dog_id])
    const dog_size = dogResult.rows[0].size

    // Get daily rate based on dog size, rate type, and service type
    const rateResult = await query(
      'SELECT price_per_day FROM rates WHERE dog_size = $1 AND rate_type = $2 AND service_type = $3',
      [dog_size, rate_type, stay_type]
    )

    if (rateResult.rows.length === 0) {
      return res.status(404).json({ error: 'Rate not found for this dog size, rate type, and service type' })
    }

    const daily_rate = parseFloat(rateResult.rows[0].price_per_day)

    // Get current fees from settings
    const fees = await getFees()

    // Calculate fees
    // For daycare: multiply fees by days_count (each day needs drop-off/pick-up)
    // For boarding: fees are one-time (single drop-off at start, single pick-up at end)
    const fee_multiplier = stay_type === 'daycare' ? days_count : 1
    const dropoff_fee = requires_dropoff ? fees.dropoff * fee_multiplier : 0
    const pickup_fee = requires_pickup ? fees.pickup * fee_multiplier : 0
    const extra_charge_amount = extra_charge ? parseFloat(extra_charge) : 0

    // Calculate daycare rate multiplier based on hours (2-7 hrs = 50%, 8+ hrs = 100%)
    const daycareRateMultiplier = getDaycareRateMultiplier(stay_type, check_in_time, check_out_time)
    const puppy_fee = is_puppy ? getPuppyFee(fees, stay_type, rate_type) * days_count * daycareRateMultiplier : 0

    console.log('Fee calculation debug (UPDATE):', {
      stay_type,
      days_count,
      fee_multiplier,
      daycareRateMultiplier,
      base_dropoff: fees.dropoff,
      base_pickup: fees.pickup,
      calculated_dropoff_fee: dropoff_fee,
      calculated_pickup_fee: pickup_fee,
      puppy_fee,
      is_puppy,
      requires_dropoff,
      requires_pickup
    })

    // Total cost = (daily rate × days × daycare multiplier) + fees + puppy fee + extra charge
    const boarding_cost = daily_rate * days_count * daycareRateMultiplier
    const calculated_total = boarding_cost + dropoff_fee + pickup_fee + puppy_fee + extra_charge_amount

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
           dropoff_fee = $17, pickup_fee = $18, extra_charge = $19, extra_charge_comments = $20, rover = $21,
           is_puppy = $22, puppy_fee = $23, updated_at = CURRENT_TIMESTAMP
       WHERE id = $24 RETURNING *`,
      [dog_id, check_in_date, check_out_date, check_in_time || null, check_out_time || null, stay_type || 'boarding', rate_type, days_count, daily_rate, final_total, special_price || null, special_price_comments || null, notes, status, requires_dropoff, requires_pickup, dropoff_fee, pickup_fee, extra_charge || null, extra_charge_comments || null, rover || false, is_puppy || false, puppy_fee, id]
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

// POST /api/stays/migrate - Add missing columns to stays table
router.post('/migrate', async (req, res) => {
  try {
    const migrations = [
      { column: 'is_puppy', type: 'BOOLEAN DEFAULT false' },
      { column: 'puppy_fee', type: 'DECIMAL(10,2) DEFAULT 0' }
    ]

    let added = []
    let existing = []

    for (const migration of migrations) {
      const columnCheck = await query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'stays' AND column_name = $1
      `, [migration.column])

      if (columnCheck.rows.length === 0) {
        await query(`ALTER TABLE stays ADD COLUMN ${migration.column} ${migration.type}`)
        added.push(migration.column)
        console.log(`Added column: ${migration.column}`)
      } else {
        existing.push(migration.column)
      }
    }

    res.json({
      success: true,
      message: `Migration complete: ${added.length} columns added, ${existing.length} already existed`,
      added,
      existing
    })
  } catch (error) {
    console.error('Migration error:', error)
    res.status(500).json({ error: error.message })
  }
})

export default router
