import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, Wallet, CreditCard, Smartphone, FileText, Trash2, ChevronLeft, ChevronRight } from 'lucide-react'
import PageHeader from '../../../components/PageHeader'
import api from '../../../api/client'

function fmt(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)
}

// Datas sempre no horário local, formato AAAA-MM-DD
function iso(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function somarDias(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x }
function brData(s) { const [a, m, d] = s.split('-'); return `${d}/${m}/${a}` }

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

function periodoPreset(id) {
  const hoje = new Date()
  switch (id) {
    case 'hoje':       return { de: iso(hoje), ate: iso(hoje) }
    case 'ontem':      { const o = somarDias(hoje, -1); return { de: iso(o), ate: iso(o) } }
    case '7':          return { de: iso(somarDias(hoje, -6)), ate: iso(hoje) }
    case '30':         return { de: iso(somarDias(hoje, -29)), ate: iso(hoje) }
    case 'mes':        return { de: iso(new Date(hoje.getFullYear(), hoje.getMonth(), 1)), ate: iso(hoje) }
    case 'mes_passado': return {
      de: iso(new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1)),
      ate: iso(new Date(hoje.getFullYear(), hoje.getMonth(), 0)),
    }
    case 'ano':        return { de: iso(new Date(hoje.getFullYear(), 0, 1)), ate: iso(hoje) }
    default:           return null
  }
}

const PRESETS = [
  ['hoje', 'Hoje'], ['ontem', 'Ontem'], ['7', '7 dias'], ['mes', 'Este mês'],
  ['mes_passado', 'Mês passado'], ['30', '30 dias'], ['ano', 'Este ano'],
]

const FORMA_INFO = {
  dinheiro: { label: 'Dinheiro', icon: Wallet, cor: '#15803D' },
  pix:      { label: 'PIX', icon: Smartphone, cor: '#0E7490' },
  debito:   { label: 'Débito', icon: CreditCard, cor: '#7C3AED' },
  credito:  { label: 'Crédito', icon: CreditCard, cor: '#B45309' },
  outro:    { label: 'Outro', icon: FileText, cor: '#57534E' },
}

const TIPO_INFO = {
  venda: { label: 'Venda à vista', cor: '#1A1916', bg: 'var(--surface-2)' },
  fiado: { label: 'Pagamento fiado', cor: '#4338CA', bg: '#EEF2FF' },
  carne: { label: 'Parcela carnê', cor: '#B45309', bg: '#FFFBEB' },
}

function erroApi(err) {
  const d = err?.response?.data
  if (d?.errors) return Object.values(d.errors).flat().join('\n')
  return d?.message || 'Não foi possível concluir.'
}

const btnChip = ativo => ({
  padding: '6px 12px', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer',
  background: ativo ? '#1A1916' : 'white', color: ativo ? 'white' : 'var(--text-2)',
  border: `1px solid ${ativo ? '#1A1916' : 'var(--border)'}`,
})

