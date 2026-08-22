import express from 'express'
import { query } from '../models/db.js'
import { checkAvailability, getBookingRules, sizeAllowed } from '../services/availability.js'
import { quoteStay } from '../services/pricing.js'
import { isStripeEnabled, createBookingCheckoutSession } from '../services/stripe.js'

const router = express.Router()

/**
 * Customer self-booking. Public, but reachable only with a booking code.
 *
 * There is no signup. Lily hands the link to people she already boards for,
 * which is the whole access model — the same approach as the guest bill page,
 * and the reason a stranger can't get in. A code that isn't recognised looks
 * identical to one that is wrong, so the endpoint can't be used to discover
 * whether a customer exists.
 *
 * Nothing here confirms anything. A request is a stay with status 'requested';
 * only Lily turns it into a booking.
 */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

async function customerByCode(code) {
  const r = await query(
    `SELECT id, name, phone, email FROM customers WHERE booking_code = $1`,
    [String(code || '').toUpperCase()]
  )
  return r.rows[0] || null
}

// What the booking page needs to render: who they are, their dogs, the rules.
router.get('/:code', async (req, res) => {
  try {
    const customer = await customerByCode(req.params.code)
    if (!customer) return res.status(404).json({ error: 'Booking link not recognised' })

    const rules = await getBookingRules()
    const dogsResult = await query(
      `SELECT id, name, breed, size, photo_url FROM dogs WHERE customer_id = $1 ORDER BY name`,
      [customer.id]
    )
    // Dogs she won't take online are still listed, marked and disabled, rather
    // than hidden — a missing dog reads as the app being broken, and "call me
    // about Bruno" is a better outcome than silence.
    const dogs = dogsResult.rows.map(d => ({
      ...d,
      bookable: sizeAllowed(d.size, rules.maxSizeRank),
    }))

    const upcoming = await query(`
      SELECT s.id, s.check_in_date, s.check_out_date, s.status, s.total_cost, d.name AS dog_name
      FROM stays s JOIN dogs d ON s.dog_id = d.id
      WHERE d.customer_id = $1 AND s.check_out_date >= CURRENT_DATE
        AND s.status IN ('requested', 'upcoming', 'active')
      ORDER BY s.check_in_date
    `, [customer.id])

    res.json({
      customer: { name: customer.name, email: customer.email, phone: customer.phone },
      dogs,
      upcoming: upcoming.rows,
      rules: { maxPerNight: rules.maxPerNight },
      cardPayments: isStripeEnabled(),
    })
  } catch (e) {
    console.error('Booking lookup error:', e.message)
    res.status(500).json({ error: e.message })
  }
})

/**
 * Which nights in a window are already full, so the page can grey them out
 * instead of letting someone pick dates and then refusing them.
 */
