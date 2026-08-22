/**
 * A DATE column as YYYY-MM-DD, whatever the driver handed back.
 *
 * node-postgres turns a DATE into a JS Date at LOCAL midnight, and there are
 * two ways to get this wrong from there:
 *
 *   String(date).slice(0, 10)      -> "Fri Aug 21"  — toString, not ISO. Fed
 *                                     back into a query it's a syntax error.
 *   date.toISOString().slice(0,10) -> right in a timezone behind UTC, and a day
 *                                     early in one ahead of it, because local
 *                                     midnight converted to UTC lands in the
 *                                     previous day.
 *
 * So: local components, never a UTC conversion. A date here is a calendar day —
 * the day the dog arrives — not an instant, and it shouldn't move with a zone.
 */
export function toDateStr(v) {
  if (!v) return null
  if (typeof v === 'string') return v.slice(0, 10)
  const d = v instanceof Date ? v : new Date(v)
  if (Number.isNaN(d.getTime())) return null
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

/** Today as YYYY-MM-DD in local time, for comparing against stored dates. */
export function todayStr() {
  return toDateStr(new Date())
}
