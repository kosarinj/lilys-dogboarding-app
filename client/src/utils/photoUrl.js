/**
 * Resolve a stored photo path for display.
 *
 * Cloudinary hands back an absolute URL; the local fallback used when
 * Cloudinary isn't configured hands back a server-relative one. Both live in
 * the same column, so anything rendering a photo has to cope with either.
 */
const ORIGIN = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace('/api', '')

export function photoUrl(url) {
  if (!url) return ''
  return url.startsWith('http') ? url : `${ORIGIN}${url}`
}
