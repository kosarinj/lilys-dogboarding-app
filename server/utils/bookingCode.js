/**
 * Booking codes.
 *
 * Same shape and alphabet as the bill codes she already reads out over the
 * phone: no 0/O or 1/I/L, because these get spoken and mistyped.
 */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

export function generateBookingCode(length = 8) {
  let out = ''
  for (let i = 0; i < length; i++) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)]
  }
  return out
}
