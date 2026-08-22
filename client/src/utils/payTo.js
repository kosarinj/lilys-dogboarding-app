/**
 * Where money goes.
 *
 * One definition, because these were previously typed out separately in the
 * invoice view and the guest bill — and a handle that's right in one place and
 * stale in another sends a customer's money to nobody.
 */
export const PAY_TO = {
  venmo: 'lilykos',          // without the @
  zelle: 'lilykos@me.com',
  cash: true,
}

/**
 * Venmo deep link with the amount and reason filled in.
 *
 * On a phone this hands off to the Venmo app; on a desktop it opens the web
 * flow. Either way the customer isn't retyping an amount, which is where
 * paying the wrong figure comes from.
 */
export function venmoLink(amount, note) {
  const params = new URLSearchParams({ txn: 'pay' })
  if (amount > 0) params.set('amount', Number(amount).toFixed(2))
  if (note) params.set('note', note)
  return `https://venmo.com/${PAY_TO.venmo}?${params.toString()}`
}

/**
 * Zelle has no universal link — it lives inside each bank's own app, and there
 * is no scheme that reliably opens it. So the honest thing is to hand over the
 * address to send to and make it one tap to copy, rather than a button that
 * pretends to work and doesn't.
 */
export async function copyZelle() {
  try {
    await navigator.clipboard.writeText(PAY_TO.zelle)
    return true
  } catch {
    return false
  }
}
