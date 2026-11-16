import { createContext, useContext, useState } from 'react'
import api from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(() => {
  try {
    const s = localStorage.getItem('cometa_usuario')
    return s ? JSON.parse(s) : null
  } catch {
    return null
  }
})

  async function login(email, senha) {
    const { data } = await api.post('/auth/login', { email, senha })
    localStorage.setItem('cometa_token', data.token)
    localStorage.setItem('cometa_usuario', JSON.stringify(data.usuario))
    setUsuario(data.usuario)
    return data.usuario
  }

  async function logout() {
    try { await api.post('/auth/logout') } catch {}
    localStorage.removeItem('cometa_token')
    localStorage.removeItem('cometa_usuario')
    setUsuario(null)
  }

  return (
    <AuthContext.Provider value={{ usuario, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
