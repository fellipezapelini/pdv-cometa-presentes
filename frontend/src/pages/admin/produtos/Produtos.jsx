import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, Pencil, Trash2, AlertTriangle, Camera, Upload, Download } from 'lucide-react'
import PageHeader from '../../../components/PageHeader'
import Modal from '../../../components/Modal'
import api from '../../../api/client'
import ImportadorProdutos from './ImportadorProdutos' // Importando o novo componente!
import CaixasDuplicadas from './CaixasDuplicadas'

function fmt(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)
}

const camposVazios = {
  nome: '', nome_vitrine: '', sku: '', ncm: '', categoria_id: '', preco_custo: '', preco_venda: '',
  quantidade: '', estoque_minimo: '5', descricao: '', visivel_vitrine: true,
}

export default function Produtos() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [catFiltro, setCatFiltro] = useState('')
  const [modal, setModal] = useState(false)
  const [modalImportar, setModalImportar] = useState(false) // Novo estado para o Modal de Importação
  const [form, setForm] = useState(camposVazios)
  const [editId, setEditId] = useState(null)
  const [uploadingFoto, setUploadingFoto] = useState(null)

  const { data: categorias } = useQuery({
    queryKey: ['categorias'],
    queryFn: () => api.get('/categorias').then(r => r.data),
  })

  // Lista inteira (sem paginação) para rolar na tela
  const { data, isLoading } = useQuery({
    queryKey: ['produtos', search, catFiltro],
    queryFn: () => api.get('/produtos', { params: { search, categoria_id: catFiltro, per_page: 5000 } }).then(r => r.data),
  })

  const { data: inventario } = useQuery({
    queryKey: ['produtos', 'inventario'],
    queryFn: () => api.get('/produtos/inventario').then(r => r.data),
  })
  const resumo = inventario?.resumo
  const [exportando, setExportando] = useState(false)
  const [comCusto, setComCusto] = useState(false)
  const [modalCaixas, setModalCaixas] = useState(false)

  // Planilha para a contadora: produtos com estoque positivo, EAN como texto
  async function exportarEstoque() {
    setExportando(true)
    try {
      const XLSX = await import('xlsx')
      const r = await api.get('/produtos/inventario')
      const itens = r.data.produtos.filter(p => p.quantidade > 0)
      const linhas = itens.map(p => ({
        'Produto': p.nome,
        'Quantidade': p.quantidade,
        'EAN': p.sku || '',
        ...(comCusto ? {
          'Custo unitário': parseFloat(p.preco_custo),
          'Valor total (custo)': Math.round(p.quantidade * parseFloat(p.preco_custo) * 100) / 100,
        } : {}),
      }))
      linhas.push({})
      linhas.push({
        'Produto': `TOTAL (${itens.length} produtos)`,
        'Quantidade': itens.reduce((s, p) => s + p.quantidade, 0),
        ...(comCusto ? { 'Valor total (custo)': r.data.resumo.valor_custo } : {}),
      })

      const ws = XLSX.utils.json_to_sheet(linhas)
      // Colunas: Produto | Quantidade | EAN (+ custo, se marcado)
      ws['!cols'] = [{ wch: 50 }, { wch: 11 }, { wch: 16 }, ...(comCusto ? [{ wch: 14 }, { wch: 18 }] : [])]
      // EAN sempre como texto (senão o Excel vira 7,89E+12)
      linhas.forEach((_, i) => {
        const cel = ws[XLSX.utils.encode_cell({ r: i + 1, c: 2 })]
        if (cel && cel.v !== '') { cel.t = 's'; cel.z = '@' }
      })
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Estoque')
      const d = new Date()
      const dataStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      XLSX.writeFile(wb, `estoque-cometa-${dataStr}.xlsx`)
    } catch (err) {
      alert(err?.response?.data?.message || 'Não foi possível gerar a planilha.')
    } finally {
      setExportando(false)
    }
  }

  const salvar = useMutation({
    mutationFn: d => editId
      ? api.put(`/produtos/${editId}`, d)
      : api.post('/produtos', d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['produtos'] })
      setModal(false)
      setForm(camposVazios)
      setEditId(null)
    },
  })

  const deletar = useMutation({
    mutationFn: id => api.delete(`/produtos/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['produtos'] }),
  })

  function abrirEditar(p) {
    setForm({
      nome: p.nome, nome_vitrine: p.nome_vitrine || '', sku: p.sku || '', ncm: p.ncm || '', categoria_id: p.categoria_id,
      preco_custo: p.preco_custo, preco_venda: p.preco_venda,
      quantidade: p.quantidade, estoque_minimo: p.estoque_minimo,
      descricao: p.descricao || '', visivel_vitrine: p.visivel_vitrine,
    })
    setEditId(p.id)
    setModal(true)
  }

  function handleSubmit(e) {
    e.preventDefault()
    salvar.mutate({
      ...form,
      sku: form.sku?.trim() || null,
      ncm: form.ncm?.length === 8 ? form.ncm : null,
      nome_vitrine: form.nome_vitrine?.trim() || null,
      preco_custo: parseFloat(form.preco_custo),
      preco_venda: parseFloat(form.preco_venda),
      quantidade: parseInt(form.quantidade),
      estoque_minimo: parseInt(form.estoque_minimo),
      categoria_id: parseInt(form.categoria_id),
    })
  }

  async function handleFoto(produtoId, arquivo) {
    setUploadingFoto(produtoId)
    const formData = new FormData()
    formData.append('foto', arquivo)
    try {
      await api.post(`/produtos/${produtoId}/foto`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      qc.invalidateQueries({ queryKey: ['produtos'] })
    } finally {
      setUploadingFoto(null)
    }
  }

  const produtos = data?.data || []

  return (
    <div style={{ padding: 32 }} className="page-enter">
      <PageHeader
        title="Produtos"
        subtitle={`${data?.total || 0} produtos cadastrados`}
        actions={
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-secondary" onClick={() => setModalCaixas(true)} title="Caixas que a tela antiga de notas duplicou junto com a unidade">
              Caixas duplicadas
            </button>
            <button className="btn btn-secondary" onClick={exportarEstoque} disabled={exportando} title="Planilha com produto, EAN e quantidade para o balanço">
              <Download size={14} /> {exportando ? 'Gerando...' : 'Exportar estoque'}
            </button>
            {/* Novo Botão de Importar Planilha */}
            <button className="btn btn-secondary" onClick={() => setModalImportar(true)}>
              <Upload size={14} /> Importar Planilha
            </button>
            
            <button className="btn btn-primary" onClick={() => { setForm(camposVazios); setEditId(null); setModal(true) }}>
              <Plus size={14} /> Novo produto
            </button>
          </div>
        }
      />

      {/* Valor em estoque */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10, marginBottom: 12 }}>
        <div className="card" style={{ background: '#1A1916', border: 'none', padding: 16 }}>
          <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12 }}>Valor em estoque (custo)</div>
          <div style={{ fontFamily: 'Syne', fontSize: 26, fontWeight: 800, color: 'white' }}>{resumo ? fmt(resumo.valor_custo) : '…'}</div>
        </div>
        <div className="card" style={{ padding: 16 }}>
          <div style={{ color: 'var(--text-3)', fontSize: 12 }}>Valor em estoque (preço de venda)</div>
          <div style={{ fontFamily: 'Syne', fontSize: 22, fontWeight: 800 }}>{resumo ? fmt(resumo.valor_venda) : '…'}</div>
        </div>
        <div className="card" style={{ padding: 16 }}>
          <div style={{ color: 'var(--text-3)', fontSize: 12 }}>Itens em estoque</div>
          <div style={{ fontFamily: 'Syne', fontSize: 22, fontWeight: 800 }}>{resumo ? resumo.unidades.toLocaleString('pt-BR') : '…'}</div>
          {resumo && <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{resumo.produtos_com_estoque} produtos diferentes</div>}
        </div>
      </div>
      {resumo && (resumo.sem_ean > 0 || resumo.negativos > 0) && (
        <div style={{ fontSize: 12, color: '#B45309', background: '#FFFBEB', borderRadius: 8, padding: '8px 12px', marginBottom: 12 }}>
          {resumo.sem_ean > 0 && <>⚠ {resumo.sem_ean} produto(s) com estoque estão sem EAN. </>}
          {resumo.negativos > 0 && <>⚠ {resumo.negativos} produto(s) com estoque negativo (não entram no valor nem na planilha).</>}
        </div>
      )}
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-2)', marginBottom: 16, cursor: 'pointer', width: 'fit-content' }}>
        <input type="checkbox" checked={comCusto} onChange={e => setComCusto(e.target.checked)} style={{ width: 'auto' }} />
        Incluir preço de custo e valor total na planilha exportada
      </label>

      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 340 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }} />
          <input
            placeholder="Buscar por nome ou SKU..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ paddingLeft: 32 }}
          />
        </div>
        <select value={catFiltro} onChange={e => setCatFiltro(e.target.value)} style={{ width: 180 }}>
          <option value="">Todas categorias</option>
          {categorias?.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
        {!isLoading && <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{produtos.length} produto(s) na lista</span>}
      </div>

      {/* Lista completa com rolagem; cabeçalho fixo */}
      <div className="card lista-produtos" style={{ padding: 0, overflow: 'auto', maxHeight: 'calc(100vh - 220px)', minHeight: 300 }}>
        <style>{`.lista-produtos thead th { position: sticky; top: 0; z-index: 1; background: var(--surface, #fff); box-shadow: 0 1px 0 var(--border); }`}</style>
        {isLoading ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-3)' }}>Carregando...</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Produto</th>
                <th>SKU</th>
                <th>Categoria</th>
                <th style={{ textAlign: 'right' }}>Custo</th>
                <th style={{ textAlign: 'right' }}>Venda</th>
                <th style={{ textAlign: 'center' }}>Estoque</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {produtos.map(p => (
                <tr key={p.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: 6, background: 'var(--surface-2)',
                        flexShrink: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {p.foto_url
                          ? <img src={p.foto_url} alt={p.nome} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : <Camera size={14} color="var(--text-3)" />
                        }
                      </div>
                      <div>
                        <div style={{ fontWeight: 500 }}>{p.nome}</div>
                        {p.descricao && <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{p.descricao.slice(0, 60)}</div>}
                      </div>
                    </div>
                  </td>
                  <td style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-2)' }}>{p.sku}</td>
                  <td><span className="badge badge-neutral">{p.categoria?.nome}</span></td>
                  <td style={{ textAlign: 'right', color: 'var(--text-2)' }}>{fmt(p.preco_custo)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(p.preco_venda)}</td>
                  <td style={{ textAlign: 'center' }}>
                    <span className={`badge ${p.quantidade <= p.estoque_minimo ? 'badge-danger' : 'badge-success'}`}>
                      {p.quantidade <= p.estoque_minimo && <AlertTriangle size={10} />}
                      {p.quantidade}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end', alignItems: 'center' }}>
                      <label style={{ cursor: 'pointer' }} title="Adicionar foto">
                        <input
                          type="file"
                          accept="image/*"
                          style={{ display: 'none' }}
                          onChange={e => e.target.files[0] && handleFoto(p.id, e.target.files[0])}
                        />
                        <div className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          {uploadingFoto === p.id
                            ? <span style={{ fontSize: 11 }}>...</span>
                            : <Camera size={12} />
                          }
                        </div>
                      </label>
                      <button className="btn btn-secondary btn-sm" onClick={() => abrirEditar(p)}>
                        <Pencil size={12} />
                      </button>
                      <button className="btn btn-danger btn-sm" onClick={() => {
                        if (confirm(`Desativar "${p.nome}"?`)) deletar.mutate(p.id)
                      }}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!produtos.length && (
                <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-3)', padding: 32 }}>Nenhum produto encontrado.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal Padrão de Novo/Editar Produto */}
      <Modal open={modal} onClose={() => setModal(false)} title={editId ? 'Editar produto' : 'Novo produto'}>
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group" style={{ gridColumn: '1/-1' }}>
              <label>Nome do produto (interno)</label>
              <input value={form.nome} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))} required />
            </div>
            <div className="form-group" style={{ gridColumn: '1/-1' }}>
              <label>Nome no site <span style={{ fontWeight: 400, color: 'var(--text-3)' }}>(opcional)</span></label>
              <input value={form.nome_vitrine} onChange={e => setForm(p => ({ ...p, nome_vitrine: e.target.value }))}
                placeholder="Ex.: Caneta Bic Cristal Preta — vazio usa o nome interno arrumado" />
            </div>
            <div className="form-group">
              <label>EAN (código de barras)</label>
              <input value={form.sku || ''} onChange={e => setForm(p => ({ ...p, sku: e.target.value }))} placeholder="opcional" />
            </div>
            <div className="form-group">
              <label>NCM <span style={{ fontWeight: 400, color: 'var(--text-3)' }}>(classificação fiscal)</span></label>
              <input value={form.ncm || ''} inputMode="numeric" placeholder="8 dígitos — vem na nota de compra"
                onChange={e => setForm(p => ({ ...p, ncm: e.target.value.replace(/\D/g, '').slice(0, 8) }))}
                style={{ fontFamily: 'monospace', borderColor: form.ncm && form.ncm.length !== 8 ? 'var(--danger)' : undefined }} />
            </div>
            <div className="form-group">
              <label>Categoria</label>
              <select value={form.categoria_id} onChange={e => setForm(p => ({ ...p, categoria_id: e.target.value }))} required>
                <option value="">Selecione</option>
                {categorias?.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Preço de custo (R$)</label>
              <input type="number" step="0.01" min="0" value={form.preco_custo} onChange={e => setForm(p => ({ ...p, preco_custo: e.target.value }))} required />
            </div>
            <div className="form-group">
              <label>Preço de venda (R$)</label>
              <input type="number" step="0.01" min="0" value={form.preco_venda} onChange={e => setForm(p => ({ ...p, preco_venda: e.target.value }))} required />
            </div>
            <div className="form-group">
              <label>Quantidade em estoque</label>
              <input type="number" min="0" value={form.quantidade} onChange={e => setForm(p => ({ ...p, quantidade: e.target.value }))} required />
            </div>
            <div className="form-group">
              <label>Estoque mínimo</label>
              <input type="number" min="0" value={form.estoque_minimo} onChange={e => setForm(p => ({ ...p, estoque_minimo: e.target.value }))} required />
            </div>
            <div className="form-group" style={{ gridColumn: '1/-1' }}>
              <label>Descrição no site</label>
              <textarea rows={3} value={form.descricao} onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))} placeholder="Detalhes que ajudam o cliente: medidas, cor, material, o que vem na embalagem..." />
            </div>
            <label style={{ gridColumn: '1/-1', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', color: 'var(--text)' }}>
              <input type="checkbox" checked={!!form.visivel_vitrine} onChange={e => setForm(p => ({ ...p, visivel_vitrine: e.target.checked }))} style={{ width: 'auto' }} />
              Mostrar no site (só aparece se tiver estoque)
            </label>
          </div>

          {salvar.isError && (
            <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 12 }}>
              Erro ao salvar. Verifique os campos.
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
            <button type="button" className="btn btn-secondary" onClick={() => setModal(false)}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={salvar.isPending}>
              {salvar.isPending ? 'Salvando...' : editId ? 'Salvar alterações' : 'Cadastrar produto'}
            </button>
          </div>
        </form>
      </Modal>

      {/* NOVO MODAL: Abre o Importador de Planilhas que criamos */}
      <Modal open={modalImportar} onClose={() => { setModalImportar(false); qc.invalidateQueries({ queryKey: ['produtos'] }) }} title="Importar Produtos em Lote">
        <ImportadorProdutos />
      </Modal>

      <Modal open={modalCaixas} onClose={() => setModalCaixas(false)} title="Caixas duplicadas pela entrada de nota antiga" width={900}>
        {modalCaixas && <CaixasDuplicadas onFechar={() => setModalCaixas(false)} />}
      </Modal>
    </div>
  )
}