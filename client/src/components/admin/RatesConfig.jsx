import { useState, useEffect } from 'react'
import { ratesAPI, settingsAPI } from '../../utils/api'
import './admin.css'

function RatesConfig() {
  const [rates, setRates] = useState([])
  const [settings, setSettings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [editingRate, setEditingRate] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [editingSetting, setEditingSetting] = useState(null)
  const [editSettingValue, setEditSettingValue] = useState('')

  useEffect(() => {
    loadRates()
  }, [])

  const loadRates = async () => {
    try {
      setLoading(true)
      const [ratesRes, settingsRes] = await Promise.all([
        ratesAPI.getAll(),
        settingsAPI.getAll()
      ])
      setRates(ratesRes.data)
      setSettings(settingsRes.data)
      setError(null)
    } catch (err) {
      setError('Failed to load rates. Please try again.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (rate) => {
    setEditingRate(rate.id)
    setEditValue(rate.price_per_day)
  }

  const handleSave = async (rateId) => {
    try {
      await ratesAPI.update(rateId, { price_per_day: parseFloat(editValue) })
      setEditingRate(null)
      setEditValue('')
      loadRates()
    } catch (err) {
      setError('Failed to update rate. Please try again.')
      console.error(err)
    }
  }

  const handleCancel = () => {
    setEditingRate(null)
    setEditValue('')
    setEditingSetting(null)
    setEditSettingValue('')
  }

  const handleEditSetting = (setting) => {
    setEditingSetting(setting.setting_key)
    setEditSettingValue(setting.setting_value)
  }

  const handleSaveSetting = async (settingKey) => {
    try {
      await settingsAPI.update(settingKey, { setting_value: parseFloat(editSettingValue) })
      setEditingSetting(null)
      setEditSettingValue('')
      loadRates()
    } catch (err) {
      setError('Failed to update setting. Please try again.')
      console.error(err)
    }
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  const getRatesByTypeAndService = (rateType, serviceType) => {
    return rates.filter(rate => rate.rate_type === rateType && rate.service_type === serviceType)
  }

  const getRateForSize = (ratesList, size) => {
    return ratesList.find(rate => rate.dog_size === size)
  }

  if (loading) return <div className="loading-state">Loading rates...</div>

  const boardingRegular = getRatesByTypeAndService('regular', 'boarding')
  const boardingHoliday = getRatesByTypeAndService('holiday', 'boarding')
  const daycareRegular = getRatesByTypeAndService('regular', 'daycare')
  const daycareHoliday = getRatesByTypeAndService('holiday', 'daycare')

  return (
    <div>
      <div className="admin-header">
        <div>
          <h1>Rate Configuration</h1>
          <p style={{ color: '#666', marginTop: '8px', fontSize: '14px' }}>
            Set daily rates by dog size and season (applies to both Boarding and Daycare)
          </p>
        </div>
      </div>

      {error && (
        <div className="error-state">
          {error}
        </div>
      )}

      {/* Boarding Rates Section */}
      <div style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '16px', color: '#2c3e50' }}>
          🏠 Boarding Rates
        </h2>
        <p style={{ fontSize: '14px', color: '#7f8c8d', marginBottom: '20px' }}>
          Daily rates for overnight boarding stays
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          {/* Boarding Regular Rates */}
          <div className="form-card">
            <h3 style={{ marginBottom: '20px', fontSize: '16px', fontWeight: '600' }}>📅 Regular Rates</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {['small', 'medium', 'large'].map((size) => {
                const rate = getRateForSize(boardingRegular, size)
              if (!rate) return null

              return (
                <div key={rate.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '16px',
                  background: '#f8f9fa',
                  borderRadius: '8px',
                  border: '1px solid #e8e8e8'
                }}>
                  <div>
                    <div style={{ fontWeight: '600', fontSize: '15px', color: '#2c3e50' }}>
                      {size.charAt(0).toUpperCase() + size.slice(1)} Dogs
                    </div>
                    <div style={{ fontSize: '12px', color: '#7f8c8d', marginTop: '4px' }}>
                      {size === 'small' && '0-25 lbs'}
                      {size === 'medium' && '26-60 lbs'}
                      {size === 'large' && '60+ lbs'}
                    </div>
                  </div>

                  {editingRate === rate.id ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '18px', fontWeight: '600' }}>$</span>
                      <input
                        type="number"
                        step="0.01"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        style={{
                          width: '80px',
                          padding: '6px 10px',
                          fontSize: '16px',
                          border: '2px solid var(--theme-primary, #f472b6)',
                          borderRadius: '6px'
                        }}
                        autoFocus
                      />
                      <button onClick={() => handleSave(rate.id)} className="btn btn-edit" style={{ padding: '6px 12px' }}>
                        Save
                      </button>
                      <button onClick={handleCancel} className="btn btn-secondary" style={{ padding: '6px 12px' }}>
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ fontSize: '20px', fontWeight: '700', color: '#2c3e50' }}>
                        {formatCurrency(rate.price_per_day)}
                        <span style={{ fontSize: '14px', fontWeight: '400', color: '#7f8c8d' }}> / day</span>
                      </div>
                      <button onClick={() => handleEdit(rate)} className="btn btn-edit" style={{ padding: '6px 12px' }}>
                        Edit
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

          {/* Boarding Holiday Rates */}
          <div className="form-card">
            <h3 style={{ marginBottom: '20px', fontSize: '16px', fontWeight: '600' }}>🎄 Holiday Rates</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {['small', 'medium', 'large'].map((size) => {
                const rate = getRateForSize(boardingHoliday, size)
              if (!rate) return null

              return (
                <div key={rate.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '16px',
                  background: '#fff4e6',
                  borderRadius: '8px',
                  border: '1px solid #ffe0b2'
                }}>
                  <div>
                    <div style={{ fontWeight: '600', fontSize: '15px', color: '#2c3e50' }}>
                      {size.charAt(0).toUpperCase() + size.slice(1)} Dogs
                    </div>
                    <div style={{ fontSize: '12px', color: '#7f8c8d', marginTop: '4px' }}>
                      {size === 'small' && '0-25 lbs'}
                      {size === 'medium' && '26-60 lbs'}
                      {size === 'large' && '60+ lbs'}
                    </div>
                  </div>

                  {editingRate === rate.id ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '18px', fontWeight: '600' }}>$</span>
                      <input
                        type="number"
                        step="0.01"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        style={{
                          width: '80px',
                          padding: '6px 10px',
                          fontSize: '16px',
                          border: '2px solid var(--theme-primary, #f472b6)',
                          borderRadius: '6px'
                        }}
                        autoFocus
                      />
                      <button onClick={() => handleSave(rate.id)} className="btn btn-edit" style={{ padding: '6px 12px' }}>
                        Save
                      </button>
                      <button onClick={handleCancel} className="btn btn-secondary" style={{ padding: '6px 12px' }}>
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ fontSize: '20px', fontWeight: '700', color: '#2c3e50' }}>
                        {formatCurrency(rate.price_per_day)}
                        <span style={{ fontSize: '14px', fontWeight: '400', color: '#7f8c8d' }}> / day</span>
                      </div>
                      <button onClick={() => handleEdit(rate)} className="btn btn-edit" style={{ padding: '6px 12px' }}>
                        Edit
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Daycare Rates Section */}
      <div style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '16px', color: '#2c3e50' }}>
          ☀️ Daycare Rates
        </h2>
        <p style={{ fontSize: '14px', color: '#7f8c8d', marginBottom: '20px' }}>
          Daily rates for daytime daycare stays
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          {/* Daycare Regular Rates */}
          <div className="form-card">
            <h3 style={{ marginBottom: '20px', fontSize: '16px', fontWeight: '600' }}>📅 Regular Rates</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {['small', 'medium', 'large'].map((size) => {
                const rate = getRateForSize(daycareRegular, size)
                if (!rate) return null

                return (
                  <div key={rate.id} style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '16px',
                    background: '#f8f9fa',
                    borderRadius: '8px',
                    border: '1px solid #e8e8e8'
                  }}>
                    <div>
                      <div style={{ fontWeight: '600', fontSize: '15px', color: '#2c3e50' }}>
                        {size.charAt(0).toUpperCase() + size.slice(1)} Dogs
                      </div>
                      <div style={{ fontSize: '12px', color: '#7f8c8d', marginTop: '4px' }}>
                        {size === 'small' && '0-25 lbs'}
                        {size === 'medium' && '26-60 lbs'}
                        {size === 'large' && '60+ lbs'}
                      </div>
                    </div>

                    {editingRate === rate.id ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '18px', fontWeight: '600' }}>$</span>
                        <input
                          type="number"
                          step="0.01"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          style={{
                            width: '80px',
                            padding: '6px 10px',
                            fontSize: '16px',
                            border: '2px solid var(--theme-primary, #f472b6)',
                            borderRadius: '6px'
                          }}
                          autoFocus
                        />
                        <button onClick={() => handleSave(rate.id)} className="btn btn-edit" style={{ padding: '6px 12px' }}>
                          Save
                        </button>
                        <button onClick={handleCancel} className="btn btn-secondary" style={{ padding: '6px 12px' }}>
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ fontSize: '20px', fontWeight: '700', color: '#2c3e50' }}>
                          {formatCurrency(rate.price_per_day)}
                          <span style={{ fontSize: '14px', fontWeight: '400', color: '#7f8c8d' }}> / day</span>
                        </div>
                        <button onClick={() => handleEdit(rate)} className="btn btn-edit" style={{ padding: '6px 12px' }}>
                          Edit
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Daycare Holiday Rates */}
          <div className="form-card">
            <h3 style={{ marginBottom: '20px', fontSize: '16px', fontWeight: '600' }}>🎄 Holiday Rates</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {['small', 'medium', 'large'].map((size) => {
                const rate = getRateForSize(daycareHoliday, size)
                if (!rate) return null

                return (
                  <div key={rate.id} style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '16px',
                    background: '#fff4e6',
                    borderRadius: '8px',
                    border: '1px solid #ffe0b2'
                  }}>
                    <div>
                      <div style={{ fontWeight: '600', fontSize: '15px', color: '#2c3e50' }}>
                        {size.charAt(0).toUpperCase() + size.slice(1)} Dogs
                      </div>
                      <div style={{ fontSize: '12px', color: '#7f8c8d', marginTop: '4px' }}>
                        {size === 'small' && '0-25 lbs'}
                        {size === 'medium' && '26-60 lbs'}
                        {size === 'large' && '60+ lbs'}
                      </div>
                    </div>

                    {editingRate === rate.id ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '18px', fontWeight: '600' }}>$</span>
                        <input
                          type="number"
                          step="0.01"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          style={{
                            width: '80px',
                            padding: '6px 10px',
                            fontSize: '16px',
                            border: '2px solid var(--theme-primary, #f472b6)',
                            borderRadius: '6px'
                          }}
                          autoFocus
                        />
                        <button onClick={() => handleSave(rate.id)} className="btn btn-edit" style={{ padding: '6px 12px' }}>
                          Save
                        </button>
                        <button onClick={handleCancel} className="btn btn-secondary" style={{ padding: '6px 12px' }}>
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ fontSize: '20px', fontWeight: '700', color: '#2c3e50' }}>
                          {formatCurrency(rate.price_per_day)}
                          <span style={{ fontSize: '14px', fontWeight: '400', color: '#7f8c8d' }}> / day</span>
                        </div>
                        <button onClick={() => handleEdit(rate)} className="btn btn-edit" style={{ padding: '6px 12px' }}>
                          Edit
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Additional Services Info */}
      <div className="form-card" style={{ marginTop: '24px' }}>
        <h2 style={{ marginBottom: '16px', fontSize: '18px' }}>Additional Services</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          {settings.filter(s => s.setting_key === 'dropoff_fee').map(setting => (
            <div key={setting.setting_key} style={{
              padding: '16px',
              background: '#f8f9fa',
              borderRadius: '8px',
              border: '1px solid #e8e8e8'
            }}>
              <div style={{ fontWeight: '600', fontSize: '15px', color: '#2c3e50', marginBottom: '8px' }}>
                🚗 Drop-off Service
              </div>
              {editingSetting === setting.setting_key ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px' }}>
                  <span style={{ fontSize: '18px', fontWeight: '600' }}>$</span>
                  <input
                    type="number"
                    step="0.01"
                    value={editSettingValue}
                    onChange={(e) => setEditSettingValue(e.target.value)}
                    style={{
                      width: '80px',
                      padding: '6px 10px',
                      fontSize: '16px',
                      border: '2px solid var(--theme-primary, #f472b6)',
                      borderRadius: '6px'
                    }}
                    autoFocus
                  />
                  <button onClick={() => handleSaveSetting(setting.setting_key)} className="btn btn-edit" style={{ padding: '6px 12px' }}>
                    Save
                  </button>
                  <button onClick={handleCancel} className="btn btn-secondary" style={{ padding: '6px 12px' }}>
                    Cancel
                  </button>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: '20px', fontWeight: '700', color: '#2c3e50' }}>
                    {formatCurrency(setting.setting_value)}
                    <span style={{ fontSize: '14px', fontWeight: '400', color: '#7f8c8d' }}> / one-time</span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#7f8c8d', marginTop: '8px' }}>
                    Optional service for customer convenience
                  </div>
                  <button onClick={() => handleEditSetting(setting)} className="btn btn-edit" style={{ padding: '6px 12px', marginTop: '12px' }}>
                    Edit
                  </button>
                </div>
              )}
            </div>
          ))}

          {settings.filter(s => s.setting_key === 'pickup_fee').map(setting => (
            <div key={setting.setting_key} style={{
              padding: '16px',
              background: '#f8f9fa',
              borderRadius: '8px',
              border: '1px solid #e8e8e8'
            }}>
              <div style={{ fontWeight: '600', fontSize: '15px', color: '#2c3e50', marginBottom: '8px' }}>
                🏠 Pick-up Service
              </div>
              {editingSetting === setting.setting_key ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px' }}>
                  <span style={{ fontSize: '18px', fontWeight: '600' }}>$</span>
                  <input
                    type="number"
                    step="0.01"
                    value={editSettingValue}
                    onChange={(e) => setEditSettingValue(e.target.value)}
                    style={{
                      width: '80px',
                      padding: '6px 10px',
                      fontSize: '16px',
                      border: '2px solid var(--theme-primary, #f472b6)',
                      borderRadius: '6px'
                    }}
                    autoFocus
                  />
                  <button onClick={() => handleSaveSetting(setting.setting_key)} className="btn btn-edit" style={{ padding: '6px 12px' }}>
                    Save
                  </button>
                  <button onClick={handleCancel} className="btn btn-secondary" style={{ padding: '6px 12px' }}>
                    Cancel
                  </button>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: '20px', fontWeight: '700', color: '#2c3e50' }}>
                    {formatCurrency(setting.setting_value)}
                    <span style={{ fontSize: '14px', fontWeight: '400', color: '#7f8c8d' }}> / one-time</span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#7f8c8d', marginTop: '8px' }}>
                    Optional service for customer convenience
                  </div>
                  <button onClick={() => handleEditSetting(setting)} className="btn btn-edit" style={{ padding: '6px 12px', marginTop: '12px' }}>
                    Edit
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default RatesConfig
