import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { authAPI } from '../../utils/api'
import { setAuth } from '../../utils/auth'

function Login() {
  const [mode, setMode] = useState('login') // 'login' | 'setup'
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  // First run: if no accounts exist yet, show a "create admin account" form instead.
  useEffect(() => {
    authAPI.status()
      .then(res => { if (res.data?.needsSetup) setMode('setup') })
      .catch(() => {})
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = mode === 'setup'
        ? await authAPI.bootstrap({ name, email, password })
        : await authAPI.login({ email, password })
      setAuth(res.data.token, res.data.user)
      navigate('/admin/dashboard')
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  const inputStyle = {
    width: '100%', padding: '10px', border: '1px solid #ddd',
    borderRadius: '4px', fontSize: '14px', boxSizing: 'border-box'
  }

  return (
    <div style={{
      backgroundColor: 'white',
      padding: '40px',
      borderRadius: '8px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      width: '400px',
      maxWidth: '90%'
    }}>
      <h1 style={{ marginBottom: '10px', textAlign: 'center' }}>🐾 Lily's Dog Boarding</h1>
      <p style={{ textAlign: 'center', color: '#666', marginBottom: '30px' }}>
        {mode === 'setup' ? 'Create your admin account' : 'Admin Portal'}
      </p>

      <form onSubmit={handleSubmit}>
        {mode === 'setup' && (
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>Your name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} placeholder="e.g. Lily" />
          </div>
        )}

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="username" style={inputStyle} />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>Password</label>
          <input
            type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
            autoComplete={mode === 'setup' ? 'new-password' : 'current-password'}
            placeholder={mode === 'setup' ? 'At least 6 characters' : ''} style={inputStyle}
          />
        </div>

        {error && (
          <div style={{
            backgroundColor: '#fee', color: '#c33', padding: '10px',
            borderRadius: '4px', marginBottom: '20px', fontSize: '14px'
          }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%', padding: '12px',
            backgroundColor: loading ? '#9bbcd6' : '#3498db',
            color: 'white', border: 'none', borderRadius: '4px',
            fontSize: '16px', fontWeight: '500', cursor: loading ? 'default' : 'pointer'
          }}
        >
          {loading ? 'Please wait…' : (mode === 'setup' ? 'Create account' : 'Login')}
        </button>
      </form>
    </div>
  )
}

export default Login
