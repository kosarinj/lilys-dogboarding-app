import { useState, useEffect } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import axios from 'axios'
import PayButtons from '../components/shared/PayButtons'

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
  // Times matter to Lily even when they don't change the price — she needs to
  // know when to expect someone at the door. Defaulted to a sensible morning
  // drop-off and pick-up so the common case needs no fiddling.
  const [inTime, setInTime] = useState('09:00')
  const [outTime, setOutTime] = useState('09:00')
  // Lily's collection / delivery service. Off by default — it costs extra, and
  // opting in should be a choice rather than something to notice and undo.
  const [wantDropoff, setWantDropoff] = useState(false)
  const [wantPickup, setWantPickup] = useState(false)
  const [quote, setQuote] = useState(null)
  const [quoteError, setQuoteError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [cancelling, setCancelling] = useState(null)
  const [cancelError, setCancelError] = useState(null)

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
        check_in_time: inTime, check_out_time: outTime,
        requires_dropoff: wantDropoff, requires_pickup: wantPickup,
      })
        .then(r => { if (!cancelledReq) { setQuote(r.data); setQuoteError(null) } })
        .catch(err => {
          if (cancelledReq) return
          setQuote(null)
          setQuoteError(err.response?.data?.error || 'Could not price those dates.')
        })
    }, 350)
    return () => { cancelledReq = true; clearTimeout(t) }
  }, [code, dogId, checkIn, checkOut, inTime, outTime, wantDropoff, wantPickup])

  const submit = async () => {
    setBusy(true)
    setQuoteError(null)
    try {
      const r = await axios.post(`${API}/book/${code}/request`, {
        dog_id: Number(dogId), check_in_date: checkIn, check_out_date: checkOut,
        check_in_time: inTime, check_out_time: outTime,
        requires_dropoff: wantDropoff, requires_pickup: wantPickup, notes,
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

  // Only a request she hasn't acted on. Once it's confirmed the dates are held
  // and she may have turned other people away, so that conversation goes
  // through her — the button would make it look like a customer's decision
  // alone when it isn't.
  const cancelRequest = async (stay) => {
    if (!window.confirm(
      `Cancel your request for ${stay.dog_name}, ${fmt(stay.check_in_date)}–${fmt(stay.check_out_date)}?`
    )) return
    setCancelling(stay.id); setCancelError(null)
    try {
      await axios.post(`${API}/book/${code}/cancel`, { stayId: stay.id })
      const r = await axios.get(`${API}/book/${code}`)
      setData(r.data)
    } catch (err) {
      setCancelError(err.response?.data?.error || 'Could not cancel — please text Lily.')
    } finally {
      setCancelling(null)
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
          <strong>Request sent.</strong> Lily will confirm shortly — nothing is booked until she does.
          {data.cardPayments && ' Your card is held but not charged; it only goes through when she approves.'}
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
          {cancelError && (
            <div style={{ fontSize: 13, color: '#c0392b', marginBottom: 8 }}>{cancelError}</div>
          )}
          {data.upcoming.map(s => (
            <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between',
                                     alignItems: 'center', gap: 10, padding: '6px 0', fontSize: 14 }}>
              <span>{s.dog_name} · {fmt(s.check_in_date)} – {fmt(s.check_out_date)}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{
                  fontWeight: 600,
                  color: s.status === 'requested' ? '#b8860b'
                       : s.paid ? '#27ae60' : '#e67e22',
                }}>
                  {s.status === 'requested' ? 'Awaiting confirmation'
                   : s.paid ? 'Confirmed' : 'Awaiting payment'}
                </span>
                {s.status === 'requested' && (
                  <button
                    onClick={() => cancelRequest(s)}
                    disabled={cancelling === s.id}
                    style={{
                      padding: '4px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      color: '#a4353a', background: '#fff', border: '1px solid #e8b4bd',
                      borderRadius: 5,
                    }}>
                    {cancelling === s.id ? 'Cancelling…' : 'Cancel'}
                  </button>
                )}
              </span>
            </div>
          ))}
          {/* Said once, here, rather than as a disabled button on every row —
              the answer to "how do I cancel this one" should be visible, not
              discovered by clicking something that doesn't work. */}
          {data.upcoming.some(s => s.status !== 'requested') && (
            <div style={{ fontSize: 12.5, color: '#6c7a89', marginTop: 8 }}>
              To change or cancel a confirmed stay, please text Lily.
            </div>
          )}
          {/* A confirmed stay is one she's agreed to, so it can be paid now.
              Nothing is owed on a request she hasn't accepted yet. */}
          {data.upcoming.some(s => s.status !== 'requested' && !s.paid) && !data.cardPayments && (
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #f0d5de' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#2c3e50', marginBottom: 8 }}>
                Pay for a confirmed stay
              </div>
              <PayButtons
                amount={data.upcoming.filter(s => s.status !== 'requested' && !s.paid)
                  .reduce((t, s) => t + Number(s.total_cost || 0), 0)}
                note="Dog boarding"
                compact
              />
            </div>
          )}
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

            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={label}>Drop-off time</label>
                <input type="time" value={inTime} onChange={e => setInTime(e.target.value)} style={input} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={label}>Pick-up time</label>
                <input type="time" value={outTime} onChange={e => setOutTime(e.target.value)} style={input} />
              </div>
            </div>

            <label style={label}>Transport</label>
            <div style={{ marginBottom: 14 }}>
              <Check checked={wantDropoff} onChange={setWantDropoff}
                     label={`Drop-off service${quote?.dropoff_fee > 0 ? ` — ${money(quote.dropoff_fee)}` : ''}`} />
              <Check checked={wantPickup} onChange={setWantPickup}
                     label={`Pick-up service${quote?.pickup_fee > 0 ? ` — ${money(quote.pickup_fee)}` : ''}`} />
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
                <Row l={`${quote.days_count} day${quote.days_count === 1 ? '' : 's'} at ${money(quote.daily_rate)}`} r={money(quote.boarding_cost)} />
                {quote.partial_day > 0 && (
                  <div style={{ fontSize: 12, color: '#6c7a89', margin: '-2px 0 4px' }}>
                    includes {quote.partial_day === 1 ? 'a full extra day' : 'a half day'} — pick-up is later than drop-off
                  </div>
                )}
                {quote.dropoff_fee > 0 && <Row l="Drop-off" r={money(quote.dropoff_fee)} />}
                {quote.pickup_fee > 0 && <Row l="Pick-up" r={money(quote.pickup_fee)} />}
                {quote.puppy_fee > 0 && <Row l="Puppy care" r={money(quote.puppy_fee)} />}
                {/* Named, not just added. A line saying "Holiday" invites the
                    question; "Labor Day" answers it before they ask. */}
                {quote.holiday_fee > 0 && (
                  <Row l={`Holiday — ${quote.holiday_note}`} r={money(quote.holiday_fee)} />
                )}
                <div style={{ borderTop: '1px solid #ffc9d9', marginTop: 8, paddingTop: 8 }}>
                  <Row bold l="Total" r={money(quote.grand_total ?? quote.total_cost)} />
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
                : data.cardPayments ? `Request and hold card — ${quote ? money(quote.grand_total ?? quote.total_cost) : ''}`
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

const Check = ({ checked, onChange, label: text }) => (
  <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0',
                  fontSize: 14, color: '#2c3e50', cursor: 'pointer' }}>
    <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)}
           style={{ width: 17, height: 17, cursor: 'pointer' }} />
    {text}
  </label>
)

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
