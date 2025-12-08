import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Login from '../components/auth/Login'

function LoginPage() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f0f2f5' }}>
      <Login />
    </div>
  )
}

export default LoginPage
