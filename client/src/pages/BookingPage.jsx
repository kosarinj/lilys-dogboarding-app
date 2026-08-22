import { useState, useEffect } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import axios from 'axios'

/**
 * Customer booking page, reached by a link Lily hands out.
 *
 * Nothing here confirms anything — it asks. Everything is worded that way on
 * purpose, because a customer who believes they're booked when they're only
 * queued is a phone call she has to make.
 */
const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

const money = (n) => `$${Number(n || 0).toFixed(2)}`
const todayStr = () => new Date().toISOString().slice(0, 10)

export default function BookingPage() {
  const { code } = useParams()
  const [params] = useSearchParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [dogId, setDogId] = useState('')
  const [checkIn, setCheckIn] = useState('')
  const [checkOut, setCheckOut] = useState('')
  const [notes, setNotes] = useState('')
  const [quote, setQuote] = useState(null)
  const [quoteError, setQuoteError] = useState(null)
  const [busy, setBusy] = useState(false)

  const justRequested = params.get('requested') === '1'
  const cancelled = params.get('cancelled') === '1'

  useEffect(() => {
    axios.get(`${API}/book/${code}`)
      .then(r => {
        setData(r.data)
        const first = (r.data.dogs || []).find(d => d.bookable)
        if (first) setDogId(String(first.id))
      })
      .catch(err => setError(
        err.response?.status === 404
          ? "This booking link isn't recognised. Please check the link Lily sent you."
          : 'Something went wrong loading your details.'
      ))
      .finally(() => setLoading(false))
  }, [code])

  // Re-quote whenever the choice changes. Debounced so dragging through dates
  // in a date picker doesn't fire a request per keystroke.
  useEffect(() => {
    if (!dogId || !checkIn || !checkOut) { setQuote(null); setQuoteError(null); return }
    let cancelledReq = false
    const t = setTimeout(() => {
      axios.post(`${API}/book/${code}/quote`, {
        dog_id: Number(dogId), check_in_date: checkIn, check_out_date: checkOut,
      })
        .then(r => { if (!cancelledReq) { setQuote(r.data); setQuoteError(null) } })
        .catch(err => {
          if (cancelledReq) return
          setQuote(null)
          setQuoteError(err.response?.data?.error || 'Could not price those dates.')
        })
    }, 350)
    return () => { cancelledReq = true; clearTimeout(t) }
  }, [code, dogId, checkIn, checkOut])

  const submit = async () => {
    setBusy(true)
    setQuoteError(null)
    try {
      const r = await axios.post(`${API}/book/${code}/request`, {
        dog_id: Number(dogId), check_in_date: checkIn, check_out_date: checkOut, notes,
      })
      if (r.data?.checkoutUrl) {
        window.location.href = r.data.checkoutUrl
      } else {
        window.location.href = `/book/${code}?requested=1`
      }
    } catch (err) {
      setQuoteError(err.response?.data?.error || 'Could not send the request.')
      setBusy(false)
    }
  }

  if (loading) return <Shell><p style={{ color: '#6c7a89' }}>Loading…</p></Shell>
  if (error) return <Shell><p style={{ color: '#c0392b' }}>{error}</p></Shell>

  const dogs = data.dogs || []
  const bookable = dogs.filter(d => d.bookable)

  return (
    <Shell>
      <h1 style={{ fontSize: 24, margin: '0 0 4px', color: '#2c3e50' }}>
        Hello {data.customer.name.split(' ')[0]}
      </h1>
      <p style={{ color: '#6c7a89', margin: '0 0 20px', fontSize: 14 }}>
        Request a stay. Lily confirms every booking herself, so this is a request rather
        than a confirmation — she'll be in touch.
      </p>

      {justRequested && (
        <Banner tone="ok">
          <strong>Request sent.</strong> Lily will confirm shortly.
          {data.cardPayments && ' Your card is held but not charged — it only goes through when she approves.'}
        </Banner>
      )}
      {cancelled && (
        <Banner tone="warn">
          Payment wasn't completed, so the request wasn't sent. Nothing has been charged.
        </Banner>
      )}

      {data.upcoming?.length > 0 && (
        <section style={card}>
          <h2 style={h2}>Coming up</h2>
          {data.upcoming.map(s => (
            <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 14 }}>
              <span>{s.dog_name} · {fmt(s.check_in_date)} – {fmt(s.check_out_date)}</span>
              <span style={{ color: s.status === 'requested' ? '#b8860b' : '#27ae60', fontWeight: 600 }}>
                {s.status === 'requested' ? 'Awaiting confirmation' : 'Confirmed'}
              </span>
            </div>
          ))}
        </section>
      )}

      <section style={card}>
        <h2 style={h2}>New request</h2>

        {bookable.length === 0 ? (
          <p style={{ fontSize: 14, color: '#c0392b' }}>
            None of your dogs can be booked online at the moment — please give Lily a call.
          </p>
        ) : (
          <>
            <label style={label}>Which dog</label>
            <select value={dogId} onChange={e => setDogId(e.target.value)} style={input}>
              {dogs.map(d => (
                <option key={d.id} value={d.id} disabled={!d.bookable}>
                  {d.name}{d.breed ? ` — ${d.breed}` : ''}{!d.bookable ? ' (please call)' : ''}
                </option>
              ))}
            </select>

            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={label}>Drop off</label>
                <input type="date" value={checkIn} min={todayStr()}
                       onChange={e => setCheckIn(e.target.value)} style={input} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={label}>Pick up</label>
                <input type="date" value={checkOut} min={checkIn || todayStr()}
                       onChange={e => setCheckOut(e.target.value)} style={input} />
              </div>
            </div>

            <label style={label}>Anything she should know (optional)</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} style={{ ...input, resize: 'vertical' }} />

            {quoteError && (
              <div style={{ background: '#fdecea', border: '1px solid #f5c6cb', color: '#c0392b',
                            padding: '10px 12px', borderRadius: 6, fontSize: 14, marginBottom: 12 }}>
                {quoteError}
              </div>
            )}

            {quote && (
              <div style={{ background: '#fff5f8', border: '1px solid #ffc9d9', borderRadius: 8,
                            padding: '12px 14px', marginBottom: 14, fontSize: 14 }}>
                <Row l={`${quote.days_count} night${quote.days_count === 1 ? '' : 's'} at ${money(quote.daily_rate)}`} r={money(quote.boarding_cost)} />
                {quote.dropoff_fee > 0 && <Row l="Drop-off" r={money(quote.dropoff_fee)} />}
                {quote.pickup_fee > 0 && <Row l="Pick-up" r={money(quote.pickup_fee)} />}
                {quote.puppy_fee > 0 && <Row l="Puppy care" r={money(quote.puppy_fee)} />}
                <div style={{ borderTop: '1px solid #ffc9d9', marginTop: 8, paddingTop: 8 }}>
                  <Row bold l="Total" r={money(quote.total_cost)} />
                </div>
              </div>
            )}

            <button
              onClick={submit}
              disabled={!quote || busy}
              style={{
                width: '100%', padding: '14px', fontSize: 16, fontWeight: 700, color: '#fff',
                background: (!quote || busy) ? '#c8ced4' : '#e8547c',
                border: 'none', borderRadius: 8, cursor: (!quote || busy) ? 'default' : 'pointer',
              }}
            >
              {busy ? 'One moment…'
                : data.cardPayments ? `Request and hold card — ${quote ? money(quote.total_cost) : ''}`
                : 'Send request'}
            </button>

            {data.cardPayments && (
              <p style={{ fontSize: 12, color: '#6c7a89', marginTop: 8, textAlign: 'center', lineHeight: 1.5 }}>
                Your card is <strong>held, not charged</strong>. It's only taken once Lily
                confirms — if she can't take the booking, the hold is released and you pay nothing.
              </p>
            )}
          </>
        )}
      </section>
    </Shell>
  )
}

