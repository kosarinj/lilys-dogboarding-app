import express from 'express'
import { query } from '../models/db.js'
import { checkAvailability, getBookingRules, sizeAllowed } from '../services/availability.js'
import { quoteStay, getPartialDayAddition } from '../services/pricing.js'
import { isStripeEnabled, createBookingCheckoutSession, cancelPaymentIntent } from '../services/stripe.js'
import { todayStr } from '../utils/dates.js'
import { sendSms } from '../services/sms.js'

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
      SELECT s.id, s.check_in_date, s.check_out_date, s.status, s.total_cost, s.payment_state,
             (s.payment_state IN ('paid', 'captured')) AS paid,
             d.name AS dog_name
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
        dog_id, check_in_date, check_out_date, check_in_time, check_out_time,
        stay_type, rate_type, requires_dropoff, requires_pickup, dropoff_fee, pickup_fee,
        days_count, daily_rate, total_cost, notes, status, requested_at, quoted_total
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'requested',CURRENT_TIMESTAMP,$16)
      RETURNING id
    `, [
      dog_id, check_in_date, check_out_date, quote.check_in_time, quote.check_out_time,
      quote.stay_type, quote.rate_type,
      quote.requires_dropoff, quote.requires_pickup, quote.dropoff_fee, quote.pickup_fee,
      quote.days_count, quote.daily_rate, quote.total_cost,
      notes ? String(notes).slice(0, 1000) : null, quote.total_cost,
    ])
    const stayId = stay.rows[0].id

    // Tell Lily. A request nobody knows about is a request that sits until the
    // customer chases it, and the whole point of self-service is that she stops
    // being the one who has to start the conversation.
    //
    // Not awaited into the response's success: the request is already saved,
    // and a text that fails must not make the customer think it wasn't.
    notifyOwner(customer, quote, notes).catch(e =>
      console.error('Owner notification failed:', e.message))

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

/**
 * Text Lily that a request came in.
 *
 * Silent when no number is configured — texting is optional throughout this app
 * and a missing number is a setting she hasn't filled in, not an error worth
 * failing a booking over.
 */
async function notifyOwner(customer, quote, notes) {
  const r = await query(`SELECT value FROM app_config WHERE key = 'owner_phone'`)
  const to = r.rows[0]?.value
  if (!to) return

  const d = (v) => {
    const [, mo, dd] = String(v).slice(0, 10).split('-')
    return `${Number(mo)}/${Number(dd)}`
  }
  await sendSms(to,
    `New booking request: ${quote.dog_name} for ${customer.name}, ` +
    `${d(quote.check_in_date)}–${d(quote.check_out_date)}, ` +
    `$${Number(quote.total_cost || 0).toFixed(2)}.` +
    (notes ? ` Note: ${String(notes).slice(0, 80)}` : '') +
    ` Approve it in the app.`
  )
}

/**
 * POST /:code/cancel — the customer changes their mind.
 *
 * Only a request Lily hasn't acted on yet. Once she has approved it the dates
 * are held, the customer has been told, and money may have moved — undoing that
 * is a conversation, not a button, and it already exists on her side. A
 * customer who needs out of an approved booking is told to get in touch, which
 * is what they'd have had to do before this existed anyway.
 *
 * The stay must belong to a dog of THIS customer. Without that check a booking
 * code would cancel anyone's stay by id, which is a worse hole than the one
 * self-service closes.
 */
router.post('/:code/cancel', async (req, res) => {
  try {
    const customer = await customerByCode(req.params.code)
    if (!customer) return res.status(404).json({ error: 'Booking link not recognised' })

    const { stayId } = req.body || {}
    const r = await query(`
      SELECT s.* FROM stays s JOIN dogs d ON s.dog_id = d.id
      WHERE s.id = $1 AND d.customer_id = $2
    `, [stayId, customer.id])
    if (r.rows.length === 0) return res.status(404).json({ error: 'That booking is not on your account' })
    const stay = r.rows[0]

    if (stay.status === 'cancelled') return res.json({ success: true, alreadyCancelled: true })
    if (stay.status !== 'requested') {
      return res.status(409).json({
        error: 'Lily has already confirmed this one — please text her to change or cancel it.',
      })
    }

    // Release the hold so the money goes back to their card. Not allowed to
    // block the cancellation: an uncancelled authorization expires on its own,
    // and refusing to cancel would leave dates blocked over a Stripe hiccup.
    if (stay.payment_intent_id && stay.payment_state === 'authorized') {
      try {
        await cancelPaymentIntent(stay.payment_intent_id)
        await query(`UPDATE stays SET payment_state = 'released' WHERE id = $1`, [stay.id])
      } catch (e) {
        console.error('Could not release hold on customer cancel:', e.message)
      }
    }

    await query(`
      UPDATE stays SET status = 'cancelled', decline_reason = 'Cancelled by customer',
             updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [stay.id])

    // She needs to know the night is free again — she may have been holding it.
    notifyOwnerCancelled(customer, stay).catch(e =>
      console.error('Cancel notification failed:', e.message))

    res.json({ success: true })
  } catch (e) {
    console.error('Booking cancel error:', e.message)
    res.status(500).json({ error: e.message })
  }
})

