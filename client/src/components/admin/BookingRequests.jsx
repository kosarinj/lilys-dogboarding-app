import { useState, useEffect } from 'react'
import api from '../../utils/api'

/**
 * Requests waiting on Lily.
 *
 * Oldest first — this is a queue, and whoever asked first should be dealt with
 * first. Approving captures the held card and turns the request into an
 * ordinary stay; declining releases the hold so the customer pays nothing.
 */
const money = (n) => `$${Number(n || 0).toFixed(2)}`
// "14:30:00" -> "2:30pm". Times come back from Postgres with seconds, and the
// seconds are noise on a door-knock time.
const hhmm = (t) => {
  const [h, m] = String(t).split(':').map(Number)
  if (!Number.isFinite(h)) return ''
  const ampm = h >= 12 ? 'pm' : 'am'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return m ? `${h12}:${String(m).padStart(2, '0')}${ampm}` : `${h12}${ampm}`
}

const fmt = (d) => {
  const [y, m, day] = String(d).slice(0, 10).split('-')
  return `${Number(m)}/${Number(day)}/${String(y).slice(2)}`
}

export default function BookingRequests() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [busyId, setBusyId] = useState(null)
  const [note, setNote] = useState(null)
  const [editId, setEditId] = useState(null)
  const [draft, setDraft] = useState({})
  const [recent, setRecent] = useState([])

  const load = async () => {
    try {
      setLoading(true)
      const [pending, done] = await Promise.all([
        api.get('/stays/requests/pending'),
        api.get('/stays/requests/recent'),
      ])
      setRows(pending.data || [])
      setRecent(done.data || [])
      setError(null)
    } catch (e) {
      setError(e.response?.data?.error || 'Could not load requests')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  const startEdit = (row) => {
    setEditId(row.id)
    setNote(null)
    setDraft({
      check_in_date: String(row.check_in_date).slice(0, 10),
      check_out_date: String(row.check_out_date).slice(0, 10),
      check_in_time: (row.check_in_time || '09:00').slice(0, 5),
      check_out_time: (row.check_out_time || '09:00').slice(0, 5),
      requires_dropoff: !!row.requires_dropoff,
      requires_pickup: !!row.requires_pickup,
    })
  }

  const saveEdit = async (row) => {
    setBusyId(row.id)
    try {
      const r = await api.patch(`/stays/requests/${row.id}`, draft)
      // A card hold caps what can be collected, so a warning here matters more
      // than the save succeeding — surface it instead of just closing the form.
      setNote(r.data?.paymentWarning
        ? { tone: 'bad', text: `Saved — ${r.data.paymentWarning}` }
        : { tone: 'ok', text: `Updated. New total $${Number(r.data?.quote?.total_cost || 0).toFixed(2)}.` })
      setEditId(null)
      await load()
    } catch (e) {
      setNote({ tone: 'bad', text: e.response?.data?.error || 'Could not save' })
    } finally { setBusyId(null) }
  }

  const approve = async (row) => {
    setBusyId(row.id); setNote(null)
    try {
      const r = await api.post(`/stays/requests/${row.id}/approve`)
      // Approving told nobody. The customer's page does say "Confirmed", but
      // only if they think to look — so hand her the message ready to send.
      setNote({
        tone: 'ok',
        text: `Approved ${row.dog_name}. ${r.data?.note || ''}`.trim(),
        msgFor: row,
      })
      await load()
    } catch (e) {
      // A failed capture leaves it a request on purpose, so it can be chased
      // rather than silently becoming an unpaid confirmed booking.
      setNote({ tone: 'bad', text: e.response?.data?.error || 'Could not approve' })
    } finally { setBusyId(null) }
  }

  const decline = async (row) => {
    const reason = window.prompt(`Decline ${row.dog_name}'s request? Optional note for your records:`)
    if (reason === null) return
    setBusyId(row.id); setNote(null)
    try {
      await api.post(`/stays/requests/${row.id}/decline`, { reason })
      setNote({ tone: 'ok', text: `Declined. Any card hold has been released.` })
      await load()
    } catch (e) {
      setNote({ tone: 'bad', text: e.response?.data?.error || 'Could not decline' })
    } finally { setBusyId(null) }
  }

  const confirmMessage = (row) =>
    `Hi ${String(row.customer_name || '').split(' ')[0]}, you're all set — ` +
    `${row.dog_name} is booked in for ${fmt(row.check_in_date)}` +
    `${row.check_in_time ? ` at ${hhmm(row.check_in_time)}` : ''} ` +
    `through ${fmt(row.check_out_date)}` +
    `${row.check_out_time ? ` at ${hhmm(row.check_out_time)}` : ''}. ` +
    `Total is $${Number(row.total_cost || 0).toFixed(2)}. ` +
    `Venmo @lilykos or Zelle lilykos@me.com whenever suits. Thank you!`

  const copyMessage = async (row) => {
    const text = confirmMessage(row)
    try { await navigator.clipboard.writeText(text) }
    catch { window.prompt('Copy this message:', text) }
    setNote({ tone: 'ok', text: 'Message copied — paste it into a text.' })
  }

  const undo = async (row) => {
    if (!window.confirm(
      `Cancel ${row.dog_name}'s confirmed booking?` +
      (row.payment_state === 'captured' ? '\n\nThe card payment will be refunded.' : '')
    )) return
    setBusyId(row.id)
    try {
      const r = await api.post(`/stays/requests/${row.id}/undo`, {})
      setNote({ tone: 'ok', text: `Cancelled. ${r.data?.moneyNote || ''}`.trim() })
      await load()
    } catch (e) {
      setNote({ tone: 'bad', text: e.response?.data?.error || 'Could not cancel' })
    } finally { setBusyId(null) }
  }

  if (loading) return <div style={{ padding: 20, color: '#6c7a89' }}>Loading requests…</div>

  return (
    <div style={{ padding: '4px 0' }}>
      <h1 style={{ fontSize: 22, margin: '0 0 4px' }}>Booking requests</h1>
      <p style={{ color: '#6c7a89', fontSize: 13, margin: '0 0 16px' }}>
        Customers asking for dates. Nothing is confirmed until you approve it.
      </p>

      {error && <Msg tone="bad">{error}</Msg>}
      {note && (
        <Msg tone={note.tone}>
          {note.text}
          {note.msgFor && (
            <button onClick={() => copyMessage(note.msgFor)}
              style={{ marginLeft: 10, padding: '4px 10px', fontSize: 12, fontWeight: 600,
                       border: 'none', borderRadius: 4, background: '#2980b9', color: '#fff', cursor: 'pointer' }}>
              Copy message to send
            </button>
          )}
        </Msg>
      )}

      {rows.length === 0 ? (
        <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: 8, padding: 24, color: '#6c7a89' }}>
          Nothing waiting.
        </div>
      ) : null}

      {recent.length > 0 && (
        <details style={{ marginTop: 18, marginBottom: 8 }}>
          <summary style={{ cursor: 'pointer', fontSize: 13, color: '#6c7a89', fontWeight: 600 }}>
            Recently decided ({recent.length}) — cancel one here if it was a mistake
          </summary>
          <div style={{ marginTop: 10 }}>
            {recent.map(row => (
              <div key={row.id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10,
                background: '#fff', border: '1px solid #eee', borderRadius: 8,
                padding: '10px 12px', marginBottom: 8, flexWrap: 'wrap',
              }}>
                <div style={{ fontSize: 13 }}>
                  <strong>{row.dog_name}</strong> · {row.customer_name} ·{' '}
                  {fmt(row.check_in_date)}–{fmt(row.check_out_date)}
                  <span style={{
                    marginLeft: 8, fontWeight: 700,
                    color: row.status === 'cancelled' ? '#c0392b' : '#27ae60',
                  }}>
                    {row.status === 'cancelled' ? 'cancelled' : 'confirmed'}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {row.status !== 'cancelled' && (
                    <>
                      <button onClick={() => copyMessage(row)}
                        style={{ ...smallBtn, background: '#2980b9' }}>Copy message</button>
                      <button onClick={() => undo(row)} disabled={busyId === row.id}
                        style={{ ...smallBtn, background: '#c0392b' }}>Cancel</button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </details>
      )}

      {rows.length > 0 && rows.map(row => {
        const held = row.payment_state === 'authorized'
        return (
          <div key={row.id} style={{
            background: '#fff', border: '1px solid #f0d5de', borderRadius: 10,
            padding: '14px 16px', marginBottom: 12,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>
                  {row.dog_name} <span style={{ color: '#6c7a89', fontWeight: 400 }}>· {row.customer_name}</span>
                </div>
                <div style={{ fontSize: 14, color: '#2c3e50', marginTop: 2 }}>
                  {fmt(row.check_in_date)}{row.check_in_time ? ` ${hhmm(row.check_in_time)}` : ''}
                  {' – '}
                  {fmt(row.check_out_date)}{row.check_out_time ? ` ${hhmm(row.check_out_time)}` : ''}
                  {' · '}{row.days_count} day{Number(row.days_count) === 1 ? '' : 's'}
                </div>
                {(row.requires_dropoff || row.requires_pickup) && (
                  <div style={{ fontSize: 13, color: '#8e44ad', marginTop: 2, fontWeight: 600 }}>
                    🚗 {[row.requires_dropoff && 'drop-off', row.requires_pickup && 'pick-up']
                          .filter(Boolean).join(' + ')} requested
                  </div>
                )}
                <div style={{ fontSize: 13, color: '#6c7a89', marginTop: 2 }}>
                  {row.customer_phone || 'no phone'}{row.dog_size ? ` · ${row.dog_size}` : ''}
                </div>
                {row.notes && (
                  <div style={{ fontSize: 13, color: '#2c3e50', marginTop: 6, fontStyle: 'italic' }}>
                    “{row.notes}”
                  </div>
                )}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 700, fontSize: 18 }}>{money(row.total_cost)}</div>
                <div style={{
                  fontSize: 12, marginTop: 2, fontWeight: 600,
                  color: held ? '#27ae60' : '#b8860b',
                }}>
                  {held ? 'Card held' : row.payment_state === 'captured' ? 'Paid' : 'No card held'}
                </div>
              </div>
            </div>

            {editId === row.id && (
              <div style={{ marginTop: 12, padding: 12, background: '#fbf4f7', borderRadius: 8 }}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <Field label="Arrives">
                    <input type="date" value={draft.check_in_date} style={ed}
                           onChange={e => setDraft({ ...draft, check_in_date: e.target.value })} />
                  </Field>
                  <Field label="at">
                    <input type="time" value={draft.check_in_time} style={ed}
                           onChange={e => setDraft({ ...draft, check_in_time: e.target.value })} />
                  </Field>
                  <Field label="Leaves">
                    <input type="date" value={draft.check_out_date} style={ed}
                           onChange={e => setDraft({ ...draft, check_out_date: e.target.value })} />
                  </Field>
                  <Field label="at">
                    <input type="time" value={draft.check_out_time} style={ed}
                           onChange={e => setDraft({ ...draft, check_out_time: e.target.value })} />
                  </Field>
                </div>
                <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 13 }}>
                  <label style={{ cursor: 'pointer' }}>
                    <input type="checkbox" checked={draft.requires_dropoff}
                           onChange={e => setDraft({ ...draft, requires_dropoff: e.target.checked })} /> Drop-off
                  </label>
                  <label style={{ cursor: 'pointer' }}>
                    <input type="checkbox" checked={draft.requires_pickup}
                           onChange={e => setDraft({ ...draft, requires_pickup: e.target.checked })} /> Pick-up
                  </label>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <button onClick={() => saveEdit(row)} disabled={busyId === row.id}
                          style={{ ...btn, background: '#2980b9' }}>Save & reprice</button>
                  <button onClick={() => setEditId(null)} style={{ ...btn, background: '#95a5a6' }}>Cancel</button>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button onClick={() => startEdit(row)} disabled={busyId === row.id || editId === row.id}
                style={{ ...btn, background: '#2980b9', flex: '0 0 auto', padding: '10px 16px' }}>
                Edit
              </button>
              <button onClick={() => approve(row)} disabled={busyId === row.id}
                style={{ ...btn, background: '#27ae60' }}>
                {busyId === row.id ? '…' : held ? 'Approve & charge' : 'Approve'}
              </button>
              <button onClick={() => decline(row)} disabled={busyId === row.id}
                style={{ ...btn, background: '#c0392b' }}>
                Decline
              </button>
            </div>
            {held && (
              <div style={{ fontSize: 11.5, color: '#6c7a89', marginTop: 6 }}>
                Approving takes the money now. Holds expire after about a week, so approve promptly.
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

const smallBtn = {
  padding: '6px 10px', fontSize: 12, fontWeight: 600, color: '#fff',
  border: 'none', borderRadius: 5, cursor: 'pointer',
}

const btn = {
  flex: 1, padding: '10px 14px', fontSize: 14, fontWeight: 600, color: '#fff',
  border: 'none', borderRadius: 6, cursor: 'pointer',
}

const ed = {
  padding: '6px 8px', fontSize: 13, border: '1px solid #d9c3cb',
  borderRadius: 5, background: '#fff', color: '#2c3e50',
}

const Field = ({ label, children }) => (
  <div>
    <div style={{ fontSize: 11, color: '#6c7a89', marginBottom: 2 }}>{label}</div>
    {children}
  </div>
)

const Msg = ({ tone, children }) => (
  <div style={{
    background: tone === 'ok' ? '#eafaf1' : '#fdecea',
    border: `1px solid ${tone === 'ok' ? '#c3e6cb' : '#f5c6cb'}`,
    padding: '10px 12px', borderRadius: 6, marginBottom: 12, fontSize: 14,
  }}>{children}</div>
)
