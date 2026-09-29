import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import LoginPage from './pages/LoginPage'
import AdminPage from './pages/AdminPage'
import BillPage from './pages/BillPage'
import BookingPage from './pages/BookingPage'
import RequestAccessPage from './pages/RequestAccessPage'
import HomePage from './pages/HomePage'
import { PrivacyPage, TermsPage } from './pages/PolicyPages'
import { isLoggedIn } from './utils/auth'

// Guard admin pages: send un-authenticated visitors to the login screen.
function RequireAuth({ children }) {
  return isLoggedIn() ? children : <Navigate to="/login" replace />
}

// Launched from the phone's home-screen icon (iOS navigator.standalone, or the
// manifest's display mode elsewhere).
const isHomeScreenApp = () =>
  window.navigator.standalone === true ||
  window.matchMedia?.('(display-mode: standalone)').matches

// "/" is the public website for the texting reviewer, but it's also where the
// home-screen app opens — so staff (installed app, or already signed in) go
// straight to the dashboard. A reviewer in a normal browser still sees the page.
function Front() {
  return isHomeScreenApp() || isLoggedIn()
    ? <Navigate to="/admin/dashboard" replace />
    : <HomePage />
}

function App() {
  return (
    <Router>
      <Routes>
        {/* Public front page, and the brand website the texting registration
            points at. Was a redirect to the admin login, which left the brand
            with no website a reviewer could open. */}
        <Route path="/" element={<Front />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/admin/*" element={<RequireAuth><AdminPage /></RequireAuth>} />
        <Route path="/bill/:billCode" element={<BillPage />} />
        {/* Public, like the bill page — the code in the link is the access. */}
        <Route path="/book/:code" element={<BookingPage />} />
        {/* The one link Lily hands out. Proves the number by text, then drops
            the customer on their own /book page. */}
        <Route path="/request" element={<RequestAccessPage />} />
        {/* Public policy pages — the texting registration links to these. */}
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />
      </Routes>
    </Router>
  )
}

export default App
