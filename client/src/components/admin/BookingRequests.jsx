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

  const load = async () => {
    try {
      setLoading(true)
      const r = await api.get('/stays/requests/pending')
      setRows(r.data || [])
      setError(null)
    } catch (e) {
      setError(e.response?.data?.error || 'Could not load requests')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  const approve = async (row) => {
    setBusyId(row.id); setNote(null)
    try {
      const r = await api.post(`/stays/requests/${row.id}/approve`)
      setNote({ tone: 'ok', text: `Approved ${row.dog_name}. ${r.data?.note || ''}`.trim() })
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

  if (loading) return <div style={{ padding: 20, color: '#6c7a89' }}>Loading requests…</div>

  return (
    <div style={{ padding: '4px 0' }}>
      <h1 style={{ fontSize: 22, margin: '0 0 4px' }}>Booking requests</h1>
      <p style={{ color: '#6c7a89', fontSize: 13, margin: '0 0 16px' }}>
        Customers asking for dates. Nothing is confirmed until you approve it.
      </p>

      {error && <Msg tone="bad">{error}</Msg>}
      {note && <Msg tone={note.tone}>{note.text}</Msg>}

      {rows.length === 0 ? (
        <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: 8, padding: 24, color: '#6c7a89' }}>
          Nothing waiting.
        </div>
      ) : rows.map(row => {
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
                  {fmt(row.check_in_date)} – {fmt(row.check_out_date)} · {row.days_count} night{row.days_count === 1 ? '' : 's'}
                </div>
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

            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
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

const btn = {
  flex: 1, padding: '10px 14px', fontSize: 14, fontWeight: 600, color: '#fff',
  border: 'none', borderRadius: 6, cursor: 'pointer',
}

const Msg = ({ tone, children }) => (
  <div style={{
    background: tone === 'ok' ? '#eafaf1' : '#fdecea',
    border: `1px solid ${tone === 'ok' ? '#c3e6cb' : '#f5c6cb'}`,
    padding: '10px 12px', borderRadius: 6, marginBottom: 12, fontSize: 14,
  }}>{children}</div>
)
