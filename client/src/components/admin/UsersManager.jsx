import { useState, useEffect } from 'react'
import { authAPI } from '../../utils/api'
import { getUser } from '../../utils/auth'

function UsersManager() {
  const me = getUser()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')

  // Add-user form
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [adding, setAdding] = useState(false)

  // Change-password form
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '' })
  const [pwMsg, setPwMsg] = useState('')
  const [pwErr, setPwErr] = useState('')

  const load = () => {
    setLoading(true)
    authAPI.listUsers()
      .then(res => { setUsers(res.data); setLoading(false) })
      .catch(err => { setError(err.response?.data?.error || err.message); setLoading(false) })
  }
  useEffect(load, [])

  const addUser = async (e) => {
    e.preventDefault()
    setError(''); setMsg(''); setAdding(true)
    try {
      await authAPI.createUser(form)
      setForm({ name: '', email: '', password: '' })
      setMsg('User added.')
      setTimeout(() => setMsg(''), 4000)
      load()
    } catch (err) {
      setError(err.response?.data?.error || err.message)
    } finally { setAdding(false) }
  }

  const removeUser = async (u) => {
    if (!window.confirm(`Remove ${u.email}? They will no longer be able to log in.`)) return
    setError(''); setMsg('')
    try {
      await authAPI.deleteUser(u.id)
      load()
    } catch (err) {
      setError(err.response?.data?.error || err.message)
    }
  }

  const changePassword = async (e) => {
    e.preventDefault()
    setPwErr(''); setPwMsg('')
    try {
      await authAPI.changePassword(pw)
      setPw({ currentPassword: '', newPassword: '' })
      setPwMsg('Password updated.')
      setTimeout(() => setPwMsg(''), 4000)
    } catch (err) {
      setPwErr(err.response?.data?.error || err.message)
    }
  }

  const input = { padding: '9px 10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }
  const card = { background: 'white', borderRadius: '10px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', padding: '20px', marginBottom: '20px' }
  const btn = { padding: '9px 16px', borderRadius: '6px', border: 'none', background: '#3498db', color: 'white', fontSize: '14px', fontWeight: 500, cursor: 'pointer' }

  return (
    <div style={{ maxWidth: 760 }}>
      <h1 style={{ marginBottom: '6px' }}>Users</h1>
      <p style={{ color: '#666', marginTop: 0, marginBottom: '20px' }}>People who can log in to the admin portal.</p>

      {error && <div style={{ background: '#fee', color: '#c33', padding: '10px', borderRadius: '6px', marginBottom: '16px' }}>{error}</div>}
      {msg && <div style={{ background: '#e8f8ee', color: '#1a7f45', padding: '10px', borderRadius: '6px', marginBottom: '16px' }}>{msg}</div>}

      <div style={card}>
        <h3 style={{ marginTop: 0 }}>Current users</h3>
        {loading ? <p>Loading…</p> : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', color: '#666', fontSize: '13px' }}>
                <th style={{ padding: '8px' }}>Name</th>
                <th style={{ padding: '8px' }}>Email</th>
                <th style={{ padding: '8px' }}></th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} style={{ borderTop: '1px solid #eee' }}>
                  <td style={{ padding: '10px 8px' }}>{u.name} {me?.id === u.id && <span style={{ color: '#3498db', fontSize: 12 }}>(you)</span>}</td>
                  <td style={{ padding: '10px 8px' }}>{u.email}</td>
                  <td style={{ padding: '10px 8px', textAlign: 'right' }}>
                    {me?.id !== u.id && (
                      <button onClick={() => removeUser(u)}
                        style={{ background: 'transparent', border: '1px solid #e0b4b4', color: '#c0392b', padding: '5px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>
                        Remove
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div style={card}>
        <h3 style={{ marginTop: 0 }}>Add a user</h3>
        <form onSubmit={addUser} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', alignItems: 'end' }}>
          <label style={{ display: 'grid', gap: 4, fontSize: 13, color: '#555' }}>
            Name
            <input style={input} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Optional" />
          </label>
          <label style={{ display: 'grid', gap: 4, fontSize: 13, color: '#555' }}>
            Email
            <input style={input} type="email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
          </label>
          <label style={{ display: 'grid', gap: 4, fontSize: 13, color: '#555' }}>
            Password
            <input style={input} type="password" required autoComplete="new-password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="At least 6 characters" />
          </label>
          <button type="submit" style={{ ...btn, opacity: adding ? 0.6 : 1 }} disabled={adding}>{adding ? 'Adding…' : 'Add user'}</button>
        </form>
      </div>

      <div style={card}>
        <h3 style={{ marginTop: 0 }}>Change my password</h3>
        {pwErr && <div style={{ background: '#fee', color: '#c33', padding: '8px 10px', borderRadius: '6px', marginBottom: '12px' }}>{pwErr}</div>}
        {pwMsg && <div style={{ background: '#e8f8ee', color: '#1a7f45', padding: '8px 10px', borderRadius: '6px', marginBottom: '12px' }}>{pwMsg}</div>}
        <form onSubmit={changePassword} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '12px', alignItems: 'end' }}>
          <label style={{ display: 'grid', gap: 4, fontSize: 13, color: '#555' }}>
            Current password
            <input style={input} type="password" required autoComplete="current-password" value={pw.currentPassword} onChange={e => setPw({ ...pw, currentPassword: e.target.value })} />
          </label>
          <label style={{ display: 'grid', gap: 4, fontSize: 13, color: '#555' }}>
            New password
            <input style={input} type="password" required autoComplete="new-password" value={pw.newPassword} onChange={e => setPw({ ...pw, newPassword: e.target.value })} placeholder="At least 6 characters" />
          </label>
          <button type="submit" style={btn}>Update</button>
        </form>
      </div>
    </div>
  )
}

export default UsersManager
