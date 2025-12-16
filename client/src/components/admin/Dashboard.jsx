import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { customersAPI, staysAPI, billsAPI } from '../../utils/api'
import './admin.css'

function Dashboard() {
  const [stats, setStats] = useState({
    totalCustomers: 0,
    activeStays: 0,
    upcomingStays: 0,
    completedStays: 0,
    cancelledStays: 0,
    unpaidBills: 0,
    monthlyRevenue: 0,
    totalRevenue: 0,
    upcomingStaysTotal: 0,
    activeStaysTotal: 0,
    completedStaysTotal: 0,
    cancelledStaysTotal: 0,
    allStaysTotal: 0
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    loadStats()

    // Refresh data when page becomes visible (e.g., when navigating back to dashboard)
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        loadStats()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
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

      // Count and calculate totals for each stay status
      const activeStaysData = stays.filter(s => s.status === 'active')
      const upcomingStaysData = stays.filter(s => s.status === 'upcoming')
      const completedStaysData = stays.filter(s => s.status === 'completed')
      const cancelledStaysData = stays.filter(s => s.status === 'cancelled')

      const activeStays = activeStaysData.length
      const upcomingStays = upcomingStaysData.length
      const completedStays = completedStaysData.length
      const cancelledStays = cancelledStaysData.length

      const activeStaysTotal = activeStaysData.reduce((sum, s) => sum + parseFloat(s.total_cost || 0), 0)
      const upcomingStaysTotal = upcomingStaysData.reduce((sum, s) => sum + parseFloat(s.total_cost || 0), 0)
      const completedStaysTotal = completedStaysData.reduce((sum, s) => sum + parseFloat(s.total_cost || 0), 0)
      const cancelledStaysTotal = cancelledStaysData.reduce((sum, s) => sum + parseFloat(s.total_cost || 0), 0)
      const allStaysTotal = stays.reduce((sum, s) => sum + parseFloat(s.total_cost || 0), 0)

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
        cancelledStays,
        unpaidBills,
        monthlyRevenue,
        totalRevenue,
        upcomingStaysTotal,
        activeStaysTotal,
        completedStaysTotal,
        cancelledStaysTotal,
        allStaysTotal
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
          <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#2c3e50', marginBottom: '16px' }}>Bookings by Status</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <Link to="/admin/stays" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: '#f8f9fa', borderRadius: '8px', textDecoration: 'none', transition: 'background 0.2s', cursor: 'pointer' }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#e9ecef'}
              onMouseLeave={(e) => e.currentTarget.style.background = '#f8f9fa'}>
              <div>
                <div style={{ color: '#7f8c8d', fontSize: '13px' }}>Upcoming</div>
                <div style={{ color: '#3498db', fontSize: '11px', marginTop: '2px' }}>{stats.upcomingStays} stay{stats.upcomingStays !== 1 ? 's' : ''}</div>
              </div>
              <strong style={{ color: '#3498db', fontSize: '16px' }}>{formatCurrency(stats.upcomingStaysTotal)}</strong>
            </Link>
            <Link to="/admin/stays" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: '#f8f9fa', borderRadius: '8px', textDecoration: 'none', transition: 'background 0.2s', cursor: 'pointer' }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#e9ecef'}
              onMouseLeave={(e) => e.currentTarget.style.background = '#f8f9fa'}>
              <div>
                <div style={{ color: '#7f8c8d', fontSize: '13px' }}>Active</div>
                <div style={{ color: '#27ae60', fontSize: '11px', marginTop: '2px' }}>{stats.activeStays} stay{stats.activeStays !== 1 ? 's' : ''}</div>
              </div>
              <strong style={{ color: '#27ae60', fontSize: '16px' }}>{formatCurrency(stats.activeStaysTotal)}</strong>
            </Link>
            <Link to="/admin/stays" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: '#f8f9fa', borderRadius: '8px', textDecoration: 'none', transition: 'background 0.2s', cursor: 'pointer' }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#e9ecef'}
              onMouseLeave={(e) => e.currentTarget.style.background = '#f8f9fa'}>
              <div>
                <div style={{ color: '#7f8c8d', fontSize: '13px' }}>Completed</div>
                <div style={{ color: '#95a5a6', fontSize: '11px', marginTop: '2px' }}>{stats.completedStays} stay{stats.completedStays !== 1 ? 's' : ''}</div>
              </div>
              <strong style={{ color: '#95a5a6', fontSize: '16px' }}>{formatCurrency(stats.completedStaysTotal)}</strong>
            </Link>
            {stats.cancelledStays > 0 && (
              <Link to="/admin/stays" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: '#f8f9fa', borderRadius: '8px', textDecoration: 'none', transition: 'background 0.2s', cursor: 'pointer' }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#e9ecef'}
                onMouseLeave={(e) => e.currentTarget.style.background = '#f8f9fa'}>
                <div>
                  <div style={{ color: '#7f8c8d', fontSize: '13px' }}>Cancelled</div>
                  <div style={{ color: '#e74c3c', fontSize: '11px', marginTop: '2px' }}>{stats.cancelledStays} stay{stats.cancelledStays !== 1 ? 's' : ''}</div>
                </div>
                <strong style={{ color: '#e74c3c', fontSize: '16px' }}>{formatCurrency(stats.cancelledStaysTotal)}</strong>
              </Link>
            )}
            <div style={{ borderTop: '2px solid #dee2e6', marginTop: '8px', paddingTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ color: '#2c3e50', fontSize: '14px', fontWeight: '600' }}>Total Bookings</div>
                <div style={{ color: '#7f8c8d', fontSize: '11px', marginTop: '2px' }}>{stats.activeStays + stats.upcomingStays + stats.completedStays + stats.cancelledStays} total</div>
              </div>
              <strong style={{ color: '#2c3e50', fontSize: '18px' }}>{formatCurrency(stats.allStaysTotal)}</strong>
            </div>
          </div>
        </div>

        <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', border: '1px solid #e8e8e8' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#2c3e50', marginBottom: '16px' }}>Quick Actions</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <Link to="/admin/stays" className="btn btn-primary" style={{ padding: '12px', borderRadius: '8px', textDecoration: 'none', fontWeight: '500', textAlign: 'center' }}>
              + Book New Stay
            </Link>
            <Link to="/admin/billing" className="btn btn-secondary" style={{ padding: '12px', borderRadius: '8px', textDecoration: 'none', fontWeight: '500', textAlign: 'center' }}>
              Create Bill
            </Link>
            <Link to="/admin/customers" className="btn btn-secondary" style={{ padding: '12px', borderRadius: '8px', textDecoration: 'none', fontWeight: '500', textAlign: 'center' }}>
              Add Customer
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Dashboard
