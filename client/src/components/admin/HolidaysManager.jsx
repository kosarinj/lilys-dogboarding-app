import { useState, useEffect } from 'react'
import api from '../../utils/api'

/**
 * The holiday calendar behind the boarding surcharge.
 *
 * Built-ins can be switched off but not deleted — a deleted one would return
 * the next time the calendar is extended, so disabling is the action that
 * actually sticks. Custom ones she adds are hers and can be removed.
 */
const fmt = (d) => {
  const [y, m, day] = String(d).split('-').map(Number)
  return new Date(y, m - 1, day).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  })
}

export default function HolidaysManager() {
  const thisYear = new Date().getFullYear()
  const [year, setYear] = useState(thisYear)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState(null)
  const [newDate, setNewDate] = useState('')
  const [newName, setNewName] = useState('')
  const [rate, setRate] = useState('')

  const load = async (y = year) => {
    setLoading(true)
    try {
      const r = await api.get(`/holidays?year=${y}`)
      setData(r.data)
      setRate(String(r.data.surcharge ?? ''))
    } catch (e) {
      setMsg({ bad: true, text: e.response?.data?.error || 'Could not load' })
    } finally { setLoading(false) }
  }
  useEffect(() => { load(year) }, [year])

  const toggle = async (h) => {
    try {
      await api.patch(`/holidays/${h.id}`, { enabled: !h.enabled })
      load()
    } catch (e) { setMsg({ bad: true, text: 'Could not update' }) }
  }

  const remove = async (h) => {
    if (!window.confirm(`Remove ${h.name}?`)) return
    try {
      await api.delete(`/holidays/${h.id}`)
      load()
    } catch (e) {
      setMsg({ bad: true, text: e.response?.data?.error || 'Could not remove' })
    }
  }

  const add = async () => {
    if (!newDate || !newName.trim()) { setMsg({ bad: true, text: 'Date and name are both needed' }); return }
    try {
      await api.post('/holidays', { date: newDate, name: newName.trim() })
      setNewDate(''); setNewName('')
      setMsg({ text: 'Added' })
      load()
    } catch (e) {
      setMsg({ bad: true, text: e.response?.data?.error || 'Could not add' })
    }
  }

  const saveRate = async () => {
    const v = parseFloat(rate)
    if (!(v >= 0)) { setMsg({ bad: true, text: 'Enter an amount' }); return }
    try {
      await api.put('/settings/holiday_surcharge_per_day', { setting_value: v })
      setMsg({ text: `Surcharge set to $${v.toFixed(2)} a night` })
      load()
    } catch (e) { setMsg({ bad: true, text: 'Could not save the amount' }) }
  }

  const seedNext = async () => {
    try {
      const r = await api.post('/holidays/seed', { year: year + 1 })
      setMsg({ text: `Added ${r.data.added} date(s) for ${year + 1}` })
    } catch (e) { setMsg({ bad: true, text: 'Could not add that year' }) }
  }

  if (loading && !data) return <div style={{ padding: 20, color: '#6c7a89' }}>Loading…</div>

  const list = data?.holidays || []
  const on = list.filter(h => h.enabled).length

  return (
    <div style={{ padding: '4px 0' }}>
      <h1 style={{ fontSize: 22, margin: '0 0 4px' }}>Holidays</h1>
      <p style={{ color: '#6c7a89', fontSize: 13, margin: '0 0 16px' }}>
        Nights that fall on an enabled holiday get a surcharge, added automatically when
        a bill is created. A stay is charged for the nights it covers — a dog collected
        on Christmas Day isn't charged for it.
      </p>

      {msg && (
        <div style={{
          background: msg.bad ? '#fdecea' : '#eafaf1',
          border: `1px solid ${msg.bad ? '#f5c6cb' : '#c3e6cb'}`,
          padding: '10px 12px', borderRadius: 6, marginBottom: 12, fontSize: 14,
        }}>{msg.text}</div>
      )}

      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 18 }}>
        <div>
          <label style={lbl}>Surcharge per night</label>
          <div style={{ display: 'flex', gap: 6 }}>
            <input type="number" step="0.01" value={rate} onChange={e => setRate(e.target.value)}
                   style={{ ...inp, width: 100 }} />
            <button onClick={saveRate} style={{ ...btn, background: '#27ae60' }}>Save</button>
          </div>
        </div>
        <div>
          <label style={lbl}>Year</label>
          <select value={year} onChange={e => setYear(Number(e.target.value))} style={inp}>
            {[thisYear - 1, thisYear, thisYear + 1, thisYear + 2, thisYear + 3].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        <button onClick={seedNext} style={{ ...btn, background: '#95a5a6' }}>
          Add {year + 1} dates
        </button>
      </div>

      <div style={{ fontSize: 12, color: '#6c7a89', marginBottom: 8 }}>
        {on} of {list.length} enabled for {year}
      </div>

      <div style={{ background: '#fff', border: '1px solid #f0d5de', borderRadius: 10, overflow: 'hidden' }}>
        {list.map(h => (
          <div key={h.id} style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px',
            borderBottom: '1px solid #f4f4f4', opacity: h.enabled ? 1 : 0.5,
          }}>
            <input type="checkbox" checked={h.enabled} onChange={() => toggle(h)}
                   title={h.enabled ? 'Charged' : 'Not charged'}
                   style={{ width: 17, height: 17, cursor: 'pointer' }} />
            <span style={{ width: 140, fontSize: 13, color: '#2c3e50' }}>{fmt(h.date)}</span>
            <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: '#2c3e50' }}>
              {h.name}
              {h.custom && (
                <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: '#8e44ad' }}>ADDED</span>
              )}
            </span>
            {h.custom && (
              <button onClick={() => remove(h)} style={{ ...btn, background: '#c0392b', padding: '4px 9px', fontSize: 12 }}>
                Remove
              </button>
            )}
          </div>
        ))}
        {list.length === 0 && (
          <div style={{ padding: 20, color: '#6c7a89', fontSize: 14 }}>
            No dates for {year} yet — use “Add {year} dates”.
          </div>
        )}
      </div>

      <div style={{ marginTop: 18, background: '#fff', border: '1px solid #f0d5de', borderRadius: 10, padding: '14px 16px' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#2c3e50', marginBottom: 10 }}>Add a holiday</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <label style={lbl}>Date</label>
            <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} style={inp} />
          </div>
          <div style={{ flex: 1, minWidth: 180 }}>
            <label style={lbl}>Name</label>
            <input value={newName} onChange={e => setNewName(e.target.value)}
                   placeholder="e.g. Local festival weekend" style={{ ...inp, width: '100%' }} />
          </div>
          <button onClick={add} style={{ ...btn, background: '#e8547c' }}>Add</button>
        </div>
      </div>
    </div>
  )
}

const lbl = { display: 'block', fontSize: 12, fontWeight: 600, color: '#2c3e50', marginBottom: 4 }
const inp = {
  padding: '8px 10px', fontSize: 14, border: '1px solid #d9c3cb', borderRadius: 6,
  background: '#fff', color: '#2c3e50', boxSizing: 'border-box',
}
const btn = {
  padding: '8px 14px', fontSize: 13, fontWeight: 600, color: '#fff',
  border: 'none', borderRadius: 6, cursor: 'pointer',
}
