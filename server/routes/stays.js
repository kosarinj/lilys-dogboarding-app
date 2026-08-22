import express from 'express'
import { query } from '../models/db.js'
import { checkAvailability } from '../services/availability.js'
import { capturePaymentIntent, cancelPaymentIntent } from '../services/stripe.js'
// Same generator as the booking codes: one alphabet, chosen so codes read
// cleanly over the phone.
import { generateBookingCode } from '../utils/bookingCode.js'
import { toDateStr, todayStr } from '../utils/dates.js'

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

// Helper function to calculate partial day addition based on checkout time vs checkin time
// If checkout is past checkin time: 2-7 hrs = +0.5 day, 8+ hrs = +1 day
function getPartialDayAddition(check_in_time, check_out_time) {
  if (!check_in_time || !check_out_time) {
    return 0 // No partial day if times not specified
  }

  const [inHour, inMin] = check_in_time.split(':').map(Number)
  const [outHour, outMin] = check_out_time.split(':').map(Number)
  const inMinutes = inHour * 60 + inMin
  const outMinutes = outHour * 60 + outMin
  const hours = (outMinutes - inMinutes) / 60

  // If checkout is before or at checkin time, no extra partial day
  if (hours <= 0) {
    return 0
  }

  if (hours >= 8) {
    return 1.0 // Full extra day
  } else if (hours >= 2) {
    return 0.5 // Half day
  }
  return 0 // Less than 2 hours, no extra charge
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

    // Calculate base days from date range
    const checkIn = new Date(check_in_date)
    const checkOut = new Date(check_out_date)
    let base_days = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24))

    // Add partial day if checkout time is past checkin time
    // 2-7 hours past = +0.5 day, 8+ hours past = +1 day
    const partial_day = getPartialDayAddition(check_in_time, check_out_time)

    // For daycare, allow manual days_count override (for non-consecutive days within date range)
    // For boarding, always use calculated days from date range
    let days_count
    if (stay_type === 'daycare') {
      // Use manual days_count if provided, otherwise use calculated
      if (manual_days_count) {
        days_count = parseInt(manual_days_count)
      } else {
        days_count = Math.max(base_days + partial_day, partial_day > 0 ? partial_day : 1)
      }
    } else {
      // Boarding: base days + partial day for checkout past checkin time
      days_count = base_days + partial_day
      if (days_count <= 0) {
        days_count = partial_day > 0 ? partial_day : 0
        if (days_count <= 0) {
          return res.status(400).json({ error: 'For boarding, check-out must be after check-in' })
        }
      }
    }

    // Get dog size and custom rate/fee overrides
    const dogResult = await query('SELECT size, custom_daily_rate, pickup_fee_override, dropoff_fee_override FROM dogs WHERE id = $1', [dog_id])
    if (dogResult.rows.length === 0) {
      return res.status(404).json({ error: 'Dog not found' })
    }
    const dog_size = dogResult.rows[0].size
    const dog_custom_daily_rate = dogResult.rows[0].custom_daily_rate
    const dog_pickup_fee_override = dogResult.rows[0].pickup_fee_override
    const dog_dropoff_fee_override = dogResult.rows[0].dropoff_fee_override

    // Use custom daily rate from dog if set, otherwise look up by size/type
    let daily_rate
    if (dog_custom_daily_rate != null) {
      daily_rate = parseFloat(dog_custom_daily_rate)
    } else {
      const rateResult = await query(
        'SELECT price_per_day FROM rates WHERE dog_size = $1 AND rate_type = $2 AND service_type = $3',
        [dog_size, rate_type, stay_type]
      )

      if (rateResult.rows.length === 0) {
        return res.status(404).json({ error: 'Rate not found for this dog size, rate type, and service type' })
      }

      daily_rate = parseFloat(rateResult.rows[0].price_per_day)
    }

    // Get current fees from settings
    const fees = await getFees()

    // Calculate fees — use dog-level overrides if set, otherwise use global settings
    // For daycare: multiply fees by days_count (each day needs drop-off/pick-up)
    // For boarding: fees are one-time (single drop-off at start, single pick-up at end)
    const fee_multiplier = stay_type === 'daycare' ? Math.ceil(days_count) : 1
    const dropoff_rate = dog_dropoff_fee_override != null ? parseFloat(dog_dropoff_fee_override) : fees.dropoff
    const pickup_rate = dog_pickup_fee_override != null ? parseFloat(dog_pickup_fee_override) : fees.pickup
    const dropoff_fee = requires_dropoff ? dropoff_rate * fee_multiplier : 0
    const pickup_fee = requires_pickup ? pickup_rate * fee_multiplier : 0
    const extra_charge_amount = extra_charge ? parseFloat(extra_charge) : 0

    // Puppy fee based on total days (including partial)
    const puppy_fee = is_puppy ? getPuppyFee(fees, stay_type, rate_type) * days_count : 0

    console.log('Fee calculation debug:', {
      stay_type,
      base_days,
      partial_day,
      days_count,
      fee_multiplier,
      base_dropoff: fees.dropoff,
      base_pickup: fees.pickup,
      calculated_dropoff_fee: dropoff_fee,
      calculated_pickup_fee: pickup_fee,
      puppy_fee,
      is_puppy,
      requires_dropoff,
      requires_pickup
    })

    // Total cost = (daily rate × days including partial) + fees + puppy fee + extra charge
    const boarding_cost = daily_rate * days_count
    const total_cost = boarding_cost + dropoff_fee + pickup_fee + puppy_fee + extra_charge_amount

    // Determine status based on dates
    const now = new Date()
    let status = 'upcoming'
    if (checkIn <= now && checkOut >= now) {
      status = 'active'
    } else if (checkOut < now) {
      status = 'completed'
    }

    // special_price overrides only the boarding cost; fees are always added on top
    let final_total = special_price
      ? parseFloat(special_price) + dropoff_fee + pickup_fee + puppy_fee + extra_charge_amount
      : total_cost

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

    // Calculate base days from date range
    const checkIn = new Date(check_in_date)
    const checkOut = new Date(check_out_date)
    let base_days = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24))

    // Add partial day if checkout time is past checkin time
    // 2-7 hours past = +0.5 day, 8+ hours past = +1 day
    const partial_day = getPartialDayAddition(check_in_time, check_out_time)

    // For daycare, allow manual days_count override (for non-consecutive days within date range)
    // For boarding, always use calculated days from date range
    let days_count
    if (stay_type === 'daycare') {
      // Use manual days_count if provided, otherwise use calculated
      if (manual_days_count) {
        days_count = parseInt(manual_days_count)
      } else {
        days_count = Math.max(base_days + partial_day, partial_day > 0 ? partial_day : 1)
      }
    } else {
      // Boarding: base days + partial day for checkout past checkin time
      days_count = base_days + partial_day
      if (days_count <= 0) {
        days_count = partial_day > 0 ? partial_day : 0
        if (days_count <= 0) {
          return res.status(400).json({ error: 'For boarding, check-out must be after check-in' })
        }
      }
    }

    // Get dog size and custom rate/fee overrides
    const dogResult = await query('SELECT size, custom_daily_rate, pickup_fee_override, dropoff_fee_override FROM dogs WHERE id = $1', [dog_id])
    const dog_size = dogResult.rows[0].size
    const dog_custom_daily_rate = dogResult.rows[0].custom_daily_rate
    const dog_pickup_fee_override = dogResult.rows[0].pickup_fee_override
    const dog_dropoff_fee_override = dogResult.rows[0].dropoff_fee_override

    // Use custom daily rate from dog if set, otherwise look up by size/type
    let daily_rate
    if (dog_custom_daily_rate != null) {
      daily_rate = parseFloat(dog_custom_daily_rate)
    } else {
      const rateResult = await query(
        'SELECT price_per_day FROM rates WHERE dog_size = $1 AND rate_type = $2 AND service_type = $3',
        [dog_size, rate_type, stay_type]
      )

      if (rateResult.rows.length === 0) {
        return res.status(404).json({ error: 'Rate not found for this dog size, rate type, and service type' })
      }

      daily_rate = parseFloat(rateResult.rows[0].price_per_day)
    }

    // Get current fees from settings
    const fees = await getFees()

    // Calculate fees — use dog-level overrides if set, otherwise use global settings
    // For daycare: multiply fees by days_count (each day needs drop-off/pick-up)
    // For boarding: fees are one-time (single drop-off at start, single pick-up at end)
    const fee_multiplier = stay_type === 'daycare' ? Math.ceil(days_count) : 1
    const dropoff_rate = dog_dropoff_fee_override != null ? parseFloat(dog_dropoff_fee_override) : fees.dropoff
    const pickup_rate = dog_pickup_fee_override != null ? parseFloat(dog_pickup_fee_override) : fees.pickup
    const dropoff_fee = requires_dropoff ? dropoff_rate * fee_multiplier : 0
    const pickup_fee = requires_pickup ? pickup_rate * fee_multiplier : 0
    const extra_charge_amount = extra_charge ? parseFloat(extra_charge) : 0

    // Puppy fee based on total days (including partial)
    const puppy_fee = is_puppy ? getPuppyFee(fees, stay_type, rate_type) * days_count : 0

    console.log('Fee calculation debug (UPDATE):', {
      stay_type,
      base_days,
      partial_day,
      days_count,
      fee_multiplier,
      base_dropoff: fees.dropoff,
      base_pickup: fees.pickup,
      calculated_dropoff_fee: dropoff_fee,
      calculated_pickup_fee: pickup_fee,
      puppy_fee,
      is_puppy,
      requires_dropoff,
      requires_pickup
    })

    // Total cost = (daily rate × days including partial) + fees + puppy fee + extra charge
    const boarding_cost = daily_rate * days_count
    const calculated_total = boarding_cost + dropoff_fee + pickup_fee + puppy_fee + extra_charge_amount

    // special_price overrides only the boarding cost; fees are always added on top
    let final_total = special_price
      ? parseFloat(special_price) + dropoff_fee + pickup_fee + puppy_fee + extra_charge_amount
      : calculated_total

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

