/**
 * What a stay is actually worth, surcharge included.
 *
 * Mirrors stayTotal on the server. total_cost is boarding plus fees; the
 * holiday surcharge lives in its own column because total_cost means what it
 * always meant everywhere else. Every screen that shows a stay's money goes
 * through here — leaving it out is what made "total booked" read low.
 */
export function stayTotal(stay) {
  if (!stay) return 0
  const base = stay.special_price != null ? stay.special_price : stay.total_cost
  return Number(base || 0) + Number(stay.holiday_fee || 0)
}
