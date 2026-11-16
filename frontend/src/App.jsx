import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './context/AuthContext'
import PrivateRoute from './components/PrivateRoute'
import AdminLayout from './components/AdminLayout'
import Despesas from './pages/admin/despesas/Despesas'
import Carnes from './pages/admin/carnes/Carnes'
import Vendas from './pages/admin/vendas-historico/Vendas'
import Recebimentos from './pages/admin/recebimentos/Recebimentos'

// Vitrine
import Home from './pages/vitrine/Home'
import Produto from './pages/vitrine/Produto'
import { CarrinhoProvider, useCarrinho } from './pages/vitrine/loja'
import Carrinho from './pages/vitrine/Carrinho'
import Checkout from './pages/vitrine/Checkout'
import ConfirmacaoPedido from './pages/vitrine/ConfirmacaoPedido'

// Admin
import Login from './pages/admin/Login'
import Dashboard from './pages/admin/Dashboard'
import Produtos from './pages/admin/produtos/Produtos'
import PDV from './pages/admin/vendas/PDV'
import Clientes from './pages/admin/clientes/Clientes'
import Movimentacoes from './pages/admin/estoque/Movimentacoes'
import NotasFiscais from './pages/admin/notas/NotasFiscais'

const qc = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } }
})

// Checkout ainda recebe o carrinho por props
function CheckoutRota() {
  const { carrinho, setCarrinho } = useCarrinho()
  return <Checkout carrinho={carrinho} setCarrinho={setCarrinho} />
}

export default function App() {

  return (
    <QueryClientProvider client={qc}>
      <AuthProvider>
        <CarrinhoProvider>
        <BrowserRouter>
          <Routes>
            {/* ── Vitrine pública ── */}
            <Route path="/" element={<Home />} />
            <Route path="/produtos/:id" element={<Produto />} />
            <Route path="/carrinho" element={<Carrinho />} />
            <Route path="/checkout" element={<CheckoutRota />} />
            <Route path="/pedido/:codigo" element={<ConfirmacaoPedido />} />
            <Route path="/admin/despesas" element={<PrivateRoute><AdminLayout><Despesas /></AdminLayout></PrivateRoute>} />

            {/* ── Área do vendedor ── */}
            <Route path="/admin/login" element={<Login />} />
            <Route path="/admin/*" element={
              <PrivateRoute>
                <AdminLayout>
                  <Routes>
                    <Route index element={<Dashboard />} />
                    <Route path="produtos" element={<Produtos />} />
                    <Route path="vendas" element={<PDV />} />
                    <Route path="clientes" element={<Clientes />} />
                    <Route path="estoque" element={<Movimentacoes />} />
                    <Route path="carnes" element={<Carnes />} />
                    <Route path="vendas-historico" element={<Vendas />} />
                    <Route path="recebimentos" element={<Recebimentos />} />
                    <Route path="notas" element={<NotasFiscais />} />
                  </Routes>
                </AdminLayout>
              </PrivateRoute>
            } />
          </Routes>
        </BrowserRouter>
        </CarrinhoProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}
