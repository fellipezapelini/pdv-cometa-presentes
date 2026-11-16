import { useEffect, useState } from 'react'
import { Package, ShoppingCart, AlertTriangle, TrendingDown, DollarSign, Users } from 'lucide-react'
import PageHeader from '../../components/PageHeader'
import StatCard from '../../components/StatCard'
import api from '../../api/client'

function fmt(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)
}

export default function Dashboard() {
  const [dados, setDados] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/dashboard/resumo').then(r => setDados(r.data)).finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div style={{ padding: 32 }}>
      <div style={{ color: 'var(--text-3)', fontSize: 13 }}>Carregando dashboard...</div>
    </div>
  )

  return (
    <div style={{ padding: 32 }} className="page-enter">
      <PageHeader
        title="Dashboard"
        subtitle="Visão geral da Cometa Presentes"
      />

      {/* Alertas estoque baixo */}
      {dados?.estoque_baixo > 0 && (
        <div style={{
          background: 'var(--warning-bg)', border: '1px solid #F6D58A',
          borderRadius: 10, padding: '12px 16px', marginBottom: 24,
          display: 'flex', alignItems: 'center', gap: 10, fontSize: 13,
          color: 'var(--warning)',
        }}>
          <AlertTriangle size={16} />
          <strong>{dados.estoque_baixo} produto(s)</strong> abaixo do estoque mínimo.
          <a href="/admin/produtos?estoque_baixo=1" style={{ color: 'var(--warning)', fontWeight: 600, marginLeft: 4 }}>
            Ver lista →
          </a>
        </div>
      )}

      {/* Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
        gap: 16, marginBottom: 32,
      }}>
        <StatCard label="Total Produtos" value={dados?.total_produtos ?? '—'} icon={Package} color="var(--brand)" />
        <StatCard label="Valor em Estoque" value={fmt(dados?.valor_estoque)} icon={DollarSign} color="#1A7A4A" />
        <StatCard label="Vendas Hoje" value={fmt(dados?.vendas_hoje)} icon={ShoppingCart} color="#185FA5" />
        <StatCard label="Total em Fiado" value={fmt(dados?.total_fiado)} icon={Users} color="#92580A" />
        <StatCard label="Estoque Baixo" value={dados?.estoque_baixo ?? 0} icon={AlertTriangle} color="var(--danger)" sub="produtos no limite" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Top vendidos */}
        <div className="card">
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Top 10 mais vendidos</h3>
          {dados?.top_vendidos?.length ? (
            <table>
              <thead>
                <tr>
                  <th>Produto</th>
                  <th style={{ textAlign: 'right' }}>Qtd</th>
                  <th style={{ textAlign: 'right' }}>Faturamento</th>
                </tr>
              </thead>
              <tbody>
                {dados.top_vendidos.map((p, i) => (
                  <tr key={i}>
                    <td>{p.nome}</td>
                    <td style={{ textAlign: 'right' }}>{p.total_vendido}</td>
                    <td style={{ textAlign: 'right' }}>{fmt(p.faturamento)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p style={{ color: 'var(--text-3)', fontSize: 13 }}>Nenhuma venda registrada ainda.</p>
          )}
        </div>

        {/* Movimentações recentes */}
        <div className="card">
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Movimentações recentes</h3>
          {dados?.mov_recentes?.length ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {dados.mov_recentes.slice(0, 8).map(m => (
                <div key={m.id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '8px 0', borderBottom: '1px solid var(--surface-2)',
                }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{m.produto?.nome}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{m.motivo} · {m.usuario?.nome}</div>
                  </div>
                  <span className={`badge badge-${m.tipo === 'entrada' ? 'success' : 'danger'}`}>
                    {m.tipo === 'entrada' ? '+' : '-'}{m.quantidade}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: 'var(--text-3)', fontSize: 13 }}>Nenhuma movimentação ainda.</p>
          )}
        </div>
      </div>
    </div>
  )
}
