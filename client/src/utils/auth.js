// Small client-side auth helper: stores the JWT + current user in localStorage.
const TOKEN_KEY = 'lily_token'
const USER_KEY = 'lily_user'

export const getToken = () => localStorage.getItem(TOKEN_KEY)

export const setAuth = (token, user) => {
  localStorage.setItem(TOKEN_KEY, token)
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export const clearAuth = () => {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

export const getUser = () => {
  try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null') } catch { return null }
}

export const isLoggedIn = () => !!getToken()

// For places that use raw fetch() instead of the shared axios instance.
export const authHeader = () => {
  const t = getToken()
  return t ? { Authorization: `Bearer ${t}` } : {}
}
