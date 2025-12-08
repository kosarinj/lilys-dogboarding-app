import { Routes, Route, Navigate } from 'react-router-dom'
import Dashboard from '../components/admin/Dashboard'
import CustomersManager from '../components/admin/CustomersManager'
import DogsManager from '../components/admin/DogsManager'
import StaysManager from '../components/admin/StaysManager'
import BillingManager from '../components/admin/BillingManager'
import RatesConfig from '../components/admin/RatesConfig'
import Analytics from '../components/admin/Analytics'

function AdminPage() {
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar Navigation */}
      <nav style={{
        width: '250px',
        backgroundColor: '#2c3e50',
        color: 'white',
        padding: '20px'
      }}>
        <h2 style={{ marginBottom: '30px' }}>Lily's Dog Boarding</h2>
        <ul style={{ listStyle: 'none' }}>
          <li style={{ marginBottom: '10px' }}><a href="/admin/dashboard" style={{ color: 'white', textDecoration: 'none' }}>Dashboard</a></li>
          <li style={{ marginBottom: '10px' }}><a href="/admin/customers" style={{ color: 'white', textDecoration: 'none' }}>Customers</a></li>
          <li style={{ marginBottom: '10px' }}><a href="/admin/dogs" style={{ color: 'white', textDecoration: 'none' }}>Dogs</a></li>
          <li style={{ marginBottom: '10px' }}><a href="/admin/stays" style={{ color: 'white', textDecoration: 'none' }}>Stays</a></li>
          <li style={{ marginBottom: '10px' }}><a href="/admin/billing" style={{ color: 'white', textDecoration: 'none' }}>Billing</a></li>
          <li style={{ marginBottom: '10px' }}><a href="/admin/rates" style={{ color: 'white', textDecoration: 'none' }}>Rates</a></li>
          <li style={{ marginBottom: '10px' }}><a href="/admin/analytics" style={{ color: 'white', textDecoration: 'none' }}>Analytics</a></li>
        </ul>
      </nav>

      {/* Main Content */}
      <div style={{ flex: 1, padding: '30px' }}>
        <Routes>
          <Route path="/" element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/customers" element={<CustomersManager />} />
          <Route path="/dogs" element={<DogsManager />} />
          <Route path="/stays" element={<StaysManager />} />
          <Route path="/billing" element={<BillingManager />} />
          <Route path="/rates" element={<RatesConfig />} />
          <Route path="/analytics" element={<Analytics />} />
        </Routes>
      </div>
    </div>
  )
}

export default AdminPage
