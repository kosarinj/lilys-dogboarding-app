import { query } from '../models/db.js'

/**
 * Holiday surcharge.
 *
 * A stay occupies the nights from check-in up to but NOT including check-out —
 * the same rule availability uses. So a dog dropped off on Christmas Eve and
 * collected on Boxing Day sleeps over the 24th and 25th: two holiday nights,
 * not three. Counting check-out would charge for a day the dog goes home.
 */

/** Enabled holidays between two dates, inclusive. */
export async function holidaysBetween(fromDate, toDate) {
  const r = await query(
    `SELECT holiday_date, name FROM holidays
     WHERE enabled = true AND holiday_date >= $1 AND holiday_date <= $2
     ORDER BY holiday_date`,
    [isoDate(fromDate), isoDate(toDate)]
  )
  return r.rows.map(h => ({
    // pg returns DATE as a Date; local components, not toISOString, which is
    // UTC and lands a day early in a timezone ahead of it.
    date: h.holiday_date instanceof Date ? localDate(h.holiday_date) : String(h.holiday_date).slice(0, 10),
    name: h.name,
  }))
}

function localDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// A date can reach us two ways: as 'YYYY-MM-DD' from a query string, or as a
// Date from pg, which parses a DATE column into one. String(aDate) gives
// 'Mon Dec 08 2025 ...', so slicing ten characters off it yields 'Mon Dec 08' —
// which Postgres rejects as a date. Normalise before either is used.
function isoDate(value) {
  if (value instanceof Date) return localDate(value)
  return String(value).slice(0, 10)
}

export async function getHolidaySurcharge() {
  const r = await query(
    `SELECT setting_value FROM settings WHERE setting_key = 'holiday_surcharge_per_day'`
  )
  const v = Number(r.rows[0]?.setting_value)
  return Number.isFinite(v) ? v : 17
}

/**
 * Which nights of a stay fall on a holiday, and what that adds.
 *
 * Returns the nights themselves rather than just a count, so a bill can say
 * WHICH holidays are being charged for. "Holiday surcharge $34" invites a
 * question; "Christmas Eve, Christmas Day" answers it before it's asked.
 */
export async function holidayChargeForStay({ check_in_date, check_out_date, contracts = 1 }) {
  const from = isoDate(check_in_date)
  const to = isoDate(check_out_date)
  if (!from || !to || to <= from) {
    // A same-day daycare visit has no overnight, but the day itself can still
    // be a holiday — charge that one day when it is.
    const sameDay = await holidaysBetween(from, from)
    const rate = await getHolidaySurcharge()
    return {
      nights: sameDay,
      count: sameDay.length,
      perNight: rate,
      total: Math.round(sameDay.length * rate * contracts * 100) / 100,
    }
  }

  // Up to but not including check-out.
  const dayBefore = addDays(to, -1)
  const found = await holidaysBetween(from, dayBefore)

  // Two holidays can share a date (Christmas Eve and a custom one). A night is
  // charged once however many names it carries.
  const byDate = new Map()
  found.forEach(h => {
    if (!byDate.has(h.date)) byDate.set(h.date, h.name)
    else byDate.set(h.date, `${byDate.get(h.date)} / ${h.name}`)
  })
  const nights = [...byDate.entries()].map(([date, name]) => ({ date, name }))

  const rate = await getHolidaySurcharge()
  return {
    nights,
    count: nights.length,
    perNight: rate,
    total: Math.round(nights.length * rate * contracts * 100) / 100,
  }
}

function addDays(isoDate, n) {
  const [y, m, d] = isoDate.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + n))
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`
}

/**
 * Work out a stay's holiday surcharge and store it on the stay.
 *
 * The calendar stays the authority — this is a cache of what it currently says,
 * not a decision frozen at booking time. Anything that changes which nights a
 * stay covers, or which nights are holidays, calls this again.
 *
 * Returns the amount, so a caller that has just quoted a price can use it
 * without reading the row back.
 */
export async function syncHolidayFee(stayId) {
  const r = await query(
    `SELECT id, check_in_date, check_out_date, status FROM stays WHERE id = $1`,
    [stayId]
  )
  const stay = r.rows[0]
  if (!stay) return 0

  // A cancelled stay is not going to be billed, and re-pricing one on a
  // calendar change would silently rewrite history.
  if (stay.status === 'cancelled') return 0

  const h = await holidayChargeForStay(stay)
  const note = h.nights.map(n => n.name).join(', ') || null
  await query(
    `UPDATE stays SET holiday_fee = $2, holiday_note = $3 WHERE id = $1`,
    [stayId, h.total, note]
  )
  return h.total
}

/**
 * Re-price every stay that could be affected by a calendar change.
 *
 * Scoped by date rather than run over the whole table: switching off Veterans
 * Day should not touch a stay in March. Cancelled and past-billed stays are
 * left alone — a stay that has already been invoiced has an agreed price, and
 * moving it after the fact is how a customer gets a bill that no longer matches
 * what they were told.
 */
export async function refreshHolidayFees({ from, to } = {}) {
  const params = []
  let where = `s.status <> 'cancelled' AND s.id NOT IN (SELECT stay_id FROM bill_items WHERE stay_id IS NOT NULL)`
  if (from && to) {
    // A stay is affected if it overlaps the changed window at all.
    params.push(from, to)
    where += ` AND s.check_in_date <= $2 AND s.check_out_date >= $1`
  }
  const r = await query(`SELECT s.id FROM stays s WHERE ${where}`, params)
  for (const row of r.rows) await syncHolidayFee(row.id)
  return r.rows.length
}
