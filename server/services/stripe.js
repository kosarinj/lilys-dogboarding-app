import Stripe from 'stripe'

/**
 * Stripe, optional by design.
 *
 * With no STRIPE_SECRET_KEY set, isStripeEnabled() is false and every card
 * feature hides itself — the app carries on exactly as it does today with
 * Venmo, Zelle and cash. That matters for two reasons: it can be deployed
 * before Lily has finished signing up, and if the keys are ever removed the
 * bills still work rather than the page breaking.
 *
 * Test keys (sk_test_...) work fully without a real account, so all of this can
 * be exercised end to end before any bank details exist.
 */
let stripe = null
const secret = process.env.STRIPE_SECRET_KEY || ''
if (secret) {
  try {
    stripe = new Stripe(secret, { apiVersion: '2023-10-16' })
  } catch (e) {
    console.error('Stripe init failed:', e.message)
  }
}

export function isStripeEnabled() {
  return !!stripe
}

export function isTestMode() {
  return secret.startsWith('sk_test_')
}

export function getStripe() {
  if (!stripe) throw new Error('Stripe is not configured')
  return stripe
}

/** Dollars to cents, guarding against float drift on values like 40.15. */
export function toCents(amount) {
  return Math.round(Number(amount) * 100)
}

export function fromCents(cents) {
  return Math.round(Number(cents)) / 100
}

/**
 * A Checkout session for paying a bill.
 *
 * Checkout is hosted by Stripe on purpose: card details never touch this server
 * or this database, which takes the whole of PCI scope off the table for a
 * one-person business.
 *
 * `capture: 'automatic'` — the money is taken now. This is for a bill for a stay
 * that already happened, so there is nothing to hold and release.
 */
export async function createBillCheckoutSession({ bill, customer, amountDue, successUrl, cancelUrl }) {
  const s = getStripe()
  return s.checkout.sessions.create({
    mode: 'payment',
    // Prefilled so she doesn't get a payment she can't match to a person.
    customer_email: customer?.email || undefined,
    line_items: [{
      quantity: 1,
      price_data: {
        currency: 'usd',
        unit_amount: toCents(amountDue),
        product_data: {
          name: `Boarding — invoice ${bill.bill_code}`,
          description: customer?.name ? `For ${customer.name}` : undefined,
        },
      },
    }],
    // The webhook is the only thing that marks a bill paid, and it needs to know
    // WHICH bill without trusting anything the browser sends back.
    metadata: {
      kind: 'bill',
      bill_id: String(bill.id),
      bill_code: bill.bill_code,
    },
    payment_intent_data: {
      metadata: { kind: 'bill', bill_id: String(bill.id), bill_code: bill.bill_code },
    },
    success_url: successUrl,
    cancel_url: cancelUrl,
  })
}

/**
 * A Checkout session for a booking request.
 *
 * `capture_method: 'manual'` — the card is AUTHORIZED, not charged. The money is
 * held, and only taken when Lily approves. If she declines, the hold is released
 * and the customer is never out of pocket, which is much better than charging
 * and refunding.
 *
 * The catch: an authorization expires after about 7 days. That's fine when she
 * reviews requests within a day or two, but a request approved later than that
 * will need collecting again — handled by capturePaymentIntent reporting the
 * failure rather than silently confirming an unpaid booking.
 */
export async function createBookingCheckoutSession({ stayId, customer, amount, description, successUrl, cancelUrl }) {
  const s = getStripe()
  return s.checkout.sessions.create({
    mode: 'payment',
    customer_email: customer?.email || undefined,
    line_items: [{
      quantity: 1,
      price_data: {
        currency: 'usd',
        unit_amount: toCents(amount),
        product_data: { name: description || 'Boarding request' },
      },
    }],
    metadata: { kind: 'booking', stay_id: String(stayId) },
    payment_intent_data: {
      capture_method: 'manual',
      metadata: { kind: 'booking', stay_id: String(stayId) },
    },
    success_url: successUrl,
    cancel_url: cancelUrl,
  })
}

/** Take a held payment. Called when Lily approves a request. */
export async function capturePaymentIntent(paymentIntentId) {
  const s = getStripe()
  return s.paymentIntents.capture(paymentIntentId)
}

/** Release a held payment. Called when she declines. */
export async function cancelPaymentIntent(paymentIntentId) {
  const s = getStripe()
  return s.paymentIntents.cancel(paymentIntentId)
}

/**
 * Verify a webhook came from Stripe.
 *
 * Without this, anyone who knows the URL could POST "payment succeeded" and
 * mark a bill paid. Requires the RAW body — a parsed one changes the bytes and
 * the signature stops matching.
 */
export function constructWebhookEvent(rawBody, signature) {
  const s = getStripe()
  const whSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!whSecret) throw new Error('STRIPE_WEBHOOK_SECRET is not set')
  return s.webhooks.constructEvent(rawBody, signature, whSecret)
}
