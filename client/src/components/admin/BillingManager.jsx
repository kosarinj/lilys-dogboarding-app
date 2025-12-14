import { useState, useEffect } from 'react'
import { billsAPI } from '../../utils/api'
import InvoiceView from './InvoiceView'
import axios from 'axios'
import './admin.css'

function BillingManager() {
  const [bills, setBills] = useState([])
  const [unbilledStays, setUnbilledStays] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedStays, setSelectedStays] = useState({})
  const [viewingBill, setViewingBill] = useState(null)

  const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const [billsRes, unbilledRes] = await Promise.all([
        billsAPI.getAll(),
        axios.get(`${API_BASE_URL}/bills/unbilled/stays`)
      ])
      setBills(billsRes.data)
      setUnbilledStays(unbilledRes.data)
      setError(null)
    } catch (err) {
      setError('Failed to load billing data. Please try again.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const groupStaysByCustomer = () => {
    const grouped = {}
    unbilledStays.forEach(stay => {
      const customerId = stay.customer_id
      if (!grouped[customerId]) {
        grouped[customerId] = {
          customer_name: stay.customer_name,
          customer_id: customerId,
          stays: []
        }
      }
      grouped[customerId].stays.push(stay)
    })
    return Object.values(grouped)
  }

  const handleStayToggle = (stayId) => {
    setSelectedStays(prev => ({
      ...prev,
      [stayId]: !prev[stayId]
    }))
  }

  const handleGenerateBill = async (customerId) => {
    const stayIds = unbilledStays
      .filter(stay => stay.customer_id === customerId && selectedStays[stay.id])
      .map(stay => stay.id)

    if (stayIds.length === 0) {
      setError('Please select at least one stay to bill')
      return
    }

    try {
      await billsAPI.create({ customer_id: customerId, stay_ids: stayIds })
      setSelectedStays({})
      loadData()
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to generate bill')
      console.error(err)
    }
  }

  const handleViewBill = async (billId) => {
    try {
      const response = await billsAPI.getById(billId)
      setViewingBill(response.data)
    } catch (err) {
      setError('Failed to load bill details')
      console.error(err)
    }
  }

  const handleMarkPaid = async (billId, totalAmount) => {
    if (!confirm('Mark this bill as paid?')) return

    try {
      await billsAPI.update(billId, {
        status: 'paid',
        paid_amount: totalAmount,
        payment_method: 'cash'
      })
      loadData()
      if (viewingBill && viewingBill.id === billId) {
        setViewingBill(null)
      }
    } catch (err) {
      setError('Failed to mark bill as paid')
      console.error(err)
    }
  }

  const handleDeleteBill = async (billId) => {
    if (!confirm('Are you sure you want to delete this bill?')) return

    try {
      await billsAPI.delete(billId)
      loadData()
    } catch (err) {
      setError('Failed to delete bill')
      console.error(err)
    }
  }

  const formatDate = (dateString) => {
    // Parse date as local time to avoid timezone shifting
    const date = new Date(dateString + 'T00:00:00')
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  const getStatusBadge = (status) => {
    const badges = {
      draft: { class: 'badge-small', text: 'Draft' },
      sent: { class: 'badge-medium', text: 'Sent' },
      paid: { class: 'badge-large', text: 'Paid' },
      overdue: { class: 'badge-small', text: 'Overdue' },
      cancelled: { class: 'badge-small', text: 'Cancelled' }
    }
    return badges[status] || badges.draft
  }

  if (loading) return <div className="loading-state">Loading billing data...</div>

  if (viewingBill) {
    return <InvoiceView bill={viewingBill} onClose={() => setViewingBill(null)} />
  }

  const customerGroups = groupStaysByCustomer()

  return (
    <div>
      <div className="admin-header">
        <h1>Billing & Invoices</h1>
      </div>

      {error && (
        <div className="error-state">
          {error}
        </div>
      )}

      {/* Unbilled Stays Section */}
      {customerGroups.length > 0 && (
        <div className="form-card" style={{ marginBottom: '24px' }}>
          <h2 style={{ marginBottom: '20px' }}>Unbilled Stays</h2>
          <p style={{ color: '#666', marginBottom: '20px', fontSize: '14px' }}>
            Select upcoming, active, or completed stays to generate bills for customers
          </p>

          {customerGroups.map(group => {
            const selectedCount = group.stays.filter(s => selectedStays[s.id]).length
            const totalAmount = group.stays
              .filter(s => selectedStays[s.id])
              .reduce((sum, s) => sum + parseFloat(s.total_cost), 0)

            return (
              <div key={group.customer_id} style={{
                marginBottom: '24px',
                padding: '20px',
                background: '#f8f9fa',
                borderRadius: '12px',
                border: '1px solid #e8e8e8'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '18px', color: '#2c3e50' }}>
                      {group.customer_name}
                    </h3>
                    <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#7f8c8d' }}>
                      {group.stays.length} unbilled stay{group.stays.length > 1 ? 's' : ''}
                    </p>
                  </div>
                  {selectedCount > 0 && (
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '13px', color: '#7f8c8d', marginBottom: '4px' }}>
                        {selectedCount} stay{selectedCount > 1 ? 's' : ''} selected
                      </div>
                      <div style={{ fontSize: '20px', fontWeight: '700', color: '#2c3e50', marginBottom: '8px' }}>
                        {formatCurrency(totalAmount)}
                      </div>
                      <button
                        onClick={() => handleGenerateBill(group.customer_id)}
                        className="btn btn-success"
                        style={{ padding: '8px 16px' }}
                      >
                        Generate Bill
                      </button>
                    </div>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '12px' }}>
                  {group.stays.map(stay => (
                    <label key={stay.id} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '12px',
                      background: 'white',
                      borderRadius: '8px',
                      border: selectedStays[stay.id] ? '2px solid var(--theme-primary, #f472b6)' : '2px solid transparent',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}>
                      <input
                        type="checkbox"
                        checked={selectedStays[stay.id] || false}
                        onChange={() => handleStayToggle(stay.id)}
                        style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                      />
                      {stay.dog_photo_url ? (
                        <img
                          src={stay.dog_photo_url.startsWith('http') ? stay.dog_photo_url : `${(import.meta.env.VITE_API_URL || 'http://localhost:5000').replace('/api', '')}${stay.dog_photo_url}`}
                          alt={stay.dog_name}
                          style={{ width: '50px', height: '50px', objectFit: 'cover', borderRadius: '8px' }}
                        />
                      ) : (
                        <div style={{ width: '50px', height: '50px', background: '#f0f0f0', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}>
                          🐕
                        </div>
                      )}
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: '600', fontSize: '14px', color: '#2c3e50' }}>
                          {stay.dog_name}
                        </div>
                        <div style={{ fontSize: '12px', color: '#7f8c8d', marginTop: '2px' }}>
                          {formatDate(stay.check_in_date)} - {formatDate(stay.check_out_date)}
                        </div>
                        <div style={{ fontSize: '12px', color: '#7f8c8d' }}>
                          {stay.days_count} day{stay.days_count > 1 ? 's' : ''}
                        </div>
                      </div>
                      <div style={{ fontWeight: '700', fontSize: '15px', color: '#2c3e50' }}>
                        {formatCurrency(stay.total_cost)}
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Existing Bills Section */}
      <div className="data-table-container">
        <h2 style={{ marginBottom: '16px' }}>All Bills</h2>
        <table className="data-table">
          <thead>
            <tr>
              <th>Bill Code</th>
              <th>Customer</th>
              <th>Bill Date</th>
              <th>Due Date</th>
              <th>Amount</th>
              <th>Paid</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {bills.length === 0 ? (
              <tr>
                <td colSpan="8">
                  <div className="empty-state">
                    <div className="empty-state-icon">💳</div>
                    <div className="empty-state-text">No bills generated yet</div>
                    <div className="empty-state-subtext">
                      {unbilledStays.length > 0
                        ? 'Select completed stays above to create your first bill'
                        : 'Complete some stays to start billing'}
                    </div>
                  </div>
                </td>
              </tr>
            ) : (
              bills.map(bill => {
                const statusBadge = getStatusBadge(bill.status)
                return (
                  <tr key={bill.id}>
                    <td><strong>{bill.bill_code}</strong></td>
                    <td>{bill.customer_name}</td>
                    <td>{formatDate(bill.bill_date)}</td>
                    <td>{formatDate(bill.due_date)}</td>
                    <td><strong>{formatCurrency(bill.total_amount)}</strong></td>
                    <td>{formatCurrency(bill.paid_amount)}</td>
                    <td>
                      <span className={`badge ${statusBadge.class}`}>
                        {statusBadge.text}
                      </span>
                    </td>
                    <td>
                      <button
                        onClick={() => handleViewBill(bill.id)}
                        className="btn btn-edit"
                      >
                        View Invoice
                      </button>
                      {bill.status !== 'paid' && (
                        <button
                          onClick={() => handleMarkPaid(bill.id, bill.total_amount)}
                          className="btn btn-success"
                          style={{ marginLeft: '8px' }}
                        >
                          Mark Paid
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteBill(bill.id)}
                        className="btn btn-delete"
                        style={{ marginLeft: '8px' }}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default BillingManager
