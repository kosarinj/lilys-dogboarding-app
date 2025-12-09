import { Routes, Route, Navigate, Link, useLocation } from 'react-router-dom'
import Dashboard from '../components/admin/Dashboard'
import CustomersManager from '../components/admin/CustomersManager'
import DogsManager from '../components/admin/DogsManager'
import StaysManager from '../components/admin/StaysManager'
import BillingManager from '../components/admin/BillingManager'
import RatesConfig from '../components/admin/RatesConfig'
import Analytics from '../components/admin/Analytics'
import ThemeSwitcher from '../components/admin/ThemeSwitcher'
import './AdminPage.css'

function AdminPage() {
  const location = useLocation()

  const isActive = (path) => {
    return location.pathname === path
  }

  return (
    <div className="admin-layout">
      {/* Sidebar Navigation */}
      <nav className="sidebar">
        <div className="sidebar-header">
          <h2 className="sidebar-title">🐕 Lily's Dog Boarding</h2>
        </div>
        <ul className="sidebar-menu">
          <li>
            <Link to="/admin/dashboard" className={`menu-item ${isActive('/admin/dashboard') ? 'active' : ''}`}>
              <span className="menu-icon">📊</span>
              <span>Dashboard</span>
            </Link>
          </li>
          <li>
            <Link to="/admin/customers" className={`menu-item ${isActive('/admin/customers') ? 'active' : ''}`}>
              <span className="menu-icon">👥</span>
              <span>Customers</span>
            </Link>
          </li>
          <li>
            <Link to="/admin/dogs" className={`menu-item ${isActive('/admin/dogs') ? 'active' : ''}`}>
              <span className="menu-icon">🐕</span>
              <span>Dogs</span>
            </Link>
          </li>
          <li>
            <Link to="/admin/stays" className={`menu-item ${isActive('/admin/stays') ? 'active' : ''}`}>
              <span className="menu-icon">📅</span>
              <span>Stays</span>
            </Link>
          </li>
          <li>
            <Link to="/admin/billing" className={`menu-item ${isActive('/admin/billing') ? 'active' : ''}`}>
              <span className="menu-icon">💳</span>
              <span>Billing</span>
            </Link>
          </li>
          <li>
            <Link to="/admin/rates" className={`menu-item ${isActive('/admin/rates') ? 'active' : ''}`}>
              <span className="menu-icon">💰</span>
              <span>Rates</span>
            </Link>
          </li>
          <li>
            <Link to="/admin/analytics" className={`menu-item ${isActive('/admin/analytics') ? 'active' : ''}`}>
              <span className="menu-icon">📈</span>
              <span>Analytics</span>
            </Link>
          </li>
        </ul>
      </nav>

      {/* Main Content */}
      <div className="main-content">
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
        <ThemeSwitcher />
      </div>
    </div>
  )
}

export default AdminPage
