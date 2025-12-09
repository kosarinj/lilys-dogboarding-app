import { useState, useEffect } from 'react'
import { customersAPI } from '../../utils/api'
import './admin.css'

function CustomersManager() {
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState(null)
  const [formData, setFormData] = useState({ name: '', phone: '', email: '' })

  useEffect(() => {
    loadCustomers()
  }, [])

  const loadCustomers = async () => {
    try {
      setLoading(true)
      const response = await customersAPI.getAll()
      setCustomers(response.data)
      setError(null)
    } catch (err) {
      setError('Failed to load customers. Please try again.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      if (editingCustomer) {
        await customersAPI.update(editingCustomer.id, formData)
      } else {
        await customersAPI.create(formData)
      }
      setFormData({ name: '', phone: '', email: '' })
      setShowForm(false)
      setEditingCustomer(null)
      loadCustomers()
    } catch (err) {
      setError('Failed to save customer. Please try again.')
      console.error(err)
    }
  }

  const handleEdit = (customer) => {
    setEditingCustomer(customer)
    setFormData({ name: customer.name, phone: customer.phone || '', email: customer.email || '' })
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this customer? This will also delete all their dogs and stays.')) return
    try {
      await customersAPI.delete(id)
      loadCustomers()
    } catch (err) {
      setError('Failed to delete customer. They may have associated records.')
      console.error(err)
    }
  }

  const handleCancel = () => {
    setFormData({ name: '', phone: '', email: '' })
    setShowForm(false)
    setEditingCustomer(null)
  }

  if (loading) return <div className="loading-state">Loading customers...</div>

  return (
    <div>
      <div className="admin-header">
        <h1>Customers</h1>
        {!showForm && (
          <button onClick={() => setShowForm(true)} className="btn btn-primary">
            + Add Customer
          </button>
        )}
      </div>

      {error && (
        <div className="error-state">
          {error}
        </div>
      )}

      {showForm && (
        <div className="form-card">
          <h2>{editingCustomer ? 'Edit Customer' : 'New Customer'}</h2>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Name *</label>
              <input
                type="text"
                className="form-input"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                placeholder="Enter customer name"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Phone</label>
              <input
                type="tel"
                className="form-input"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="(555) 123-4567"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input
                type="email"
                className="form-input"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="customer@example.com"
              />
            </div>
            <div className="form-actions">
              <button type="submit" className="btn btn-success">
                {editingCustomer ? '✓ Update Customer' : '✓ Create Customer'}
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
              <th>Name</th>
              <th>Phone</th>
              <th>Email</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {customers.length === 0 ? (
              <tr>
                <td colSpan="4">
                  <div className="empty-state">
                    <div className="empty-state-icon">👥</div>
                    <div className="empty-state-text">No customers yet</div>
                    <div className="empty-state-subtext">Click "Add Customer" to get started</div>
                  </div>
                </td>
              </tr>
            ) : (
              customers.map((customer) => (
                <tr key={customer.id}>
                  <td><strong>{customer.name}</strong></td>
                  <td>{customer.phone || '-'}</td>
                  <td>{customer.email || '-'}</td>
                  <td>
                    <button onClick={() => handleEdit(customer)} className="btn btn-edit">
                      Edit
                    </button>
                    <button onClick={() => handleDelete(customer.id)} className="btn btn-delete">
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

export default CustomersManager
