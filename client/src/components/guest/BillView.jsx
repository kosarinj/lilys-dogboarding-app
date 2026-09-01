import { useState, useEffect } from 'react'
import axios from 'axios'
import PayButtons from '../shared/PayButtons'

function BillView({ billCode }) {
  const [bill, setBill] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  // Card payment is optional. Until the server says it's configured there is no
  // button at all, so the bill looks exactly as it always has.
  const [cardEnabled, setCardEnabled] = useState(false)
  const [cardTestMode, setCardTestMode] = useState(false)
  const [payLoading, setPayLoading] = useState(false)
  const [payError, setPayError] = useState(null)

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

  // Whether cards are available at all. A failure here just means no button —
  // never a broken bill, since Venmo, Zelle and cash still work.
  useEffect(() => {
    axios.get(`${API_BASE_URL}/payments/config`)
      .then(r => { setCardEnabled(!!r.data?.enabled); setCardTestMode(!!r.data?.testMode) })
      .catch(() => setCardEnabled(false))
  }, [])

  const payByCard = async () => {
    setPayLoading(true)
    setPayError(null)
    try {
      const r = await axios.post(`${API_BASE_URL}/payments/bills/${billCode}/checkout`)
      if (r.data?.url) {
        // Stripe's own hosted page — card details never reach this app.
        window.location.href = r.data.url
      } else {
        setPayError('Could not start the payment. Please try again.')
        setPayLoading(false)
      }
    } catch (err) {
      setPayError(err.response?.data?.error || 'Could not start the payment. Please try again.')
      setPayLoading(false)
    }
  }

  const amountDue = bill
    ? Number(bill.total_amount || 0) - Number(bill.paid_amount || 0)
    : 0

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A'

    // Extract just the date portion (YYYY-MM-DD) regardless of format
    let datePart
    if (dateString.includes('T')) {
      datePart = dateString.split('T')[0]
    } else if (dateString.includes(' ')) {
      datePart = dateString.split(' ')[0]
    } else {
      datePart = dateString
    }

    // Parse as local date by providing year, month, day separately
    const [year, month, day] = datePart.split('-').map(Number)
    const date = new Date(year, month - 1, day) // month is 0-indexed

    if (isNaN(date.getTime())) return 'Invalid Date'

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const formatDateRange = (start, end) => {
    // Check if dates are valid
    if (!start || !end) return 'Date not available'

    // Handle both date strings (YYYY-MM-DD) and timestamps
    const parseDate = (dateStr) => {
      // Extract just the date portion (YYYY-MM-DD) regardless of format
      let datePart
      if (dateStr.includes('T')) {
        datePart = dateStr.split('T')[0]
      } else if (dateStr.includes(' ')) {
        datePart = dateStr.split(' ')[0]
      } else {
        datePart = dateStr
      }

      // Parse as local date by providing year, month, day separately
      const [year, month, day] = datePart.split('-').map(Number)
      return new Date(year, month - 1, day) // month is 0-indexed
    }

    const startDate = parseDate(start)
    const endDate = parseDate(end)

    // Check if dates are valid after parsing
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      console.error('Invalid dates:', { start, end, startDate, endDate })
      return 'Date not available'
    }

    // Compare dates using local date parts (not ISO which converts to UTC)
    const isSameDay =
      startDate.getFullYear() === endDate.getFullYear() &&
      startDate.getMonth() === endDate.getMonth() &&
      startDate.getDate() === endDate.getDate()

    // Check if same day (for daycare)
    if (isSameDay) {
      return startDate.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      })
    }

    // Different dates - show range
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

  const formatTime = (timeStr) => {
    if (!timeStr) return ''
    const [hours, minutes] = timeStr.split(':').map(Number)
    const ampm = hours >= 12 ? 'PM' : 'AM'
    const h = hours % 12 || 12
    return minutes === 0 ? `${h} ${ampm}` : `${h}:${String(minutes).padStart(2, '0')} ${ampm}`
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

  // A bill line is either a stay or a surcharge hung off one, and both carry the
  // same stay_id. The table below reads the stay's own columns, so a surcharge
  // left in this list would be drawn as a second stay. Split them once, here.
  const stayItems = bill.items.filter(i => i.item_type !== 'holiday')
  const holidayItems = bill.items.filter(i => i.item_type === 'holiday')

  // Group items by dog
  const dogGroups = {}
  stayItems.forEach(item => {
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
        {stayItems.length > 0 && (
          <div style={{ marginBottom: '32px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <div style={{ fontSize: '12px', color: '#7f8c8d', marginBottom: '4px' }}>Invoice Date</div>
                <div style={{ fontSize: '16px', color: '#2c3e50' }}>{formatDate(bill.bill_date)}</div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: '#7f8c8d', marginBottom: '4px' }}>Stay Dates</div>
                <div style={{ fontSize: '16px', color: '#2c3e50' }}>
                  {formatDateRange(stayItems[0].check_in_date, stayItems[stayItems.length - 1].check_out_date)}
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
              {stayItems.map((item, index) => (
                <tr key={index} style={{ borderBottom: '1px solid #f0f0f0' }}>
                  <td style={{ padding: '16px 12px' }}>
                    <div style={{ fontWeight: '600', color: '#2c3e50' }}>
                      {item.dog_name} - {item.stay_type === 'daycare' ? 'Daycare' : 'Boarding'}
                    </div>
                    <div style={{ fontSize: '12px', color: '#7f8c8d', marginTop: '4px' }}>
                      {formatDate(item.check_in_date)} to {formatDate(item.check_out_date)}
                      {(item.check_in_time || item.check_out_time) && (
                        <span> ({formatTime(item.check_in_time)} - {formatTime(item.check_out_time)})</span>
                      )}
                      {!item.special_price && item.rate_type === 'holiday' && ' (Holiday Rate)'}
                    </div>
                    {item.special_price && item.special_price_comments && (
                      <div style={{ fontSize: '12px', color: '#7f8c8d', marginTop: '4px', fontStyle: 'italic' }}>
                        {item.special_price_comments}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '16px 12px', textAlign: 'center', color: '#2c3e50' }}>
                    {item.days_count}
                  </td>
                  <td style={{ padding: '16px 12px', textAlign: 'right', color: '#2c3e50' }}>
                    {item.special_price ? '-' : (() => {
                      const puppyFeePerDay = item.is_puppy && item.puppy_fee ? parseFloat(item.puppy_fee) / parseFloat(item.days_count) : 0
                      const displayRate = parseFloat(item.daily_rate) + puppyFeePerDay
                      return formatCurrency(displayRate)
                    })()}
                  </td>
                  <td style={{ padding: '16px 12px', textAlign: 'right', fontWeight: '600', color: '#2c3e50' }}>
                    {formatCurrency(parseFloat(item.total_cost) - parseFloat(item.dropoff_fee || 0) - parseFloat(item.pickup_fee || 0) - parseFloat(item.extra_charge || 0))}
                  </td>
                </tr>
              ))}

              {/* Holiday nights, named so the charge explains itself. */}
              {holidayItems.map((item, index) => (
                <tr key={`hol-${index}`} style={{ borderBottom: '1px solid #f0f0f0' }}>
                  <td style={{ padding: '16px 12px' }}>
                    <div style={{ fontWeight: '600', color: '#2c3e50' }}>
                      {item.description}
                    </div>
                    {holidayItems.length > 1 && (
                      <div style={{ fontSize: '12px', color: '#7f8c8d', marginTop: '4px' }}>
                        {item.dog_name}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '16px 12px', textAlign: 'center', color: '#2c3e50' }}>
                    {item.quantity}
                  </td>
                  <td style={{ padding: '16px 12px', textAlign: 'right', color: '#2c3e50' }}>
                    {formatCurrency(item.unit_price)}
                  </td>
                  <td style={{ padding: '16px 12px', textAlign: 'right', fontWeight: '600', color: '#2c3e50' }}>
                    {formatCurrency(item.total_price)}
                  </td>
                </tr>
              ))}

              {/* Additional Services */}
              {stayItems.some(item => item.dropoff_fee > 0 || item.pickup_fee > 0 || item.extra_charge > 0) && (
                <>
                  {stayItems.filter(item => item.dropoff_fee > 0).map((item, index) => (
                    <tr key={`dropoff-${index}`} style={{ borderBottom: '1px solid #f0f0f0' }}>
                      <td style={{ padding: '16px 12px', color: '#7f8c8d' }}>Drop-off Service</td>
                      <td style={{ padding: '16px 12px', textAlign: 'center', color: '#7f8c8d' }}>-</td>
                      <td style={{ padding: '16px 12px', textAlign: 'right', color: '#7f8c8d' }}>-</td>
                      <td style={{ padding: '16px 12px', textAlign: 'right', fontWeight: '600', color: '#2c3e50' }}>
                        {formatCurrency(item.dropoff_fee)}
                      </td>
                    </tr>
                  ))}
                  {stayItems.filter(item => item.pickup_fee > 0).map((item, index) => (
                    <tr key={`pickup-${index}`} style={{ borderBottom: '1px solid #f0f0f0' }}>
                      <td style={{ padding: '16px 12px', color: '#7f8c8d' }}>Pick-up Service</td>
                      <td style={{ padding: '16px 12px', textAlign: 'center', color: '#7f8c8d' }}>-</td>
                      <td style={{ padding: '16px 12px', textAlign: 'right', color: '#7f8c8d' }}>-</td>
                      <td style={{ padding: '16px 12px', textAlign: 'right', fontWeight: '600', color: '#2c3e50' }}>
                        {formatCurrency(item.pickup_fee)}
                      </td>
                    </tr>
                  ))}
                  {stayItems.filter(item => item.extra_charge > 0).map((item, index) => (
                    <tr key={`extra-${index}`} style={{ borderBottom: '1px solid #f0f0f0' }}>
                      <td style={{ padding: '16px 12px', color: '#7f8c8d' }}>
                        {item.extra_charge_comments || 'Additional Charge'}
                        {stayItems.filter(i => i.extra_charge > 0).length > 1 && (
                          <span style={{ fontSize: '12px', marginLeft: '4px' }}>({item.dog_name})</span>
                        )}
                      </td>
                      <td style={{ padding: '16px 12px', textAlign: 'center', color: '#7f8c8d' }}>-</td>
                      <td style={{ padding: '16px 12px', textAlign: 'right', color: '#7f8c8d' }}>-</td>
                      <td style={{ padding: '16px 12px', textAlign: 'right', fontWeight: '600', color: '#2c3e50' }}>
                        {formatCurrency(item.extra_charge)}
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

        {/* Personal Message */}
        <div style={{
          background: '#f8f9fa',
          padding: '24px',
          borderRadius: '8px',
          marginBottom: '32px',
          borderLeft: '4px solid #f472b6'
        }}>
          <p style={{ margin: '0 0 12px 0', fontSize: '16px', color: '#2c3e50' }}>
            Hello {allDogNames[0] || 'Customer'},
          </p>
          <p style={{ margin: '0', fontSize: '15px', color: '#555', lineHeight: '1.6' }}>
            Thank you so much for choosing Lily's Dog Boarding! We hope you have a wonderful stay with us. We look forward to seeing you!
          </p>
        </div>

        {/* Payment Info */}
        <div style={{
          background: 'linear-gradient(135deg, #fff4f6 0%, #fef5f8 100%)',
          padding: '24px',
          borderRadius: '8px',
          marginBottom: '32px',
          border: '1px solid #ffc9d9'
        }}>
          <div style={{ fontWeight: '600', fontSize: '15px', color: '#2c3e50', marginBottom: '12px' }}>
            Payment Information
          </div>
          <div style={{ fontSize: '17px', fontWeight: 700, color: '#2c3e50', marginBottom: '12px' }}>
            All services are paid in advance
          </div>
          {/* The headline states the rule; this says what it costs the customer to
              ignore it — a reservation is not held until the payment arrives. */}
          <div style={{ fontSize: '14px', color: '#2c3e50', lineHeight: '1.7', marginBottom: '12px' }}>
            Just a friendly reminder — payment is required in advance to confirm and guarantee
            your dog’s boarding or daycare reservation. Reservations are only secured once
            payment has been received.
          </div>
          <div style={{ fontSize: '14px', color: '#2c3e50', lineHeight: '1.7', marginBottom: '16px' }}>
            Thank you for your understanding and continued support! 🐾
          </div>
          {/* Card is an extra option, deliberately above the others but not
              replacing them — plenty of people would rather use Venmo, and the
              app works unchanged when cards are switched off. */}
          {cardEnabled && amountDue > 0 && bill.status !== 'cancelled' && (
            <div className="no-print" style={{ marginBottom: '16px' }}>
              <button
                onClick={payByCard}
                disabled={payLoading}
                style={{
                  width: '100%', padding: '14px 20px', fontSize: '16px', fontWeight: 700,
                  color: '#fff', background: payLoading ? '#9bb0c4' : '#e8547c',
                  border: 'none', borderRadius: '8px',
                  cursor: payLoading ? 'default' : 'pointer',
                }}
              >
                {payLoading ? 'Opening secure checkout…' : `Pay $${amountDue.toFixed(2)} by card`}
              </button>
              <div style={{ fontSize: '12px', color: '#6c7a89', marginTop: '6px', textAlign: 'center' }}>
                Secure checkout by Stripe · card details are never stored here
                {cardTestMode && <strong style={{ color: '#b8860b' }}> · TEST MODE — no real money</strong>}
              </div>
              {payError && (
                <div style={{ fontSize: '13px', color: '#c0392b', marginTop: '8px', textAlign: 'center' }}>
                  {payError}
                </div>
              )}
            </div>
          )}
          {/* The original invoice wording, unchanged. It reads as an invoice
              should, and the buttons are an addition to it rather than a
              replacement for it — swapping this out changed the character of
              the whole document for the sake of two links. */}
          <div style={{ fontSize: '14px', color: '#2c3e50', lineHeight: '1.8' }}>
            <div><strong>Cash:</strong> Accepted</div>
            <div><strong>Venmo:</strong> @lilykos</div>
            <div><strong>Zelle:</strong> lilykos@me.com</div>
          </div>

          {/* Buttons below the details, and hidden on a printed copy where a
              tappable link is meaningless. */}
          {amountDue > 0 && bill.status !== 'cancelled' && (
            <div className="no-print" style={{ marginTop: '14px' }}>
              <PayButtons amount={amountDue} note={`Boarding invoice ${bill.bill_code}`} compact />
            </div>
          )}
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
              Payment due by {formatDate(stayItems[0]?.check_in_date || bill.due_date)}
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
