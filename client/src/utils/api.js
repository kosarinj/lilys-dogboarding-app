import axios from 'axios'
import { getToken, clearAuth } from './auth.js'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
})

// Attach the JWT to every request. Register on BOTH the shared instance and the global
// axios default, since several components call axios directly rather than this instance.
const attachToken = (config) => {
  const token = getToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
}
api.interceptors.request.use(attachToken)
axios.interceptors.request.use(attachToken)

// On 401 (expired/invalid session) clear auth and bounce to the login screen.
const onUnauthorized = (error) => {
  if (error?.response?.status === 401 && !window.location.pathname.startsWith('/login')) {
    clearAuth()
    window.location.href = '/login'
  }
  return Promise.reject(error)
}
api.interceptors.response.use((r) => r, onUnauthorized)
axios.interceptors.response.use((r) => r, onUnauthorized)

// Auth API
export const authAPI = {
  status: () => api.get('/auth/status'),
  bootstrap: (data) => api.post('/auth/bootstrap', data),
  login: (data) => api.post('/auth/login', data),
  me: () => api.get('/auth/me'),
  listUsers: () => api.get('/auth/users'),
  createUser: (data) => api.post('/auth/users', data),
  deleteUser: (id) => api.delete(`/auth/users/${id}`),
  changePassword: (data) => api.post('/auth/change-password', data)
}

// Customers API
export const customersAPI = {
  getAll: () => api.get('/customers'),
  getById: (id) => api.get(`/customers/${id}`),
  create: (data) => api.post('/customers', data),
  update: (id, data) => api.put(`/customers/${id}`, data),
  delete: (id) => api.delete(`/customers/${id}`)
}

// Dogs API
export const dogsAPI = {
  getAll: () => api.get('/dogs'),
  getById: (id) => api.get(`/dogs/${id}`),
  create: (data) => api.post('/dogs', data),
  update: (id, data) => api.put(`/dogs/${id}`, data),
  delete: (id) => api.delete(`/dogs/${id}`),
  migrate: () => api.post('/dogs/migrate')
}

// Rates API
export const ratesAPI = {
  getAll: () => api.get('/rates'),
  update: (id, data) => api.put(`/rates/${id}`, data),
  initialize: () => api.post('/rates/initialize')
}

// Settings API
export const settingsAPI = {
  getAll: () => api.get('/settings'),
  getByKey: (key) => api.get(`/settings/${key}`),
  update: (key, data) => api.put(`/settings/${key}`, data),
  initialize: () => api.post('/settings/initialize')
}

// Stays API
export const staysAPI = {
  getAll: () => api.get('/stays'),
  getById: (id) => api.get(`/stays/${id}`),
  create: (data) => api.post('/stays', data),
  update: (id, data) => api.put(`/stays/${id}`, data),
  delete: (id) => api.delete(`/stays/${id}`),
  migrate: () => api.post('/stays/migrate')
}

// Bills API
export const billsAPI = {
  getAll: () => api.get('/bills'),
  getById: (id) => api.get(`/bills/${id}`),
  getByCode: (code) => api.get(`/bills/code/${code}`),
  create: (data) => api.post('/bills', data),
  update: (id, data) => api.put(`/bills/${id}`, data),
  delete: (id) => api.delete(`/bills/${id}`)
}

// Upload API
export const uploadAPI = {
  uploadPhoto: (file) => {
    const formData = new FormData()
    formData.append('photo', file)
    return api.post('/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    })
  }
}

export default api
