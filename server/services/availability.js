import { query } from '../models/db.js'

const SIZE_RANK = { small: 1, medium: 2, large: 3 }

/**
 * Booking rules, read from settings so she can change them without a deploy.
 * Falls back to her current rules if a row is missing.
 */
export async function getBookingRules() {
  const r = await query(
    `SELECT setting_key, setting_value FROM settings
     WHERE setting_key IN ('max_dogs_per_night', 'max_dog_size')`
  )
  const map = Object.fromEntries(r.rows.map(x => [x.setting_key, Number(x.setting_value)]))
  return {
    maxPerNight: Number.isFinite(map.max_dogs_per_night) ? map.max_dogs_per_night : 3,
    maxSizeRank: Number.isFinite(map.max_dog_size) ? map.max_dog_size : 2,
  }
}

export function sizeAllowed(dogSize, maxSizeRank) {
  const rank = SIZE_RANK[String(dogSize || '').toLowerCase()]
  // An unknown size isn't refused — she has dogs on file without one, and this
  // is a request she reviews anyway, not an automatic confirmation.
  if (!rank) return true
  return rank <= maxSizeRank
}

/**
 * Which nights between two dates are already full.
 *
 * A stay occupies the nights from check-in up to but NOT including check-out:
 * a dog arriving Friday and leaving Sunday sleeps over Friday and Saturday, so
 * a dog arriving Sunday doesn't collide with it. Counting check-out as occupied
 * would refuse a booking that is genuinely fine, which is worse here than it
 * sounds — at three kennels one phantom night blocks a third of capacity.
 *
 * 'requested' counts toward the total on purpose. Two people asking for the
 * same weekend shouldn't both be told it's free; the second sees it as full
 * until Lily declines the first, which releases it.
 */
export async function nightlyCounts(fromDate, toDate, { excludeStayId = null } = {}) {
  const r = await query(
    `SELECT check_in_date, check_out_date
       FROM stays
      WHERE status IN ('requested', 'upcoming', 'active')
        AND check_in_date < $2
        AND check_out_date > $1
        ${excludeStayId ? 'AND id <> $3' : ''}`,
    excludeStayId ? [fromDate, toDate, excludeStayId] : [fromDate, toDate]
  )

  const counts = {}
  for (const row of r.rows) {
    const start = new Date(row.check_in_date)
    const end = new Date(row.check_out_date)
    for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
      const key = d.toISOString().slice(0, 10)
      counts[key] = (counts[key] || 0) + 1
    }
  }
  return counts
}

/** Every night in [checkIn, checkOut) as YYYY-MM-DD. */
export function nightsBetween(checkIn, checkOut) {
  const out = []
  const end = new Date(checkOut)
  for (let d = new Date(checkIn); d < end; d.setDate(d.getDate() + 1)) {
    out.push(d.toISOString().slice(0, 10))
  }
  return out
}

/**
 * Can these dates be requested? Returns the full nights so the caller can say
 * WHICH ones are the problem rather than just refusing.
 */
export async function checkAvailability(checkIn, checkOut, opts = {}) {
  const { maxPerNight } = await getBookingRules()
  const counts = await nightlyCounts(checkIn, checkOut, opts)
  const nights = nightsBetween(checkIn, checkOut)
  const fullNights = nights.filter(n => (counts[n] || 0) >= maxPerNight)
  return {
    available: fullNights.length === 0,
    fullNights,
    nights,
    maxPerNight,
    counts,
  }
}
