import { useState } from 'react'
import { PAY_TO, venmoLink, copyZelle } from '../../utils/payTo'

/**
 * Venmo and Zelle, as actual buttons rather than text to copy out by hand.
 *
 * Venmo gets a real link with the amount prefilled — on a phone that opens the
 * app. Zelle can't: it lives inside each bank's own app and has no universal
 * scheme, so pretending otherwise would give a button that does nothing. It
 * copies the address instead and says that's what it did.
 */
export default function PayButtons({ amount, note, compact = false }) {
  const [copied, setCopied] = useState(false)

  const onZelle = async () => {
    const ok = await copyZelle()
    if (!ok) window.prompt('Send Zelle to:', PAY_TO.zelle)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <a
          href={venmoLink(amount, note)}
          target="_blank"
          rel="noopener noreferrer"
          style={{ ...btn, background: '#008CFF', textDecoration: 'none', textAlign: 'center' }}
        >
          Pay with Venmo{amount > 0 ? ` — $${Number(amount).toFixed(2)}` : ''}
        </a>
        <button onClick={onZelle} style={{ ...btn, background: '#6D1ED4' }}>
          {copied ? '✓ Zelle address copied' : 'Pay with Zelle'}
        </button>
      </div>

      <div style={{ fontSize: 12, color: '#6c7a89', marginTop: 8, lineHeight: 1.6 }}>
        {copied
          ? <>Send <strong>{amount > 0 ? `$${Number(amount).toFixed(2)}` : 'the amount'}</strong> to <strong>{PAY_TO.zelle}</strong> in your bank's app.</>
          : <>Venmo <strong>@{PAY_TO.venmo}</strong> · Zelle <strong>{PAY_TO.zelle}</strong>{PAY_TO.cash ? ' · cash accepted' : ''}</>}
      </div>

      {!compact && (
        <div style={{ fontSize: 11.5, color: '#95a5a6', marginTop: 6 }}>
          Zelle opens in your own bank's app, so it can't be launched from here — the
          address is copied for you instead.
        </div>
      )}
    </div>
  )
}

const btn = {
  flex: '1 1 160px', padding: '12px 16px', fontSize: 15, fontWeight: 700,
  color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer',
}
