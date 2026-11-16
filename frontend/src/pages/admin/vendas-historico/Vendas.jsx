import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, X, Trash2 } from 'lucide-react'
import PageHeader from '../../../components/PageHeader'
import Modal from '../../../components/Modal'
import api from '../../../api/client'

function fmt(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)
}

const FORMA_LABEL = {
  dinheiro: '💵 Dinheiro', pix: '📲 PIX', debito: '💳 Débito',
  credito: '💳 Crédito', fiado: '⭐ Fiado', carne: '📋 Carnê',
}

export default function Vendas() {
  const qc = useQueryClient()
  const [busca, setBusca] = useState('')
  const [filtroForma, setFiltroForma] = useState('todas')
  const [modalVenda, setModalVenda] = useState(null)
  const [pagina, setPagina] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['vendas', pagina],
    queryFn: () => api.get('/vendas', { params: { page: pagina } }).then(r => r.data),
  })

  const cancelarVenda = useMutation({
    mutationFn: (vendaId) => api.delete(`/vendas/${vendaId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vendas'] })
      setModalVenda(null)
    },
  })

  const vendas = (data?.data || []).filter(v => {
    const matchBusca = !busca || v.cliente?.nome?.toLowerCase().includes(busca.toLowerCase()) || String(v.id).includes(busca)
    const matchForma = filtroForma === 'todas' || v.forma_pagamento === filtroForma
    return matchBusca && matchForma
  })

  return (
    <div style={{ padding: 16 }} className="page-enter">
      <PageHeader title="Vendas" subtitle="Histórico completo de vendas" />

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }} />
          <input placeholder="Buscar por cliente ou nº da venda..." value={busca} onChange={e => setBusca(e.target.value)} style={{ paddingLeft: 30, fontSize: 13 }} />
        </div>
        <select value={filtroForma} onChange={e => setFiltroForma(e.target.value)} style={{ width: 160, fontSize: 13 }}>
          <option value="todas">Todas as formas</option>
          {Object.entries(FORMA_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {isLoading ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-3)' }}>Carregando...</div>
        ) : vendas.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)' }}>Nenhuma venda encontrada.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Venda</th>
                <th>Data</th>
                <th>Cliente</th>
                <th>Forma</th>
                <th style={{ textAlign: 'right' }}>Valor</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {vendas.map(v => (
                <tr key={v.id}>
                  <td style={{ fontWeight: 600 }}>#{v.id}</td>
                  <td style={{ fontSize: 12, color: 'var(--text-2)' }}>{new Date(v.created_at).toLocaleString('pt-BR')}</td>
                  <td style={{ fontSize: 13 }}>{v.cliente?.nome || <span style={{ color: 'var(--text-3)' }}>Sem cliente</span>}</td>
                  <td style={{ fontSize: 12 }}>{FORMA_LABEL[v.forma_pagamento] || v.forma_pagamento}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700 }}>{fmt(v.valor_total)}</td>
                  <td>
                    <button className="btn btn-secondary btn-sm" onClick={() => setModalVenda(v)}>Ver</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {data?.last_page > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16 }}>
          <button className="btn btn-secondary btn-sm" disabled={pagina === 1} onClick={() => setPagina(p => p - 1)}>Anterior</button>
          <span style={{ fontSize: 13, color: 'var(--text-2)', alignSelf: 'center' }}>Página {pagina} de {data.last_page}</span>
          <button className="btn btn-secondary btn-sm" disabled={pagina === data.last_page} onClick={() => setPagina(p => p + 1)}>Próxima</button>
        </div>
      )}

      {/* Modal detalhes */}
      <Modal open={!!modalVenda} onClose={() => setModalVenda(null)} title={`Venda #${modalVenda?.id}`} width={560}>
        {modalVenda && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, fontSize: 13, color: 'var(--text-2)', flexWrap: 'wrap', gap: 8 }}>
              <span>Data: {new Date(modalVenda.created_at).toLocaleString('pt-BR')}</span>
              <span>Cliente: {modalVenda.cliente?.nome || '—'}</span>
              <span>Forma: {FORMA_LABEL[modalVenda.forma_pagamento] || modalVenda.forma_pagamento}</span>
            </div>

            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th style={{ textAlign: 'center' }}>Qtd</th>
                  <th style={{ textAlign: 'right' }}>Preço</th>
                  <th style={{ textAlign: 'right' }}>Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {modalVenda.itens?.map((item, idx) => (
                  <tr key={idx}>
                    <td style={{ fontSize: 13 }}>{item.produto?.nome || item.nome_avulso || 'Item avulso'}</td>
                    <td style={{ textAlign: 'center' }}>{item.quantidade}</td>
                    <td style={{ textAlign: 'right' }}>{fmt(item.preco_unitario)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(item.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ textAlign: 'right', fontWeight: 800, fontSize: 18, fontFamily: 'Syne', marginTop: 12, borderTop: '2px solid var(--border)', paddingTop: 10 }}>
              Total: {fmt(modalVenda.valor_total)}
            </div>

            <button
              className="btn btn-danger"
              style={{ width: '100%', justifyContent: 'center', marginTop: 20, display: 'flex', alignItems: 'center', gap: 6 }}
              disabled={cancelarVenda.isPending}
              onClick={() => {
                if (confirm(`Cancelar a Venda #${modalVenda.id}? Isso vai devolver o estoque e reverter qualquer débito de fiado ou carnê ligado a ela.`)) {
                  cancelarVenda.mutate(modalVenda.id)
                }
              }}
            >
              <Trash2 size={14} /> {cancelarVenda.isPending ? 'Cancelando...' : 'Cancelar esta venda'}
            </button>
          </div>
        )}
      </Modal>
    </div>
  )
}