router.get('/:code/availability', async (req, res) => {
  try {
    const customer = await customerByCode(req.params.code)
    if (!customer) return res.status(404).json({ error: 'Booking link not recognised' })

    const { from, to } = req.query
    if (!DATE_RE.test(from || '') || !DATE_RE.test(to || '')) {
      return res.status(400).json({ error: 'from and to must be YYYY-MM-DD' })
    }
    const result = await checkAvailability(from, to)
    res.json({
      maxPerNight: result.maxPerNight,
      counts: result.counts,       // night -> dogs already booked
      fullNights: result.fullNights,
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// A price before committing to anything.
router.post('/:code/quote', async (req, res) => {
  try {
    const customer = await customerByCode(req.params.code)
    if (!customer) return res.status(404).json({ error: 'Booking link not recognised' })
    const quote = await buildQuote(customer, req.body)
    if (quote.error) return res.status(quote.status || 400).json({ error: quote.error })
    res.json(quote)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

/**
 * Make the request.
 *
 * Creates the stay as 'requested' and, when cards are on, returns a Checkout
 * URL that AUTHORIZES the card without charging it. The money is committed but
 * not taken, so declining costs the customer nothing — better than charging and
 * refunding, and it means Lily never approves a stay that turns out to be
 * unfunded.
 */
router.post('/:code/request', async (req, res) => {
  try {
    const customer = await customerByCode(req.params.code)
    if (!customer) return res.status(404).json({ error: 'Booking link not recognised' })

    const quote = await buildQuote(customer, req.body)
    if (quote.error) return res.status(quote.status || 400).json({ error: quote.error })

    const { dog_id, check_in_date, check_out_date, notes } = req.body
    const stay = await query(`
      INSERT INTO stays (
        dog_id, check_in_date, check_out_date, stay_type, rate_type,
        days_count, daily_rate, total_cost, notes, status, requested_at, quoted_total
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'requested',CURRENT_TIMESTAMP,$10)
      RETURNING id
    `, [
      dog_id, check_in_date, check_out_date, quote.stay_type, quote.rate_type,
      quote.days_count, quote.daily_rate, quote.total_cost,
      notes ? String(notes).slice(0, 1000) : null, quote.total_cost,
    ])
    const stayId = stay.rows[0].id

    if (!isStripeEnabled()) {
      // No cards configured: the request stands on its own and she settles up
      // the way she does today.
      return res.json({ stayId, requiresPayment: false, quote })
    }

    const session = await createBookingCheckoutSession({
      stayId,
      customer,
      amount: quote.total_cost,
      description: `Boarding ${check_in_date} to ${check_out_date}`,
      successUrl: `${clientUrl()}/book/${req.params.code}?requested=1`,
      cancelUrl: `${clientUrl()}/book/${req.params.code}?cancelled=1`,
    })
    res.json({ stayId, requiresPayment: true, checkoutUrl: session.url, quote })
  } catch (e) {
    console.error('Booking request error:', e.message)
    res.status(500).json({ error: e.message })
  }
})

const clientUrl = () =>
  process.env.CLIENT_URL || process.env.PUBLIC_URL || 'http://localhost:5173'

/**
 * Validate and price a request. Every check that protects Lily lives here, so
 * quote and request can't disagree about what's allowed.
 */
async function buildQuote(customer, body) {
  const { dog_id, check_in_date, check_out_date, stay_type = 'boarding', rate_type = 'regular' } = body || {}

  if (!dog_id) return { error: 'Choose a dog' }
  if (!DATE_RE.test(check_in_date || '') || !DATE_RE.test(check_out_date || '')) {
    return { error: 'Choose both dates' }
  }
  if (check_out_date <= check_in_date) {
    return { error: 'Check-out must be after check-in' }
  }
  // Dates are compared as strings, which is safe for YYYY-MM-DD and avoids the
  // timezone traps that come with parsing a bare date into a Date.
  const today = new Date().toISOString().slice(0, 10)
  if (check_in_date < today) return { error: 'That date has already passed' }

  // The dog must belong to THIS customer — the code identifies a person, and
  // without this check anyone with a link could book against someone else's dog.
  const dogResult = await query(
    `SELECT id, name, size FROM dogs WHERE id = $1 AND customer_id = $2`,
    [dog_id, customer.id]
  )
  if (dogResult.rows.length === 0) return { error: 'That dog is not on your account', status: 404 }
  const dog = dogResult.rows[0]

  const rules = await getBookingRules()
  if (!sizeAllowed(dog.size, rules.maxSizeRank)) {
    return { error: `Sorry — ${dog.name} is too big to book online. Please get in touch.` }
  }

  const avail = await checkAvailability(check_in_date, check_out_date)
  if (!avail.available) {
    return {
      error: avail.fullNights.length === avail.nights.length
        ? 'Those dates are fully booked.'
        : `Fully booked on ${avail.fullNights.join(', ')}.`,
      status: 409,
    }
  }

  const days_count = avail.nights.length
  const priced = await quoteStay({ dog_id, days_count, stay_type, rate_type })
  return { ...priced, dog_name: dog.name, stay_type, rate_type, check_in_date, check_out_date }
}

export default router
