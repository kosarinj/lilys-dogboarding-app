// Auto-update: notice when a newer build is deployed and reload to pick it up.
//
// Works without a service worker by comparing the content-hashed entry-bundle
// filename (e.g. /assets/index-BcjlFOYK.js) that THIS page booted with against
// the one the live index.html names. Vite changes that hash on every build, so a
// mismatch means a newer version is up.
//
// This exists for the iPhone home-screen app, which caches the old build hard
// and otherwise never picks up a deploy. Flynn's unpaid invoice showed the
// Venmo and Zelle buttons in a browser and not in the home-screen app, which is
// the shape of the problem: nobody thinks to suspect the phone is showing a
// build from weeks ago.
//
// Same approach as the PNL tracker's src/autoUpdate.js.

const CHECK_INTERVAL_MS = 5 * 60 * 1000 // and on focus / when the app becomes visible

function hashFrom(src) {
  if (!src) return null
  const m = String(src).match(/index-([A-Za-z0-9_-]+)\.js/)
  return m ? m[1] : null
}

// The bundle hash the running page loaded with (null in dev, which has no hash).
function bootedHash() {
  const el = document.querySelector('script[type="module"][src*="/assets/index-"]')
  return hashFrom(el && el.getAttribute('src'))
}

async function liveHash() {
  // index.html is served no-store; the query param defeats any cache in between.
  const res = await fetch(`/index.html?_=${Date.now()}`, { cache: 'no-store' })
  if (!res.ok) return null
  const html = await res.text()
  const m = html.match(/\/assets\/index-[A-Za-z0-9_-]+\.js/)
  return hashFrom(m && m[0])
}

let booted = null
let busy = false
let reloading = false

async function check() {
  if (busy || reloading) return
  busy = true
  try {
    const live = await liveHash()
    if (live && booted && live !== booted) {
      reloading = true
      window.location.reload()
    }
  } catch {
    /* offline or a transient network error — try again on the next check */
  } finally {
    busy = false
  }
}

export function startAutoUpdate() {
  booted = bootedHash()
  // No hashed bundle means dev mode or markup we don't recognise. Doing nothing
  // is important here: guessing would risk a reload loop.
  if (!booted) return

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') check()
  })
  window.addEventListener('focus', check)
  setInterval(check, CHECK_INTERVAL_MS)
}
