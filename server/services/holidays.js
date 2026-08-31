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
    [fromDate, toDate]
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
  const from = String(check_in_date).slice(0, 10)
  const to = String(check_out_date).slice(0, 10)
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
