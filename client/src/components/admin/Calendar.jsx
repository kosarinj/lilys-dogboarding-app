import { useState, useEffect, useMemo } from 'react'
import { staysAPI } from '../../utils/api'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const ymd = (d) => {
  const dt = (d instanceof Date) ? d : new Date(d)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}
const only = (s) => String(s || '').slice(0, 10)
const pretty = (s) => { const [y, m, d] = only(s).split('-'); return `${m}/${d}/${y}` }

function Calendar() {
  const [stays, setStays] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const today = ymd(new Date())
  const [cal, setCal] = useState(() => { const d = new Date(); return { year: d.getFullYear(), month: d.getMonth() } })
  const [selected, setSelected] = useState(today)
  const [showBanner, setShowBanner] = useState(true)

  useEffect(() => {
    staysAPI.getAll()
      .then(res => { setStays(Array.isArray(res.data) ? res.data : []); setLoading(false) })
      .catch(e => { setError(e.response?.data?.error || e.message); setLoading(false) })
  }, [])

  const tomorrow = useMemo(() => { const d = new Date(); d.setDate(d.getDate() + 1); return ymd(d) }, [])

  // Stays overlapping a given day (check-in ≤ day ≤ check-out)
  const staysOn = (day) => stays.filter(s => only(s.check_in_date) <= day && day <= only(s.check_out_date))
  const checkInsOn = (day) => stays.filter(s => only(s.check_in_date) === day)
  const checkOutsOn = (day) => stays.filter(s => only(s.check_out_date) === day)

  const todays = staysOn(today)
  const tomorrowArrivals = checkInsOn(tomorrow)

  // Build the month grid
  const firstDow = new Date(cal.year, cal.month, 1).getDay()
  const daysInMonth = new Date(cal.year, cal.month + 1, 0).getDate()
  const cells = []
  for (let i = 0; i < firstDow; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  const prev = () => setCal(c => c.month === 0 ? { year: c.year - 1, month: 11 } : { year: c.year, month: c.month - 1 })
  const next = () => setCal(c => c.month === 11 ? { year: c.year + 1, month: 0 } : { year: c.year, month: c.month + 1 })
  const goToday = () => { const d = new Date(); setCal({ year: d.getFullYear(), month: d.getMonth() }); setSelected(today) }

  const selectedStays = staysOn(selected)
  const navBtn = { border: '1px solid #ddd', background: 'white', borderRadius: 6, padding: '4px 12px', cursor: 'pointer', fontSize: 16 }
  const card = { background: 'white', borderRadius: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', padding: 16 }

  return (
    <div>
      <h1 style={{ marginBottom: 12 }}>📅 Boarding Calendar</h1>

      {/* Today / tomorrow alert */}
      {showBanner && !loading && (todays.length > 0 || tomorrowArrivals.length > 0) && (
        <div style={{ background: '#fff8e1', border: '1px solid #ffe082', borderRadius: 10, padding: '12px 16px', marginBottom: 16, position: 'relative' }}>
          <button onClick={() => setShowBanner(false)} style={{ position: 'absolute', top: 8, right: 10, border: 'none', background: 'transparent', fontSize: 18, cursor: 'pointer', color: '#8a6d00' }}>×</button>
          {todays.length > 0 && (
            <div style={{ marginBottom: tomorrowArrivals.length ? 8 : 0 }}>
              <strong>🐾 Today ({pretty(today)}):</strong> {todays.length} dog{todays.length !== 1 ? 's' : ''} boarding —{' '}
              {todays.map(s => s.dog_name).join(', ')}
              {checkOutsOn(today).length > 0 && <span style={{ color: '#c0392b' }}> · {checkOutsOn(today).length} checking out</span>}
            </div>
          )}
          {tomorrowArrivals.length > 0 && (
            <div>
              <strong>⏰ Heads up — tomorrow ({pretty(tomorrow)}):</strong> {tomorrowArrivals.length} check-in{tomorrowArrivals.length !== 1 ? 's' : ''} arriving —{' '}
              {tomorrowArrivals.map(s => `${s.dog_name} (${s.customer_name})`).join(', ')}
            </div>
          )}
        </div>
      )}

      {error && <div style={{ background: '#fee', color: '#c33', padding: 10, borderRadius: 8, marginBottom: 12 }}>{error}</div>}

      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {/* Month grid */}
        <div style={{ ...card, flex: '1 1 420px', minWidth: 300 }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12, gap: 8 }}>
            <button style={navBtn} onClick={prev}>‹</button>
            <div style={{ flex: 1, textAlign: 'center', fontSize: 18, fontWeight: 700 }}>{MONTHS[cal.month]} {cal.year}</div>
            <button style={navBtn} onClick={next}>›</button>
            <button style={{ ...navBtn, fontSize: 13 }} onClick={goToday}>Today</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
            {DOW.map(d => <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 600, color: '#888', paddingBottom: 4 }}>{d}</div>)}
            {cells.map((day, i) => {
              if (!day) return <div key={`e${i}`} />
              const ds = `${cal.year}-${String(cal.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
              const occ = staysOn(ds).length
              const ins = checkInsOn(ds).length
              const outs = checkOutsOn(ds).length
              const isToday = ds === today
              const isSel = ds === selected
              return (
                <button key={day} onClick={() => setSelected(ds)}
                  style={{
                    minHeight: 58, padding: '4px 3px', borderRadius: 8, cursor: 'pointer', textAlign: 'left',
                    border: isSel ? '2px solid #3498db' : isToday ? '2px solid #f39c12' : '1px solid #eee',
                    background: occ ? '#eaf4fb' : 'white', position: 'relative'
                  }}>
                  <div style={{ fontSize: 12, fontWeight: isToday ? 700 : 500, color: isToday ? '#e67e22' : '#333' }}>{day}</div>
                  {occ > 0 && (
                    <div style={{ marginTop: 2, fontSize: 10, fontWeight: 700, color: '#2471a3' }}>{occ} 🐕</div>
                  )}
                  <div style={{ position: 'absolute', bottom: 3, right: 4, display: 'flex', gap: 2 }}>
                    {ins > 0 && <span title={`${ins} check-in`} style={{ width: 7, height: 7, borderRadius: '50%', background: '#27ae60', display: 'inline-block' }} />}
                    {outs > 0 && <span title={`${outs} check-out`} style={{ width: 7, height: 7, borderRadius: '50%', background: '#e74c3c', display: 'inline-block' }} />}
                  </div>
                </button>
              )
            })}
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 12, fontSize: 12, color: '#666' }}>
            <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#27ae60', marginRight: 4 }} />Check-in</span>
            <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#e74c3c', marginRight: 4 }} />Check-out</span>
            <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, background: '#eaf4fb', border: '1px solid #cde', marginRight: 4 }} />Boarding</span>
          </div>
        </div>

        {/* Selected-day detail */}
        <div style={{ ...card, flex: '1 1 300px', minWidth: 260 }}>
          <h3 style={{ marginTop: 0, marginBottom: 4 }}>{pretty(selected)}{selected === today ? ' · Today' : ''}</h3>
          {loading ? <p style={{ color: '#888' }}>Loading…</p> : selectedStays.length === 0 ? (
            <p style={{ color: '#888' }}>No dogs boarding this day.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {selectedStays.map(s => {
                const isIn = only(s.check_in_date) === selected
                const isOut = only(s.check_out_date) === selected
                return (
                  <div key={s.id} style={{ border: '1px solid #eee', borderRadius: 8, padding: '8px 10px' }}>
                    <div style={{ fontWeight: 700 }}>
                      {s.dog_name} <span style={{ fontWeight: 400, color: '#888', fontSize: 13 }}>· {s.customer_name}</span>
                    </div>
                    <div style={{ fontSize: 12, color: '#555', marginTop: 2 }}>
                      {pretty(s.check_in_date)} → {pretty(s.check_out_date)} · {s.stay_type || 'boarding'}
                    </div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 5, flexWrap: 'wrap' }}>
                      {isIn && <span style={{ fontSize: 11, fontWeight: 600, color: '#1e824c', background: '#e6f6ec', padding: '2px 7px', borderRadius: 10 }}>▶ Checks in</span>}
                      {isOut && <span style={{ fontSize: 11, fontWeight: 600, color: '#a93226', background: '#fdecea', padding: '2px 7px', borderRadius: 10 }}>■ Checks out</span>}
                      {!isIn && !isOut && <span style={{ fontSize: 11, fontWeight: 600, color: '#2471a3', background: '#eaf4fb', padding: '2px 7px', borderRadius: 10 }}>Boarding</span>}
                      {s.customer_phone && <a href={`tel:${s.customer_phone}`} style={{ fontSize: 11, color: '#3498db', textDecoration: 'none' }}>📞 {s.customer_phone}</a>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Calendar