/**
 * POST /api/stays/:id/payment-link
 *
 * She books the stay herself and sends the customer a link to pay — the other
 * direction from self-booking, for the people who'd rather she just sorted it
 * out. Saves them the whole booking flow while still getting paid up front.
 *
 * Deliberately reuses bills rather than inventing a second way to owe money:
 * the guest bill page, the card button, the payment record and the paid/unpaid
 * accounting all already exist and are already proven. This is a shortcut
 * through them, not a parallel path.
 *
 * Idempotent — if the stay is already on a bill, it hands back that bill's link
 * instead of raising a second one for the same nights.
 */
router.post('/:id/payment-link', async (req, res) => {
  try {
    const { id } = req.params

    const existing = await query(`
      SELECT b.bill_code FROM bill_items bi JOIN bills b ON bi.bill_id = b.id
      WHERE bi.stay_id = $1 AND b.status <> 'cancelled' LIMIT 1
    `, [id])
    if (existing.rows.length > 0) {
      return res.json({ billCode: existing.rows[0].bill_code, link: billLink(existing.rows[0].bill_code), reused: true })
    }

    const stayResult = await query(`
      SELECT s.*, d.name AS dog_name, d.customer_id, c.name AS customer_name
      FROM stays s JOIN dogs d ON s.dog_id = d.id JOIN customers c ON d.customer_id = c.id
      WHERE s.id = $1
    `, [id])
    if (stayResult.rows.length === 0) return res.status(404).json({ error: 'Stay not found' })
    const stay = stayResult.rows[0]

    if (stay.status === 'requested') {
      return res.status(400).json({ error: 'Approve this request first, then send a payment link.' })
    }

    const total = Number(stay.special_price != null ? stay.special_price : stay.total_cost)

    let code = generateBookingCode()
    for (let i = 0; i < 5; i++) {
      const clash = await query('SELECT id FROM bills WHERE bill_code = $1', [code])
      if (clash.rows.length === 0) break
      code = generateBookingCode()
    }

    const bill = await query(`
      INSERT INTO bills (customer_id, bill_code, bill_date, due_date, subtotal, tax, total_amount, paid_amount, status, notes)
      VALUES ($1, $2, CURRENT_DATE, $3, $4, 0, $4, 0, 'sent', $5)
      RETURNING id, bill_code
    `, [
      stay.customer_id, code,
      toDateStr(stay.check_in_date),   // due before the stay starts — the point is paying up front
      total,
      `Advance payment for ${stay.dog_name}`,
    ])

    await query(`
      INSERT INTO bill_items (bill_id, stay_id, description, quantity, unit_price, total_price)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [
      bill.rows[0].id, stay.id,
      `${stay.dog_name} — ${toDateStr(stay.check_in_date)} to ${toDateStr(stay.check_out_date)}`,
      Math.max(1, Math.ceil(Number(stay.days_count) || 1)),
      Number(stay.daily_rate) || total,
      total,
    ])

    res.json({ billCode: bill.rows[0].bill_code, link: billLink(bill.rows[0].bill_code), reused: false })
  } catch (e) {
    console.error('Payment link error:', e.message)
    res.status(500).json({ error: e.message })
  }
})

const billLink = (code) =>
  `${process.env.CLIENT_URL || process.env.PUBLIC_URL || 'http://localhost:5173'}/bill/${code}`


// ─── Booking requests ────────────────────────────────────────────────────────
// A request is a stay with status 'requested'. Approving it makes it an ordinary
// upcoming stay, so bills, the calendar and analytics need no changes.

// Everything waiting on her, oldest first — this is a queue, so the person who
// asked first should be dealt with first.
router.get('/requests/pending', async (req, res) => {
  try {
    const r = await query(`
      SELECT s.*, d.name AS dog_name, d.size AS dog_size, d.photo_url AS dog_photo_url,
             c.id AS customer_id, c.name AS customer_name, c.phone AS customer_phone, c.email AS customer_email
      FROM stays s
      JOIN dogs d ON s.dog_id = d.id
      JOIN customers c ON d.customer_id = c.id
      WHERE s.status = 'requested'
      ORDER BY s.requested_at ASC NULLS LAST, s.id ASC
    `)
    res.json(r.rows)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// Approve: take the held money, then confirm. In that order deliberately — if
// the capture fails (an authorization older than about 7 days has expired), the
// stay stays a request rather than becoming a confirmed booking nobody paid for.
router.post('/requests/:id/approve', async (req, res) => {
  try {
    const { id } = req.params
    const r = await query(`SELECT * FROM stays WHERE id = $1 AND status = 'requested'`, [id])
    if (r.rows.length === 0) return res.status(404).json({ error: 'Request not found' })
    const stay = r.rows[0]

    let paymentNote = null
    if (stay.payment_intent_id && stay.payment_state === 'authorized') {
      try {
        await capturePaymentIntent(stay.payment_intent_id)
        await query(`UPDATE stays SET payment_state = 'captured' WHERE id = $1`, [id])
        paymentNote = 'Card charged.'
      } catch (e) {
        await query(`UPDATE stays SET payment_state = 'expired' WHERE id = $1`, [id])
        return res.status(402).json({
          error: `Could not take the payment: ${e.message}. The hold may have expired — ask them to pay again.`,
        })
      }
    }

    // Re-check capacity at the moment of approval. Requests are counted as
    // occupying space, but she can also add stays by hand, so the picture may
    // have changed since the request came in.
    const avail = await checkAvailability(
      toDateStr(stay.check_in_date),
      toDateStr(stay.check_out_date),
      { excludeStayId: Number(id) }
    )
    if (!avail.available) {
      paymentNote = (paymentNote ? paymentNote + ' ' : '') +
        `Note: now over capacity on ${avail.fullNights.join(', ')}.`
    }

    const status = toDateStr(stay.check_in_date) <= todayStr() ? 'active' : 'upcoming'
    await query(
      `UPDATE stays SET status = $2::stay_status, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [id, status]
    )
    res.json({ success: true, status, note: paymentNote })
  } catch (e) {
    console.error('Approve error:', e.message)
    res.status(500).json({ error: e.message })
  }
})

// Decline: release the hold so they're never out of pocket, and keep the reason.
router.post('/requests/:id/decline', async (req, res) => {
  try {
    const { id } = req.params
    const { reason } = req.body || {}
    const r = await query(`SELECT * FROM stays WHERE id = $1 AND status = 'requested'`, [id])
    if (r.rows.length === 0) return res.status(404).json({ error: 'Request not found' })
    const stay = r.rows[0]

    if (stay.payment_intent_id && stay.payment_state === 'authorized') {
      try {
        await cancelPaymentIntent(stay.payment_intent_id)
        await query(`UPDATE stays SET payment_state = 'released' WHERE id = $1`, [id])
      } catch (e) {
        // Don't block the decline on this. An uncancelled authorization expires
        // by itself; refusing to decline would leave the dates blocked.
        console.error('Could not release hold:', e.message)
      }
    }

    await query(`
      UPDATE stays SET status = 'cancelled', decline_reason = $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [id, reason ? String(reason).slice(0, 500) : null])
    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

export default router
