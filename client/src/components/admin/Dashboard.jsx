import { useState, useEffect } from 'react'
import { customersAPI, staysAPI, billsAPI } from '../../utils/api'
import './admin.css'

function Dashboard() {
  const [stats, setStats] = useState({
    totalCustomers: 0,
    activeStays: 0,
    upcomingStays: 0,
    completedStays: 0,
    unpaidBills: 0,
    monthlyRevenue: 0,
    totalRevenue: 0
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    loadStats()
  }, [])

  const loadStats = async () => {
    try {
      setLoading(true)
      const [customersRes, staysRes, billsRes] = await Promise.all([
        customersAPI.getAll(),
        staysAPI.getAll(),
        billsAPI.getAll()
      ])

      const customers = customersRes.data
      const stays = staysRes.data
      const bills = billsRes.data

      // Count active stays (status = 'active')
      const activeStays = stays.filter(s => s.status === 'active').length
      const upcomingStays = stays.filter(s => s.status === 'upcoming').length
      const completedStays = stays.filter(s => s.status === 'completed').length

      // Calculate unpaid bills total
      const unpaidBills = bills
        .filter(b => b.status !== 'paid')
        .reduce((sum, b) => sum + parseFloat(b.total_amount || 0), 0)

      // Calculate monthly revenue (this month)
      const now = new Date()
      const currentMonth = now.getMonth()
      const currentYear = now.getFullYear()

      const monthlyRevenue = bills
        .filter(b => {
          const billDate = new Date(b.bill_date)
          return billDate.getMonth() === currentMonth &&
                 billDate.getFullYear() === currentYear &&
                 b.status === 'paid'
        })
        .reduce((sum, b) => sum + parseFloat(b.total_amount || 0), 0)

      // Calculate total revenue
      const totalRevenue = bills
        .filter(b => b.status === 'paid')
        .reduce((sum, b) => sum + parseFloat(b.total_amount || 0), 0)

      setStats({
        totalCustomers: customers.length,
        activeStays,
        upcomingStays,
        completedStays,
        unpaidBills,
        monthlyRevenue,
        totalRevenue
      })
      setError(null)
    } catch (err) {
      setError('Failed to load dashboard data')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  if (loading) return <div className="loading-state">Loading dashboard...</div>

  return (
    <div>
      <div className="admin-header">
        <h1>Dashboard</h1>
      </div>

      {error && (
        <div className="error-state">
          {error}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginBottom: '30px' }}>
        <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', border: '1px solid #e8e8e8' }}>
          <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#7f8c8d', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Customers</h3>
          <p style={{ fontSize: '36px', fontWeight: 'bold', marginTop: '8px', color: '#2c3e50' }}>{stats.totalCustomers}</p>
        </div>
        <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', border: '1px solid #e8e8e8' }}>
          <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#7f8c8d', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Active Stays</h3>
          <p style={{ fontSize: '36px', fontWeight: 'bold', marginTop: '8px', color: '#27ae60' }}>{stats.activeStays}</p>
          <p style={{ fontSize: '12px', color: '#95a5a6', marginTop: '8px' }}>{stats.upcomingStays} upcoming</p>
        </div>
        <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', border: '1px solid #e8e8e8' }}>
          <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#7f8c8d', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Unpaid Bills</h3>
          <p style={{ fontSize: '36px', fontWeight: 'bold', marginTop: '8px', color: '#e67e22' }}>{formatCurrency(stats.unpaidBills)}</p>
        </div>
        <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', border: '1px solid #e8e8e8' }}>
          <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#7f8c8d', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Monthly Revenue</h3>
          <p style={{ fontSize: '36px', fontWeight: 'bold', marginTop: '8px', color: 'var(--theme-primary, #f472b6)' }}>{formatCurrency(stats.monthlyRevenue)}</p>
          <p style={{ fontSize: '12px', color: '#95a5a6', marginTop: '8px' }}>Total: {formatCurrency(stats.totalRevenue)}</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', border: '1px solid #e8e8e8' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#2c3e50', marginBottom: '16px' }}>Stay Summary</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: '#f8f9fa', borderRadius: '8px' }}>
              <span style={{ color: '#7f8c8d' }}>Active</span>
              <strong style={{ color: '#27ae60' }}>{stats.activeStays}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: '#f8f9fa', borderRadius: '8px' }}>
              <span style={{ color: '#7f8c8d' }}>Upcoming</span>
              <strong style={{ color: '#3498db' }}>{stats.upcomingStays}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: '#f8f9fa', borderRadius: '8px' }}>
              <span style={{ color: '#7f8c8d' }}>Completed</span>
              <strong style={{ color: '#95a5a6' }}>{stats.completedStays}</strong>
            </div>
          </div>
        </div>

        <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', border: '1px solid #e8e8e8' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#2c3e50', marginBottom: '16px' }}>Quick Actions</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <a href="#/admin/stays" style={{ padding: '12px', background: '#f8f9fa', borderRadius: '8px', textDecoration: 'none', color: '#2c3e50', fontWeight: '500', textAlign: 'center', border: '1px solid #e8e8e8' }}>
              + Book New Stay
            </a>
            <a href="#/admin/billing" style={{ padding: '12px', background: '#f8f9fa', borderRadius: '8px', textDecoration: 'none', color: '#2c3e50', fontWeight: '500', textAlign: 'center', border: '1px solid #e8e8e8' }}>
              Create Bill
            </a>
            <a href="#/admin/customers" style={{ padding: '12px', background: '#f8f9fa', borderRadius: '8px', textDecoration: 'none', color: '#2c3e50', fontWeight: '500', textAlign: 'center', border: '1px solid #e8e8e8' }}>
              Add Customer
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Dashboard
