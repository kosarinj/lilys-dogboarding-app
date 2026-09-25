import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import './utils/api.js' // registers global axios auth interceptors at startup
import { startAutoUpdate } from './autoUpdate.js'

// Reload when a newer build is deployed, so the iPhone home-screen app doesn't
// sit on an old one.
startAutoUpdate()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
