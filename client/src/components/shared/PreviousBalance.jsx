/**
 * "Previous balance" on an invoice: what the customer still owes from earlier
 * invoices, with the stays it covers named in brackets.
 *
 * Rendered from `bill.previous_balance`, which the server works out, so the copy
 * Lily reads and the copy the customer opens can't disagree. The older stays are
 * NOT copied onto this invoice — they stay on their own, or they would be counted
 * twice everywhere a total is added up.
 *
 * One component for both invoice views, because two hand-written versions of a
 * money line is how they drift apart.
 */

const fmt = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(n) || 0)

// Parsed from the YYYY-MM-DD the server sends, by parts — passing a date string
// to new Date() reads it as UTC and can land a day early.
const parts = (value) => {
  if (!value) return null
  const [y, m, d] = String(value).slice(0, 10).split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return isNaN(date.getTime()) ? null : { date, m, d }
}

// Mar 3 — no year, since a previous balance is recent by nature and the year
// makes the bracket long enough to wrap.
const day = (p) => p && p.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

/** "Flynn, Sep 23–24" — a single-day stay gets one date, not a range. */
const describe = ({ dog_name, check_in_date, check_out_date }) => {
  const from = parts(check_in_date)
  const to = parts(check_out_date)
  let when = day(from)
  if (from && to && to.d !== from.d) {
    // Same month needs the month said once: "Sep 23–24", not "Sep 23–Sep 24".
    when = to.m === from.m ? `${when}–${to.d}` : `${when}–${day(to)}`
  }
  return [dog_name, when].filter(Boolean).join(', ')
}

export default function PreviousBalance({ previous, labelStyle, valueStyle }) {
  if (!previous || !(Number(previous.total) > 0)) return null

  const stays = (previous.bills || []).flatMap(b => b.stays || []).map(describe).filter(Boolean)

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', marginBottom: '12px' }}>
      <span style={labelStyle}>
        Previous balance
        {stays.length > 0 && (
          <span style={{ fontSize: '13px', color: '#7f8c8d', fontWeight: 400 }}> ({stays.join('; ')})</span>
        )}
      </span>
      <span style={valueStyle}>{fmt(previous.total)}</span>
    </div>
  )
}
