import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus, Trash2, ChevronLeft, ChevronRight, Wallet, FileText, CreditCard, Fuel, Package, Search,
  ShoppingCart, Users, Landmark, Lightbulb, Car, HandCoins, Boxes, Wrench, Heart,
} from 'lucide-react'
import PageHeader from '../../../components/PageHeader'
import api from '../../../api/client'

function fmt(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)
}

function hojeISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Manter em sincronia com DespesaController::CATEGORIAS
const CATEGORIAS = [
  { id: 'boleto_loja',           label: 'Boleto Loja',          dica: 'Fornecedores e boletos da loja',               icon: FileText,     cor: '#4338CA', bg: '#EEF2FF' },
  { id: 'faturas_cartao',        label: 'Faturas Cartão',       dica: 'Faturas de cartão de crédito',                 icon: CreditCard,   cor: '#0E7490', bg: '#ECFEFF' },
  { id: 'combustivel',           label: 'Combustível',          dica: 'Gasolina, diesel, etanol',                     icon: Fuel,         cor: '#B45309', bg: '#FFFBEB' },
  { id: 'alimentacao',           label: 'Alimentação',          dica: 'Mercado, carne, lanche, padaria, frutas',      icon: ShoppingCart, cor: '#15803D', bg: '#F0FDF4' },
  { id: 'pagamento_funcionario', label: 'Pagamento Funcionário', dica: 'Salários, diárias, vales, FGTS',               icon: Users,        cor: '#9333EA', bg: '#FAF5FF' },
  { id: 'boleto_governo',        label: 'Boleto Governo',       dica: 'Receita Federal, ICMS, DIFAL, Simples, ST, taxas', icon: Landmark, cor: '#B91C1C', bg: '#FEF2F2' },
  { id: 'contas_consumo',        label: 'Contas da Casa/Loja',  dica: 'Luz (Copel), água (Samae), internet, telefone, gás', icon: Lightbulb, cor: '#CA8A04', bg: '#FEFCE8' },
  { id: 'veiculo',               label: 'Veículo',              dica: 'Parcela, seguro, revisão, pneu, pedágio, estacionamento', icon: Car, cor: '#0369A1', bg: '#F0F9FF' },
  { id: 'emprestimos',           label: 'Empréstimos',          dica: 'Empréstimos, consórcio, financiamentos',       icon: HandCoins,    cor: '#BE185D', bg: '#FDF2F8' },
  { id: 'mercadoria',            label: 'Mercadoria/Materiais', dica: 'Compras para revenda, sacolas, materiais',     icon: Boxes,        cor: '#7C2D12', bg: '#FFF7ED' },
  { id: 'servicos',              label: 'Serviços e Taxas',     dica: 'Certificado digital, associação, anúncios',    icon: Wrench,       cor: '#475569', bg: '#F8FAFC' },
  { id: 'pessoal',               label: 'Pessoal/Família',      dica: 'Saúde, faculdade, cabelo, pets, doações',      icon: Heart,        cor: '#DB2777', bg: '#FDF2F8' },
  { id: 'outros',                label: 'Outros',               dica: 'O que não se encaixa em nenhuma',              icon: Package,      cor: '#57534E', bg: '#F5F5F4' },
]

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

function catInfo(id) {
  return CATEGORIAS.find(c => c.id === id) || CATEGORIAS[CATEGORIAS.length - 1]
}

