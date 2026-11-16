import { Fragment, useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Check, Upload, X, Package, ChevronDown, ChevronRight, Save, Search, ArrowRight, Sparkles } from 'lucide-react'
import PageHeader from '../../../components/PageHeader'
import api from '../../../api/client'

function fmt(v, casas = 2) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: casas, maximumFractionDigits: casas }).format(v || 0)
}
function num(v) { const n = parseFloat(String(v).replace(',', '.')); return isNaN(n) ? 0 : n }
function hojeISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ─── Parser XML NF-e ──────────────────────────────────────────────────────────
// Além do item comercial (cEAN/qCom/uCom), lê o item "tributável" (cEANTrib/qTrib/uTrib):
// muitas notas trazem ali o EAN e a quantidade da UNIDADE (ex.: 1 CX → 6 UN).
function parseNFe(xmlString) {
  const doc = new DOMParser().parseFromString(xmlString, 'application/xml')
  const get = (sel, raiz = doc) => raiz.querySelector(sel)?.textContent?.trim() || ''
  const ean = s => (!s || /SEM GTIN/i.test(s) ? '' : s)

  const itens = Array.from(doc.querySelectorAll('det')).map(det => {
    const qCom = num(get('prod qCom', det)) || 1
    const qTrib = num(get('prod qTrib', det))
    const uCom = get('prod uCom', det).toUpperCase()
    const uTrib = get('prod uTrib', det).toUpperCase()
    const nome = get('prod xProd', det)
    const vProd = num(get('prod vProd', det))

    // Dica de quantas unidades vêm em cada item da nota
    let dica = null
    const porTrib = qTrib && uCom !== uTrib ? Math.round(qTrib / qCom) : 0
    const porNome = nome.match(/\bC\s*\/\s*(\d{1,4})\b/i) || nome.match(/\b(?:CX|CAIXA|PCT|PACOTE|FD|FARDO)\s*(?:C\/|COM\s*)?(\d{1,4})\s*(?:UN|UND|UNID)\b/i)
    if (porTrib > 1) dica = { fator: porTrib, motivo: `a nota diz ${qTrib} ${uTrib} em ${qCom} ${uCom}` }
    else if (porNome && parseInt(porNome[1]) > 1) dica = { fator: parseInt(porNome[1]), motivo: `o nome tem "${porNome[0]}"` }

    return {
      nome_nf: nome,
      ean_nf: ean(get('prod cEAN', det)),
      ean_unidade: ean(get('prod cEANTrib', det)),
      unidade_nf: uCom || 'UN',
      quantidade_nf: qCom,
      // custo de 1 item da nota (usa o total da linha para não perder centavos)
      custo_nf: vProd && qCom ? +(vProd / qCom).toFixed(4) : num(get('prod vUnCom', det)),
      dica,
    }
  })

  return {
    form: {
      numero_nf: get('ide nNF'),
      fornecedor: get('emit xFant') || get('emit xNome'),
      data_emissao: (get('ide dhEmi') || get('ide dEmi')).split('T')[0],
      valor_total_nf: num(get('ICMSTot vNF')),
    },
    itens,
  }
}

const novoItem = (base = {}) => ({
  key: `${Date.now()}-${Math.random()}`,
  nome_nf: '', ean_nf: '', ean_unidade: '', unidade_nf: 'UN', quantidade_nf: 1, custo_nf: '',
  mult1: 1, mult2: 1, dica: null,
  modo: 'novo', produto: null, novo_nome: '', novo_ean: '', categoria_id: '',
  preco_venda: '', origem: null, lembrar: true, aberto: true,
  ...base,
})

const fatorDe = it => Math.max(1, Math.round(num(it.mult1) || 1) * Math.round(num(it.mult2) || 1))
const unidadesDe = it => Math.round(num(it.quantidade_nf) * fatorDe(it))
const custoUnDe = it => num(it.custo_nf) / fatorDe(it)

function problemasDo(it) {
  const p = []
  if (!it.nome_nf.trim()) p.push('nome na nota')
  if (num(it.quantidade_nf) <= 0) p.push('quantidade')
  if (it.modo === 'existente' && !it.produto) p.push('escolher o produto')
  if (it.modo === 'novo' && !it.novo_nome.trim()) p.push('nome do produto novo')
  if (num(it.preco_venda) <= 0) p.push('preço de venda')
  return p
}

