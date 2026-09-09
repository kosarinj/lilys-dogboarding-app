import { photoUrl } from '../../utils/photoUrl'

/**
 * The customer's own dogs, on their own booking page.
 *
 * It sits behind the booking code deliberately. Before the code we don't know
 * who is looking, so any photos would be strangers' dogs and pure decoration.
 * After it we do — so these are their dogs, and the page stops being a form and
 * starts being about the pet they're booking for.
 *
 * Photos are whichever ones Lily starred in the Dogs screen, so nothing appears
 * here she didn't choose to put here.
 */

// Eight is where a tidy grid becomes a wall. She can star more; the page shows
// the first few, which is what a collage is.
const MAX = 8

export default function DogCollage({ photos = [], names = [] }) {
  const shown = photos.filter(p => p?.url).slice(0, MAX)
  if (shown.length === 0) return null

  // "Bailey", "Bailey & Max", "Bailey, Max & Nala" — read aloud, not joined
  // with commas and left at that.
  const list = names.filter(Boolean)
  const who = list.length === 0 ? null
    : list.length === 1 ? list[0]
    : `${list.slice(0, -1).join(', ')} & ${list[list.length - 1]}`

  // Few photos should be big, many should be small — one tile size for both
  // makes two photos look like an accident and eight look like a contact sheet.
  const min = shown.length <= 2 ? 150 : shown.length <= 4 ? 110 : 88

  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))`,
        gap: 8,
      }}>
        {shown.map((p, i) => (
          <img
            key={`${p.url}-${i}`}
            src={photoUrl(p.url)}
            alt={p.dog_name || 'Your dog'}
            loading="lazy"
            style={{
              width: '100%',
              aspectRatio: '1',
              objectFit: 'cover',
              display: 'block',
              borderRadius: 12,
              // A white edge and a soft shadow, so the tiles read as prints
              // laid down rather than a grid of boxes.
              border: '3px solid #fff',
              boxShadow: '0 2px 8px rgba(164, 53, 58, 0.14)',
            }}
          />
        ))}
      </div>
      {who && (
        <div style={{ fontSize: 13, color: '#6c7a89', marginTop: 8, textAlign: 'center' }}>
          {who} at Lily's 🐾
        </div>
      )}
    </div>
  )
}
