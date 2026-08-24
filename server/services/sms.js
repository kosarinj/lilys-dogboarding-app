import twilio from 'twilio'

/**
 * Texting, optional and provider-agnostic.
 *
 * Supports Vonage and Twilio, picked from whichever credentials are present —
 * Vonage first, since that's the one that got through US registration. With
 * neither configured every send is a no-op that reports why, and the app
 * carries on: the copy-and-paste route still works, so a missing config or a
 * failed send never blocks approving a booking.
 *
 * Vonage goes over plain REST rather than their SDK. It's one POST, and it
 * avoids adding a dependency that has to be installed on a server that already
 * builds slowly.
 */

let twilioClient = null
if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
  try {
    twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  } catch (e) {
    console.error('Twilio init failed:', e.message)
  }
}

const vonageReady = () =>
  !!(process.env.VONAGE_API_KEY && process.env.VONAGE_API_SECRET && vonageFrom())

// Vonage accepts a number or an alphanumeric sender id. Digits only for a
// number — it rejects the leading + that Twilio requires, which is an easy way
// to get an opaque failure.
const vonageFrom = () =>
  String(process.env.VONAGE_FROM_NUMBER || process.env.VONAGE_PHONE_NUMBER || '').replace(/^\+/, '')

export function activeProvider() {
  if (vonageReady()) return 'vonage'
  if (twilioClient && process.env.TWILIO_PHONE_NUMBER) return 'twilio'
  return null
}

export function isSmsEnabled() {
  return activeProvider() !== null
}

/**
 * A phone number as the providers want it: E.164, so +15551234567.
 *
 * Numbers in this database are free text — "(555) 123-4567", "555.1234",
 * "555-1234 (cell)". Both providers reject those outright, so without this the
 * first real send fails on punctuation rather than on anything to do with the
 * provider, which is a confusing way to find out.
 *
 * Returns null when there's nothing sendable, so the caller can say "no number
 * on file" instead of throwing.
 */
export function toE164(raw) {
  if (!raw) return null
  const digits = String(raw).replace(/\D/g, '')
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
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
  const provider = activeProvider()
  if (!provider) return { sent: false, reason: 'Texting is not set up' }
  const to = toE164(toRaw)
  if (!to) return { sent: false, reason: 'No usable phone number on file' }
  return provider === 'vonage' ? sendVonage(to, body) : sendTwilio(to, body)
}

async function sendVonage(to, text) {
  try {
    const res = await fetch('https://rest.nexmo.com/sms/json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        api_key: process.env.VONAGE_API_KEY,
        api_secret: process.env.VONAGE_API_SECRET,
        from: vonageFrom(),
        to: to.replace(/^\+/, ''),   // Vonage wants digits, no plus
        text,
      }),
    })
    const data = await res.json()
    // Vonage returns HTTP 200 even when the send failed — the real outcome is
    // per-message inside the body, so checking res.ok would report success on a
    // message that was rejected.
    const msg = data?.messages?.[0]
    if (msg?.status === '0') return { sent: true, sid: msg['message-id'], to, provider: 'vonage' }
    return {
      sent: false,
      provider: 'vonage',
      reason: msg?.['error-text'] || `Vonage status ${msg?.status ?? 'unknown'}`,
    }
  } catch (e) {
    return { sent: false, provider: 'vonage', reason: e.message }
  }
}

async function sendTwilio(to, body) {
  try {
    const msg = await twilioClient.messages.create({
      body,
      from: process.env.TWILIO_PHONE_NUMBER,
      to,
    })
    return { sent: true, sid: msg.sid, to, provider: 'twilio' }
  } catch (e) {
    // The provider's own message is the useful part — "unverified number",
    // "not a mobile number" and so on each need a different response from her.
    return { sent: false, provider: 'twilio', reason: e.message }
  }
}
