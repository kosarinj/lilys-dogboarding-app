import { randomInt } from 'node:crypto'

/**
 * Booking and bill codes.
 *
 * Alphabet excludes 0/O and 1/I/L because these get read out over the phone.
 *
 * crypto.randomInt, not Math.random: the code IS the credential. There's no
 * password behind it, so anyone holding one can see a customer's details and
 * put a charge on their card. Math.random is a predictable PRNG — observing a
 * few outputs can expose its internal state and let the rest be derived, which
 * is exactly the wrong property for a secret. randomInt is also free of the
 * modulo bias you get from `% alphabet.length`.
 *
 * 8 characters from 31 gives ~8.5e11 combinations, which is far too many to
 * guess at over the network.
 */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

export function generateBookingCode(length = 8) {
  let out = ''
  for (let i = 0; i < length; i++) {
    out += ALPHABET[randomInt(ALPHABET.length)]
  }
  return out
}
