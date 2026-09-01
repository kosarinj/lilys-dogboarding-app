import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'

/**
 * The one link Lily hands out — /request.
 *
 * Everything before this needed her to look up a customer's personal booking
 * link and send it. This is the same link for everybody: enter your number,
 * get a code by text, and you land on your own booking page.
 *
 * The code is not ceremony. A phone number isn't a secret, so without it anyone
 * who knew one of Lily's customers could type their number and read back their
 * dogs and their upcoming stays.
 */
const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

// Formatted as they type, because a number that looks like a number is easier
// to check for a typo than ten bare digits.
function prettyPhone(raw) {
  const d = String(raw).replace(/\D/g, '').slice(0, 10)
  if (d.length <= 3) return d
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`
}

export default function RequestAccessPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState('phone')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const digits = phone.replace(/\D/g, '')

  const sendCode = async (e) => {
    e?.preventDefault()
    setBusy(true); setError(null)
    try {
      const r = await axios.post(`${API}/access/start`, { phone: digits })
      setName(r.data.name || '')
      setStep('code')
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const verify = async (e) => {
    e?.preventDefault()
    setBusy(true); setError(null)
    try {
      const r = await axios.post(`${API}/access/verify`, { phone: digits, code })
      // Straight to their own booking page. From here on it's the page Lily's
      // link has always opened — nothing downstream had to change.
      navigate(`/book/${r.data.bookingCode}`, { replace: true })
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong. Please try again.')
      setBusy(false)
    }
  }

  return (
    <Shell>
      <h1 style={{ fontSize: 24, margin: '0 0 4px', color: '#2c3e50' }}>
        Request a stay 🐾
      </h1>
      <p style={{ color: '#6c7a89', margin: '0 0 20px', fontSize: 14 }}>
        Lily's Dog Boarding
      </p>

      <section style={card}>
        {step === 'phone' ? (
          <form onSubmit={sendCode}>
            <h2 style={h2}>Your mobile number</h2>
            <p style={{ fontSize: 13, color: '#6c7a89', margin: '0 0 14px' }}>
              We'll text you a 4-digit code to check it's you.
            </p>
            <input
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              autoFocus
              value={phone}
              onChange={e => setPhone(prettyPhone(e.target.value))}
              placeholder="(555) 123-4567"
              style={input}
            />
            {error && <Err>{error}</Err>}
            <button type="submit" disabled={busy || digits.length < 10} style={btn(busy || digits.length < 10)}>
              {busy ? 'Sending…' : 'Text me a code'}
            </button>
          </form>
        ) : (
          <form onSubmit={verify}>
            <h2 style={h2}>{name ? `Welcome back, ${name}` : 'Check your texts'}</h2>
            <p style={{ fontSize: 13, color: '#6c7a89', margin: '0 0 14px' }}>
              We sent a code to {phone}. It expires in 10 minutes.
            </p>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              maxLength={4}
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder="1234"
              style={{ ...input, fontSize: 28, letterSpacing: 10, textAlign: 'center', fontWeight: 700 }}
            />
            {error && <Err>{error}</Err>}
            <button type="submit" disabled={busy || code.length !== 4} style={btn(busy || code.length !== 4)}>
              {busy ? 'Checking…' : 'Continue'}
            </button>
            <button
              type="button"
              onClick={() => { setStep('phone'); setCode(''); setError(null) }}
              style={{ ...btn(false), background: 'none', color: '#6c7a89', marginTop: 8, fontWeight: 500 }}
            >
              Use a different number
            </button>
          </form>
        )}
      </section>

      <p style={{ fontSize: 13, color: '#6c7a89', textAlign: 'center', margin: 0 }}>
        New here? Text Lily to get set up first — after that you can book yourself in any time.
      </p>
    </Shell>
  )
}

const Err = ({ children }) => (
  <div style={{
    background: '#fdecea', border: '1px solid #f5c6cb', color: '#a4353a',
    padding: '10px 12px', borderRadius: 8, marginBottom: 14, fontSize: 14,
  }}>{children}</div>
)

const Shell = ({ children }) => (
  <div style={{ minHeight: '100vh', background: '#fdf7f9', padding: '48px 16px 24px' }}>
    <div style={{ maxWidth: 420, margin: '0 auto' }}>{children}</div>
  </div>
)

const card = {
  background: '#fff', border: '1px solid #f0d5de', borderRadius: 10,
  padding: '18px 20px', marginBottom: 16,
}
const h2 = { fontSize: 15, margin: '0 0 4px', color: '#2c3e50' }
const input = {
  width: '100%', padding: '12px', fontSize: 17, marginBottom: 14,
  border: '1px solid #d9c3cb', borderRadius: 6, background: '#fff', color: '#2c3e50',
  boxSizing: 'border-box',
}
const btn = (disabled) => ({
  width: '100%', padding: '13px', fontSize: 16, fontWeight: 700, cursor: disabled ? 'default' : 'pointer',
  color: '#fff', background: disabled ? '#e3c4ce' : '#e8547c',
  border: 'none', borderRadius: 8,
})
