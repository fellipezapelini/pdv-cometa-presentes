import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { Star, Loader } from 'lucide-react'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', senha: '' })
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setErro('')
    setLoading(true)
    try {
      await login(form.email, form.senha)
      navigate('/admin')
    } catch {
      setErro('E-mail ou senha incorretos.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#1A1916',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16,
    }}>
      <div style={{ width: '100%', maxWidth: 380 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{
            width: 52, height: 52, background: 'var(--brand)',
            borderRadius: 14, display: 'flex', alignItems: 'center',
            justifyContent: 'center', margin: '0 auto 16px',
          }}>
            <Star size={24} color="white" fill="white" />
          </div>
          <h1 style={{ fontFamily: 'Syne', color: 'white', fontSize: 22, fontWeight: 800 }}>
            Cometa Presentes
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, marginTop: 4 }}>
            Painel do Vendedor
          </p>
        </div>

        {/* Form */}
        <div style={{
          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 14, padding: 28,
        }}>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label style={{ color: 'rgba(255,255,255,0.5)' }}>E-mail</label>
              <input
                type="email"
                value={form.email}
                onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                placeholder="seu@email.com"
                required
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }}
              />
            </div>
            <div className="form-group">
              <label style={{ color: 'rgba(255,255,255,0.5)' }}>Senha</label>
              <input
                type="password"
                value={form.senha}
                onChange={e => setForm(p => ({ ...p, senha: e.target.value }))}
                placeholder="••••••••"
                required
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }}
              />
            </div>

            {erro && (
              <div style={{
                background: 'var(--danger-bg)', color: 'var(--danger)',
                borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 16,
              }}>
                {erro}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary btn-lg"
              style={{ width: '100%', justifyContent: 'center', marginTop: 4 }}
            >
              {loading ? <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} /> : 'Entrar'}
            </button>
          </form>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