const ORIGEM = {
  memoria:     { txt: 'Reconhecido (usado antes)', cor: '#047857', bg: '#ECFDF5' },
  ean:         { txt: 'EAN encontrado no cadastro', cor: '#0E7490', bg: '#ECFEFF' },
  ean_unidade: { txt: 'EAN da unidade encontrado', cor: '#0E7490', bg: '#ECFEFF' },
}

// ─── Busca de produto existente ──────────────────────────────────────────────
function BuscaProduto({ onEscolher, inicial }) {
  const [termo, setTermo] = useState(inicial || '')
  const [res, setRes] = useState([])
  const [aberto, setAberto] = useState(false)
  const timer = useRef(null)

  function buscar(v) {
    setTermo(v)
    clearTimeout(timer.current)
    if (v.trim().length < 2) { setRes([]); return }
    timer.current = setTimeout(async () => {
      const r = await api.get('/produtos', { params: { search: v.trim(), per_page: 15 } })
      setRes((r.data.data || []).filter(p => p.ativo !== false))
      setAberto(true)
    }, 300)
  }

  return (
    <div style={{ position: 'relative' }}>
      <Search size={13} style={{ position: 'absolute', left: 10, top: 12, color: 'var(--text-3)' }} />
      <input placeholder="Buscar produto por nome ou EAN..." value={termo} onChange={e => buscar(e.target.value)}
        onFocus={() => res.length && setAberto(true)} style={{ paddingLeft: 30, fontSize: 13 }} />
      {aberto && res.length > 0 && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20, background: 'white', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 6px 20px rgba(0,0,0,0.1)', maxHeight: 260, overflow: 'auto', marginTop: 2 }}>
          {res.map(p => (
            <button key={p.id} type="button" onClick={() => { onEscolher(p); setAberto(false); setTermo('') }}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', background: 'none', border: 'none', borderBottom: '1px solid var(--surface-2)', cursor: 'pointer', fontFamily: 'DM Sans' }}>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{p.nome}</div>
              <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
                EAN {p.sku || '—'} · estoque {p.quantidade} · venda {fmt(p.preco_venda)}
              </div>
            </button>
          ))}
        </div>
      )}
      {aberto && termo.trim().length >= 2 && res.length === 0 && (
        <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>Nenhum produto encontrado.</div>
      )}
    </div>
  )
}

