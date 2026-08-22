import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import LoginPage from './pages/LoginPage'
import AdminPage from './pages/AdminPage'
import BillPage from './pages/BillPage'
import BookingPage from './pages/BookingPage'
import { isLoggedIn } from './utils/auth'

// Guard admin pages: send un-authenticated visitors to the login screen.
function RequireAuth({ children }) {
  return isLoggedIn() ? children : <Navigate to="/login" replace />
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to="/admin/dashboard" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/admin/*" element={<RequireAuth><AdminPage /></RequireAuth>} />
        <Route path="/bill/:billCode" element={<BillPage />} />
        {/* Public, like the bill page — the code in the link is the access. */}
        <Route path="/book/:code" element={<BookingPage />} />
      </Routes>
    </Router>
  )
}

export default App
