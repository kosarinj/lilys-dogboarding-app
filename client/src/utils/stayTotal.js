/**
 * What a stay is actually worth, surcharge included.
 *
 * Mirrors stayTotal on the server. total_cost is already the settled figure —
 * boarding (or the special price that replaced it) plus fees, less any Rover
 * discount — so it is the only base to read. special_price is the boarding
 * portion alone; preferring it dropped the delivery fees and the discount and
 * made special-rate stays read low.
 *
 * The holiday surcharge lives in its own column because total_cost means what
 * it always meant everywhere else, so it is added here. Every screen that shows
 * a stay's money goes through this — leaving it out is what made "total booked"
 * read low.
 */
export function stayTotal(stay) {
  if (!stay) return 0
  return Number(stay.total_cost || 0) + Number(stay.holiday_fee || 0)
}
