import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios'

/**
 * /privacy and /terms — public, no login.
 *
 * Texting from a US number needs an A2P 10DLC registration, and the carriers
 * reviewing it want a privacy policy and SMS terms they can open themselves,
 * plus the consent wording where numbers are collected (/request). These pages
 * are those URLs. Keep the message list in step with what the app actually
 * sends: a reviewer compares it against the campaign's sample messages.
 */
const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

const BUSINESS = "Lily's Dog Boarding"
const UPDATED = 'September 22, 2026'

// Lily's number, from Settings (the same one booking alerts go to), so the
// pages never show a placeholder. Absent, the contact line falls back to HELP.
function useContactPhone() {
  const [phone, setPhone] = useState(null)
  useEffect(() => {
    axios.get(`${API}/access/contact`).then(r => setPhone(r.data.phone || null)).catch(() => {})
  }, [])
  return phone
}

function prettyPhone(e164) {
  const d = String(e164 || '').replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '')
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : e164
}

function Contact() {
  const phone = useContactPhone()
  return phone
    ? <>call or text Lily at <a href={`tel:${phone}`}>{prettyPhone(phone)}</a>, or reply HELP to any of our texts</>
    : <>reply HELP to any of our texts</>
}

// Every message the app sends a customer. See the note at the top.
const MESSAGES = [
  'One-time login codes when you request a stay at our booking page',
  'Booking confirmations with your dates and times',
  'Links to your bill, and a thank-you when it is paid',
]

export function PrivacyPage() {
  return (
    <Page title="Privacy Policy">
      <p>{BUSINESS} is a dog boarding and daycare business run by Lily as a sole proprietor.
        This policy explains what information we keep about you and how we use it.</p>

      <h2 style={h2}>What we collect</h2>
      <ul>
        <li>Your name and mobile phone number</li>
        <li>Your dogs’ names and care details you give us</li>
        <li>Your booking dates, bills and whether they have been paid</li>
      </ul>

      <h2 style={h2}>How we use it</h2>
      <p>Only to run your bookings: to confirm stays, send you bills, take payment, and text you
        about your dog’s stay. We do not send marketing texts, and we do not sell your information.</p>

      <h2 style={h2}>Text messages</h2>
      <p>If you give us your mobile number, we use it to send the messages described in our{' '}
        <Link to="/terms">SMS Terms</Link>. You can opt out at any time by replying STOP.</p>
      <p><strong>No mobile information will be shared with third parties or affiliates for marketing
        or promotional purposes. Text messaging opt-in data and consent will not be shared with any
        third parties.</strong></p>

      <h2 style={h2}>Who else sees it</h2>
      <p>Your information is stored in our booking system and seen only by Lily. It passes to the
        services that run that system only as needed to provide it — our text message provider
        (Twilio) to deliver texts, and our payment processor (Stripe) to take card payments — and to no one
        else, unless the law requires it.</p>

      <h2 style={h2}>Your choices</h2>
      <p>You can ask to see, correct or delete the information we hold about you at any time.
        To do so, <Contact />.</p>
    </Page>
  )
}

export function TermsPage() {
  return (
    <Page title="Terms & SMS Terms">
      <h2 style={h2}>Text messaging program</h2>
      <p>By entering your mobile number on our booking page, or by asking Lily to text you, you
        agree to receive text messages from {BUSINESS} about your bookings:</p>
      <ul>{MESSAGES.map(m => <li key={m}>{m}</li>)}</ul>
      <ul>
        <li><strong>Message frequency varies</strong> — usually a few messages per booking.</li>
        <li><strong>Message and data rates may apply.</strong></li>
        <li><strong>Reply STOP</strong> to any message to stop receiving texts. You will get one
          message confirming you have been unsubscribed.</li>
        <li><strong>Reply HELP</strong> for help, or <Contact />.</li>
        <li>Carriers are not liable for delayed or undelivered messages.</li>
        <li>Consent to receive texts is not a condition of booking — you can book with Lily by
          phone instead.</li>
      </ul>
      <p>See our <Link to="/privacy">Privacy Policy</Link> for how we handle your information.</p>

      <h2 style={h2}>Bookings</h2>
      <p>A request made online is not a booking until Lily confirms it. Prices are shown before you
        request, and payment is due as stated on your bill. Please let Lily know as early as you can
        if you need to cancel.</p>
    </Page>
  )
}

/** The small links row shown on the public pages. */
export function PolicyLinks({ style }) {
  return (
    <p style={{ fontSize: 12, color: '#6c7a89', textAlign: 'center', margin: '16px 0 0', ...style }}>
      <Link to="/privacy" style={link}>Privacy Policy</Link>
      {' · '}
      <Link to="/terms" style={link}>Terms &amp; SMS Terms</Link>
    </p>
  )
}

function Page({ title, children }) {
  useEffect(() => { document.title = `${title} — ${BUSINESS}` }, [title])
  return (
    <div style={{ minHeight: '100vh', background: '#fdf7f9', padding: '40px 16px 24px' }}>
      <div style={{
        maxWidth: 640, margin: '0 auto', background: '#fff', border: '1px solid #f0d5de',
        borderRadius: 10, padding: '22px 24px', color: '#2c3e50', fontSize: 15, lineHeight: 1.55,
      }}>
        <h1 style={{ fontSize: 24, margin: '0 0 2px' }}>{title}</h1>
        <p style={{ color: '#6c7a89', margin: '0 0 18px', fontSize: 13 }}>
          {BUSINESS} · Last updated {UPDATED}
        </p>
        {children}
      </div>
      <PolicyLinks />
    </div>
  )
}

const h2 = { fontSize: 17, margin: '20px 0 6px' }
const link = { color: '#6c7a89' }
