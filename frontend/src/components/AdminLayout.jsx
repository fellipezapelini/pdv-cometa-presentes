import { useState, useEffect } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import TrocarSenha from './TrocarSenha'
import {
  LayoutDashboard, Package, ShoppingCart, Users,
  ArrowDownUp, FileText, LogOut, Menu, X, Star, Wallet, TrendingUp, Clock
} from 'lucide-react'

const nav = [
  { to: '/admin',           icon: LayoutDashboard, label: 'Dashboard',       exact: true },
  { to: '/admin/produtos',  icon: Package,         label: 'Produtos' },
  { to: '/admin/vendas',    icon: ShoppingCart,    label: 'PDV / Vendas' },
  { to: '/admin/clientes',  icon: Users,           label: 'Clientes & Fiado' },
  { to: '/admin/carnes', icon: Clock, label: 'Carnês' },
  { to: '/admin/estoque',   icon: ArrowDownUp,     label: 'Movimentações' },
  { to: '/admin/notas',     icon: FileText,        label: 'Notas Fiscais' }, 
  { to: '/admin/despesas',  icon: Wallet,           label: 'Despesas' },
  { to: '/admin/vendas-historico', icon: ShoppingCart, label: 'Histórico de Vendas' },
  { to: '/admin/recebimentos', icon: TrendingUp, label: 'Recebimentos' },
]

export default function AdminLayout({ children }) {
  const { usuario, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [trocarSenha, setTrocarSenha] = useState(false)

  // Fecha sidebar ao trocar de página no mobile
  useEffect(() => {
    setSidebarOpen(false)
  }, [location.pathname])

  async function handleLogout() {
    await logout()
    navigate('/admin/login')
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--surface)' }}>

      {/* Overlay escuro no mobile quando sidebar aberta */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            zIndex: 40, display: 'block',
          }}
        />
      )}

      {/* Sidebar */}
      <aside style={{
        width: 'var(--sidebar-w)',
        background: '#1A1916',
        color: 'white',
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        position: 'fixed',
        left: 0,
        top: 0,
        zIndex: 50,
        transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform 0.25s ease',
        // No desktop sempre visível
        '@media (min-width: 768px)': {
          transform: 'translateX(0)',
        },
      }}
      className="admin-sidebar"
      >
        {/* Header da sidebar */}
        <div style={{
          padding: '20px 20px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 32, height: 32, background: 'var(--brand)',
              borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <Star size={16} color="white" fill="white" />
            </div>
            <div>
              <div style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 14, lineHeight: 1.2 }}>Cometa</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Painel Vendedor</div>
            </div>
          </div>
          {/* Botão fechar no mobile */}
          <button
            onClick={() => setSidebarOpen(false)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'rgba(255,255,255,0.5)', padding: 4,
            }}
            className="sidebar-close-btn"
          >
            <X size={18} />
          </button>
        </div>

        {/* Nav links */}
        <nav style={{ flex: 1, padding: '12px 0', overflowY: 'auto' }}>
          {nav.map(({ to, icon: Icon, label, exact }) => (
            <NavLink
              key={to}
              to={to}
              end={exact}
              style={({ isActive }) => ({
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '12px 20px', fontSize: 14, fontWeight: 500,
                color: isActive ? 'white' : 'rgba(255,255,255,0.45)',
                background: isActive ? 'rgba(232,64,10,0.15)' : 'transparent',
                borderLeft: isActive ? '3px solid var(--brand)' : '3px solid transparent',
                textDecoration: 'none', transition: 'all 0.15s',
              })}
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* User info + logout */}
        <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{usuario?.papel}</div>
          <div style={{ fontSize: 14, color: 'white', fontWeight: 600, marginBottom: 12 }}>{usuario?.nome}</div>
          <button onClick={() => setTrocarSenha(true)} style={{
            display: 'block', fontSize: 13, color: 'rgba(255,255,255,0.5)', background: 'none',
            border: 'none', cursor: 'pointer', padding: 0, marginBottom: 8, fontFamily: 'DM Sans',
          }}>
            Trocar senha
          </button>
          <button onClick={handleLogout} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            fontSize: 13, color: 'rgba(255,255,255,0.5)', background: 'none',
            border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'DM Sans',
          }}>
            <LogOut size={14} /> Sair
          </button>
        </div>
      </aside>
      <TrocarSenha open={trocarSenha} onClose={() => setTrocarSenha(false)} />

      {/* Main content */}
      <main style={{
        flex: 1,
        minHeight: '100vh',
        background: 'var(--surface)',
        // No desktop desloca para a direita da sidebar
        marginLeft: 0,
        paddingTop: 56, // espaço para o header mobile
      }}
      className="admin-main"
      >
        {/* Header mobile com botão hambúrguer */}
        <header style={{
          position: 'fixed', top: 0, left: 0, right: 0,
          height: 56, background: '#1A1916',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 16px', zIndex: 30,
        }}
        className="admin-mobile-header"
        >
          <button
            onClick={() => setSidebarOpen(true)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'white', padding: 8, display: 'flex', alignItems: 'center',
            }}
          >
            <Menu size={22} />
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 26, height: 26, background: 'var(--brand)',
              borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Star size={13} color="white" fill="white" />
            </div>
            <span style={{ color: 'white', fontFamily: 'Syne', fontWeight: 700, fontSize: 14 }}>
              Cometa Presentes
            </span>
          </div>

          <div style={{ width: 38 }} /> {/* spacer */}
        </header>

        {children}
      </main>

      <style>{`
        /* Desktop: sidebar sempre visível, sem header mobile */
        @media (min-width: 768px) {
          .admin-sidebar {
            transform: translateX(0) !important;
          }
          .admin-sidebar .sidebar-close-btn {
            display: none;
          }
          .admin-mobile-header {
            display: none !important;
          }
          .admin-main {
            margin-left: var(--sidebar-w) !important;
            padding-top: 0 !important;
          }
        }
      `}</style>
    </div>
  )
}
