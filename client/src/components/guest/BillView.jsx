import { useState, useEffect } from 'react'
import axios from 'axios'

function BillView({ billCode }) {
  const [bill, setBill] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

  useEffect(() => {
    loadBill()
  }, [billCode])

  const loadBill = async () => {
    try {
      setLoading(true)
      const response = await axios.get(`${API_BASE_URL}/bills/code/${billCode}`)
      setBill(response.data)
      setError(null)
    } catch (err) {
      setError('Bill not found. Please check the bill code and try again.')
    } finally {
      setLoading(false)
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

  const formatDateRange = (start, end) => {
    // Parse dates as local time to avoid timezone shifting
    const startDate = new Date(start + 'T00:00:00')
    const endDate = new Date(end + 'T00:00:00')
    const startStr = startDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    })
    const endStr = endDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
    return `${startStr} - ${endStr}`
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  const handlePrint = () => {
    window.print()
  }

  if (loading) {
    return (
      <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🐕</div>
          <div style={{ fontSize: '18px', color: '#666' }}>Loading your bill...</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', maxWidth: '400px', padding: '40px' }}>
          <div style={{ fontSize: '64px', marginBottom: '16px' }}>❌</div>
          <div style={{ fontSize: '20px', fontWeight: '600', color: '#e74c3c', marginBottom: '8px' }}>
            Bill Not Found
          </div>
          <div style={{ fontSize: '14px', color: '#666' }}>
            {error}
          </div>
        </div>
      </div>
    )
  }

  if (!bill || !bill.items) return null

  // Group items by dog
  const dogGroups = {}
  bill.items.forEach(item => {
    const dogName = item.dog_name
    if (!dogGroups[dogName]) {
      dogGroups[dogName] = {
        dog_name: dogName,
        dog_size: item.dog_size,
        items: []
      }
    }
    dogGroups[dogName].items.push(item)
  })

  const allDogNames = Object.keys(dogGroups)

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      {/* Print Button */}
      <div className="no-print" style={{ marginBottom: '20px' }}>
        <button onClick={handlePrint} style={{
          padding: '12px 24px',
          background: '#f472b6',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          fontSize: '16px',
          fontWeight: '600',
          cursor: 'pointer'
        }}>
          🖨️ Print Invoice
        </button>
      </div>

      {/* Invoice Card */}
      <div style={{
        background: 'white',
        borderRadius: '12px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        padding: '48px',
        fontFamily: 'Arial, sans-serif'
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <h1 style={{
            fontSize: '32px',
            fontWeight: '700',
            background: 'linear-gradient(135deg, #f472b6 0%, #ec4899 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            marginBottom: '8px'
          }}>
            Lily's Dog Boarding
          </h1>
          <div style={{ fontSize: '14px', color: '#7f8c8d' }}>
            Invoice #{bill.bill_code}
          </div>
        </div>

        {/* Customer Info */}
        <div style={{ marginBottom: '32px' }}>
          <div style={{ fontSize: '18px', fontWeight: '600', color: '#2c3e50', marginBottom: '8px' }}>
            Bill To:
          </div>
          <div style={{ fontSize: '16px', color: '#2c3e50' }}>
            {bill.customer_name}
          </div>
          {bill.customer_phone && (
            <div style={{ fontSize: '14px', color: '#7f8c8d' }}>
              {bill.customer_phone}
            </div>
          )}
        </div>

        {/* Service For */}
        <div style={{ marginBottom: '32px', display: 'flex', alignItems: 'flex-start', gap: '20px' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '18px', fontWeight: '600', color: '#2c3e50', marginBottom: '8px' }}>
              Service for: <span style={{ color: '#f472b6' }}>
                {allDogNames.join(', ')}
              </span>
            </div>
          </div>
          {/* Dog Photos */}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {Object.values(dogGroups).map((dogGroup, index) => (
              dogGroup.items[0]?.dog_photo_url && (
                <div key={index} style={{
                  width: '80px',
                  height: '80px',
                  borderRadius: '50%',
                  overflow: 'hidden',
                  border: '3px solid #f472b6',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
                }}>
                  <img
                    src={dogGroup.items[0].dog_photo_url.startsWith('http') ? dogGroup.items[0].dog_photo_url : `${(import.meta.env.VITE_API_URL || 'http://localhost:5000').replace('/api', '')}${dogGroup.items[0].dog_photo_url}`}
                    alt={dogGroup.dog_name}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover'
                    }}
                    onError={(e) => {
                      e.target.style.display = 'none'
                    }}
                  />
                </div>
              )
            ))}
          </div>
        </div>

        {/* Dates */}
        {bill.items.length > 0 && (
          <div style={{ marginBottom: '32px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <div style={{ fontSize: '12px', color: '#7f8c8d', marginBottom: '4px' }}>Invoice Date</div>
                <div style={{ fontSize: '16px', color: '#2c3e50' }}>{formatDate(bill.bill_date)}</div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: '#7f8c8d', marginBottom: '4px' }}>Stay Dates</div>
                <div style={{ fontSize: '16px', color: '#2c3e50' }}>
                  {formatDateRange(bill.items[0].check_in_date, bill.items[bill.items.length - 1].check_out_date)}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Items Table */}
        <div style={{ marginBottom: '32px' }}>
          <div style={{ fontSize: '18px', fontWeight: '600', color: '#2c3e50', marginBottom: '16px' }}>
            Services
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e8e8e8' }}>
                <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', color: '#7f8c8d', fontWeight: '600' }}>Description</th>
                <th style={{ padding: '12px', textAlign: 'center', fontSize: '12px', color: '#7f8c8d', fontWeight: '600' }}>Days</th>
                <th style={{ padding: '12px', textAlign: 'right', fontSize: '12px', color: '#7f8c8d', fontWeight: '600' }}>Rate</th>
                <th style={{ padding: '12px', textAlign: 'right', fontSize: '12px', color: '#7f8c8d', fontWeight: '600' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {bill.items.map((item, index) => (
                <tr key={index} style={{ borderBottom: '1px solid #f0f0f0' }}>
                  <td style={{ padding: '16px 12px' }}>
                    <div style={{ fontWeight: '600', color: '#2c3e50' }}>
                      {item.dog_name} - {item.stay_type === 'daycare' ? 'Daycare' : 'Boarding'}
                    </div>
                    <div style={{ fontSize: '12px', color: '#7f8c8d', marginTop: '4px' }}>
                      {formatDate(item.check_in_date)} to {formatDate(item.check_out_date)}
                      {item.rate_type === 'holiday' && ' (Holiday Rate)'}
                    </div>
                  </td>
                  <td style={{ padding: '16px 12px', textAlign: 'center', color: '#2c3e50' }}>
                    {item.days_count}
                  </td>
                  <td style={{ padding: '16px 12px', textAlign: 'right', color: '#2c3e50' }}>
                    {formatCurrency(item.daily_rate)}
                  </td>
                  <td style={{ padding: '16px 12px', textAlign: 'right', fontWeight: '600', color: '#2c3e50' }}>
                    {formatCurrency(parseFloat(item.total_cost) - parseFloat(item.dropoff_fee || 0) - parseFloat(item.pickup_fee || 0))}
                  </td>
                </tr>
              ))}

              {/* Additional Services */}
              {bill.items.some(item => item.dropoff_fee > 0 || item.pickup_fee > 0) && (
                <>
                  {bill.items.filter(item => item.dropoff_fee > 0).map((item, index) => (
                    <tr key={`dropoff-${index}`} style={{ borderBottom: '1px solid #f0f0f0' }}>
                      <td style={{ padding: '16px 12px', color: '#7f8c8d' }}>Drop-off Service</td>
                      <td style={{ padding: '16px 12px', textAlign: 'center', color: '#7f8c8d' }}>-</td>
                      <td style={{ padding: '16px 12px', textAlign: 'right', color: '#7f8c8d' }}>-</td>
                      <td style={{ padding: '16px 12px', textAlign: 'right', fontWeight: '600', color: '#2c3e50' }}>
                        {formatCurrency(item.dropoff_fee)}
                      </td>
                    </tr>
                  ))}
                  {bill.items.filter(item => item.pickup_fee > 0).map((item, index) => (
                    <tr key={`pickup-${index}`} style={{ borderBottom: '1px solid #f0f0f0' }}>
                      <td style={{ padding: '16px 12px', color: '#7f8c8d' }}>Pick-up Service</td>
                      <td style={{ padding: '16px 12px', textAlign: 'center', color: '#7f8c8d' }}>-</td>
                      <td style={{ padding: '16px 12px', textAlign: 'right', color: '#7f8c8d' }}>-</td>
                      <td style={{ padding: '16px 12px', textAlign: 'right', fontWeight: '600', color: '#2c3e50' }}>
                        {formatCurrency(item.pickup_fee)}
                      </td>
                    </tr>
                  ))}
                </>
              )}
            </tbody>
          </table>
        </div>

        {/* Total */}
        <div style={{
          padding: '24px',
          background: '#f8f9fa',
          borderRadius: '8px',
          marginBottom: '32px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontSize: '16px', color: '#7f8c8d' }}>Subtotal:</span>
            <span style={{ fontSize: '16px', fontWeight: '600', color: '#2c3e50' }}>
              {formatCurrency(bill.subtotal)}
            </span>
          </div>
          {bill.tax > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
              <span style={{ fontSize: '16px', color: '#7f8c8d' }}>Tax:</span>
              <span style={{ fontSize: '16px', fontWeight: '600', color: '#2c3e50' }}>
                {formatCurrency(bill.tax)}
              </span>
            </div>
          )}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            paddingTop: '12px',
            borderTop: '2px solid #dee2e6'
          }}>
            <span style={{ fontSize: '20px', fontWeight: '700', color: '#2c3e50' }}>Total Amount:</span>
            <span style={{ fontSize: '24px', fontWeight: '700', color: '#f472b6' }}>
              {formatCurrency(bill.total_amount)}
            </span>
          </div>
        </div>

        {/* Status Badge */}
        <div style={{ textAlign: 'center', marginTop: '32px' }}>
          {bill.status === 'paid' ? (
            <div style={{
              display: 'inline-block',
              padding: '12px 24px',
              background: '#d4edda',
              border: '2px solid #c3e6cb',
              borderRadius: '8px',
              color: '#155724',
              fontWeight: '600',
              fontSize: '16px'
            }}>
              ✓ PAID - Thank you!
            </div>
          ) : (
            <div style={{
              display: 'inline-block',
              padding: '12px 24px',
              background: '#fff3cd',
              border: '2px solid #ffeeba',
              borderRadius: '8px',
              color: '#856404',
              fontWeight: '600',
              fontSize: '16px'
            }}>
              Payment Due: {formatDate(bill.due_date)}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          marginTop: '40px',
          paddingTop: '24px',
          borderTop: '1px solid #e8e8e8',
          textAlign: 'center',
          fontSize: '12px',
          color: '#7f8c8d'
        }}>
          <div style={{ marginBottom: '8px' }}>
            Thank you for trusting us with your furry family member!
          </div>
          <div>
            Questions? Contact us at the number provided or reach out directly.
          </div>
        </div>
      </div>
    </div>
  )
}

export default BillView
