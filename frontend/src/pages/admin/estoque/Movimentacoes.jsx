import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search } from 'lucide-react'
import PageHeader from '../../../components/PageHeader'
import Modal from '../../../components/Modal'
import api from '../../../api/client'

export default function Movimentacoes() {
  const qc = useQueryClient()
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ produto_id: '', quantidade: '', motivo: '' })
  const [buscaProduto, setBuscaProduto] = useState('')
  const [resultados, setResultados] = useState([])

  const { data, isLoading } = useQuery({
    queryKey: ['movimentacoes'],
    queryFn: () => api.get('/movimentacoes').then(r => r.data),
  })

  const saida = useMutation({
    mutationFn: d => api.post('/movimentacoes/saida', d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['movimentacoes'] }); setModal(false); setForm({ produto_id: '', quantidade: '', motivo: '' }) },
  })

  async function buscarProduto(v) {
    setBuscaProduto(v)
    if (v.length < 2) { setResultados([]); return }
    const r = await api.get('/produtos', { params: { search: v } })
    setResultados(r.data.data || [])
  }

  const movs = data?.data || []

  return (
    <div style={{ padding: 32 }} className="page-enter">
      <PageHeader
        title="Movimentações"
        subtitle="Histórico de entradas e saídas"
        actions={
          <button className="btn btn-danger" onClick={() => setModal(true)}>
            <Plus size={14} /> Registrar saída (perda/avaria)
          </button>
        }
      />

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {isLoading ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-3)' }}>Carregando...</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Produto</th>
                <th style={{ textAlign: 'center' }}>Tipo</th>
                <th style={{ textAlign: 'center' }}>Qtd</th>
                <th>Motivo</th>
                <th>Usuário</th>
              </tr>
            </thead>
            <tbody>
              {movs.map(m => (
                <tr key={m.id}>
                  <td style={{ fontSize: 12, color: 'var(--text-3)' }}>{new Date(m.created_at).toLocaleString('pt-BR')}</td>
                  <td style={{ fontWeight: 500 }}>{m.produto?.nome}</td>
                  <td style={{ textAlign: 'center' }}>
                    <span className={`badge ${m.tipo === 'entrada' ? 'badge-success' : 'badge-danger'}`}>
                      {m.tipo}
                    </span>
                  </td>
                  <td style={{ textAlign: 'center', fontWeight: 600 }}>
                    <span style={{ color: m.tipo === 'entrada' ? 'var(--success)' : 'var(--danger)' }}>
                      {m.tipo === 'entrada' ? '+' : '-'}{m.quantidade}
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-2)', fontSize: 12 }}>{m.motivo || '—'}</td>
                  <td style={{ color: 'var(--text-3)', fontSize: 12 }}>{m.usuario?.nome}</td>
                </tr>
              ))}
              {!movs.length && (
                <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-3)', padding: 32 }}>Nenhuma movimentação ainda.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title="Registrar saída (perda / avaria)">
        <form onSubmit={e => { e.preventDefault(); saida.mutate({ ...form, quantidade: parseInt(form.quantidade) }) }}>
          <div className="form-group">
            <label>Produto</label>
            <div style={{ position: 'relative' }}>
              <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }} />
              <input
                placeholder="Buscar produto..."
                value={buscaProduto}
                onChange={e => buscarProduto(e.target.value)}
                style={{ paddingLeft: 30 }}
              />
              {resultados.length > 0 && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
                  background: 'white', border: '1px solid var(--border)', borderRadius: 8,
                  boxShadow: '0 4px 16px rgba(0,0,0,0.1)', marginTop: 2,
                }}>
                  {resultados.slice(0, 6).map(p => (
                    <button key={p.id} type="button" onClick={() => {
                      setForm(f => ({ ...f, produto_id: p.id }))
                      setBuscaProduto(p.nome)
                      setResultados([])
                    }} style={{
                      width: '100%', padding: '9px 12px', background: 'none', border: 'none',
                      cursor: 'pointer', textAlign: 'left', borderBottom: '1px solid var(--surface-2)',
                      fontFamily: 'DM Sans', fontSize: 13,
                    }}>
                      {p.nome} <span style={{ color: 'var(--text-3)' }}>· estoque: {p.quantidade}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="form-group">
            <label>Quantidade</label>
            <input type="number" min="1" value={form.quantidade} onChange={e => setForm(f => ({ ...f, quantidade: e.target.value }))} required />
          </div>
          <div className="form-group">
            <label>Motivo</label>
            <input placeholder="Ex: Produto avariado, furto, vencido..." value={form.motivo} onChange={e => setForm(f => ({ ...f, motivo: e.target.value }))} required />
          </div>
          {saida.isError && <p style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 12 }}>{saida.error?.response?.data?.message}</p>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setModal(false)}>Cancelar</button>
            <button type="submit" className="btn btn-danger" disabled={saida.isPending}>Registrar saída</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
