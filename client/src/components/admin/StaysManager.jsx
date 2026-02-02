import { useState, useEffect } from 'react'
import { staysAPI, dogsAPI, settingsAPI, ratesAPI } from '../../utils/api'
import './admin.css'

function StaysManager() {
  const [stays, setStays] = useState([])
  const [dogs, setDogs] = useState([])
  const [rates, setRates] = useState([])
  const [fees, setFees] = useState({
    dropoff: 20,
    pickup: 20,
    boardingPuppyRegular: 0,
    boardingPuppyHoliday: 0,
    daycarePuppyRegular: 0,
    daycarePuppyHoliday: 0
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [editingStay, setEditingStay] = useState(null)
  const [formData, setFormData] = useState({
    dog_id: '',
    check_in_date: '',
    check_out_date: '',
    check_in_time: '',
    check_out_time: '',
    stay_type: 'boarding',
    rate_type: 'regular',
    days_count: '',
    special_price: '',
    special_price_comments: '',
    notes: '',
    status: 'upcoming',
    requires_dropoff: false,
    requires_pickup: false,
    extra_charge: '',
    extra_charge_comments: '',
    rover: false,
    is_puppy: false
  })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const [staysRes, dogsRes, settingsRes, ratesRes] = await Promise.all([
        staysAPI.getAll(),
        dogsAPI.getAll(),
        settingsAPI.getAll(),
        ratesAPI.getAll()
      ])
      setStays(staysRes.data)
      setDogs(dogsRes.data)
      setRates(ratesRes.data)

      // Extract fees from settings
      const settings = settingsRes.data
      const dropoffSetting = settings.find(s => s.setting_key === 'dropoff_fee')
      const pickupSetting = settings.find(s => s.setting_key === 'pickup_fee')
      const boardingPuppyRegularSetting = settings.find(s => s.setting_key === 'boarding_puppy_fee_regular')
      const boardingPuppyHolidaySetting = settings.find(s => s.setting_key === 'boarding_puppy_fee_holiday')
      const daycarePuppyRegularSetting = settings.find(s => s.setting_key === 'daycare_puppy_fee_regular')
      const daycarePuppyHolidaySetting = settings.find(s => s.setting_key === 'daycare_puppy_fee_holiday')

      setFees({
        dropoff: dropoffSetting ? parseFloat(dropoffSetting.setting_value) : 20,
        pickup: pickupSetting ? parseFloat(pickupSetting.setting_value) : 20,
        boardingPuppyRegular: boardingPuppyRegularSetting ? parseFloat(boardingPuppyRegularSetting.setting_value) : 0,
        boardingPuppyHoliday: boardingPuppyHolidaySetting ? parseFloat(boardingPuppyHolidaySetting.setting_value) : 0,
        daycarePuppyRegular: daycarePuppyRegularSetting ? parseFloat(daycarePuppyRegularSetting.setting_value) : 0,
        daycarePuppyHoliday: daycarePuppyHolidaySetting ? parseFloat(daycarePuppyHolidaySetting.setting_value) : 0
      })

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
      // Map 'custom' rate_type to 'regular' for DB (custom uses special_price instead)
      const submitData = { ...formData }
      if (submitData.rate_type === 'custom') {
        submitData.rate_type = 'regular'
      }

      if (editingStay) {
        await staysAPI.update(editingStay.id, submitData)
      } else {
        await staysAPI.create(submitData)
      }

      setFormData({
        dog_id: '',
        check_in_date: '',
        check_out_date: '',
        check_in_time: '',
        check_out_time: '',
        stay_type: 'boarding',
        rate_type: 'regular',
        days_count: '',
        special_price: '',
        special_price_comments: '',
        notes: '',
        status: 'upcoming',
        requires_dropoff: false,
        requires_pickup: false,
        extra_charge: '',
        extra_charge_comments: '',
        rover: false,
        is_puppy: false
      })
      setShowForm(false)
      setEditingStay(null)
      loadData()
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save stay. Please try again.')
      console.error(err)
    }
  }

  const handleEdit = (stay) => {
    setEditingStay(stay)
    setFormData({
      dog_id: stay.dog_id,
      check_in_date: stay.check_in_date.split('T')[0],
      check_out_date: stay.check_out_date.split('T')[0],
      check_in_time: stay.check_in_time || '',
      check_out_time: stay.check_out_time || '',
      stay_type: stay.stay_type || 'boarding',
      rate_type: stay.rate_type,
      days_count: stay.days_count || '',
      special_price: stay.special_price || '',
      special_price_comments: stay.special_price_comments || '',
      notes: stay.notes || '',
      status: stay.status,
      requires_dropoff: stay.requires_dropoff || false,
      requires_pickup: stay.requires_pickup || false,
      extra_charge: stay.extra_charge || '',
      extra_charge_comments: stay.extra_charge_comments || '',
      rover: stay.rover || false,
      is_puppy: stay.is_puppy || false
    })
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this stay?')) return
    try {
      await staysAPI.delete(id)
      loadData()
    } catch (err) {
      setError('Failed to delete stay.')
      console.error(err)
    }
  }

  const handleCancel = () => {
    setFormData({
      dog_id: '',
      check_in_date: '',
      check_out_date: '',
      check_in_time: '',
      check_out_time: '',
      stay_type: 'boarding',
      rate_type: 'regular',
      days_count: '',
      special_price: '',
      notes: '',
      status: 'upcoming',
      requires_dropoff: false,
      requires_pickup: false,
      extra_charge: '',
      extra_charge_comments: '',
      rover: false,
      is_puppy: false
    })
    setShowForm(false)
    setEditingStay(null)
  }

  const getStatusBadge = (status) => {
    const badges = {
      upcoming: { class: 'badge-small', text: 'Upcoming' },
      active: { class: 'badge-medium', text: 'Active' },
      completed: { class: 'badge-large', text: 'Completed' },
      cancelled: { class: 'badge-large', text: 'Cancelled' }
    }
    return badges[status] || badges.upcoming
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

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  // Get puppy fee based on stay type and rate type
  const getPuppyFee = () => {
    if (formData.stay_type === 'boarding') {
      return formData.rate_type === 'holiday' ? fees.boardingPuppyHoliday : fees.boardingPuppyRegular
    } else {
      return formData.rate_type === 'holiday' ? fees.daycarePuppyHoliday : fees.daycarePuppyRegular
    }
  }

  // Calculate partial day addition based on checkout time vs checkin time
  // If checkout is past checkin time: 2-7 hrs = +0.5 day, 8+ hrs = +1 day
  const getPartialDayAddition = () => {
    if (!formData.check_in_time || !formData.check_out_time) {
      return 0 // No partial day if times not specified
    }

    const [inHour, inMin] = formData.check_in_time.split(':').map(Number)
    const [outHour, outMin] = formData.check_out_time.split(':').map(Number)
    const inMinutes = inHour * 60 + inMin
    const outMinutes = outHour * 60 + outMin
    const hours = (outMinutes - inMinutes) / 60

    // If checkout is before or at checkin time, no extra partial day
    if (hours <= 0) {
      return 0
    }

    if (hours >= 8) {
      return 1.0 // Full extra day
    } else if (hours >= 2) {
      return 0.5 // Half day
    }
    return 0 // Less than 2 hours, no extra charge
  }

  // Calculate estimated total for booking form
  const calculateEstimatedTotal = () => {
    if (!formData.dog_id || !formData.check_in_date || !formData.check_out_date) {
      return null
    }

    let total

    // Calculate base days from date difference
    let baseDays
    if (formData.stay_type === 'daycare' && formData.days_count) {
      baseDays = parseInt(formData.days_count)
    } else {
      const checkIn = new Date(formData.check_in_date)
      const checkOut = new Date(formData.check_out_date)
      baseDays = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24))
    }

    // Add partial day if checkout time is past checkin time
    // 2-7 hours past = +0.5 day, 8+ hours past = +1 day
    const partialDay = getPartialDayAddition()
    const totalDays = Math.max(baseDays + partialDay, partialDay > 0 ? partialDay : 1)

    // For daycare: multiply fees by days (each day needs drop-off/pick-up)
    // For boarding: fees are one-time (single drop-off at start, single pick-up at end)
    const feeMultiplier = formData.stay_type === 'daycare' ? Math.ceil(totalDays) : 1

    // If special price is set, use that
    if (formData.special_price && parseFloat(formData.special_price) > 0) {
      const specialPrice = parseFloat(formData.special_price)
      const pickupFee = formData.requires_pickup ? getPickupFee() * feeMultiplier : 0
      const dropoffFee = formData.requires_dropoff ? getDropoffFee() * feeMultiplier : 0
      const extraCharge = formData.extra_charge ? parseFloat(formData.extra_charge) : 0
      const puppyFee = formData.is_puppy ? getPuppyFee() * totalDays : 0
      total = specialPrice + pickupFee + dropoffFee + extraCharge + puppyFee
    } else {
      // Get selected dog
      const selectedDog = dogs.find(d => d.id === parseInt(formData.dog_id))
      if (!selectedDog) return null

      // Use custom daily rate if rate_type is 'custom', otherwise find the appropriate rate
      let dailyRate
      if (formData.rate_type === 'custom' && selectedDog.custom_daily_rate) {
        dailyRate = parseFloat(selectedDog.custom_daily_rate)
      } else {
        const lookupRateType = formData.rate_type === 'custom' ? 'regular' : formData.rate_type
        const rate = rates.find(r =>
          r.dog_size === selectedDog.size &&
          r.rate_type === lookupRateType &&
          (r.service_type === formData.stay_type || !r.service_type)
        )
        if (!rate) return null
        dailyRate = parseFloat(rate.price_per_day)
      }

      // Calculate costs: base days + partial day
      const baseCost = totalDays * dailyRate
      const pickupFee = formData.requires_pickup ? getPickupFee() * feeMultiplier : 0
      const dropoffFee = formData.requires_dropoff ? getDropoffFee() * feeMultiplier : 0
      const extraCharge = formData.extra_charge ? parseFloat(formData.extra_charge) : 0
      const puppyFee = formData.is_puppy ? getPuppyFee() * totalDays : 0

      total = baseCost + pickupFee + dropoffFee + extraCharge + puppyFee
    }

    // Apply 20% Rover discount if checked
    if (formData.rover) {
      total = total * 0.8
    }

    return total
  }

  // Get pickup fee (use dog override if set, otherwise default)
  const getPickupFee = () => {
    const selectedDog = dogs.find(d => d.id === parseInt(formData.dog_id))
    if (selectedDog?.pickup_fee_override != null) {
      return parseFloat(selectedDog.pickup_fee_override)
    }
    return fees.pickup
  }

  // Get dropoff fee (use dog override if set, otherwise default)
  const getDropoffFee = () => {
    const selectedDog = dogs.find(d => d.id === parseInt(formData.dog_id))
    if (selectedDog?.dropoff_fee_override != null) {
      return parseFloat(selectedDog.dropoff_fee_override)
    }
    return fees.dropoff
  }

  if (loading) return <div className="loading-state">Loading stays...</div>

  return (
    <div>
      <div className="admin-header">
        <h1>Stays & Bookings</h1>
        {!showForm && (
          <button onClick={() => setShowForm(true)} className="btn btn-primary">
            + Book Stay
          </button>
        )}
      </div>

      {error && (
        <div className="error-state">
          {error}
        </div>
      )}

      {dogs.length === 0 && !showForm && (
        <div className="error-state" style={{ background: '#fff4e6', border: '1px solid #ffe0b2', color: '#e67e22' }}>
          ⚠️ Please add dogs first before booking stays.
        </div>
      )}

      {showForm && (
        <div className="form-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ margin: 0 }}>{editingStay ? 'Edit Stay' : 'Book New Stay'}</h2>
            {(() => {
              const estimatedTotal = calculateEstimatedTotal()
              if (!estimatedTotal) return null

              return (
                <div style={{
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  padding: '12px 20px',
                  borderRadius: '8px',
                  boxShadow: '0 2px 8px rgba(102, 126, 234, 0.3)',
                  minWidth: '150px',
                  textAlign: 'right'
                }}>
                  <div style={{ fontSize: '11px', opacity: 0.9, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Estimated Total
                  </div>
                  <div style={{ fontSize: '24px', fontWeight: '700' }}>
                    {formatCurrency(estimatedTotal)}
                  </div>
                </div>
              )
            })()}
          </div>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Dog *</label>
              <select
                className="form-select"
                value={formData.dog_id}
                onChange={(e) => setFormData({ ...formData, dog_id: e.target.value })}
                required
              >
                <option value="">Select dog...</option>
                {dogs
                  .filter(dog => dog.status !== 'deceased')
                  .map(dog => (
                    <option key={dog.id} value={dog.id}>
                      {dog.name} ({dog.customer_name}) - {dog.size}
                    </option>
                  ))}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div className="form-group">
                <label className="form-label">Check-In Date *</label>
                <input
                  type="date"
                  className="form-input"
                  value={formData.check_in_date}
                  onChange={(e) => setFormData({ ...formData, check_in_date: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Check-Out Date *</label>
                <input
                  type="date"
                  className="form-input"
                  value={formData.check_out_date}
                  onChange={(e) => setFormData({ ...formData, check_out_date: e.target.value })}
                  required
                  min={formData.check_in_date}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div className="form-group">
                <label className="form-label">Check-In Time</label>
                <input
                  type="time"
                  className="form-input"
                  value={formData.check_in_time}
                  onChange={(e) => setFormData({ ...formData, check_in_time: e.target.value })}
                  placeholder="e.g., 14:00"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Check-Out Time</label>
                <input
                  type="time"
                  className="form-input"
                  value={formData.check_out_time}
                  onChange={(e) => setFormData({ ...formData, check_out_time: e.target.value })}
                  placeholder="e.g., 11:00"
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px' }}>
              <div className="form-group">
                <label className="form-label">Stay Type *</label>
                <select
                  className="form-select"
                  value={formData.stay_type}
                  onChange={(e) => setFormData({ ...formData, stay_type: e.target.value })}
                  required
                >
                  <option value="boarding">Boarding</option>
                  <option value="daycare">Daycare</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Rate Type *</label>
                <select
                  className="form-select"
                  value={formData.rate_type}
                  onChange={(e) => {
                    const newRateType = e.target.value
                    const updates = { rate_type: newRateType }

                    if (newRateType === 'custom') {
                      const selectedDog = dogs.find(d => d.id === parseInt(formData.dog_id))
                      if (selectedDog?.custom_daily_rate) {
                        const customRate = parseFloat(selectedDog.custom_daily_rate)
                        // Calculate days for special price
                        let days = 0
                        if (formData.stay_type === 'daycare' && formData.days_count) {
                          days = parseInt(formData.days_count)
                        } else if (formData.check_in_date && formData.check_out_date) {
                          const checkIn = new Date(formData.check_in_date)
                          const checkOut = new Date(formData.check_out_date)
                          days = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24))
                          days += getPartialDayAddition()
                        }
                        if (days > 0) {
                          updates.special_price = (customRate * days).toFixed(2)
                          updates.special_price_comments = `Custom rate: $${customRate.toFixed(0)}/day × ${days} days`
                        }
                      }
                    } else if (formData.rate_type === 'custom') {
                      // Switching away from custom - clear special price if it was auto-set
                      updates.special_price = ''
                      updates.special_price_comments = ''
                    }

                    setFormData({ ...formData, ...updates })
                  }}
                  required
                >
                  <option value="regular">Regular Rate</option>
                  <option value="holiday">Holiday Rate</option>
                  {(() => {
                    const selectedDog = dogs.find(d => d.id === parseInt(formData.dog_id))
                    return selectedDog?.custom_daily_rate ? (
                      <option value="custom">Custom Rate (${parseFloat(selectedDog.custom_daily_rate).toFixed(0)}/day)</option>
                    ) : null
                  })()}
                </select>
              </div>

              {editingStay && (
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select
                    className="form-select"
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  >
                    <option value="upcoming">Upcoming</option>
                    <option value="active">Active</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              )}
            </div>

            {formData.stay_type === 'daycare' && (
              <div className="form-group">
                <label className="form-label">Number of Daycare Days (Optional)</label>
                <input
                  type="number"
                  min="1"
                  className="form-input"
                  value={formData.days_count}
                  onChange={(e) => setFormData({ ...formData, days_count: e.target.value })}
                  placeholder="Leave blank to use date range"
                />
                <p style={{ fontSize: '12px', color: '#7f8c8d', marginTop: '4px' }}>
                  For daycare with a date range but non-consecutive days, specify the actual number of days. Leave blank to auto-calculate from check-in/check-out dates.
                </p>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Special Price (Optional)</label>
              <input
                type="number"
                step="0.01"
                className="form-input"
                value={formData.special_price}
                onChange={(e) => setFormData({ ...formData, special_price: e.target.value })}
                placeholder="Override calculated price (e.g., 250.00)"
              />
              <p style={{ fontSize: '12px', color: '#7f8c8d', marginTop: '4px' }}>
                Leave blank to use standard pricing. Enter a custom amount to override.
              </p>
            </div>

            <div className="form-group">
              <label className="form-label">Special Price Comments (Optional)</label>
              <textarea
                className="form-textarea"
                value={formData.special_price_comments}
                onChange={(e) => setFormData({ ...formData, special_price_comments: e.target.value })}
                rows="2"
                placeholder="Explain the reason for the special price..."
              />
              <p style={{ fontSize: '12px', color: '#7f8c8d', marginTop: '4px' }}>
                Add details about why a special price was set (will appear on invoice).
              </p>
            </div>

            <div className="form-group">
              <label className="form-label">Additional Services</label>
              <div style={{ display: 'flex', gap: '20px', marginTop: '8px', flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={formData.requires_dropoff}
                    onChange={(e) => setFormData({ ...formData, requires_dropoff: e.target.checked })}
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                  <span>Drop-off (${fees.dropoff.toFixed(2)})</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={formData.requires_pickup}
                    onChange={(e) => setFormData({ ...formData, requires_pickup: e.target.checked })}
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                  <span>Pick-up (${fees.pickup.toFixed(2)})</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={formData.is_puppy}
                    onChange={(e) => setFormData({ ...formData, is_puppy: e.target.checked })}
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                  <span style={{ color: formData.is_puppy ? '#ec4899' : 'inherit', fontWeight: formData.is_puppy ? '600' : 'normal' }}>
                    🐶 Puppy (+${getPuppyFee().toFixed(2)}/day)
                  </span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={formData.rover}
                    onChange={(e) => setFormData({ ...formData, rover: e.target.checked })}
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                  <span style={{ color: formData.rover ? '#e67e22' : 'inherit', fontWeight: formData.rover ? '600' : 'normal' }}>
                    Rover.com (-20%)
                  </span>
                </label>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Extra Charge (Optional)</label>
              <input
                type="number"
                step="0.01"
                className="form-input"
                value={formData.extra_charge}
                onChange={(e) => setFormData({ ...formData, extra_charge: e.target.value })}
                placeholder="Additional charge amount (e.g., 25.00)"
              />
              <p style={{ fontSize: '12px', color: '#7f8c8d', marginTop: '4px' }}>
                Enter any additional charges beyond standard rates and services.
              </p>
            </div>

            <div className="form-group">
              <label className="form-label">Extra Charge Comments (Optional)</label>
              <textarea
                className="form-textarea"
                value={formData.extra_charge_comments}
                onChange={(e) => setFormData({ ...formData, extra_charge_comments: e.target.value })}
                rows="2"
                placeholder="Description of the extra charge..."
              />
              <p style={{ fontSize: '12px', color: '#7f8c8d', marginTop: '4px' }}>
                Explain what the extra charge is for (will appear on invoice).
              </p>
            </div>

            <div className="form-group">
              <label className="form-label">Notes</label>
              <textarea
                className="form-textarea"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows="3"
                placeholder="Any special instructions for this stay..."
              />
            </div>

            <div className="form-actions">
              <button type="submit" className="btn btn-success">
                {editingStay ? '✓ Update Stay' : '✓ Book Stay'}
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
              <th>Dog</th>
              <th>Owner</th>
              <th>Due Date</th>
              <th>Payment Due Date</th>
              <th>Days</th>
              <th>Rate</th>
              <th>Services</th>
              <th>Total</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {stays.length === 0 ? (
              <tr>
                <td colSpan="11">
                  <div className="empty-state">
                    <div className="empty-state-icon">📅</div>
                    <div className="empty-state-text">No stays booked yet</div>
                    <div className="empty-state-subtext">Click "Book Stay" to schedule your first boarding</div>
                  </div>
                </td>
              </tr>
            ) : (
              stays.map((stay) => {
                const statusBadge = getStatusBadge(stay.status)
                const services = []
                if (stay.requires_dropoff) services.push('Drop-off')
                if (stay.requires_pickup) services.push('Pick-up')

                return (
                  <tr key={stay.id}>
                    <td>
                      {stay.dog_photo_url ? (
                        <img
                          src={`${(import.meta.env.VITE_API_URL || 'http://localhost:5000').replace('/api', '')}${stay.dog_photo_url}`}
                          alt={stay.dog_name}
                          style={{ width: '50px', height: '50px', objectFit: 'cover', borderRadius: '8px' }}
                        />
                      ) : (
                        <div style={{ width: '50px', height: '50px', background: '#f0f0f0', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>
                          🐕
                        </div>
                      )}
                    </td>
                    <td><strong>{stay.dog_name}</strong></td>
                    <td>{stay.customer_name}</td>
                    <td>{formatDate(stay.check_in_date)}</td>
                    <td>{formatDate(stay.check_in_date)}</td>
                    <td>{stay.days_count} days</td>
                    <td>{stay.rate_type === 'holiday' ? '🎄 Holiday' : 'Regular'}</td>
                    <td>
                      {services.length > 0 ? (
                        <div style={{ fontSize: '12px' }}>
                          {services.map((service, i) => (
                            <div key={i}>✓ {service}</div>
                          ))}
                        </div>
                      ) : (
                        <span style={{ color: '#95a5a6' }}>-</span>
                      )}
                    </td>
                    <td><strong>{formatCurrency(stay.total_cost)}</strong></td>
                    <td>
                      <span className={`badge ${statusBadge.class}`}>
                        {statusBadge.text}
                      </span>
                    </td>
                    <td>
                      <button onClick={() => handleEdit(stay)} className="btn btn-edit">
                        Edit
                      </button>
                      <button onClick={() => handleDelete(stay.id)} className="btn btn-delete">
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

export default StaysManager