export default function Despesas() {
  const qc = useQueryClient()
  const hoje = new Date()
  const [mes, setMes] = useState(hoje.getMonth() + 1)
  const [ano, setAno] = useState(hoje.getFullYear())
  const [categoria, setCategoria] = useState('boleto_loja')
  const [valor, setValor] = useState('')
  const [descricao, setDescricao] = useState('')
  const [dataPagamento, setDataPagamento] = useState(hojeISO())
  const [filtroCat, setFiltroCat] = useState('todas')
  const [busca, setBusca] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['despesas', mes, ano],
    queryFn: () => api.get('/despesas', { params: { mes, ano } }).then(r => r.data),
  })

  const registrar = useMutation({
    mutationFn: () => api.post('/despesas', {
      categoria,
      valor: parseFloat(valor),
      descricao: descricao || null,
      data_pagamento: dataPagamento,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['despesas'] })
      setValor('')
      setDescricao('')
    },
  })

  const mudarCategoria = useMutation({
    mutationFn: ({ id, categoria }) => api.put(`/despesas/${id}`, { categoria }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['despesas'] }),
    onError: err => alert(err?.response?.data?.message || 'Erro ao mudar a categoria.'),
  })

  const excluir = useMutation({
    mutationFn: id => api.delete(`/despesas/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['despesas'] }),
  })

  function mesAnterior() {
    if (mes === 1) { setMes(12); setAno(a => a - 1) }
    else setMes(m => m - 1)
  }

  function proximoMes() {
    if (mes === 12) { setMes(1); setAno(a => a + 1) }
    else setMes(m => m + 1)
  }

  const todas = useMemo(() => data?.despesas || [], [data])
  const totalGeral = data?.total_geral || 0
  const totalPorCat = data?.total_por_categoria || {}

  const despesas = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return todas.filter(d =>
      (filtroCat === 'todas' || d.categoria === filtroCat) &&
      (!termo || (d.descricao || '').toLowerCase().includes(termo))
    )
  }, [todas, filtroCat, busca])
  const totalFiltrado = despesas.reduce((s, d) => s + parseFloat(d.valor), 0)
  const filtrando = filtroCat !== 'todas' || busca.trim()

  // Categorias com valor no mês primeiro (maior → menor), depois as sem gasto
  const catsDoMes = [...CATEGORIAS].sort((a, b) => (totalPorCat[b.id] || 0) - (totalPorCat[a.id] || 0))
  const catSelecionada = catInfo(categoria)

  return (
    <div style={{ padding: 16 }} className="page-enter">
      <PageHeader title="Despesas" subtitle="Controle de gastos da loja" />

      {/* Navegação de mês + total */}
      <div className="card" style={{ marginBottom: 14, background: '#1A1916', border: 'none' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <button onClick={mesAnterior} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 8, padding: 8, cursor: 'pointer', color: 'white', display: 'flex' }}>
            <ChevronLeft size={16} />
          </button>
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>{MESES[mes - 1]} de {ano}</div>
            <div style={{ fontFamily: 'Syne', fontSize: 30, fontWeight: 800, color: 'white' }}>{fmt(totalGeral)}</div>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>{todas.length} despesa(s) no mês</div>
          </div>
          <button onClick={proximoMes} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 8, padding: 8, cursor: 'pointer', color: 'white', display: 'flex' }}>
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Totais por categoria — clique para filtrar */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
          {catsDoMes.filter(c => totalPorCat[c.id]).map(c => {
            const ativo = filtroCat === c.id
            return (
              <button key={c.id} onClick={() => setFiltroCat(ativo ? 'todas' : c.id)} style={{
                background: ativo ? 'white' : 'rgba(255,255,255,0.08)', borderRadius: 8, padding: '5px 10px', fontSize: 11,
                color: ativo ? '#1A1916' : 'rgba(255,255,255,0.7)', border: 'none', cursor: 'pointer', fontFamily: 'DM Sans',
              }}>
                {c.label}: <strong style={{ color: ativo ? '#1A1916' : 'white' }}>{fmt(totalPorCat[c.id])}</strong>
                <span style={{ opacity: 0.6 }}> · {totalGeral ? Math.round((totalPorCat[c.id] / totalGeral) * 100) : 0}%</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Registro rápido */}
      <div className="card" style={{ marginBottom: 14 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Registrar despesa</h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(118px, 1fr))', gap: 8, marginBottom: 8 }}>
          {CATEGORIAS.map(c => {
            const Icon = c.icon
            const ativo = categoria === c.id
            return (
              <button
                key={c.id}
                title={c.dica}
                onClick={() => setCategoria(c.id)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
                  padding: '10px 6px', borderRadius: 10, cursor: 'pointer',
                  background: ativo ? c.bg : 'var(--surface)',
                  border: `2px solid ${ativo ? c.cor : 'var(--border)'}`,
                  transition: 'all 0.15s', fontFamily: 'DM Sans',
                }}
              >
                <Icon size={18} color={ativo ? c.cor : 'var(--text-3)'} />
                <span style={{ fontSize: 11, fontWeight: 600, textAlign: 'center', lineHeight: 1.2, color: ativo ? c.cor : 'var(--text-2)' }}>{c.label}</span>
              </button>
            )
          })}
        </div>
        <p style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 12 }}>
          <strong style={{ color: catSelecionada.cor }}>{catSelecionada.label}:</strong> {catSelecionada.dica}
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, alignItems: 'flex-end' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label>Valor (R$)</label>
            <input
              type="number" step="0.01" min="0.01" placeholder="0,00"
              value={valor}
              onChange={e => setValor(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && valor) registrar.mutate() }}
              autoFocus
            />
          </div>
          <div className="form-group" style={{ margin: 0, gridColumn: 'span 2' }}>
            <label>Descrição (opcional)</label>
            <input
              placeholder="Ex: Conta de luz, fornecedor X..."
              value={descricao}
              onChange={e => setDescricao(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && valor) registrar.mutate() }}
            />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label>Data do pagamento</label>
            <input type="date" value={dataPagamento} onChange={e => setDataPagamento(e.target.value)} />
          </div>
          <button
            className="btn btn-primary"
            disabled={!valor || registrar.isPending}
            onClick={() => registrar.mutate()}
            style={{ height: 38, justifyContent: 'center' }}
          >
            <Plus size={14} /> Registrar
          </button>
        </div>

        {registrar.isError && (
          <p style={{ color: 'var(--danger)', fontSize: 12, marginTop: 8 }}>
            {registrar.error?.response?.data?.message || 'Erro ao registrar.'}
          </p>
        )}
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={filtroCat} onChange={e => setFiltroCat(e.target.value)} style={{ width: 220, fontSize: 13 }}>
          <option value="todas">Todas as categorias</option>
          {CATEGORIAS.map(c => <option key={c.id} value={c.id}>{c.label}{totalPorCat[c.id] ? ` — ${fmt(totalPorCat[c.id])}` : ''}</option>)}
        </select>
        <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }} />
          <input placeholder="Buscar na descrição..." value={busca} onChange={e => setBusca(e.target.value)} style={{ paddingLeft: 30, fontSize: 13 }} />
        </div>
        {filtrando && (
          <>
            <span style={{ fontSize: 13, color: 'var(--text-2)' }}>{despesas.length} item(ns) · <strong>{fmt(totalFiltrado)}</strong></span>
            <button className="btn btn-secondary btn-sm" onClick={() => { setFiltroCat('todas'); setBusca('') }}>Limpar</button>
          </>
        )}
      </div>

      {/* Lista do mês */}
      <div className="card" style={{ padding: 0, overflow: 'auto' }}>
        {isLoading ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-3)' }}>Carregando...</div>
        ) : despesas.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)' }}>
            <Wallet size={40} style={{ marginBottom: 12, opacity: 0.3 }} />
            <p>{filtrando ? 'Nenhuma despesa com esse filtro.' : `Nenhuma despesa registrada em ${MESES[mes - 1]}.`}</p>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Categoria</th>
                <th>Descrição</th>
                <th style={{ textAlign: 'right' }}>Valor</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {despesas.map(d => {
                const cat = catInfo(d.categoria)
                return (
                  <tr key={d.id}>
                    <td style={{ fontSize: 12, color: 'var(--text-2)', whiteSpace: 'nowrap' }}>
                      {d.data_pagamento ? (() => {
                        const [a, m, dia] = d.data_pagamento.split('T')[0].split('-')
                        return `${dia}/${m}/${a}`
                      })() : '—'}
                    </td>
                    <td>
                      {/* Trocar a categoria direto na lista */}
                      <select
                        value={d.categoria}
                        title="Mudar categoria"
                        disabled={mudarCategoria.isPending}
                        onChange={e => mudarCategoria.mutate({ id: d.id, categoria: e.target.value })}
                        style={{
                          fontSize: 11, fontWeight: 600, padding: '3px 6px', borderRadius: 6, width: 'auto', height: 'auto',
                          background: cat.bg, color: cat.cor, border: `1px solid ${cat.bg}`, cursor: 'pointer',
                        }}
                      >
                        {CATEGORIAS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                      </select>
                    </td>
                    <td style={{ fontSize: 13 }}>{d.descricao || '—'}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap' }}>{fmt(d.valor)}</td>
                    <td style={{ width: 40 }}>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => { if (confirm(`Excluir despesa de ${fmt(d.valor)}?`)) excluir.mutate(d.id) }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
