/**
 * US holidays, computed rather than hard-coded.
 *
 * Most of these move: Thanksgiving is the fourth Thursday, Memorial Day the last
 * Monday, Easter follows the lunar calendar. A hand-typed list would be right
 * for one year and quietly wrong afterwards — and a boarding surcharge that
 * silently stops applying is worse than one that was never set up.
 *
 * The list leans toward the days people actually travel and need a dog looked
 * after, which is not the same as the federal holiday list: Christmas Eve and
 * New Year's Eve matter here, Columbus Day doesn't much.
 */

const iso = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`

/** The nth given weekday of a month. weekday: 0=Sun … 6=Sat. */
function nthWeekday(year, month, weekday, n) {
  const first = new Date(Date.UTC(year, month - 1, 1))
  const shift = (weekday - first.getUTCDay() + 7) % 7
  return iso(year, month, 1 + shift + (n - 1) * 7)
}

/** The last given weekday of a month. */
function lastWeekday(year, month, weekday) {
  const last = new Date(Date.UTC(year, month, 0))
  const shift = (last.getUTCDay() - weekday + 7) % 7
  return iso(year, month, last.getUTCDate() - shift)
}

/** Easter Sunday — anonymous Gregorian computus. */
function easter(year) {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return iso(year, month, day)
}

const addDays = (isoDate, n) => {
  const [y, m, d] = isoDate.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + n))
  return iso(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate())
}

/** Every holiday for one year, as { date, name }. */
export function holidaysForYear(year) {
  const thanksgiving = nthWeekday(year, 11, 4, 4)   // 4th Thursday of November
  const easterSunday = easter(year)
  return [
    { date: iso(year, 1, 1), name: "New Year's Day" },
    { date: nthWeekday(year, 1, 1, 3), name: 'Martin Luther King Jr. Day' },
    { date: nthWeekday(year, 2, 1, 3), name: "Presidents' Day" },
    { date: addDays(easterSunday, -2), name: 'Good Friday' },
    { date: easterSunday, name: 'Easter Sunday' },
    { date: lastWeekday(year, 5, 1), name: 'Memorial Day' },
    { date: iso(year, 6, 19), name: 'Juneteenth' },
    { date: iso(year, 7, 4), name: 'Independence Day' },
    { date: nthWeekday(year, 9, 1, 1), name: 'Labor Day' },
    { date: iso(year, 10, 31), name: 'Halloween' },
    { date: iso(year, 11, 11), name: 'Veterans Day' },
    { date: addDays(thanksgiving, -1), name: 'Thanksgiving Eve' },
    { date: thanksgiving, name: 'Thanksgiving' },
    { date: addDays(thanksgiving, 1), name: 'Day after Thanksgiving' },
    { date: iso(year, 12, 24), name: 'Christmas Eve' },
    { date: iso(year, 12, 25), name: 'Christmas Day' },
    { date: iso(year, 12, 26), name: 'Day after Christmas' },
    { date: iso(year, 12, 31), name: "New Year's Eve" },
  ]
}

/** Every holiday across a span of years. */
export function holidaysForYears(fromYear, toYear) {
  const out = []
  for (let y = fromYear; y <= toYear; y++) out.push(...holidaysForYear(y))
  return out
}
