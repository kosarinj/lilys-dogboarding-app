import twilio from 'twilio'

/**
 * Texting, optional in the same way Stripe is.
 *
 * With no credentials the send is a no-op that reports why, and every caller
 * carries on — the copy-and-paste route still works, so a missing config or a
 * failed send never blocks approving a booking.
 */
let client = null
if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
  try {
    client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  } catch (e) {
    console.error('Twilio init failed:', e.message)
  }
}

export function isSmsEnabled() {
  return !!client && !!process.env.TWILIO_PHONE_NUMBER
}

/**
 * A phone number as Twilio wants it: E.164, so +15551234567.
 *
 * Numbers in this database are free text — "(555) 123-4567", "555.1234",
 * "555-1234 (cell)". Twilio rejects all of those outright, so without this the
 * first real send fails on punctuation rather than on anything to do with
 * Twilio, which is a confusing way to find out.
 *
 * Returns null when there's nothing sendable, so the caller can say "no number
 * on file" instead of throwing.
 */
export function toE164(raw) {
  if (!raw) return null
  const digits = String(raw).replace(/\D/g, '')
  if (digits.length === 10) return `+1${digits}`                       // US, no country code
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  // Anything else is already international, or too short to be a phone number.
  if (digits.length > 11 && digits.length <= 15) return `+${digits}`
  return null
}

/**
 * Send a text. Never throws — returns what happened.
 *
 * Callers use this alongside an action that has already succeeded (a booking
 * approved, a payment recorded), so a failure here must not undo that. The
 * result is reported to the UI so she knows to send it by hand instead.
 */
export async function sendSms(toRaw, body) {
  if (!isSmsEnabled()) return { sent: false, reason: 'Texting is not set up' }
  const to = toE164(toRaw)
  if (!to) return { sent: false, reason: 'No usable phone number on file' }
  try {
    const msg = await client.messages.create({
      body,
      from: process.env.TWILIO_PHONE_NUMBER,
      to,
    })
    return { sent: true, sid: msg.sid, to }
  } catch (e) {
    // Twilio's own message is the useful part — "unverified number",
    // "not a mobile number" and so on each need a different response from her.
    return { sent: false, reason: e.message }
  }
}
