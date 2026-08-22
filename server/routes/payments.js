import express from 'express'
import { query } from '../models/db.js'
import {
  isStripeEnabled, isTestMode, createBillCheckoutSession,
  constructWebhookEvent, fromCents,
} from '../services/stripe.js'

const router = express.Router()

/**
 * Card payment for bills and bookings.
 *
 * Cards are an ADDITION, never a replacement: the Venmo, Zelle and cash details
 * stay on every bill exactly as they are. With no Stripe key configured this
 * whole router reports itself disabled and the client hides the button, so the
 * app is the same as it was before any of this existed.
 */

// Public: does the client show a Pay Now button at all?
router.get('/config', (req, res) => {
  res.json({ enabled: isStripeEnabled(), testMode: isStripeEnabled() && isTestMode() })
})

const clientUrl = () =>
  process.env.CLIENT_URL || process.env.PUBLIC_URL || 'http://localhost:5173'

/**
 * Public: start a card payment for a bill.
 *
 * Keyed on the bill CODE, the same public identifier the guest bill page
 * already uses — the customer is not logged in and has nothing else to present.
 * The amount is computed here from the bill, never taken from the request, or
 * anyone could pay a dollar and have the bill marked settled.
 */
router.post('/bills/:code/checkout', async (req, res) => {
  try {
    if (!isStripeEnabled()) {
      return res.status(503).json({ error: 'Card payments are not set up' })
    }
    const { code } = req.params
    const r = await query(`
      SELECT b.*, c.name AS customer_name, c.email AS customer_email
      FROM bills b JOIN customers c ON b.customer_id = c.id
      WHERE b.bill_code = $1
    `, [code])
    if (r.rows.length === 0) return res.status(404).json({ error: 'Bill not found' })

    const bill = r.rows[0]
    const amountDue = Number(bill.total_amount) - Number(bill.paid_amount || 0)
    if (!(amountDue > 0)) {
      return res.status(400).json({ error: 'This bill is already paid' })
    }
    if (bill.status === 'cancelled') {
      return res.status(400).json({ error: 'This bill was cancelled' })
    }

    const session = await createBillCheckoutSession({
      bill,
      customer: { name: bill.customer_name, email: bill.customer_email },
      amountDue,
      successUrl: `${clientUrl()}/bill/${code}?paid=1`,
      cancelUrl: `${clientUrl()}/bill/${code}`,
    })
    res.json({ url: session.url })
  } catch (e) {
    console.error('Checkout error:', e.message)
    res.status(500).json({ error: e.message })
  }
})

/**
 * Stripe's callback. Mounted with a RAW body parser in server.js — signature
 * verification hashes the exact bytes, and express.json() rewrites them.
 *
 * This is the ONLY thing that marks a bill paid. The browser returning from
 * Checkout proves nothing: a customer can close the tab before redirecting, and
 * anyone can visit the success URL directly.
 */
router.post('/webhook', async (req, res) => {
  if (!isStripeEnabled()) return res.status(503).end()

  let event
  try {
    event = constructWebhookEvent(req.body, req.headers['stripe-signature'])
  } catch (e) {
    // A bad signature means it didn't come from Stripe. Never act on it.
    console.error('Webhook signature failed:', e.message)
    return res.status(400).send(`Webhook Error: ${e.message}`)
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object
      const kind = session.metadata?.kind

      if (kind === 'bill') {
        await recordBillPayment(session)
      } else if (kind === 'booking') {
        // Authorized, not captured — the hold is placed and Lily now has a
        // funded request to approve. Capture happens on approval.
        await markBookingAuthorized(session)
      }
    }
  } catch (e) {
    // Log and still 200: Stripe retries on a non-2xx, and a bug in here would
    // otherwise have it retrying the same broken event for days.
    console.error('Webhook handling error:', e.message)
  }
  res.json({ received: true })
})

async function recordBillPayment(session) {
  const billId = Number(session.metadata?.bill_id)
  if (!billId) return
  const paid = fromCents(session.amount_total)
  const intentId = typeof session.payment_intent === 'string'
    ? session.payment_intent : session.payment_intent?.id

  // Stripe can deliver the same event more than once — that's expected, not a
  // fault — so a repeat must not add the payment twice.
  const seen = await query('SELECT id FROM payments WHERE stripe_payment_id = $1', [intentId])
  if (seen.rows.length > 0) return

  await query(`
    INSERT INTO payments (bill_id, amount, payment_method, stripe_payment_id, status)
    VALUES ($1, $2, 'card', $3, 'succeeded')
  `, [billId, paid, intentId])

  // Recompute from the payments actually recorded rather than adding to the
  // stored figure, so a duplicate or a manually-entered payment can't drift it.
  await query(`
    UPDATE bills b SET
      paid_amount = COALESCE((SELECT SUM(amount) FROM payments WHERE bill_id = b.id AND status = 'succeeded'), 0),
      payment_method = 'card',
      stripe_payment_intent_id = $2,
      status = CASE
        WHEN COALESCE((SELECT SUM(amount) FROM payments WHERE bill_id = b.id AND status = 'succeeded'), 0)
             >= b.total_amount THEN 'paid'::bill_status
        ELSE b.status END,
      updated_at = CURRENT_TIMESTAMP
    WHERE b.id = $1
  `, [billId, intentId])

  console.log(`✓ Bill ${billId} paid by card: $${paid}`)
}

async function markBookingAuthorized(session) {
  const stayId = Number(session.metadata?.stay_id)
  if (!stayId) return
  const intentId = typeof session.payment_intent === 'string'
    ? session.payment_intent : session.payment_intent?.id
  await query(
    `UPDATE stays SET payment_intent_id = $2, payment_state = 'authorized', updated_at = CURRENT_TIMESTAMP
     WHERE id = $1`,
    [stayId, intentId]
  )
  console.log(`✓ Booking request ${stayId} funded (held, not charged)`)
}

export default router
