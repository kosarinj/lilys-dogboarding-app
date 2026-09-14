import { useState, useEffect } from 'react'
import api from '../../utils/api'

/**
 * What's been paid.
 *
 * Lily marks a stay paid when the Venmo, Zelle or cash arrives, and it lands
 * here. Until texting is approved the thank-you goes out by hand, so each row
 * carries the message ready to copy, and remembers that it was copied — the
 * "still to thank" count is what tells her whether anyone's been missed.
 */
const money = (n) => `$${Number(n || 0).toFixed(2)}`

const fmt = (d) => {
  const [y, m, day] = String(d).slice(0, 10).split('-')
  return `${Number(m)}/${Number(day)}/${String(y).slice(2)}`
}

const paidWhen = (ts) => {
  if (!ts) return ''
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const METHOD = { venmo: 'Venmo', zelle: 'Zelle', cash: 'Cash' }
const methodLabel = (row) =>
  row.payment_state === 'captured' ? 'Card' : (METHOD[row.payment_method] || row.payment_method || '—')

export default function PaidStays() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [onlyUnthanked, setOnlyUnthanked] = useState(false)
  const [copiedId, setCopiedId] = useState(null)

  const load = async () => {
    try {
      const r = await api.get('/stays/paid')
      setRows(r.data || [])
      setError(null)
    } catch (e) {
      setError(e.response?.data?.error || 'Could not load payments')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  const copy = async (row) => {
    try { await navigator.clipboard.writeText(row.message) }
    catch { window.prompt('Copy this message:', row.message) }
    setCopiedId(row.id)
    setTimeout(() => setCopiedId(null), 2000)
    try {
      const r = await api.post(`/stays/${row.id}/thanked`, {})
      setRows(rs => rs.map(x => x.id === row.id ? { ...x, thanked_at: r.data.thanked_at } : x))
    } catch { /* the copy still worked */ }
  }

  const unthank = async (row) => {
    try {
      await api.post(`/stays/${row.id}/thanked`, { clear: true })
      setRows(rs => rs.map(x => x.id === row.id ? { ...x, thanked_at: null } : x))
    } catch { setError('Could not undo') }
  }

  if (loading) return <div style={{ padding: 20, color: '#6c7a89' }}>Loading payments…</div>

  const q = search.trim().toLowerCase()
  const shown = rows.filter(r =>
    (!onlyUnthanked || !r.thanked_at) &&
    (!q || r.dog_name?.toLowerCase().includes(q) || r.customer_name?.toLowerCase().includes(q))
  )
  const unthanked = rows.filter(r => !r.thanked_at).length
  const total = shown.reduce((sum, r) => sum + Number(r.amount || 0), 0)

  return (
    <div style={{ padding: '4px 0' }}>
      <h1 style={{ fontSize: 22, margin: '0 0 4px' }}>Paid</h1>
      <p style={{ color: '#6c7a89', fontSize: 13, margin: '0 0 14px' }}>
        Every stay that's been paid, newest first. Copy the thank-you and text it to the customer.
      </p>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
        <div style={stat}>
          <div style={statLabel}>{q || onlyUnthanked ? 'Shown' : 'Total paid'}</div>
          <div style={statValue}>{money(total)}</div>
        </div>
        <div style={stat}>
          <div style={statLabel}>Stays</div>
          <div style={statValue}>{shown.length}</div>
        </div>
        <div style={{ ...stat, borderColor: unthanked ? '#f5c48a' : '#eee' }}>
          <div style={statLabel}>Still to thank</div>
          <div style={{ ...statValue, color: unthanked ? '#e67e22' : '#27ae60' }}>{unthanked}</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search dog or customer"
          style={{ padding: '7px 10px', fontSize: 13, borderRadius: 5, border: '1px solid #d9c3cb', width: 220 }}
        />
        <label style={{ fontSize: 13, cursor: 'pointer' }}>
          <input type="checkbox" checked={onlyUnthanked} onChange={e => setOnlyUnthanked(e.target.checked)} />
          {' '}Only ones not thanked yet
        </label>
      </div>

      {error && (
        <div style={{ background: '#fdecea', border: '1px solid #f5c6cb', padding: '10px 12px',
                      borderRadius: 6, marginBottom: 12, fontSize: 14 }}>{error}</div>
      )}

      {shown.length === 0 && (
        <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: 8, padding: 24, color: '#6c7a89' }}>
          {rows.length === 0 ? 'Nothing marked paid yet.' : 'Nothing matches.'}
        </div>
      )}

      {shown.map(row => (
        <div key={row.id} style={{
          background: '#fff', border: `1px solid ${row.thanked_at ? '#eee' : '#f0d5de'}`,
          borderRadius: 10, padding: '12px 14px', marginBottom: 10,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>
                {row.dog_name} <span style={{ color: '#6c7a89', fontWeight: 400 }}>· {row.customer_name}</span>
              </div>
              <div style={{ fontSize: 13, color: '#2c3e50', marginTop: 2 }}>
                {fmt(row.check_in_date)} – {fmt(row.check_out_date)}
                {row.customer_phone ? <span style={{ color: '#6c7a89' }}> · {row.customer_phone}</span> : null}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{money(row.amount)}</div>
              <div style={{ fontSize: 12, color: '#27ae60', fontWeight: 600 }}>
                {methodLabel(row)}{row.paid_at ? ` · ${paidWhen(row.paid_at)}` : ''}
              </div>
            </div>
          </div>

          <div style={{ marginTop: 10, padding: '8px 10px', background: '#fbf4f7', borderRadius: 6,
                        fontSize: 13, color: '#2c3e50' }}>
            {row.message}
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 8, flexWrap: 'wrap' }}>
            <button onClick={() => copy(row)} style={{
              padding: '6px 12px', fontSize: 12.5, fontWeight: 600, color: '#fff', border: 'none',
              borderRadius: 5, cursor: 'pointer', background: copiedId === row.id ? '#27ae60' : '#2980b9',
            }}>
              {copiedId === row.id ? '✓ Copied' : 'Copy thank-you'}
            </button>
            {row.thanked_at ? (
              <span style={{ fontSize: 12, color: '#27ae60' }}>
                ✓ Thanked {paidWhen(row.thanked_at)}
                <button onClick={() => unthank(row)} style={{
                  marginLeft: 6, border: 'none', background: 'transparent', color: '#95a5a6',
                  cursor: 'pointer', textDecoration: 'underline', fontSize: 11,
                }}>undo</button>
              </span>
            ) : (
              <span style={{ fontSize: 12, color: '#e67e22', fontWeight: 600 }}>Not thanked yet</span>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

const stat = { background: '#fff', border: '1px solid #eee', borderRadius: 8, padding: '8px 14px', minWidth: 110 }
const statLabel = { fontSize: 11.5, color: '#6c7a89' }
const statValue = { fontSize: 18, fontWeight: 700, color: '#2c3e50' }
