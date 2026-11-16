import axios from 'axios'

const api = axios.create({
  // VITE_API_URL só é usado em testes locais (ex.: /api pelo proxy do vite preview)
  baseURL: import.meta.env.VITE_API_URL || 'https://api.cometapresentes.com.br/api',
  headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
})

api.interceptors.request.use(config => {
  const token = localStorage.getItem('cometa_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('cometa_token')
      localStorage.removeItem('cometa_usuario')
      window.location.href = '/admin/login'
    }
    return Promise.reject(err)
  }
)

export default api
