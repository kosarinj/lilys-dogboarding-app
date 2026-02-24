import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
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
  const [monthlyRevenueData, setMonthlyRevenueData] = useState([])
  const [selectedMonth, setSelectedMonth] = useState(null)
  const [allBills, setAllBills] = useState([])
  const [allCustomers, setAllCustomers] = useState([])
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

      // Store raw data for drill-down
      setAllBills(bills)
      setAllCustomers(customers)

      // Build monthly revenue data for chart (last 12 months)
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
      const chartData = []
      for (let i = 11; i >= 0; i--) {
        const d = new Date(currentYear, currentMonth - i, 1)
        const m = d.getMonth()
        const y = d.getFullYear()
        const revenue = bills
          .filter(b => {
            const bd = new Date(b.bill_date)
            return bd.getMonth() === m && bd.getFullYear() === y && b.status === 'paid'
          })
          .reduce((sum, b) => sum + parseFloat(b.total_amount || 0), 0)
        chartData.push({ month: `${monthNames[m]} ${y !== currentYear ? y : ''}`.trim(), monthIndex: m, year: y, revenue })
      }
      setMonthlyRevenueData(chartData)

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

  const handleBarClick = (data) => {
    if (!data || !data.activePayload) return
    const clicked = data.activePayload[0].payload
    // Toggle off if clicking the same month
    if (selectedMonth && selectedMonth.monthIndex === clicked.monthIndex && selectedMonth.year === clicked.year) {
      setSelectedMonth(null)
    } else {
      setSelectedMonth(clicked)
    }
  }

  const getSelectedMonthBills = () => {
    if (!selectedMonth) return []
    const customerMap = {}
    allCustomers.forEach(c => { customerMap[c.id] = c.name })
    return allBills
      .filter(b => {
        const bd = new Date(b.bill_date)
        return bd.getMonth() === selectedMonth.monthIndex && bd.getFullYear() === selectedMonth.year && b.status === 'paid'
      })
      .map(b => ({
        ...b,
        customerName: customerMap[b.customer_id] || 'Unknown'
      }))
      .sort((a, b) => new Date(a.bill_date) - new Date(b.bill_date))
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

      <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', border: '1px solid #e8e8e8', marginBottom: '30px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#2c3e50', margin: 0 }}>Monthly Revenue</h3>
          {selectedMonth && (
            <button
              onClick={() => setSelectedMonth(null)}
              style={{ background: 'none', border: '1px solid #dee2e6', borderRadius: '6px', padding: '4px 12px', fontSize: '12px', color: '#7f8c8d', cursor: 'pointer' }}
            >
              Clear selection
            </button>
          )}
        </div>
        <p style={{ fontSize: '12px', color: '#95a5a6', marginBottom: '16px', marginTop: 0 }}>Click a bar to see bill details</p>
        {monthlyRevenueData.some(d => d.revenue > 0) ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={monthlyRevenueData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }} onClick={handleBarClick} style={{ cursor: 'pointer' }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#7f8c8d' }} />
              <YAxis tick={{ fontSize: 12, fill: '#7f8c8d' }} tickFormatter={(v) => `$${v}`} />
              <Tooltip
                formatter={(value) => [new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value), 'Revenue']}
                contentStyle={{ borderRadius: '8px', border: '1px solid #e8e8e8', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
              />
              <Bar dataKey="revenue" radius={[4, 4, 0, 0]}>
                {monthlyRevenueData.map((entry, index) => (
                  <Cell key={index} fill={selectedMonth && selectedMonth.monthIndex === entry.monthIndex && selectedMonth.year === entry.year ? '#d6336c' : '#f472b6'} style={{ cursor: 'pointer' }} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#95a5a6' }}>
            No paid bills yet
          </div>
        )}

        {selectedMonth && (() => {
          const monthBills = getSelectedMonthBills()
          const monthTotal = monthBills.reduce((sum, b) => sum + parseFloat(b.total_amount || 0), 0)
          return (
            <div style={{ marginTop: '20px', borderTop: '2px solid #f0f0f0', paddingTop: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h4 style={{ fontSize: '15px', fontWeight: '600', color: '#2c3e50', margin: 0 }}>
                  {selectedMonth.month} {selectedMonth.year} — {formatCurrency(monthTotal)}
                </h4>
                <span style={{ fontSize: '13px', color: '#7f8c8d' }}>{monthBills.length} bill{monthBills.length !== 1 ? 's' : ''}</span>
              </div>
              {monthBills.length === 0 ? (
                <p style={{ color: '#95a5a6', fontSize: '14px', textAlign: 'center', padding: '20px 0' }}>No paid bills this month</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {monthBills.map(bill => (
                    <div key={bill.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: '#f8f9fa', borderRadius: '8px' }}>
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: '500', color: '#2c3e50' }}>{bill.customerName}</div>
                        <div style={{ fontSize: '12px', color: '#95a5a6', marginTop: '2px' }}>
                          {new Date(bill.bill_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          {bill.payment_method && ` · ${bill.payment_method}`}
                        </div>
                      </div>
                      <strong style={{ fontSize: '15px', color: '#27ae60' }}>{formatCurrency(bill.total_amount)}</strong>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })()}
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