// ─── Uma linha da nota ───────────────────────────────────────────────────────
function LinhaNota({ it, onChange, onRemove, categorias }) {
  const set = patch => onChange({ ...it, ...patch })
  const fator = fatorDe(it)
  const unidades = unidadesDe(it)
  const custoUn = custoUnDe(it)
  const preco = num(it.preco_venda)
  const margem = custoUn > 0 && preco > 0 ? ((preco - custoUn) / custoUn) * 100 : null
  const problemas = problemasDo(it)
  const origem = ORIGEM[it.origem]
  const nomeDestino = it.modo === 'existente' ? it.produto?.nome : it.novo_nome

  return (
    <div style={{ border: `1px solid ${problemas.length ? '#FCD34D' : 'var(--border)'}`, borderRadius: 10, marginBottom: 10, overflow: 'hidden', background: 'white' }}>
      {/* Cabeçalho: como veio na nota */}
      <div onClick={() => set({ aberto: !it.aberto })} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--surface)', cursor: 'pointer' }}>
        {it.aberto ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {num(it.quantidade_nf)} {it.unidade_nf} · {it.nome_nf || 'Novo item'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
            {problemas.length
              ? <span style={{ color: '#B45309' }}>Falta: {problemas.join(', ')}</span>
              : <>+{unidades} un → <strong>{nomeDestino}</strong> · {fmt(custoUn, custoUn < 1 ? 4 : 2)}/un · venda {fmt(preco)}</>}
          </div>
        </div>
        {origem && <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 6, background: origem.bg, color: origem.cor, whiteSpace: 'nowrap' }}>{origem.txt}</span>}
        <button onClick={e => { e.stopPropagation(); onRemove() }} title="Tirar esta linha" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', display: 'flex' }}><X size={15} /></button>
      </div>

      {it.aberto && (
        <div style={{ padding: 14, display: 'grid', gap: 14 }}>
          {/* 1. Como vem na nota */}
          <div>
            <div style={rotulo}>1 · Como vem na nota</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8 }}>
              <div style={{ gridColumn: 'span 2' }}>
                <label style={lbl}>Descrição na nota</label>
                <input value={it.nome_nf} onChange={e => set({ nome_nf: e.target.value })} style={{ fontSize: 13 }} />
              </div>
              <div>
                <label style={lbl}>EAN na nota</label>
                <input value={it.ean_nf} onChange={e => set({ ean_nf: e.target.value })} style={{ fontSize: 13, fontFamily: 'monospace' }} placeholder="—" />
              </div>
              <div>
                <label style={lbl}>Quantidade</label>
                <div style={{ display: 'flex', gap: 4 }}>
                  <input type="number" min="0" step="any" value={it.quantidade_nf} onChange={e => set({ quantidade_nf: e.target.value })} style={{ fontSize: 13, textAlign: 'center' }} />
                  <input value={it.unidade_nf} onChange={e => set({ unidade_nf: e.target.value.toUpperCase() })} style={{ fontSize: 12, width: 52, textAlign: 'center' }} title="Unidade da nota (CX, UN, PCT...)" />
                </div>
              </div>
              <div>
                <label style={lbl}>Valor de 1 {it.unidade_nf || 'item'}</label>
                <input type="number" min="0" step="0.01" value={it.custo_nf} onChange={e => set({ custo_nf: e.target.value })} style={{ fontSize: 13, textAlign: 'right' }} />
              </div>
            </div>
          </div>

          {/* 2. Quantas unidades de venda vêm dentro */}
          <div>
            <div style={rotulo}>2 · Quantas unidades vocês vendem de cada {it.unidade_nf || 'item'}?</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 13 }}>
              <span>1 {it.unidade_nf || 'item'} =</span>
              <input type="number" min="1" value={it.mult1} onChange={e => set({ mult1: e.target.value })} style={{ width: 80, textAlign: 'center' }} title="Ex.: 6 caixas" />
              <span>×</span>
              <input type="number" min="1" value={it.mult2} onChange={e => set({ mult2: e.target.value })} style={{ width: 80, textAlign: 'center' }} title="Ex.: 100 canetas em cada caixa" />
              <span>= <strong>{fator}</strong> unidade(s)</span>
              <span style={{ color: 'var(--text-3)' }}>→ total <strong style={{ color: 'var(--text-1, #1A1916)' }}>{unidades} un</strong> a {fmt(custoUn, custoUn < 1 ? 4 : 2)} cada</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>
              Ex.: "1 CX CANETA BIC C/6" com 100 canetas em cada caixinha → 6 × 100. Se vende do jeito que vem, deixe 1 × 1.
            </div>
            {it.dica && it.dica.fator !== fator && (
              <button type="button" onClick={() => set({ mult1: it.dica.fator, mult2: 1 })} style={{ marginTop: 6, fontSize: 12, background: '#FFFBEB', color: '#B45309', border: '1px solid #FCD34D', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Sparkles size={12} /> Sugestão: {it.dica.fator} por {it.unidade_nf} ({it.dica.motivo}) — usar
              </button>
            )}
          </div>

          {/* 3. Em qual produto entra */}
          <div>
            <div style={rotulo}>3 · Em qual produto do estoque entra</div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
              {[['existente', 'Produto que já existe'], ['novo', 'Cadastrar produto novo']].map(([m, t]) => (
                <button key={m} type="button" onClick={() => set({ modo: m })} style={{
                  padding: '5px 10px', borderRadius: 8, fontSize: 12, cursor: 'pointer',
                  background: it.modo === m ? '#1A1916' : 'white', color: it.modo === m ? 'white' : 'var(--text-2)',
                  border: `1px solid ${it.modo === m ? '#1A1916' : 'var(--border)'}`,
                }}>{t}</button>
              ))}
            </div>

            {it.modo === 'existente' ? (
              it.produto ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{it.produto.nome}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
                      EAN {it.produto.sku || '—'} · estoque {it.produto.quantidade} <ArrowRight size={10} style={{ verticalAlign: 'middle' }} /> <strong>{it.produto.quantidade + unidades}</strong>
                    </div>
                  </div>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => set({ produto: null, origem: null })}>Trocar</button>
                </div>
              ) : (
                <BuscaProduto onEscolher={p => set({ produto: p, origem: null, preco_venda: it.preco_venda || p.preco_venda })} />
              )
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8 }}>
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={lbl}>Nome do produto (como vende na loja)</label>
                  <input value={it.novo_nome} onChange={e => set({ novo_nome: e.target.value })} placeholder="Ex.: CANETA BIC CRISTAL PRETA" style={{ fontSize: 13 }} />
                </div>
                <div>
                  <label style={lbl}>EAN da unidade {fator > 1 && '(bipe a unidade)'}</label>
                  <input value={it.novo_ean} onChange={e => set({ novo_ean: e.target.value })} placeholder={fator === 1 ? (it.ean_nf || 'opcional') : 'opcional'} style={{ fontSize: 13, fontFamily: 'monospace' }} />
                </div>
                {categorias?.length > 1 && (
                  <div>
                    <label style={lbl}>Categoria</label>
                    <select value={it.categoria_id} onChange={e => set({ categoria_id: e.target.value })} style={{ fontSize: 13 }}>
                      <option value="">—</option>
                      {categorias.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                    </select>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 4. Preço de venda */}
          <div>
            <div style={rotulo}>4 · Preço de venda da unidade</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <input type="number" min="0" step="0.01" value={it.preco_venda} onChange={e => set({ preco_venda: e.target.value })} placeholder="0,00" style={{ width: 120, textAlign: 'right' }} />
              <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
                custo {fmt(custoUn, custoUn < 1 ? 4 : 2)}
                {margem !== null && <> · margem <strong style={{ color: margem < 30 ? 'var(--danger)' : 'var(--success)' }}>{Math.round(margem)}%</strong></>}
                {it.modo === 'existente' && it.produto && num(it.produto.preco_venda) !== preco && <> · antes {fmt(it.produto.preco_venda)}</>}
              </span>
              {custoUn > 0 && [1.5, 2, 2.5].map(m => (
                <button key={m} type="button" className="btn btn-secondary btn-sm" onClick={() => set({ preco_venda: (Math.ceil(custoUn * m * 10) / 10).toFixed(2) })}>
                  ×{String(m).replace('.', ',')}
                </button>
              ))}
            </div>
          </div>

          {it.ean_nf && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-2)', cursor: 'pointer' }}>
              <input type="checkbox" checked={it.lembrar} onChange={e => set({ lembrar: e.target.checked })} style={{ width: 'auto' }} />
              Lembrar: da próxima vez que o EAN {it.ean_nf} vier numa nota, já entrar como {fator} un de "{nomeDestino || '…'}"
            </label>
          )}
        </div>
      )}
    </div>
  )
}