export default function Recebimentos() {
  const qc = useQueryClient()
  const [preset, setPreset] = useState('mes')
  const [periodo, setPeriodo] = useState(() => periodoPreset('mes'))
  const [busca, setBusca] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('todos')
  const [filtroForma, setFiltroForma] = useState('todas')

  const { data, isLoading, isError } = useQuery({
    queryKey: ['recebimentos', periodo.de, periodo.ate],
    queryFn: () => api.get('/recebimentos', { params: { de: periodo.de, ate: periodo.ate } }).then(r => r.data),
    enabled: !!periodo.de && !!periodo.ate && periodo.de <= periodo.ate,
  })

  function escolherPreset(id) {
    setPreset(id)
    setPeriodo(periodoPreset(id))
  }

  function mudarData(campo, valor) {
    setPreset('personalizado')
    setPeriodo(p => ({ ...p, [campo]: valor }))
  }

  // Setas: anda um mês inteiro para trás/frente
  function andarMes(delta) {
    const base = new Date(periodo.de + 'T12:00:00')
    const ini = new Date(base.getFullYear(), base.getMonth() + delta, 1)
    const fim = new Date(base.getFullYear(), base.getMonth() + delta + 1, 0)
    setPreset('personalizado')
    setPeriodo({ de: iso(ini), ate: iso(fim) })
  }

  const recebimentos = useMemo(() => (data?.recebimentos || []).filter(r => {
    const termo = busca.trim().toLowerCase()
    const matchBusca = !termo
      || r.cliente?.toLowerCase().includes(termo)
      || String(r.venda_id || '').includes(termo)
      || r.descricao?.toLowerCase().includes(termo)
    const matchTipo = filtroTipo === 'todos' || r.tipo === filtroTipo
    const matchForma = filtroForma === 'todas' || (r.forma || 'outro') === filtroForma
    return matchBusca && matchTipo && matchForma
  }), [data, busca, filtroTipo, filtroForma])

  // Totais refletem os filtros aplicados
  const totais = useMemo(() => {
    const t = { geral: 0, forma: {}, tipo: {} }
    for (const r of recebimentos) {
      const forma = FORMA_INFO[r.forma] ? r.forma : 'outro'
      t.geral += r.valor
      t.forma[forma] = (t.forma[forma] || 0) + r.valor
      t.tipo[r.tipo] = (t.tipo[r.tipo] || 0) + r.valor
    }
    return t
  }, [recebimentos])

  const filtrando = busca || filtroTipo !== 'todos' || filtroForma !== 'todas'

  const excluir = useMutation({
    mutationFn: ({ r, motivo }) => {
      if (r.tipo === 'venda') return api.delete(`/vendas/${r.venda_id}`)
      if (r.tipo === 'carne') return api.post(`/parcelas/${r.id}/desfazer`)
      return api.post(`/fiado/lancamentos/${r.id}/estornar`, { motivo })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['recebimentos'] })
      qc.invalidateQueries({ queryKey: ['vendas'] })
      qc.invalidateQueries({ queryKey: ['fiado'] })
      qc.invalidateQueries({ queryKey: ['parcelas'] })
      qc.invalidateQueries({ queryKey: ['carnes-cliente'] })
    },
    onError: err => alert(erroApi(err)),
  })

  function pedirExclusao(r) {
    const valor = fmt(r.valor)
    if (r.tipo === 'venda') {
      if (confirm(`Cancelar a Venda #${r.venda_id} (${valor})?\n\nA venda é apagada e o estoque dos itens volta.`)) excluir.mutate({ r })
    } else if (r.tipo === 'carne') {
      if (confirm(`Desfazer o pagamento da parcela ${r.numero_parcela} da Venda #${r.venda_id} (${valor})?\n\nA parcela volta a ficar pendente no carnê de ${r.cliente}.`)) excluir.mutate({ r })
    } else {
      const motivo = prompt(`Excluir o pagamento de fiado de ${r.cliente} (${valor})?\n\nO valor volta a ser dívida na conta fiado e o pagamento fica riscado no histórico.\nInforme o motivo:`)
      if (motivo === null) return
      if (motivo.trim().length < 3) { alert('Informe o motivo.'); return }
      excluir.mutate({ r, motivo: motivo.trim() })
    }
  }

  const tituloPeriodo = periodo.de === periodo.ate
    ? brData(periodo.de)
    : `${brData(periodo.de)} a ${brData(periodo.ate)}`
  const ehMesInteiro = (() => {
    const ini = new Date(periodo.de + 'T12:00:00')
    const fim = new Date(periodo.ate + 'T12:00:00')
    return ini.getDate() === 1 && ini.getMonth() === fim.getMonth() && ini.getFullYear() === fim.getFullYear()
      && somarDias(fim, 1).getDate() === 1
  })()

  return (
    <div style={{ padding: 16 }} className="page-enter">
      <PageHeader title="Recebimentos" subtitle="Tudo que entrou de dinheiro na loja" />

      {/* Período */}
      <div className="card" style={{ marginBottom: 16, padding: 14 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
          {PRESETS.map(([id, label]) => (
            <button key={id} onClick={() => escolherPreset(id)} style={btnChip(preset === id)}>{label}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <button onClick={() => andarMes(-1)} title="Mês anterior" className="btn btn-secondary btn-sm" style={{ height: 38 }}><ChevronLeft size={14} /></button>
          <div style={{ width: 160 }}>
            <label style={{ fontSize: 11 }}>De</label>
            <input type="date" value={periodo.de} max={periodo.ate} onChange={e => mudarData('de', e.target.value)} />
          </div>
          <div style={{ width: 160 }}>
            <label style={{ fontSize: 11 }}>Até</label>
            <input type="date" value={periodo.ate} min={periodo.de} onChange={e => mudarData('ate', e.target.value)} />
          </div>
          <button onClick={() => andarMes(1)} title="Próximo mês" className="btn btn-secondary btn-sm" style={{ height: 38 }}><ChevronRight size={14} /></button>
          {periodo.de > periodo.ate && <span style={{ fontSize: 12, color: 'var(--danger)' }}>A data inicial é depois da final.</span>}
        </div>
      </div>

      {/* Total geral */}
      <div className="card" style={{ background: '#1A1916', border: 'none', marginBottom: 16, textAlign: 'center', padding: 20 }}>
        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>
          Total recebido · {ehMesInteiro ? `${MESES[new Date(periodo.de + 'T12:00:00').getMonth()]} de ${periodo.de.slice(0, 4)}` : tituloPeriodo}
          {filtrando && ' (com filtros)'}
        </div>
        <div style={{ fontFamily: 'Syne', fontSize: 34, fontWeight: 800, color: 'white' }}>{fmt(totais.geral)}</div>
        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 4 }}>{recebimentos.length} recebimento(s)</div>
      </div>

      {/* Totais por forma de pagamento (clique para filtrar) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: 16 }}>
        {Object.entries(FORMA_INFO).filter(([k]) => k !== 'outro' || totais.forma.outro).map(([key, info]) => {
          const Icon = info.icon
          const ativo = filtroForma === key
          return (
            <button key={key} className="card" onClick={() => setFiltroForma(ativo ? 'todas' : key)} style={{
              textAlign: 'center', padding: 14, cursor: 'pointer', fontFamily: 'DM Sans',
              border: `2px solid ${ativo ? info.cor : 'var(--border)'}`,
            }}>
              <Icon size={18} color={info.cor} style={{ marginBottom: 4 }} />
              <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{info.label}</div>
              <div style={{ fontFamily: 'Syne', fontSize: 16, fontWeight: 700 }}>{fmt(totais.forma[key] || 0)}</div>
            </button>
          )
        })}
      </div>

      {/* Totais por tipo (clique para filtrar) */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {Object.entries(TIPO_INFO).map(([key, info]) => {
          const ativo = filtroTipo === key
          return (
            <button key={key} onClick={() => setFiltroTipo(ativo ? 'todos' : key)} style={{
              background: info.bg, borderRadius: 8, padding: '8px 14px', fontSize: 12, cursor: 'pointer',
              border: `2px solid ${ativo ? info.cor : 'transparent'}`, fontFamily: 'DM Sans',
            }}>
              <span style={{ color: info.cor, fontWeight: 600 }}>{info.label}:</span> {fmt(totais.tipo[key] || 0)}
            </button>
          )
        })}
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }} />
          <input placeholder="Buscar cliente ou nº da venda..." value={busca} onChange={e => setBusca(e.target.value)} style={{ paddingLeft: 30, fontSize: 13 }} />
        </div>
        <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)} style={{ width: 160, fontSize: 13 }}>
          <option value="todos">Todos os tipos</option>
          {Object.entries(TIPO_INFO).map(([k, i]) => <option key={k} value={k}>{i.label}</option>)}
        </select>
        <select value={filtroForma} onChange={e => setFiltroForma(e.target.value)} style={{ width: 150, fontSize: 13 }}>
          <option value="todas">Todas as formas</option>
          {Object.entries(FORMA_INFO).map(([k, i]) => <option key={k} value={k}>{i.label}</option>)}
        </select>
        {filtrando && (
          <button className="btn btn-secondary btn-sm" onClick={() => { setBusca(''); setFiltroTipo('todos'); setFiltroForma('todas') }}>Limpar filtros</button>
        )}
      </div>

      {/* Lista */}
      <div className="card" style={{ padding: 0, overflow: 'auto' }}>
        {isLoading ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-3)' }}>Carregando...</div>
        ) : isError ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--danger)' }}>Erro ao carregar os recebimentos.</div>
        ) : recebimentos.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)' }}>Nenhum recebimento no período.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Cliente</th>
                <th>Tipo</th>
                <th>Forma</th>
                <th style={{ textAlign: 'right' }}>Valor</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {recebimentos.map(r => {
                const tipoInfo = TIPO_INFO[r.tipo]
                const formaInfo = FORMA_INFO[r.forma] || FORMA_INFO.outro
                const titulo = r.tipo === 'venda' ? 'Cancelar venda' : r.tipo === 'carne' ? 'Desfazer pagamento da parcela' : 'Excluir pagamento (estornar)'
                return (
                  <tr key={`${r.tipo}-${r.id}`}>
                    <td style={{ fontSize: 12, color: 'var(--text-2)', whiteSpace: 'nowrap' }}>
                      {r.retroativo
                        ? <span title="Pagamento lançado com data retroativa">{new Date(r.data).toLocaleDateString('pt-BR')} ⏱</span>
                        : new Date(r.data).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                    <td style={{ fontSize: 13 }}>{r.cliente}</td>
                    <td>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 6, background: tipoInfo.bg, color: tipoInfo.cor, whiteSpace: 'nowrap' }}>
                        {tipoInfo.label}
                        {r.tipo === 'venda' && ` #${r.venda_id}`}
                        {r.tipo === 'carne' && ` #${r.venda_id} (${r.numero_parcela})`}
                      </span>
                    </td>
                    <td style={{ fontSize: 12 }}>{formaInfo.label}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap' }}>{fmt(r.valor)}</td>
                    <td style={{ width: 40 }}>
                      <button className="btn btn-danger btn-sm" title={titulo} disabled={excluir.isPending} onClick={() => pedirExclusao(r)}>
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
