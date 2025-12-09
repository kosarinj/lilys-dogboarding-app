import './admin.css'

function InvoiceView({ bill, onClose }) {
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const formatDateRange = (start, end) => {
    const startDate = new Date(start)
    const endDate = new Date(end)
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
  let holidaySurcharge = 0

  bill.items.forEach(item => {
    const itemCost = parseFloat(item.total_cost)
    const dropoffFee = parseFloat(item.dropoff_fee || 0)
    const pickupFee = parseFloat(item.pickup_fee || 0)

    // Boarding cost (total - fees)
    boardingTotal += (itemCost - dropoffFee - pickupFee)
    dropoffTotal += dropoffFee
    pickupTotal += pickupFee

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
        <div className="no-print" style={{ marginBottom: '20px', display: 'flex', gap: '12px' }}>
          <button onClick={onClose} className="btn btn-secondary">
            ← Back to Bills
          </button>
          <button onClick={handlePrint} className="btn btn-primary">
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
          <div style={{ marginBottom: '32px' }}>
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
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input type="checkbox" checked readOnly style={{ width: '20px', height: '20px' }} />
                <span style={{ fontWeight: '600' }}>Boarding</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#95a5a6' }}>
                <input type="checkbox" readOnly style={{ width: '20px', height: '20px' }} />
                <span>Day Care</span>
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
              const itemBoardingCost = parseFloat(item.total_cost) - parseFloat(item.dropoff_fee || 0) - parseFloat(item.pickup_fee || 0)
              return (
                <div key={index} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: '12px',
                  fontSize: '16px',
                  color: '#2c3e50'
                }}>
                  <div>
                    <strong>{item.dog_name}</strong> - {item.days_count} {item.days_count > 1 ? 'Nights' : 'Night'}
                    {item.rate_type === 'holiday' && (
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
                    {item.days_count} × {formatCurrency(item.daily_rate)} = <strong>{formatCurrency(itemBoardingCost)}</strong>
                  </div>
                </div>
              )
            })}

            {/* Drop-off/Pick-up Services */}
            {(dropoffTotal > 0 || pickupTotal > 0) && (
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
              Thank you so much for choosing Lily's Dog Boarding! We hope {allDogNames.length > 1 ? 'they' : primaryDogName} had a wonderful stay with us. We look forward to seeing {allDogNames.length > 1 ? 'them' : 'you'} again soon!
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
              <strong>Holiday Rates:</strong>
              <ul style={{ margin: '4px 0', paddingLeft: '20px' }}>
                <li>Day Care: $75/day</li>
                <li>Boarding: $85/night</li>
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
              Invoice Date: {formatDate(bill.bill_date)} | Due Date: {formatDate(bill.due_date)}
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
