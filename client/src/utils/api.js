import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
})

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
  delete: (id) => api.delete(`/dogs/${id}`)
}

// Rates API
export const ratesAPI = {
  getAll: () => api.get('/rates'),
  update: (id, data) => api.put(`/rates/${id}`, data)
}

// Settings API
export const settingsAPI = {
  getAll: () => api.get('/settings'),
  getByKey: (key) => api.get(`/settings/${key}`),
  update: (key, data) => api.put(`/settings/${key}`, data)
}

// Stays API
export const staysAPI = {
  getAll: () => api.get('/stays'),
  getById: (id) => api.get(`/stays/${id}`),
  create: (data) => api.post('/stays', data),
  update: (id, data) => api.put(`/stays/${id}`, data),
  delete: (id) => api.delete(`/stays/${id}`)
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