const fmt = (d) => {
  const s = String(d).slice(0, 10).split('-')
  return `${Number(s[1])}/${Number(s[2])}`
}

const Row = ({ l, r, bold }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', fontWeight: bold ? 700 : 400 }}>
    <span>{l}</span><span>{r}</span>
  </div>
)

const Banner = ({ tone, children }) => (
  <div style={{
    background: tone === 'ok' ? '#eafaf1' : '#fff8e1',
    border: `1px solid ${tone === 'ok' ? '#c3e6cb' : '#ffe0a3'}`,
    color: '#2c3e50', padding: '12px 14px', borderRadius: 8, marginBottom: 16, fontSize: 14,
  }}>{children}</div>
)

const Shell = ({ children }) => (
  <div style={{ minHeight: '100vh', background: '#fdf7f9', padding: '24px 16px' }}>
    <div style={{ maxWidth: 560, margin: '0 auto' }}>{children}</div>
  </div>
)

const card = {
  background: '#fff', border: '1px solid #f0d5de', borderRadius: 10,
  padding: '18px 20px', marginBottom: 16,
}
const h2 = { fontSize: 15, margin: '0 0 14px', color: '#2c3e50' }
const label = { display: 'block', fontSize: 13, fontWeight: 600, color: '#2c3e50', margin: '0 0 5px' }
const input = {
  width: '100%', padding: '10px 12px', fontSize: 15, marginBottom: 14,
  border: '1px solid #d9c3cb', borderRadius: 6, background: '#fff', color: '#2c3e50',
  boxSizing: 'border-box',
}