async function notifyOwnerCancelled(customer, stay) {
  const r = await query(`SELECT value FROM app_config WHERE key = 'owner_phone'`)
  const to = r.rows[0]?.value
  if (!to) return
  const dog = await query(`SELECT name FROM dogs WHERE id = $1`, [stay.dog_id])
  // pg hands back a DATE as a Date at local midnight. Local components, not
  // toISOString — that is UTC and reads a day early anywhere ahead of it.
  const d = (v) => v instanceof Date
    ? `${v.getMonth() + 1}/${v.getDate()}`
    : `${Number(String(v).slice(5, 7))}/${Number(String(v).slice(8, 10))}`
  await sendSms(to,
    `Request cancelled by ${customer.name}: ${dog.rows[0]?.name || 'their dog'}, ` +
    `${d(stay.check_in_date)}–${d(stay.check_out_date)}. Those nights are free again.`
  )
}

const clientUrl = () =>
  process.env.CLIENT_URL || process.env.PUBLIC_URL || 'http://localhost:5173'

/**
 * Validate and price a request. Every check that protects Lily lives here, so
 * quote and request can't disagree about what's allowed.
 */
async function buildQuote(customer, body) {
  const {
    dog_id, check_in_date, check_out_date,
    check_in_time, check_out_time,
    requires_dropoff = false, requires_pickup = false,
    stay_type = 'boarding', rate_type = 'regular',
  } = body || {}

  if (!dog_id) return { error: 'Choose a dog' }
  if (!DATE_RE.test(check_in_date || '') || !DATE_RE.test(check_out_date || '')) {
    return { error: 'Choose both dates' }
  }
  if (check_out_date <= check_in_date) {
    return { error: 'Check-out must be after check-in' }
  }
  // Compared as strings, which is safe for YYYY-MM-DD. "Today" comes from local
  // components rather than toISOString — in a timezone ahead of UTC the latter
  // gives yesterday, and would refuse a booking for this morning.
  if (check_in_date < todayStr()) return { error: 'That date has already passed' }

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

  // Nights, plus a part-day when pick-up is later in the day than drop-off —
  // the same rule she charges by, so the quote can't undercut the real price.
  const partial_day = getPartialDayAddition(check_in_time, check_out_time)
  const days_count = avail.nights.length + partial_day
  const priced = await quoteStay({
    dog_id, days_count, stay_type, rate_type,
    requires_dropoff: !!requires_dropoff, requires_pickup: !!requires_pickup,
  })
  return {
    ...priced, dog_name: dog.name, stay_type, rate_type,
    check_in_date, check_out_date, check_in_time: check_in_time || null,
    check_out_time: check_out_time || null, partial_day,
    requires_dropoff: !!requires_dropoff, requires_pickup: !!requires_pickup,
  }
}

export default router
