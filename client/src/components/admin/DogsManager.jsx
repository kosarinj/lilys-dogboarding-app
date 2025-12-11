import { useState, useEffect } from 'react'
import { dogsAPI, customersAPI, uploadAPI } from '../../utils/api'
import './admin.css'

function DogsManager() {
  const [dogs, setDogs] = useState([])
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [editingDog, setEditingDog] = useState(null)
  const [formData, setFormData] = useState({
    customer_id: '',
    name: '',
    breed: '',
    age: '',
    age_months: '',
    location: '',
    size: 'medium',
    food_preferences: '',
    behavioral_notes: '',
    special_instructions: '',
    photo_url: ''
  })
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const [dogsRes, customersRes] = await Promise.all([
        dogsAPI.getAll(),
        customersAPI.getAll()
      ])
      setDogs(dogsRes.data)
      setCustomers(customersRes.data)
      setError(null)
    } catch (err) {
      setError('Failed to load data. Please try again.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const submitData = {
        ...formData,
        age: formData.age ? parseInt(formData.age) : null,
        age_months: formData.age_months ? parseInt(formData.age_months) : null
      }

      if (editingDog) {
        await dogsAPI.update(editingDog.id, submitData)
      } else {
        await dogsAPI.create(submitData)
      }

      setFormData({
        customer_id: '',
        name: '',
        breed: '',
        age: '',
        age_months: '',
        location: '',
        size: 'medium',
        food_preferences: '',
        behavioral_notes: '',
        special_instructions: '',
        photo_url: ''
      })
      setShowForm(false)
      setEditingDog(null)
      loadData()
    } catch (err) {
      setError('Failed to save dog. Please try again.')
      console.error(err)
    }
  }

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    try {
      setUploading(true)
      const response = await uploadAPI.uploadPhoto(file)
      setFormData({ ...formData, photo_url: response.data.url })
      setError(null)
    } catch (err) {
      setError('Failed to upload photo. Please try again.')
      console.error(err)
    } finally {
      setUploading(false)
    }
  }

  const handleEdit = (dog) => {
    setEditingDog(dog)
    setFormData({
      customer_id: dog.customer_id,
      name: dog.name,
      breed: dog.breed || '',
      age: dog.age || '',
      age_months: dog.age_months || '',
      location: dog.location || '',
      size: dog.size,
      food_preferences: dog.food_preferences || '',
      behavioral_notes: dog.behavioral_notes || '',
      special_instructions: dog.special_instructions || '',
      photo_url: dog.photo_url || ''
    })
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this dog? This will also delete all their stays.')) return
    try {
      await dogsAPI.delete(id)
      loadData()
    } catch (err) {
      setError('Failed to delete dog. They may have associated stays.')
      console.error(err)
    }
  }

  const handleCancel = () => {
    setFormData({
      customer_id: '',
      name: '',
      breed: '',
      age: '',
      age_months: '',
      location: '',
      size: 'medium',
      food_preferences: '',
      behavioral_notes: '',
      special_instructions: '',
      photo_url: ''
    })
    setShowForm(false)
    setEditingDog(null)
  }

  const getSizeBadge = (size) => {
    const badges = {
      small: 'badge-small',
      medium: 'badge-medium',
      large: 'badge-large'
    }
    return badges[size] || 'badge-medium'
  }

  if (loading) return <div className="loading-state">Loading dogs...</div>

  return (
    <div>
      <div className="admin-header">
        <h1>Dogs</h1>
        {!showForm && (
          <button onClick={() => setShowForm(true)} className="btn btn-primary">
            + Add Dog
          </button>
        )}
      </div>

      {error && (
        <div className="error-state">
          {error}
        </div>
      )}

      {customers.length === 0 && !showForm && (
        <div className="error-state" style={{ background: '#fff4e6', border: '1px solid #ffe0b2', color: '#e67e22' }}>
          ⚠️ Please add customers first before adding dogs.
        </div>
      )}

      {showForm && (
        <div className="form-card">
          <h2>{editingDog ? 'Edit Dog' : 'New Dog'}</h2>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Owner *</label>
              <select
                className="form-select"
                value={formData.customer_id}
                onChange={(e) => setFormData({ ...formData, customer_id: e.target.value })}
                required
              >
                <option value="">Select owner...</option>
                {customers.map(customer => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Dog Photo</label>
              <input
                type="file"
                className="form-input"
                onChange={handlePhotoUpload}
                accept="image/*"
                disabled={uploading}
              />
              {uploading && <p style={{ fontSize: '13px', color: 'var(--theme-primary, #f472b6)', marginTop: '8px' }}>Uploading...</p>}
              {formData.photo_url && (
                <div style={{ marginTop: '12px' }}>
                  <img
                    src={`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}${formData.photo_url}`}
                    alt="Dog preview"
                    style={{ width: '120px', height: '120px', objectFit: 'cover', borderRadius: '8px', border: '2px solid #e8e8e8' }}
                  />
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div className="form-group">
                <label className="form-label">Dog Name *</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  placeholder="e.g., Max"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Breed</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.breed}
                  onChange={(e) => setFormData({ ...formData, breed: e.target.value })}
                  placeholder="e.g., Golden Retriever"
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px' }}>
              <div className="form-group">
                <label className="form-label">Age (years)</label>
                <input
                  type="number"
                  className="form-input"
                  value={formData.age}
                  onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                  min="0"
                  max="30"
                  placeholder="e.g., 3"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Months</label>
                <input
                  type="number"
                  className="form-input"
                  value={formData.age_months}
                  onChange={(e) => setFormData({ ...formData, age_months: e.target.value })}
                  min="0"
                  max="11"
                  placeholder="e.g., 6"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Size *</label>
                <select
                  className="form-select"
                  value={formData.size}
                  onChange={(e) => setFormData({ ...formData, size: e.target.value })}
                  required
                >
                  <option value="small">Small (0-25 lbs)</option>
                  <option value="medium">Medium (26-60 lbs)</option>
                  <option value="large">Large (60+ lbs)</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Location</label>
              <select
                className="form-select"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              >
                <option value="">Select location...</option>
                <option value="New York">New York</option>
                <option value="Connecticut">Connecticut</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Food Preferences</label>
              <textarea
                className="form-textarea"
                value={formData.food_preferences}
                onChange={(e) => setFormData({ ...formData, food_preferences: e.target.value })}
                rows="2"
                placeholder="e.g., Eats twice daily, prefers chicken-based food"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Behavioral Notes</label>
              <textarea
                className="form-textarea"
                value={formData.behavioral_notes}
                onChange={(e) => setFormData({ ...formData, behavioral_notes: e.target.value })}
                rows="2"
                placeholder="e.g., Friendly with other dogs, shy around strangers"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Special Instructions</label>
              <textarea
                className="form-textarea"
                value={formData.special_instructions}
                onChange={(e) => setFormData({ ...formData, special_instructions: e.target.value })}
                rows="2"
                placeholder="e.g., Needs medication twice daily, can't be left alone"
              />
            </div>

            <div className="form-actions">
              <button type="submit" className="btn btn-success">
                {editingDog ? '✓ Update Dog' : '✓ Add Dog'}
              </button>
              <button type="button" onClick={handleCancel} className="btn btn-secondary">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="data-table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Photo</th>
              <th>Dog Name</th>
              <th>Owner</th>
              <th>Breed</th>
              <th>Age</th>
              <th>Size</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {dogs.length === 0 ? (
              <tr>
                <td colSpan="7">
                  <div className="empty-state">
                    <div className="empty-state-icon">🐕</div>
                    <div className="empty-state-text">No dogs yet</div>
                    <div className="empty-state-subtext">Click "Add Dog" to register your first furry friend</div>
                  </div>
                </td>
              </tr>
            ) : (
              dogs.map((dog) => (
                <tr key={dog.id}>
                  <td>
                    {dog.photo_url ? (
                      <img
                        src={`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}${dog.photo_url}`}
                        alt={dog.name}
                        style={{ width: '50px', height: '50px', objectFit: 'cover', borderRadius: '8px' }}
                      />
                    ) : (
                      <div style={{ width: '50px', height: '50px', background: '#f0f0f0', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>
                        🐕
                      </div>
                    )}
                  </td>
                  <td><strong>{dog.name}</strong></td>
                  <td>{dog.customer_name}</td>
                  <td>{dog.breed || '-'}</td>
                  <td>{dog.age ? `${dog.age} years` : '-'}</td>
                  <td>
                    <span className={`badge ${getSizeBadge(dog.size)}`}>
                      {dog.size.charAt(0).toUpperCase() + dog.size.slice(1)}
                    </span>
                  </td>
                  <td>
                    <button onClick={() => handleEdit(dog)} className="btn btn-edit">
                      Edit
                    </button>
                    <button onClick={() => handleDelete(dog.id)} className="btn btn-delete">
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default DogsManager
