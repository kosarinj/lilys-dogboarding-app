import { useState, useEffect } from 'react'
import { customersAPI } from '../../utils/api'
import './admin.css'

function CustomersManager() {
  const [customers, setCustomers] = useState([])
  const [copiedId, setCopiedId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState(null)
  const [formData, setFormData] = useState({ name: '', phone: '', email: '' })
  const [searchQuery, setSearchQuery] = useState('')

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

  // Built from the current origin so it's right in dev and in production
  // without another env var to keep in step.
  const copyBookingLink = async (customer) => {
    const link = `${window.location.origin}/book/${customer.booking_code}`
    try {
      await navigator.clipboard.writeText(link)
    } catch {
      // Clipboard needs HTTPS and permission; falling back to a prompt means
      // she can still get the link by hand rather than hitting a dead end.
      window.prompt('Copy this booking link:', link)
    }
    setCopiedId(customer.id)
    setTimeout(() => setCopiedId(null), 2000)
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
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <input
            type="text"
            placeholder="Search by name, phone, or email..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="form-input"
            style={{ width: '260px', margin: 0 }}
          />
          {!showForm && (
            <button onClick={() => setShowForm(true)} className="btn btn-primary">
              + Add Customer
            </button>
          )}
        </div>
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
              <th>Booking link</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {customers.length === 0 ? (
              <tr>
                <td colSpan="5">
                  <div className="empty-state">
                    <div className="empty-state-icon">👥</div>
                    <div className="empty-state-text">No customers yet</div>
                    <div className="empty-state-subtext">Click "Add Customer" to get started</div>
                  </div>
                </td>
              </tr>
            ) : (
              customers
              .filter(customer => {
                const q = searchQuery.toLowerCase()
                return !q || customer.name?.toLowerCase().includes(q) || customer.phone?.toLowerCase().includes(q) || customer.email?.toLowerCase().includes(q)
              })
              .map((customer) => (
                <tr key={customer.id}>
                  <td><strong>{customer.name}</strong></td>
                  <td>{customer.phone || '-'}</td>
                  <td>{customer.email || '-'}</td>
                  {/* The link IS the customer's way in — there is no login — so
                      it has to be somewhere she can grab it. Copy rather than
                      display: it's long, and reading it out would be miserable. */}
                  <td>
                    {customer.booking_code ? (
                      <button
                        onClick={() => copyBookingLink(customer)}
                        className="btn btn-edit"
                        title="Copy this customer's personal booking link, then text it to them"
                        style={{ whiteSpace: 'nowrap' }}
                      >
                        {copiedId === customer.id ? '✓ Copied' : '🔗 Copy link'}
                      </button>
                    ) : (
                      <span style={{ color: '#95a5a6', fontSize: 12 }}>—</span>
                    )}
                  </td>
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