const rotulo = { fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }
const lbl = { fontSize: 11 }

const formVazio = { numero_nf: '', fornecedor: '', data_emissao: hojeISO(), valor_total_nf: '' }
const RASCUNHO_KEY = 'cometa_entrada_rascunho_v2'

// ─── Página ──────────────────────────────────────────────────────────────────
export default function NotasFiscais() {
  const qc = useQueryClient()
  const fileRef = useRef(null)

  const [aba, setAba] = useState('historico')
  const [form, setForm] = useState(formVazio)
  const [itens, setItens] = useState([])
  const [analisando, setAnalisando] = useState(false)
  const [temRascunho, setTemRascunho] = useState(() => {
    try {
      localStorage.removeItem('cometa_entrada_rascunho') // formato antigo
      return !!localStorage.getItem(RASCUNHO_KEY)
    } catch { return false }
  })
  const [resultado, setResultado] = useState(null)
  const [notaAberta, setNotaAberta] = useState(null)

  const { data: categorias } = useQuery({ queryKey: ['categorias'], queryFn: () => api.get('/categorias').then(r => r.data) })
  const { data, isLoading } = useQuery({ queryKey: ['notas'], queryFn: () => api.get('/notas-fiscais').then(r => r.data) })
  const { data: detalhe } = useQuery({
    queryKey: ['nota', notaAberta],
    queryFn: () => api.get(`/notas-fiscais/${notaAberta}`).then(r => r.data),
    enabled: !!notaAberta,
  })

  // Rascunho automático
  useEffect(() => {
    if (aba !== 'nova' || !itens.length) return
    const t = setTimeout(() => {
      try { localStorage.setItem(RASCUNHO_KEY, JSON.stringify({ form, itens })) } catch { /* sem espaço */ }
    }, 600)
    return () => clearTimeout(t)
  }, [form, itens, aba])

  function continuarRascunho() {
    try {
      const { form: f, itens: i } = JSON.parse(localStorage.getItem(RASCUNHO_KEY))
      setForm(f); setItens(i); setAba('nova'); setTemRascunho(false)
    } catch { localStorage.removeItem(RASCUNHO_KEY); setTemRascunho(false) }
  }

  function descartar() {
    localStorage.removeItem(RASCUNHO_KEY)
    setForm(formVazio); setItens([]); setTemRascunho(false)
  }

  // Reconhece os itens (memória / EAN) e já preenche produto, fator e preço
  async function reconhecer(lista) {
    setAnalisando(true)
    try {
      const r = await api.post('/notas-fiscais/analisar', { itens: lista.map(i => ({ ean: i.ean_nf, ean_unidade: i.ean_unidade })) })
      return lista.map((it, idx) => {
        const s = r.data[idx]
        if (!s?.produto) {
          return novoItem({ ...it, mult1: it.dica?.fator || 1, novo_nome: it.nome_nf, novo_ean: it.dica && it.ean_unidade !== it.ean_nf ? it.ean_unidade : '' })
        }
        const fator = s.fator || (s.origem === 'ean_unidade' ? (it.dica?.fator || 1) : 1)
        return novoItem({
          ...it, modo: 'existente', produto: s.produto, origem: s.origem, mult1: fator, mult2: 1,
          preco_venda: s.produto.preco_venda, aberto: s.origem !== 'memoria', novo_nome: it.nome_nf,
        })
      })
    } catch {
      alert('Não foi possível reconhecer os produtos automaticamente. Preencha manualmente.')
      return lista.map(it => novoItem({ ...it, mult1: it.dica?.fator || 1, novo_nome: it.nome_nf }))
    } finally {
      setAnalisando(false)
    }
  }

  function handleXML(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const reader = new FileReader()
    reader.onload = async ev => {
      let parsed
      try { parsed = parseNFe(ev.target.result) } catch { alert('Erro ao ler o XML.'); return }
      if (!parsed.form.numero_nf || !parsed.itens.length) { alert('XML inválido ou sem produtos.'); return }
      setForm(parsed.form)
      setAba('nova')
      setItens(await reconhecer(parsed.itens))
    }
    reader.readAsText(file, 'UTF-8')
  }

  const lancar = useMutation({
    mutationFn: forcar => api.post('/notas-fiscais/entrada', {
      ...form,
      valor_total_nf: num(form.valor_total_nf),
      forcar: !!forcar,
      itens: itens.map(it => ({
        nome_nf: it.nome_nf.trim(),
        ean_nf: it.ean_nf || null,
        quantidade_nf: num(it.quantidade_nf),
        custo_nf: num(it.custo_nf),
        fator: fatorDe(it),
        produto_id: it.modo === 'existente' ? it.produto?.id : null,
        novo_nome: it.modo === 'novo' ? it.novo_nome.trim() : null,
        novo_ean: it.modo === 'novo' ? (it.novo_ean || null) : null,
        categoria_id: it.modo === 'novo' && it.categoria_id ? parseInt(it.categoria_id) : null,
        preco_venda: num(it.preco_venda),
        lembrar: it.lembrar,
      })),
    }),
    onSuccess: r => {
      setResultado(r.data.resumo)
      descartar()
      setAba('historico')
      qc.invalidateQueries({ queryKey: ['notas'] })
      qc.invalidateQueries({ queryKey: ['produtos'] })
    },
    onError: err => {
      const d = err?.response?.data
      if (err?.response?.status === 409 && d?.duplicada) {
        if (confirm(`${d.message}\n\nLançar de novo mesmo assim? O estoque será somado outra vez.`)) lancar.mutate(true)
        return
      }
      alert(d?.errors ? Object.values(d.errors).flat().join('\n') : (d?.message || 'Erro ao lançar a nota.'))
    },
  })

  const pendentes = itens.map((it, i) => ({ i, p: problemasDo(it) })).filter(x => x.p.length)
  const totalNota = itens.reduce((s, it) => s + num(it.quantidade_nf) * num(it.custo_nf), 0)
  const totalUn = itens.reduce((s, it) => s + unidadesDe(it), 0)
  const notas = data?.data || []

  return (
    <div style={{ padding: 16 }} className="page-enter">
      <PageHeader
        title="Entrada de Mercadoria"
        subtitle="Lance a nota do fornecedor e o estoque entra na unidade em que vocês vendem"
        actions={
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {temRascunho && aba === 'historico' && (
              <button className="btn btn-secondary" onClick={continuarRascunho}><Save size={14} /> Continuar rascunho</button>
            )}
            {aba === 'historico' ? (
              <>
                <button className="btn btn-primary" onClick={() => fileRef.current?.click()}><Upload size={14} /> Importar XML da nota</button>
                <button className="btn btn-secondary" onClick={() => { setForm(formVazio); setItens([novoItem()]); setAba('nova') }}><Plus size={14} /> Lançar à mão</button>
              </>
            ) : (
              <button className="btn btn-secondary" onClick={() => setAba('historico')}>Ver histórico</button>
            )}
          </div>
        }
      />
      <input ref={fileRef} type="file" accept=".xml" style={{ display: 'none' }} onChange={handleXML} />

      {resultado && (
        <div className="card" style={{ marginBottom: 14, background: 'var(--success-bg)', border: '1px solid #A7F3D0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <strong style={{ color: 'var(--success)' }}>✓ Entrada lançada</strong>
            <button onClick={() => setResultado(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={14} /></button>
          </div>
          {resultado.map((r, i) => (
            <div key={i} style={{ fontSize: 12 }}>+{r.unidades} un · {r.produto} <span style={{ color: 'var(--text-3)' }}>(estoque agora {r.estoque})</span></div>
          ))}
        </div>
      )}

      {aba === 'nova' && (
        <div>
          <div className="card" style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700 }}>Dados da nota</h3>
              <button onClick={() => fileRef.current?.click()} className="btn btn-secondary btn-sm"><Upload size={13} /> Trocar XML</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 10 }}>
              <div className="form-group" style={{ margin: 0 }}><label>Número da NF</label>
                <input placeholder="S/N" value={form.numero_nf} onChange={e => setForm(f => ({ ...f, numero_nf: e.target.value }))} /></div>
              <div className="form-group" style={{ margin: 0 }}><label>Fornecedor</label>
                <input value={form.fornecedor} onChange={e => setForm(f => ({ ...f, fornecedor: e.target.value }))} /></div>
              <div className="form-group" style={{ margin: 0 }}><label>Data</label>
                <input type="date" value={form.data_emissao} onChange={e => setForm(f => ({ ...f, data_emissao: e.target.value }))} /></div>
              <div className="form-group" style={{ margin: 0 }}><label>Valor total da NF</label>
                <input type="number" step="0.01" value={form.valor_total_nf} onChange={e => setForm(f => ({ ...f, valor_total_nf: e.target.value }))} /></div>
            </div>
          </div>

          <div className="card" style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700 }}>
                Itens ({itens.length}) {analisando && <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-3)' }}>· reconhecendo produtos...</span>}
              </h3>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn btn-secondary btn-sm" onClick={() => setItens(is => is.map(i => ({ ...i, aberto: false })))}>Recolher todos</button>
                <button className="btn btn-secondary btn-sm" onClick={() => setItens(is => [...is, novoItem()])}><Plus size={13} /> Adicionar item</button>
              </div>
            </div>
            {itens.map((it, idx) => (
              <LinhaNota key={it.key} it={it} categorias={categorias}
                onChange={novo => setItens(is => is.map((x, j) => j === idx ? novo : x))}
                onRemove={() => setItens(is => is.filter((_, j) => j !== idx))} />
            ))}
            {!itens.length && <p style={{ color: 'var(--text-3)', fontSize: 13 }}>Nenhum item.</p>}
          </div>

          <div className="card" style={{ position: 'sticky', bottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', boxShadow: '0 -4px 16px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize: 13 }}>
              <strong>{totalUn}</strong> unidades · custo {fmt(totalNota)}
              {num(form.valor_total_nf) > 0 && Math.abs(num(form.valor_total_nf) - totalNota) > 0.05 && (
                <span style={{ color: 'var(--text-3)' }}> (total da NF {fmt(form.valor_total_nf)} — inclui impostos/frete)</span>
              )}
              {pendentes.length > 0 && <div style={{ color: '#B45309', fontSize: 12 }}>{pendentes.length} item(ns) incompleto(s) — veja os destacados em amarelo</div>}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-secondary" onClick={() => { if (confirm('Descartar esta entrada?')) { descartar(); setAba('historico') } }}>Descartar</button>
              <button className="btn btn-primary btn-lg" disabled={!itens.length || pendentes.length > 0 || lancar.isPending || analisando}
                onClick={() => { if (confirm(`Lançar ${itens.length} item(ns) — ${totalUn} unidades — no estoque?`)) lancar.mutate(false) }}>
                <Check size={15} /> {lancar.isPending ? 'Lançando...' : 'Lançar no estoque'}
              </button>
            </div>
          </div>
        </div>
      )}

      {aba === 'historico' && (
        <div className="card" style={{ padding: 0, overflow: 'auto' }}>
          {isLoading ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-3)' }}>Carregando...</div>
          ) : notas.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)' }}>
              <Package size={40} style={{ marginBottom: 12, opacity: 0.3 }} />
              <p>Nenhuma entrada registrada ainda.</p>
            </div>
          ) : (
            <table>
              <thead>
                <tr><th>NF / Fornecedor</th><th>Data</th><th style={{ textAlign: 'center' }}>Itens</th><th style={{ textAlign: 'right' }}>Valor</th><th style={{ textAlign: 'center' }}>Status</th></tr>
              </thead>
              <tbody>
                {notas.map(nf => (
                  <Fragment key={nf.id}>
                    <tr onClick={() => setNotaAberta(notaAberta === nf.id ? null : nf.id)} style={{ cursor: 'pointer' }}>
                      <td>
                        <div style={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
                          {notaAberta === nf.id ? <ChevronDown size={13} /> : <ChevronRight size={13} />}{nf.fornecedor}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'monospace', marginLeft: 19 }}>NF {nf.numero_nf}</div>
                      </td>
                      <td style={{ color: 'var(--text-2)', fontSize: 12 }}>
                        {nf.data_emissao ? new Date(String(nf.data_emissao).split('T')[0] + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}
                      </td>
                      <td style={{ textAlign: 'center', fontSize: 12 }}>{nf.itens_count}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(nf.valor_total_nf)}</td>
                      <td style={{ textAlign: 'center' }}>
                        <span className={`badge ${nf.status === 'confirmada' ? 'badge-success' : 'badge-warning'}`} title={nf.status === 'rascunho' ? 'Lançada pela tela antiga: o registro da nota não foi concluído' : ''}>
                          {nf.status === 'confirmada' ? 'lançada' : 'não concluída'}
                        </span>
                      </td>
                    </tr>
                    {notaAberta === nf.id && (
                      <tr>
                        <td colSpan={5} style={{ background: 'var(--surface)', padding: 12 }}>
                          {!detalhe ? 'Carregando...' : (
                            <table style={{ fontSize: 12 }}>
                              <thead><tr><th>Como veio na nota</th><th style={{ textAlign: 'center' }}>Entrou</th><th>Produto no estoque</th><th style={{ textAlign: 'right' }}>Custo/un</th><th style={{ textAlign: 'right' }}>Venda</th></tr></thead>
                              <tbody>
                                {detalhe.itens.map(i => (
                                  <tr key={i.id}>
                                    <td>{i.quantidade} × {i.nome_produto}<div style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'monospace' }}>{i.sku}</div></td>
                                    <td style={{ textAlign: 'center' }}>{i.unidades_entrada ?? i.quantidade}{i.fator > 1 && <div style={{ fontSize: 10, color: 'var(--text-3)' }}>× {i.fator}</div>}</td>
                                    <td>{i.produto?.nome || <span style={{ color: 'var(--text-3)' }}>—</span>}</td>
                                    <td style={{ textAlign: 'right' }}>{fmt(i.custo_unidade ?? i.custo_unitario, 2)}</td>
                                    <td style={{ textAlign: 'right' }}>{fmt(i.preco_venda)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
