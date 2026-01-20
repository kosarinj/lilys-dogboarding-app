import { useState, useEffect } from 'react'
import { ratesAPI } from '../../utils/api'
import './admin.css'

function InvoiceView({ bill, onClose }) {
  const [rates, setRates] = useState([])

  useEffect(() => {
    const loadRates = async () => {
      try {
        const res = await ratesAPI.getAll()
        setRates(res.data)
      } catch (err) {
        console.error('Failed to load rates:', err)
      }
    }
    loadRates()
  }, [])

  // Helper to get holiday rate for a service type and size
  const getHolidayRate = (serviceType, size = 'medium') => {
    const rate = rates.find(r =>
      r.service_type === serviceType &&
      r.rate_type === 'holiday' &&
      r.dog_size === size
    )
    return rate ? parseFloat(rate.price_per_day) : null
  }
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
      const result = new Date(year, month - 1, day) // month is 0-indexed
      console.log('Date parsing:', { input: dateStr, datePart, year, month, day, result: result.toLocaleDateString() })
      return result
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

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  const handlePrint = () => {
    window.print()
  }

  const handleCopyLink = () => {
    const shareableLink = `${window.location.origin}/bill/${bill.bill_code}`
    navigator.clipboard.writeText(shareableLink).then(() => {
      alert('Link copied! You can now share this with your customer via text or email.')
    })
  }

  const handleSendBill = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/bills/${bill.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'sent' })
      })
      if (response.ok) {
        bill.status = 'sent'
        handleCopyLink()
      }
    } catch (err) {
      alert('Failed to mark bill as sent')
    }
  }

  const handleSendSMS = async () => {
    const phoneNumber = prompt('Enter phone number (e.g., +18457431086):', '+18457431086')
    if (!phoneNumber) return

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/bills/${bill.id}/send-sms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone_number: phoneNumber })
      })
      const data = await response.json()
      if (response.ok) {
        // Copy link to clipboard
        if (data.link) {
          navigator.clipboard.writeText(data.link).then(() => {
            if (data.mock) {
              alert(`SMS Preview (Twilio not configured):\n\nTo: ${data.phone}\n\n✅ Link copied to clipboard!\n\nNote: Configure Twilio credentials in .env to send real SMS.`)
            } else {
              alert(`✅ SMS sent successfully to ${data.phone}!\n\nLink copied to clipboard - you can paste it into your messaging app.`)
            }
          }).catch(() => {
            // Fallback if clipboard fails
            if (data.mock) {
              alert(`SMS Preview (Twilio not configured):\n\nTo: ${data.phone}\n\nLink: ${data.link}\n\nNote: Configure Twilio credentials in .env to send real SMS.`)
            } else {
              alert(`✅ SMS sent successfully to ${data.phone}!\n\nBill link: ${data.link}`)
            }
          })
        }
      } else {
        alert(`Failed to send SMS: ${data.error}`)
      }
    } catch (err) {
      alert('Failed to send SMS: ' + err.message)
    }
  }

  const handleEmailInvoice = () => {
    const shareableLink = `${window.location.origin}/bill/${bill.bill_code}`
    const customerEmail = bill.customer_email || ''
    const subject = encodeURIComponent(`Invoice from Lily's Dog Boarding - ${bill.bill_code}`)
    const body = encodeURIComponent(
      `Hello ${bill.customer_name},\n\n` +
      `Thank you for choosing Lily's Dog Boarding!\n\n` +
      `You can view your invoice here:\n${shareableLink}\n\n` +
      `Invoice Total: $${bill.total_amount}\n` +
      `Payment Due Date: ${formatDate(bill.items[0]?.check_in_date || bill.due_date)}\n\n` +
      `If you have any questions, please don't hesitate to reach out.\n\n` +
      `Best regards,\nLily's Dog Boarding`
    )

    window.location.href = `mailto:${customerEmail}?subject=${subject}&body=${body}`
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
  const primaryDogName = allDogNames[0] || 'Customer'

  // Calculate totals for each category
  let boardingTotal = 0
  let dropoffTotal = 0
  let pickupTotal = 0
  let extraChargeTotal = 0
  let holidaySurcharge = 0

  // Determine service type - check if any items are daycare
  const hasDaycare = bill.items.some(item => item.stay_type === 'daycare')
  const hasBoarding = bill.items.some(item => item.stay_type === 'boarding')

  // Collect all extra charge items with their comments
  const extraCharges = []

  bill.items.forEach(item => {
    const itemCost = parseFloat(item.total_cost)
    const dropoffFee = parseFloat(item.dropoff_fee || 0)
    const pickupFee = parseFloat(item.pickup_fee || 0)
    const extraCharge = parseFloat(item.extra_charge || 0)

    // Boarding cost (total - fees - extra charge)
    boardingTotal += (itemCost - dropoffFee - pickupFee - extraCharge)
    dropoffTotal += dropoffFee
    pickupTotal += pickupFee
    extraChargeTotal += extraCharge

    // Collect extra charges with comments
    if (extraCharge > 0) {
      extraCharges.push({
        amount: extraCharge,
        comment: item.extra_charge_comments || 'Additional charge',
        dogName: item.dog_name
      })
    }

    // Check if holiday rate
    if (item.rate_type === 'holiday') {
      // Holiday surcharge is already included in the daily_rate
      // We'll just flag that there were holiday rates used
    }
  })

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5', padding: '20px' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        {/* Action Buttons */}
        <div className="no-print" style={{ marginBottom: '20px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button onClick={onClose} className="btn btn-secondary">
            ← Back to Bills
          </button>
          <button onClick={handlePrint} className="btn btn-primary">
            🖨️ Print Invoice
          </button>
          {bill.status === 'draft' ? (
            <button onClick={handleSendBill} className="btn btn-success">
              📤 Send Bill (Get Link)
            </button>
          ) : (
            <button onClick={handleCopyLink} className="btn btn-primary">
              🔗 Copy Shareable Link
            </button>
          )}
          <button onClick={handleSendSMS} className="btn btn-success" style={{ background: '#10b981' }}>
            📱 Send SMS
          </button>
          <button onClick={handleEmailInvoice} className="btn btn-primary" style={{ background: '#3b82f6' }}>
            ✉️ Email Invoice
          </button>
        </div>

        {/* Shareable Link Display */}
        {bill.status !== 'draft' && (
          <div className="no-print" style={{
            marginBottom: '20px',
            padding: '16px',
            background: '#f0f9ff',
            border: '2px solid #0ea5e9',
            borderRadius: '8px'
          }}>
            <div style={{ fontSize: '14px', fontWeight: '600', color: '#0369a1', marginBottom: '8px' }}>
              Shareable Link for Customer:
            </div>
            <div style={{
              padding: '10px',
              background: 'white',
              borderRadius: '6px',
              fontFamily: 'monospace',
              fontSize: '14px',
              wordBreak: 'break-all'
            }}>
              {window.location.origin}/bill/{bill.bill_code}
            </div>
          </div>
        )}

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
              background: 'var(--theme-gradient, linear-gradient(135deg, #f472b6 0%, #ec4899 100%))',
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

          {/* Service For */}
          <div style={{ marginBottom: '32px', display: 'flex', alignItems: 'flex-start', gap: '20px' }}>
            <div style={{ flex: 1 }}>
              <div style={{
                fontSize: '18px',
                fontWeight: '600',
                color: '#2c3e50',
                marginBottom: '8px'
              }}>
                Service for: <span style={{ color: 'var(--theme-primary, #f472b6)' }}>
                  {allDogNames.join(', ')}
                </span>
              </div>
              <div style={{ fontSize: '14px', color: '#7f8c8d' }}>
                Customer: {bill.customer_name}
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
                    border: '3px solid var(--theme-primary, #f472b6)',
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
              <div style={{ fontSize: '16px', color: '#2c3e50', marginBottom: '8px' }}>
                <strong>Dates:</strong> {formatDateRange(bill.items[0].check_in_date, bill.items[bill.items.length - 1].check_out_date)}
              </div>
            </div>
          )}

          {/* Service Type */}
          <div style={{ marginBottom: '32px' }}>
            <div style={{ display: 'flex', gap: '24px', fontSize: '16px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: hasBoarding ? '#2c3e50' : '#95a5a6' }}>
                <input type="checkbox" checked={hasBoarding} readOnly style={{ width: '20px', height: '20px' }} />
                <span style={{ fontWeight: hasBoarding ? '600' : '400' }}>Boarding</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: hasDaycare ? '#2c3e50' : '#95a5a6' }}>
                <input type="checkbox" checked={hasDaycare} readOnly style={{ width: '20px', height: '20px' }} />
                <span style={{ fontWeight: hasDaycare ? '600' : '400' }}>Day Care</span>
              </label>
            </div>
          </div>

          {/* Line Items */}
          <div style={{
            borderTop: '2px solid #e8e8e8',
            borderBottom: '2px solid #e8e8e8',
            padding: '24px 0',
            marginBottom: '24px'
          }}>
            {/* Boarding */}
            {bill.items.map((item, index) => {
              const itemBoardingCost = parseFloat(item.total_cost) - parseFloat(item.dropoff_fee || 0) - parseFloat(item.pickup_fee || 0) - parseFloat(item.extra_charge || 0)
              return (
                <div key={index} style={{
                  marginBottom: '16px'
                }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: item.special_price && item.special_price_comments ? '4px' : '0',
                    fontSize: '16px',
                    color: '#2c3e50'
                  }}>
                    <div>
                      <strong>{item.dog_name}</strong> - {item.days_count} {item.stay_type === 'daycare' ? (item.days_count > 1 ? 'Days' : 'Day') : (item.days_count > 1 ? 'Nights' : 'Night')}
                      {!item.special_price && item.rate_type === 'holiday' && (
                        <span style={{
                          marginLeft: '8px',
                          fontSize: '13px',
                          color: 'var(--theme-primary, #f472b6)',
                          fontWeight: '600'
                        }}>
                          🎄 Holiday Rate
                        </span>
                      )}
                    </div>
                    <div>
                      {item.special_price ? (
                        // If special price, show the special price amount
                        <span>
                          <span style={{ fontSize: '13px', color: '#7f8c8d', marginRight: '8px' }}>Special Rate</span>
                          <strong>{formatCurrency(parseFloat(item.special_price))}</strong>
                        </span>
                      ) : (
                        // Normal calculation - include puppy fee in the displayed rate if applicable
                        (() => {
                          const puppyFeePerDay = item.is_puppy && item.puppy_fee ? parseFloat(item.puppy_fee) / parseFloat(item.days_count) : 0
                          const displayRate = parseFloat(item.daily_rate) + puppyFeePerDay
                          return (
                            <span>
                              {item.days_count} × {formatCurrency(displayRate)}
                              {item.is_puppy && <span style={{ fontSize: '12px', color: '#ec4899' }}> (incl. puppy fee)</span>}
                              {' = '}<strong>{formatCurrency(itemBoardingCost)}</strong>
                            </span>
                          )
                        })()
                      )}
                    </div>
                  </div>
                  {item.special_price && item.special_price_comments && (
                    <div style={{
                      fontSize: '13px',
                      color: '#7f8c8d',
                      fontStyle: 'italic',
                      marginLeft: '0'
                    }}>
                      {item.special_price_comments}
                    </div>
                  )}
                </div>
              )
            })}

            {/* Drop-off/Pick-up Services and Extra Charges */}
            {(dropoffTotal > 0 || pickupTotal > 0 || extraChargeTotal > 0) && (
              <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #ecf0f1' }}>
                <div style={{ fontSize: '15px', fontWeight: '600', color: '#2c3e50', marginBottom: '12px' }}>
                  Additional Services:
                </div>
                {dropoffTotal > 0 && (
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: '8px',
                    fontSize: '15px',
                    color: '#2c3e50'
                  }}>
                    <div>🚗 Sitter Drop-off</div>
                    <div><strong>{formatCurrency(dropoffTotal)}</strong></div>
                  </div>
                )}
                {pickupTotal > 0 && (
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: '8px',
                    fontSize: '15px',
                    color: '#2c3e50'
                  }}>
                    <div>🏠 Sitter Pick-up</div>
                    <div><strong>{formatCurrency(pickupTotal)}</strong></div>
                  </div>
                )}
                {extraCharges.map((charge, index) => (
                  <div key={index} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: '8px',
                    fontSize: '15px',
                    color: '#2c3e50'
                  }}>
                    <div>
                      💰 {charge.comment}
                      {extraCharges.length > 1 && <span style={{ fontSize: '13px', color: '#7f8c8d', marginLeft: '4px' }}>({charge.dogName})</span>}
                    </div>
                    <div><strong>{formatCurrency(charge.amount)}</strong></div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Total */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '24px',
            fontWeight: '700',
            color: '#2c3e50',
            marginBottom: '40px'
          }}>
            <div>TOTAL:</div>
            <div style={{ color: 'var(--theme-primary, #f472b6)' }}>
              {formatCurrency(bill.total_amount)}
            </div>
          </div>

          {/* Personal Message */}
          <div style={{
            background: '#f8f9fa',
            padding: '24px',
            borderRadius: '8px',
            marginBottom: '32px',
            borderLeft: '4px solid var(--theme-primary, #f472b6)'
          }}>
            <p style={{ margin: '0 0 12px 0', fontSize: '16px', color: '#2c3e50' }}>
              Hello {primaryDogName},
            </p>
            <p style={{ margin: '0', fontSize: '15px', color: '#555', lineHeight: '1.6' }}>
              Thank you so much for choosing Lily's Dog Boarding! We hope you have a wonderful stay with us. We look forward to seeing you!
            </p>
          </div>

          {/* Policies Section */}
          <div style={{
            fontSize: '13px',
            color: '#666',
            marginBottom: '24px',
            padding: '20px',
            background: '#fcfcfc',
            borderRadius: '8px',
            border: '1px solid #e8e8e8'
          }}>
            <div style={{ fontWeight: '600', fontSize: '14px', color: '#2c3e50', marginBottom: '12px' }}>
              Rate Information
            </div>
            <div style={{ marginBottom: '8px' }}>
              <strong>Extended Care:</strong>
              <ul style={{ margin: '4px 0', paddingLeft: '20px' }}>
                <li>2-7 hours: +50% of daily rate</li>
                <li>8+ hours: +100% of daily rate (full day care)</li>
              </ul>
            </div>
            <div>
              <strong>Holiday Rates (Medium size):</strong>
              <ul style={{ margin: '4px 0', paddingLeft: '20px' }}>
                <li>Day Care: {getHolidayRate('daycare') ? `$${getHolidayRate('daycare').toFixed(0)}/day` : 'Loading...'}</li>
                <li>Boarding: {getHolidayRate('boarding') ? `$${getHolidayRate('boarding').toFixed(0)}/night` : 'Loading...'}</li>
              </ul>
            </div>
          </div>

          {/* Payment Info */}
          <div style={{
            background: 'linear-gradient(135deg, #fff4f6 0%, #fef5f8 100%)',
            padding: '24px',
            borderRadius: '8px',
            marginBottom: '24px',
            border: '1px solid #ffc9d9'
          }}>
            <div style={{ fontWeight: '600', fontSize: '15px', color: '#2c3e50', marginBottom: '12px' }}>
              💳 Payment Information
            </div>
            <div style={{ fontSize: '13px', color: '#2c3e50', marginBottom: '12px', fontStyle: 'italic' }}>
              All services are paid in advance
            </div>
            <div style={{ fontSize: '14px', color: '#2c3e50', lineHeight: '1.8' }}>
              <div><strong>Cash:</strong> Accepted</div>
              <div><strong>Venmo:</strong> @lilykos</div>
              <div><strong>Zelle:</strong> lilykos@me.com</div>
            </div>
          </div>

          {/* Footer */}
          <div style={{
            textAlign: 'center',
            fontSize: '13px',
            color: '#95a5a6',
            paddingTop: '24px',
            borderTop: '1px solid #e8e8e8'
          }}>
            <div style={{ marginBottom: '8px' }}>
              Thank you for your business! 🐾
            </div>
            <div>
              Invoice Date: {formatDate(bill.bill_date)} | Payment Due Date: {formatDate(bill.items[0]?.check_in_date || bill.due_date)}
            </div>
          </div>
        </div>
      </div>

      {/* Print Styles */}
      <style>{`
        @media print {
          .no-print {
            display: none !important;
          }
          body {
            background: white !important;
          }
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>
    </div>
  )
}

export default InvoiceView
