import { useState, useEffect, useRef } from 'react'
import { dogsAPI, uploadAPI } from '../../utils/api'
import { photoUrl } from '../../utils/photoUrl'
import './admin.css'

/**
 * Lily's photo gallery for one dog.
 *
 * The starred photos are what that dog's OWNER sees on their own booking page —
 * nobody else's. That's said in the panel rather than left to be inferred,
 * because "does this go somewhere public?" is the only question that matters
 * when she's deciding whether to star a picture, and she shouldn't have to
 * remember the answer.
 *
 * New uploads arrive starred. She has just chosen to add this picture of this
 * dog; making her then tick it as well is a second decision for one intent, and
 * unstarring is right there if she changes her mind.
 */
function DogPhotos({ dog, onClose }) {
  const [photos, setPhotos] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(0)
  const [error, setError] = useState(null)
  const fileInput = useRef(null)

  useEffect(() => { load() }, [dog.id])

  const load = async () => {
    try {
      setLoading(true)
      const r = await dogsAPI.listPhotos(dog.id)
      setPhotos(r.data)
      setError(null)
    } catch (err) {
      setError('Could not load photos. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // Several at once, because that's how photos of a dog actually arrive — she
  // takes six over a weekend, not one.
  const handleUpload = async (e) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return
    setError(null)
    setUploading(files.length)
    const added = []
    try {
      for (const file of files) {
        const up = await uploadAPI.uploadPhoto(file)
        const saved = await dogsAPI.addPhoto(dog.id, { url: up.data.url })
        added.push(saved.data)
        setUploading(n => n - 1)
      }
    } catch (err) {
      setError('Some photos failed to upload. Please try again.')
    } finally {
      setUploading(0)
      if (fileInput.current) fileInput.current.value = ''
      if (added.length) setPhotos(p => [...p, ...added])
    }
  }

  // Flip locally first: a star is a glance-and-click decision, and waiting on a
  // round trip to see it turn gold makes her click it twice.
  const toggleStar = async (photo) => {
    const next = !photo.in_collage
    setPhotos(p => p.map(x => (x.id === photo.id ? { ...x, in_collage: next } : x)))
    try {
      await dogsAPI.updatePhoto(photo.id, { in_collage: next })
    } catch (err) {
      setPhotos(p => p.map(x => (x.id === photo.id ? { ...x, in_collage: !next } : x)))
      setError('Could not save that change. Please try again.')
    }
  }

  const remove = async (photo) => {
    if (!window.confirm('Delete this photo?')) return
    try {
      await dogsAPI.deletePhoto(photo.id)
      setPhotos(p => p.filter(x => x.id !== photo.id))
    } catch (err) {
      setError('Could not delete that photo. Please try again.')
    }
  }

  const starred = photos.filter(p => p.in_collage).length

  return (
    <div className="form-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
        <div>
          <h2 style={{ marginBottom: 4 }}>Photos — {dog.name}</h2>
          <div style={{ fontSize: '13px', color: '#7f8c8d', lineHeight: 1.6 }}>
            Starred photos appear on {dog.customer_name ? `${dog.customer_name}'s` : 'the owner’s'} own
            booking page. Nobody else sees them.
            {photos.length > 0 && (
              <> · <strong>{starred}</strong> of {photos.length} starred</>
            )}
          </div>
        </div>
        <button onClick={onClose} className="btn btn-secondary" style={{ flexShrink: 0 }}>Done</button>
      </div>

      {error && <div className="error-state" style={{ marginTop: 16 }}>{error}</div>}

      <div className="form-group" style={{ marginTop: 20 }}>
        <label className="form-label">Add photos</label>
        <input
          ref={fileInput}
          type="file"
          className="form-input"
          onChange={handleUpload}
          accept="image/*"
          multiple
          disabled={uploading > 0}
        />
        {uploading > 0 && (
          <p style={{ fontSize: '13px', color: 'var(--theme-primary, #f472b6)', marginTop: '8px' }}>
            Uploading {uploading} photo{uploading === 1 ? '' : 's'}…
          </p>
        )}
      </div>

      {loading ? (
        <div className="loading-state">Loading photos…</div>
      ) : photos.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📸</div>
          <div className="empty-state-text">No photos of {dog.name} yet</div>
          <div className="empty-state-subtext">
            Add a few and star the ones you'd like {dog.customer_name || 'the owner'} to see
          </div>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
          gap: '14px',
          marginTop: '8px',
        }}>
          {photos.map(photo => (
            <div key={photo.id} style={{ position: 'relative' }}>
              <img
                src={photoUrl(photo.url)}
                alt={dog.name}
                style={{
                  width: '100%',
                  aspectRatio: '1',
                  objectFit: 'cover',
                  borderRadius: '10px',
                  display: 'block',
                  // The border is the answer to "is this one showing?" from
                  // across the room, so the star never has to be read.
                  border: photo.in_collage
                    ? '3px solid var(--theme-primary, #f472b6)'
                    : '3px solid #ececec',
                  opacity: photo.in_collage ? 1 : 0.72,
                }}
              />
              <button
                type="button"
                onClick={() => toggleStar(photo)}
                title={photo.in_collage ? 'Showing on their booking page' : 'Not shown'}
                style={{
                  position: 'absolute', top: 8, left: 8,
                  width: 30, height: 30, borderRadius: '50%',
                  border: 'none', cursor: 'pointer', fontSize: 15, lineHeight: '30px',
                  padding: 0, textAlign: 'center',
                  background: photo.in_collage ? 'var(--theme-primary, #f472b6)' : 'rgba(255,255,255,0.92)',
                  color: photo.in_collage ? '#fff' : '#95a5a6',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
                }}
              >
                {photo.in_collage ? '★' : '☆'}
              </button>
              <button
                type="button"
                onClick={() => remove(photo)}
                title="Delete photo"
                style={{
                  position: 'absolute', top: 8, right: 8,
                  width: 30, height: 30, borderRadius: '50%',
                  border: 'none', cursor: 'pointer', fontSize: 15, lineHeight: '30px',
                  padding: 0, textAlign: 'center',
                  background: 'rgba(255,255,255,0.92)', color: '#c0392b',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default DogPhotos
