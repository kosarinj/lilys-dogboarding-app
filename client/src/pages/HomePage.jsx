import { Link } from 'react-router-dom'
import { PolicyLinks, useBusiness } from './PolicyPages'

/**
 * "/" — the public front page, and the brand website for the texting
 * registration.
 *
 * Before this, "/" sent everyone to the admin login, so a carrier reviewing the
 * A2P campaign found no website at all. Three of their objections come down to
 * this page existing: the brand needs a website, and the phone number and email
 * given on the form have to appear on it to be matched to the brand. Both come
 * from Settings, so Lily can change them without a deploy.
 *
 * Admins who land here get a link on to the app rather than a redirect — the
 * reviewer has to be able to see this page, and a redirect would hide it.
 */
export default function HomePage() {
  const { phone, email, location } = useBusiness()

  return (
    <div style={{ minHeight: '100vh', background: '#fdf7f9', padding: '48px 16px 24px' }}>
      <div style={{ maxWidth: 560, margin: '0 auto' }}>
        <header style={{ textAlign: 'center', marginBottom: 22 }}>
          <div style={{ fontSize: 40, lineHeight: 1 }}>🐾</div>
          <h1 style={{ fontSize: 30, margin: '8px 0 4px', color: '#2c3e50' }}>
            Lily's Dog Boarding
          </h1>
          <p style={{ color: '#6c7a89', margin: 0, fontSize: 15 }}>
            Dog boarding and daycare{location ? ` in ${location}` : ''}
          </p>
        </header>

        <section style={card}>
          {/* Plain and accurate — boarding by the night, daycare by the day and the
              collection service are what the app actually prices. Lily can say more
              here whenever she wants to; nothing else depends on this wording. */}
          <p style={{ margin: '0 0 12px', color: '#2c3e50', lineHeight: 1.55 }}>
            Boarding by the night and daycare by the day, with drop-off and pick-up
            available. Lily is a sole proprietor and looks after every dog herself.
          </p>
          <p style={{ margin: 0, color: '#6c7a89', fontSize: 14, lineHeight: 1.55 }}>
            Already one of Lily's customers? Request a stay below. New here? Get in touch
            and Lily will set you up.
          </p>
        </section>

        <Link to="/request" style={cta}>Request a stay</Link>

        <section style={card}>
          <h2 style={h2}>Contact</h2>
          <ul style={{ margin: 0, paddingLeft: 18, color: '#2c3e50', lineHeight: 1.7 }}>
            {phone && <li>Phone / text: <a href={`tel:${phone}`} style={a}>{prettyPhone(phone)}</a></li>}
            {email && <li>Email: <a href={`mailto:${email}`} style={a}>{email}</a></li>}
            {location && <li>Serving {location}</li>}
          </ul>
        </section>

        <section style={card}>
          <h2 style={h2}>Text messages</h2>
          <p style={{ margin: 0, color: '#2c3e50', fontSize: 14, lineHeight: 1.6 }}>
            Customers who give us their mobile number receive texts about their bookings:
            login codes for the booking page, booking confirmations, and bills. Message
            frequency varies. Message and data rates may apply. Reply STOP to opt out,
            HELP for help. See our <Link to="/terms" style={a}>SMS Terms</Link> and{' '}
            <Link to="/privacy" style={a}>Privacy Policy</Link>.
          </p>
        </section>

        <p style={{ textAlign: 'center', margin: '18px 0 0', fontSize: 12 }}>
          <Link to="/admin/dashboard" style={{ color: '#b9a3ab' }}>Staff sign in</Link>
        </p>
        <PolicyLinks />
      </div>
    </div>
  )
}

function prettyPhone(e164) {
  const d = String(e164 || '').replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '')
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : e164
}

const card = {
  background: '#fff', border: '1px solid #f0d5de', borderRadius: 10,
  padding: '18px 20px', marginBottom: 16,
}
const h2 = { fontSize: 15, margin: '0 0 8px', color: '#2c3e50' }
const a = { color: '#e8547c' }
const cta = {
  display: 'block', textAlign: 'center', padding: '13px', marginBottom: 16,
  fontSize: 16, fontWeight: 700, color: '#fff', background: '#e8547c',
  border: 'none', borderRadius: 8, textDecoration: 'none',
}
