import { query } from '../models/db.js'

/**
 * What a stay costs.
 *
 * Extracted so the customer-facing quote and the stay Lily creates come from
 * one place. Quoting separately would be the obvious shortcut and a bad one:
 * the two would drift the first time a fee changed, and a customer told $300
 * who is then billed $340 is a worse problem than any bug in here.
 *
 * Mirrors the calculation that lived inline in POST /api/stays.
 */

/**
 * Extra charge when pick-up is later in the day than drop-off was.
 * 2–7 hours later adds half a day, 8+ adds a full one. Mirrors the rule in
 * POST /api/stays so a customer's quote matches what she would have charged.
 */
export function getPartialDayAddition(check_in_time, check_out_time) {
  if (!check_in_time || !check_out_time) return 0
  const [inH, inM] = String(check_in_time).split(':').map(Number)
  const [outH, outM] = String(check_out_time).split(':').map(Number)
  if ([inH, inM, outH, outM].some(n => !Number.isFinite(n))) return 0
  const hours = ((outH * 60 + outM) - (inH * 60 + inM)) / 60
  if (hours >= 8) return 1.0
  if (hours >= 2) return 0.5
  return 0
}

export async function getFees() {
  const result = await query(`SELECT setting_key, setting_value FROM settings WHERE setting_key IN (
    'dropoff_fee', 'pickup_fee',
    'boarding_puppy_fee_regular', 'boarding_puppy_fee_holiday',
    'daycare_puppy_fee_regular', 'daycare_puppy_fee_holiday'
  )`)
  const fees = {}
  result.rows.forEach(row => { fees[row.setting_key] = parseFloat(row.setting_value) })
  return {
    dropoff: fees.dropoff_fee || 15.00,
    pickup: fees.pickup_fee || 15.00,
    boardingPuppyRegular: fees.boarding_puppy_fee_regular || 0,
    boardingPuppyHoliday: fees.boarding_puppy_fee_holiday || 0,
    daycarePuppyRegular: fees.daycare_puppy_fee_regular || 0,
    daycarePuppyHoliday: fees.daycare_puppy_fee_holiday || 0,
  }
}

export function getPuppyFee(fees, stay_type, rate_type) {
  if (stay_type === 'boarding') {
    return rate_type === 'holiday' ? fees.boardingPuppyHoliday : fees.boardingPuppyRegular
  }
  return rate_type === 'holiday' ? fees.daycarePuppyHoliday : fees.daycarePuppyRegular
}

/**
 * Price a stay for a dog whose record supplies size and any overrides.
 * Returns every component, so a quote can be itemised rather than presented as
 * a single number the customer has to take on trust.
 */
export async function quoteStay({
  dog_id, days_count, stay_type = 'boarding', rate_type = 'regular',
  requires_dropoff = false, requires_pickup = false,
  extra_charge = 0, is_puppy = false,
}) {
  const dogResult = await query(
    'SELECT size, custom_daily_rate, pickup_fee_override, dropoff_fee_override FROM dogs WHERE id = $1',
    [dog_id]
  )
  if (dogResult.rows.length === 0) throw new Error('Dog not found')
  const dog = dogResult.rows[0]

  let daily_rate
  if (dog.custom_daily_rate != null) {
    daily_rate = parseFloat(dog.custom_daily_rate)
  } else {
    const rateResult = await query(
      'SELECT price_per_day FROM rates WHERE dog_size = $1 AND rate_type = $2 AND service_type = $3',
      [dog.size, rate_type, stay_type]
    )
    if (rateResult.rows.length === 0) {
      throw new Error('Rate not found for this dog size, rate type, and service type')
    }
    daily_rate = parseFloat(rateResult.rows[0].price_per_day)
  }

  const fees = await getFees()
  // Daycare charges delivery per day; boarding once at each end.
  const fee_multiplier = stay_type === 'daycare' ? Math.ceil(days_count) : 1
  const dropoff_rate = dog.dropoff_fee_override != null ? parseFloat(dog.dropoff_fee_override) : fees.dropoff
  const pickup_rate = dog.pickup_fee_override != null ? parseFloat(dog.pickup_fee_override) : fees.pickup
  const dropoff_fee = requires_dropoff ? dropoff_rate * fee_multiplier : 0
  const pickup_fee = requires_pickup ? pickup_rate * fee_multiplier : 0
  const extra_charge_amount = extra_charge ? parseFloat(extra_charge) : 0
  const puppy_fee = is_puppy ? getPuppyFee(fees, stay_type, rate_type) * days_count : 0

  const boarding_cost = daily_rate * days_count
  const total_cost = boarding_cost + dropoff_fee + pickup_fee + puppy_fee + extra_charge_amount

  return {
    dog_size: dog.size,
    daily_rate,
    days_count,
    boarding_cost: round2(boarding_cost),
    dropoff_fee: round2(dropoff_fee),
    pickup_fee: round2(pickup_fee),
    puppy_fee: round2(puppy_fee),
    extra_charge: round2(extra_charge_amount),
    total_cost: round2(total_cost),
  }
}

function round2(n) { return Math.round(Number(n) * 100) / 100 }
