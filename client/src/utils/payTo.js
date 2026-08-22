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
 * Venmo link with the amount and reason filled in.
 *
 * The recipient goes in the QUERY STRING, not the path. venmo.com/<user>?txn=pay
 * just loads a profile page and ignores the rest, which is why the button
 * appeared to do nothing — it opened a tab that looked like it had gone
 * nowhere. This is the documented pay form and actually prefills.
 *
 * On a phone Venmo's site hands off to the app; on a desktop it opens the web
 * flow behind a login. Either way the customer isn't retyping an amount, which
 * is where paying the wrong figure comes from.
 */
export function venmoLink(amount, note) {
  const params = new URLSearchParams({
    txn: 'pay',
    audience: 'private',
    recipients: PAY_TO.venmo,
  })
  if (amount > 0) params.set('amount', Number(amount).toFixed(2))
  if (note) params.set('note', note)
  return `https://venmo.com/?${params.toString()}`
}

/** The handle itself, for when the link doesn't get them there. */
export async function copyVenmo() {
  try {
    await navigator.clipboard.writeText(`@${PAY_TO.venmo}`)
    return true
  } catch {
    return false
  }
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
