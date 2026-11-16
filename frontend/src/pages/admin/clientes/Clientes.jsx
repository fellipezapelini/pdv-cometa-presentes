import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, Plus, UserPlus, X, DollarSign, ChevronDown, ChevronRight, FolderOpen, Folder, Printer } from 'lucide-react'
import PageHeader from '../../../components/PageHeader'
import Modal from '../../../components/Modal'
import api from '../../../api/client'

function fmt(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)
}

function gerarReciboPagamento(cliente, valor, forma, descricao, dataCustom) {
  const data = dataCustom || new Date().toLocaleString('pt-BR')
  const formaStr = { dinheiro: 'Dinheiro', pix: 'PIX', debito: 'Cartão Débito', credito: 'Cartão Crédito' }[forma] || forma
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Recibo</title>
  <style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Courier New', monospace; width: 80mm; max-width: 80mm; margin: 0 auto; padding: 4mm 3mm; font-size: 11px; line-height: 1.6; }
  h2 { text-align: center; font-size: 13px; margin-bottom: 2px; }
  .sub { text-align: center; font-size: 10px; color: #333; margin-bottom: 6px; }
  hr { border: none; border-top: 1px dashed #000; margin: 6px 0; }
  .titulo { font-size: 12px; font-weight: bold; text-align: center; margin: 6px 0; text-transform: uppercase; letter-spacing: 1px; }
  .linha { display: flex; justify-content: space-between; margin: 3px 0; font-size: 11px; }
  .total { font-size: 15px; font-weight: bold; text-align: right; margin-top: 6px; }
  .rodape { text-align: center; font-size: 10px; color: #555; margin-top: 10px; }
  @media print { @page { size: 80mm auto; margin: 0; } body { width: 80mm; padding: 4mm 3mm; } }
  </style></head><body>
  <h2>Cometa Papelaria & Presentes</h2>
  <div class="sub">Av. Londrina, 323 · Ibiporã-PR</div>
  <hr>
  <div class="titulo">✓ Recibo de Pagamento</div>
  <hr>
  <div class="linha"><span>Data:</span><span>${data}</span></div>
  <div class="linha"><span>Cliente:</span><span>${cliente}</span></div>
  <div class="linha"><span>Forma:</span><span>${formaStr}</span></div>
  ${descricao ? `<div class="linha"><span>Ref.:</span><span>${descricao}</span></div>` : ''}
  <hr>
  <div class="total">VALOR PAGO: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor)}</div>
  <hr>
  <div class="rodape">Obrigado pelo pagamento!<br>Cometa Presentes · Ibiporã-PR</div>
  </body></html>`
  const win = window.open('', '_blank')
  win.document.write(html)
  win.document.close()
  setTimeout(() => win.print(), 500)
}

// ─── Lançamentos do fiado: natureza, data real, histórico ─────────────────
function hojeISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function dataDoLancamento(l) {
  if (l.data_lancamento) return formatarDataBR(String(l.data_lancamento))
  return new Date(l.created_at).toLocaleDateString('pt-BR')
}

function erroApi(err, padrao = 'Não foi possível salvar.') {
  const d = err?.response?.data
  if (d?.errors) return Object.values(d.errors).flat().join('\n')
  return d?.message || padrao
}

const NATUREZAS = {
  compra:        { label: 'Compra',        bg: '#FEF2F2', fg: '#B91C1C' },
  pagamento:     { label: 'Pagamento',     bg: '#ECFDF5', fg: '#047857' },
  transferencia: { label: 'Transferência', bg: '#EEF2FF', fg: '#4338CA' },
  ajuste:        { label: 'Ajuste',        bg: '#FFFBEB', fg: '#B45309' },
  estorno:       { label: 'Estorno',       bg: '#F3F4F6', fg: '#4B5563' },
}

function naturezaDe(l) {
  return l.natureza || (l.tipo === 'credito' ? 'pagamento' : 'compra')
}

function BadgeNatureza({ l }) {
  const n = NATUREZAS[naturezaDe(l)] || NATUREZAS.compra
  return (
    <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 6, background: n.bg, color: n.fg, whiteSpace: 'nowrap' }}>
      {n.label}
    </span>
  )
}

const btnIcone = { background: 'none', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', fontSize: 11, padding: '2px 6px', color: 'var(--text-2)' }
const btnLink = { background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'DM Sans', fontSize: 13, padding: 0, textDecoration: 'underline', textAlign: 'left' }

function HistoricoLancamentos({ lancamentos, mostrarPessoa, onVenda, onPagamento, onEditar, onEstornar }) {
  const colunas = mostrarPessoa ? 5 : 4
  return (
    <table>
      <thead>
        <tr>
          <th>Data</th>
          {mostrarPessoa && <th>Pessoa</th>}
          <th>Descrição</th>
          <th style={{ textAlign: 'right' }}>Valor</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {lancamentos.map(l => {
          const natureza = naturezaDe(l)
          const podeEstornar = !l.estornado && natureza !== 'estorno' && !l.venda_id
          const riscado = l.estornado ? { textDecoration: 'line-through', opacity: 0.55 } : {}
          return (
            <tr key={l.id}>
              <td style={{ fontSize: 12, color: 'var(--text-3)', whiteSpace: 'nowrap', ...riscado }}>{dataDoLancamento(l)}</td>
              {mostrarPessoa && <td style={{ fontSize: 12, ...riscado }}>{l.cliente?.nome}</td>}
              <td>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', ...riscado }}>
                  <BadgeNatureza l={l} />
                  {l.venda_id && l.venda ? (
                    <button onClick={() => onVenda(l.venda)} style={{ ...btnLink, color: 'var(--brand)' }}>
                      Venda #{l.venda_id} ({l.venda.itens?.length || 0} itens)
                    </button>
                  ) : natureza === 'pagamento' ? (
                    <button onClick={() => onPagamento(l)} style={{ ...btnLink, color: 'var(--success)' }}>
                      {l.descricao || 'Pagamento'}
                    </button>
                  ) : (
                    <span style={{ fontSize: 13 }}>{l.descricao || '—'}</span>
                  )}
                </div>
                {l.observacao && <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>📝 {l.observacao}</div>}
                {l.estornado && <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 2 }}>↩ estornado</div>}
              </td>
              <td style={{ textAlign: 'right', fontWeight: 600, whiteSpace: 'nowrap', color: l.tipo === 'debito' ? 'var(--danger)' : 'var(--success)', ...riscado }}>
                {l.tipo === 'debito' ? '+' : '-'}{fmt(l.valor)}
              </td>
              <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                <button title="Corrigir data / descrição" style={btnIcone} onClick={() => onEditar(l)}>✏️</button>
                {podeEstornar && (
                  <button title="Estornar (desfazer) este lançamento" style={{ ...btnIcone, marginLeft: 4 }} onClick={() => onEstornar(l)}>↩</button>
                )}
              </td>
            </tr>
          )
        })}
        {!lancamentos.length && <tr><td colSpan={colunas} style={{ textAlign: 'center', color: 'var(--text-3)', padding: 20 }}>Nenhum lançamento.</td></tr>}
      </tbody>
    </table>
  )
}

function initials(nome) {
  return nome?.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase() || '?'
}

function TagEnvelope({ c }) {
  if (c.e_titular && c.tem_fiado) return <span style={{ fontSize: 10, color: 'var(--brand)', fontWeight: 600 }}>📁 Envelope próprio (titular)</span>
  if (c.envelope_titular_nome) return <span style={{ fontSize: 10, color: 'var(--text-3)' }}>📄 Envelope de <strong>{c.envelope_titular_nome}</strong></span>
  return null
}

// ─── PIX + impressão de carnê ──────────────────────────────────────────
function gerarPayloadPix({ chave, nome, cidade, valor, txid }) {
  function tlv(id, value) {
    const len = String(value.length).padStart(2, '0')
    return `${id}${len}${value}`
  }
  const merchantAccount = tlv('00', 'br.gov.bcb.pix') + tlv('01', chave)
  const valorStr = valor.toFixed(2)
  let payload =
    tlv('00', '01') + tlv('26', merchantAccount) + tlv('52', '0000') +
    tlv('53', '986') + tlv('54', valorStr) + tlv('58', 'BR') +
    tlv('59', nome.substring(0, 25)) + tlv('60', cidade.substring(0, 15)) +
    tlv('62', tlv('05', txid.substring(0, 25))) + '6304'
  function crc16(str) {
    let crc = 0xFFFF
    for (let i = 0; i < str.length; i++) {
      crc ^= str.charCodeAt(i) << 8
      for (let j = 0; j < 8; j++) {
        crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1)
        crc &= 0xFFFF
      }
    }
    return crc.toString(16).toUpperCase().padStart(4, '0')
  }
  payload += crc16(payload)
  return payload
}

const PIX_CHAVE = '07683355000171'
const PIX_NOME = 'COMETA PRESENTES'
const PIX_CIDADE = 'IBIPORA'
const CNPJ_FORMATADO = '07.683.355/0001-71'

function limparNomeCliente(nome) {
  return (nome || '').replace(/\s*\([^)]*\)/g, '').trim()
}

function formatarDataBR(dataStr) {
  if (!dataStr) return '—'
  const soData = dataStr.split('T')[0]
  const [ano, mes, dia] = soData.split('-')
  if (!ano || !mes || !dia) return '—'
  return `${dia}/${mes}/${ano}`
}

function imprimirCarne(venda, clienteNomeCompleto) {
  const parcelas = venda.parcelas || []
  const clienteNome = limparNomeCliente(clienteNomeCompleto)
  const itens = venda.itens || []
  const itensHTML = itens.map(i =>
    `<div class="item-linha">• ${i.quantidade}x ${i.produto?.nome || i.nome_avulso || 'Item'}</div>`
  ).join('')

  const paginasHTML = parcelas.map(p => {
    const txid = `CARNE${venda.id}P${p.numero}`.substring(0, 25)
    const payloadPix = gerarPayloadPix({ chave: PIX_CHAVE, nome: PIX_NOME, cidade: PIX_CIDADE, valor: parseFloat(p.valor), txid })
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(payloadPix)}`
    const valorFmt = fmt(p.valor)
    return `
    <div class="folha">
      <div class="parte-principal">
        <div class="cabecalho">
          <div class="cabecalho-loja">
            <div class="loja-nome">⭐ COMETA PRESENTES</div>
            <div class="loja-endereco">Av. Londrina, 323 · Ibiporã-PR</div>
            <div class="loja-endereco">CNPJ: ${CNPJ_FORMATADO}</div>
          </div>
          <div class="cabecalho-parcela">
            <div class="parcela-numero">PARCELA ${p.numero}/${parcelas.length}</div>
            <div class="venda-numero">Venda #${venda.id}</div>
          </div>
        </div>
        <div class="corpo">
          <div class="corpo-esquerda">
            <div class="campo"><span class="campo-label">CLIENTE</span><span class="campo-valor">${clienteNome}</span></div>
            <div class="campo"><span class="campo-label">VENCIMENTO</span><span class="campo-valor campo-vencimento">${formatarDataBR(p.vencimento)}</span></div>
            <div class="campo"><span class="campo-label">ITENS COMPRADOS</span><div class="itens-lista">${itensHTML}</div></div>
            <div class="assinatura-area"><div class="assinatura-linha"></div><div class="assinatura-texto">Assinatura do cliente</div></div>
          </div>
          <div class="corpo-direita">
            <div class="valor-destaque"><div class="valor-label">VALOR DA PARCELA</div><div class="valor-numero">${valorFmt}</div></div>
            <div class="pix-box">
              <img src="${qrUrl}" alt="QR Code PIX" class="qr-img" />
              <div class="pix-texto">Escaneie para pagar via PIX</div>
              <div class="pix-chave">Chave (CNPJ): ${CNPJ_FORMATADO}</div>
            </div>
          </div>
        </div>
      </div>
      <div class="linha-corte">✂ - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -</div>
      <div class="canhoto">
        <div class="canhoto-item"><strong>Cometa Presentes</strong> — controle interno</div>
        <div class="canhoto-item">Cliente: ${clienteNome}</div>
        <div class="canhoto-item">Parcela ${p.numero}/${parcelas.length} · Venc: ${formatarDataBR(p.vencimento)} · Valor: ${valorFmt}</div>
        <div class="canhoto-item">Pago em: _____/_____/________ &nbsp;&nbsp; Forma: ☐Dinheiro ☐PIX ☐Débito ☐Crédito</div>
      </div>
    </div>
  `}).join('')

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Carnê — ${clienteNome}</title>
  <style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Arial', sans-serif; color: #1A1916; }
  .folha { width: 100%; page-break-after: always; padding: 14mm 12mm; }
  .folha:last-child { page-break-after: auto; }
  .cabecalho { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #E8400A; padding-bottom: 12px; margin-bottom: 16px; }
  .loja-nome { font-weight: 800; font-size: 20px; }
  .loja-endereco { font-size: 11px; color: #666; margin-top: 2px; }
  .cabecalho-parcela { text-align: right; }
  .parcela-numero { background: #E8400A; color: white; font-weight: 700; font-size: 13px; padding: 5px 14px; border-radius: 20px; display: inline-block; }
  .venda-numero { font-size: 11px; color: #666; margin-top: 6px; }
  .corpo { display: flex; gap: 24px; margin-bottom: 20px; }
  .corpo-esquerda { flex: 1.3; }
  .corpo-direita { flex: 1; }
  .campo { margin-bottom: 14px; }
  .campo-label { display: block; font-size: 10px; font-weight: 700; color: #999; letter-spacing: 0.06em; margin-bottom: 3px; }
  .campo-valor { font-size: 15px; font-weight: 600; }
  .campo-vencimento { color: #E8400A; }
  .itens-lista { margin-top: 4px; }
  .item-linha { font-size: 13px; padding: 2px 0; }
  .assinatura-area { margin-top: 30px; }
  .assinatura-linha { border-bottom: 1.5px solid #333; width: 80%; margin-bottom: 4px; }
  .assinatura-texto { font-size: 10px; color: #666; }
  .valor-destaque { background: #FFF4EF; border: 2px solid #E8400A; border-radius: 12px; padding: 14px; text-align: center; margin-bottom: 16px; }
  .valor-label { font-size: 10px; font-weight: 700; color: #999; letter-spacing: 0.06em; }
  .valor-numero { font-size: 28px; font-weight: 800; color: #E8400A; margin-top: 4px; }
  .pix-box { text-align: center; border: 1px solid #ddd; border-radius: 12px; padding: 14px; }
  .qr-img { width: 150px; height: 150px; }
  .pix-texto { font-size: 11px; font-weight: 600; margin-top: 8px; }
  .pix-chave { font-size: 10px; color: #666; margin-top: 3px; }
  .linha-corte { text-align: center; font-size: 10px; color: #aaa; margin: 14px 0; letter-spacing: 1px; }
  .canhoto { border: 1.5px dashed #ccc; border-radius: 8px; padding: 10px 14px; font-size: 11px; color: #555; }
  .canhoto-item { padding: 2px 0; }
  @media print { @page { size: A4; margin: 0; } .folha { page-break-after: always; } }
  </style></head><body>${paginasHTML}</body></html>`

  const win = window.open('', '_blank')
  win.document.write(html)
  win.document.close()
  setTimeout(() => win.print(), 800)
}

export default function Clientes() {
  const [modalVenda, setModalVenda] = useState(null)
  const [modalEditar, setModalEditar] = useState(null)
  const [formEditar, setFormEditar] = useState({ nome: '', cpf: '', telefone: '' })
  const [membroSelecionado, setMembroSelecionado] = useState(null)
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [pastaAberta, setPastaAberta] = useState(false)
  const [envelopeAberto, setEnvelopeAberto] = useState(null)
  const [modalNovo, setModalNovo] = useState(false)
  const [modalFiado, setModalFiado] = useState(null)
  const [modalDebito, setModalDebito] = useState(false)
  const [modalVincular, setModalVincular] = useState(false)
  const [form, setForm] = useState({ nome: '', cpf: '', telefone: '' })
  const [pagamento, setPagamento] = useState({ valor: '', cliente_id: '', data: hojeISO() })
  const [debito, setDebito] = useState({ valor: '', descricao: 'Saldo inicial migrado', cliente_id: '', data: hojeISO() })
  const [modalTransferir, setModalTransferir] = useState(false)
  const [transf, setTransf] = useState({ origem_id: '', destino_id: '', valor: '', data: hojeISO(), observacao: '' })
  const [modalAjuste, setModalAjuste] = useState(false)
  const [ajuste, setAjuste] = useState({ cliente_id: '', tipo: 'credito', valor: '', data: hojeISO(), observacao: '' })
  const [editLanc, setEditLanc] = useState(null)
  const [buscaVincular, setBuscaVincular] = useState('')
  const [resultadosVincular, setResultadosVincular] = useState([])
  const vincularTimer = useRef(null)
  const [formaPagamento, setFormaPagamento] = useState('dinheiro')
  const [ultimoPagamento, setUltimoPagamento] = useState(null)
  const [modalPagamento, setModalPagamento] = useState(null)
  const [reimprimindoCarne, setReimprimindoCarne] = useState(null)

  const { data, isLoading } = useQuery({
    queryKey: ['clientes', search],
    queryFn: () => api.get('/clientes', { params: { search } }).then(r => r.data),
  })

  const { data: dataTitulares } = useQuery({
    queryKey: ['titulares', search],
    queryFn: () => api.get('/clientes', { params: { search, apenas_titulares: 1, per_page: 500 } }).then(r => r.data),
  })

  const { data: carnesCliente } = useQuery({
    queryKey: ['carnes-cliente', modalFiado?.id],
    queryFn: () => api.get('/parcelas', { params: { cliente_id: modalFiado.id } }).then(r => r.data),
    enabled: !!modalFiado?.id,
  })

  const { data: fiado } = useQuery({
    queryKey: ['fiado', modalFiado?.id],
    queryFn: () => api.get(`/clientes/${modalFiado.id}/fiado`).then(r => r.data),
    enabled: !!modalFiado?.id,
  })

  const { data: clienteDetalhe } = useQuery({
    queryKey: ['cliente-detalhe', modalFiado?.id],
    queryFn: () => api.get(`/clientes/${modalFiado.id}`).then(r => r.data),
    enabled: !!modalFiado?.id,
    staleTime: 0,
  })

  const atualizarCliente = useMutation({
    mutationFn: d => api.put(`/clientes/${modalEditar.id}`, d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clientes'] })
      qc.invalidateQueries({ queryKey: ['titulares'] })
      setModalEditar(null)
    },
  })

  const criarCliente = useMutation({
    mutationFn: d => api.post('/clientes', d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['clientes'] }); setModalNovo(false); setForm({ nome: '', cpf: '', telefone: '' }) },
  })

  // Depois de qualquer mexida no fiado, recarrega todas as contas abertas e os relatórios
  function recarregarFiado() {
    qc.invalidateQueries({ queryKey: ['fiado'] })
    qc.invalidateQueries({ queryKey: ['clientes'] })
    qc.invalidateQueries({ queryKey: ['recebimentos'] })
  }

  const pagar = useMutation({
    mutationFn: () => api.post(`/clientes/${modalFiado.id}/fiado/pagamento`, {
      valor: parseFloat(pagamento.valor),
      cliente_id: pagamento.cliente_id || null,
      forma_pagamento: formaPagamento,
      data: pagamento.data || null,
    }),
    onSuccess: () => {
      const pessoa = pessoasDaConta.find(p => String(p.id) === String(pagamento.cliente_id))
      setUltimoPagamento({ valor: parseFloat(pagamento.valor), forma: formaPagamento, data: pagamento.data, nome: pessoa?.nome })
      recarregarFiado()
      setPagamento({ valor: '', cliente_id: '', data: hojeISO() })
    },
    onError: err => alert(erroApi(err)),
  })

  const lancarDebito = useMutation({
    mutationFn: () => api.post(`/clientes/${modalFiado.id}/fiado/debito`, {
      valor: parseFloat(debito.valor), descricao: debito.descricao,
      cliente_id: debito.cliente_id || null, data: debito.data || null,
    }),
    onSuccess: () => {
      recarregarFiado()
      setModalDebito(false)
      setDebito({ valor: '', descricao: 'Saldo inicial migrado', cliente_id: '', data: hojeISO() })
    },
    onError: err => alert(erroApi(err)),
  })

  const transferir = useMutation({
    mutationFn: () => api.post('/fiado/transferencia', {
      origem_id: transf.origem_id, destino_id: transf.destino_id,
      valor: parseFloat(transf.valor), data: transf.data || null, observacao: transf.observacao || null,
    }),
    onSuccess: () => {
      recarregarFiado()
      setModalTransferir(false)
      setTransf({ origem_id: '', destino_id: '', valor: '', data: hojeISO(), observacao: '' })
    },
    onError: err => alert(erroApi(err)),
  })

  const ajustar = useMutation({
    mutationFn: () => api.post(`/clientes/${modalFiado.id}/fiado/ajuste`, {
      cliente_id: ajuste.cliente_id || null, tipo: ajuste.tipo,
      valor: parseFloat(ajuste.valor), data: ajuste.data || null, observacao: ajuste.observacao,
    }),
    onSuccess: () => {
      recarregarFiado()
      setModalAjuste(false)
      setAjuste({ cliente_id: '', tipo: 'credito', valor: '', data: hojeISO(), observacao: '' })
    },
    onError: err => alert(erroApi(err)),
  })

  const editarLancamento = useMutation({
    mutationFn: () => api.put(`/fiado/lancamentos/${editLanc.id}`, {
      data_lancamento: editLanc.data_lancamento,
      descricao: editLanc.descricao,
      observacao: editLanc.observacao || null,
      ...(naturezaDe(editLanc) === 'pagamento' ? { forma_pagamento: editLanc.forma_pagamento || null } : {}),
    }),
    onSuccess: () => { recarregarFiado(); setEditLanc(null) },
    onError: err => alert(erroApi(err)),
  })

  const estornar = useMutation({
    mutationFn: ({ id, motivo }) => api.post(`/fiado/lancamentos/${id}/estornar`, { motivo }),
    onSuccess: () => recarregarFiado(),
    onError: err => alert(erroApi(err)),
  })

  function pedirEstorno(l) {
    const extra = naturezaDe(l) === 'transferencia' ? '\nA transferência será desfeita nas duas pessoas.' : ''
    const motivo = prompt(`Estornar "${l.descricao || naturezaDe(l)}" de ${fmt(l.valor)}?${extra}\n\nO lançamento continua no histórico, riscado. Informe o motivo:`)
    if (motivo === null) return
    if (motivo.trim().length < 3) { alert('Informe o motivo do estorno.'); return }
    estornar.mutate({ id: l.id, motivo: motivo.trim() })
  }

  function abrirEdicao(l) {
    setEditLanc({
      ...l,
      data_lancamento: l.data_lancamento ? String(l.data_lancamento).split('T')[0] : String(l.created_at).split('T')[0],
      descricao: l.descricao || '',
      observacao: l.observacao || '',
      forma_pagamento: l.forma_pagamento || '',
    })
  }

  const { data: fiadoMembro, isError: erroMembro } = useQuery({
    queryKey: ['fiado', membroSelecionado?.id],
    queryFn: () => api.get(`/clientes/${membroSelecionado.id}/fiado`).then(r => r.data),
    enabled: !!membroSelecionado?.id,
    retry: false,
  })

  const vincular = useMutation({
    mutationFn: (dependenteId) => api.post(`/clientes/${modalFiado.id}/dependentes`, { dependente_id: dependenteId }),
    onSuccess: async () => {
      setModalVincular(false); setBuscaVincular(''); setResultadosVincular([])
      await qc.invalidateQueries({ queryKey: ['cliente-detalhe'] })
      setTimeout(() => qc.refetchQueries({ queryKey: ['cliente-detalhe', modalFiado.id] }), 200)
    },
  })

  const desvincular = useMutation({
    mutationFn: (dependenteId) => api.delete(`/clientes/${modalFiado.id}/dependentes/${dependenteId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cliente-detalhe', modalFiado.id] }),
  })

  function handleBuscaVincular(v) {
    setBuscaVincular(v)
    clearTimeout(vincularTimer.current)
    if (v.length < 2) { setResultadosVincular([]); return }
    vincularTimer.current = setTimeout(async () => {
      const r = await api.get('/clientes', { params: { search: v } })
      const jaVinculados = clienteDetalhe?.dependentes?.map(d => d.id) || []
      setResultadosVincular((r.data.data || []).filter(c => c.id !== modalFiado?.id && !jaVinculados.includes(c.id)))
    }, 300)
  }

  const cancelarVenda = useMutation({
    mutationFn: (vendaId) => api.delete(`/vendas/${vendaId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['carnes-cliente'] })
      qc.invalidateQueries({ queryKey: ['fiado'] })
      qc.invalidateQueries({ queryKey: ['clientes'] })
    },
  })

  async function handleReimprimirCarne(vendaId, clienteNome) {
    setReimprimindoCarne(vendaId)
    try {
      const r = await api.get(`/vendas/${vendaId}`)
      imprimirCarne(r.data, clienteNome)
    } catch {
      alert('Erro ao buscar dados do carnê.')
    }
    setReimprimindoCarne(null)
  }

  const clientes = data?.data || []
  const titulares = dataTitulares?.data || []
  const semFiado = clientes.filter(c => !c.tem_fiado)
  const dependentes = clienteDetalhe?.dependentes || []
  const saldoTitular = fiado?.conta?.titular_id === modalFiado?.id
    ? parseFloat(fiado?.conta?.saldo_devedor || 0)
    : parseFloat(fiado?.saldo_por_pessoa?.find(p => p.cliente.id === modalFiado?.id)?.saldo || 0)
  const pessoasDaConta = fiado ? [
    { id: modalFiado?.id, nome: modalFiado?.nome, isTitular: true, saldo: saldoTitular },
    ...dependentes.map(d => ({
      id: d.id, nome: d.nome, isTitular: false,
      saldo: parseFloat(fiado.saldo_dependentes?.[d.id] ?? fiado.saldo_por_pessoa?.find(p => p.cliente.id === d.id)?.saldo ?? 0),
    })),
  ] : []
  const nomePessoa = p => `${p.nome}${p.isTitular ? ' (titular)' : ''} — ${fmt(p.saldo)}`
  const origemTransf = pessoasDaConta.find(p => String(p.id) === String(transf.origem_id))

  return (
    <div style={{ padding: 32 }} className="page-enter">
      <PageHeader title="Clientes & Fiado" subtitle="Gerenciar clientes e contas fiado"
        actions={<button className="btn btn-primary" onClick={() => setModalNovo(true)}><Plus size={14} /> Novo cliente</button>}
      />

      <div style={{ position: 'relative', maxWidth: 340, marginBottom: 28 }}>
        <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }} />
        <input placeholder="Buscar por nome ou CPF..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 32 }} />
      </div>

      {isLoading ? <div style={{ textAlign: 'center', color: 'var(--text-3)', padding: 32 }}>Carregando...</div> : (
        <>
          <div style={{ marginBottom: 32 }}>
            <div onClick={() => setPastaAberta(p => !p)} style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none', padding: '12px 16px', borderRadius: 12, background: pastaAberta ? 'var(--brand-light)' : 'transparent', transition: 'background 0.15s' }}>
              <div style={{ position: 'relative' }}>
                {pastaAberta ? <FolderOpen size={56} color="var(--brand)" strokeWidth={1.5} /> : <Folder size={56} color={titulares.length > 0 ? '#E8A020' : 'var(--text-3)'} strokeWidth={1.5} />}
                {titulares.length > 0 && (
                  <div style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: '50%', background: 'var(--brand)', color: 'white', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {titulares.length}
                  </div>
                )}
              </div>
              <span style={{ fontSize: 12, fontWeight: 600, color: pastaAberta ? 'var(--brand)' : 'var(--text-2)', letterSpacing: '0.02em' }}>Envelopes de Fiado</span>
            </div>

            {pastaAberta && (
              <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
                {titulares.length === 0 && <p style={{ color: 'var(--text-3)', fontSize: 13 }}>Nenhum envelope ainda.</p>}
                {titulares.map(c => (
                  <div key={c.id} style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', boxShadow: envelopeAberto === c.id ? '0 4px 16px rgba(0,0,0,0.08)' : 'none' }}>
                    <div onClick={() => setEnvelopeAberto(envelopeAberto === c.id ? null : c.id)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', cursor: 'pointer', background: envelopeAberto === c.id ? 'var(--brand-light)' : 'var(--surface)', borderBottom: envelopeAberto === c.id ? '1px solid var(--border)' : 'none' }}>
                      <div style={{ width: 38, height: 38, borderRadius: '50%', flexShrink: 0, background: 'var(--brand)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700 }}>{initials(c.nome)}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.nome}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{c.telefone || 'sem telefone'} · titular</div>
                      </div>
                      {envelopeAberto === c.id ? <ChevronDown size={16} color="var(--text-3)" /> : <ChevronRight size={16} color="var(--text-3)" />}
                    </div>
                    {envelopeAberto === c.id && (
                      <div style={{ padding: '12px 16px' }}>
                        <button className="btn btn-primary btn-sm" style={{ width: '100%', justifyContent: 'center', marginBottom: 8 }} onClick={() => setModalFiado(c)}>Abrir conta fiado</button>
                        <button className="btn btn-secondary btn-sm" style={{ width: '100%', justifyContent: 'center' }} onClick={() => {
                          setFormEditar({ nome: c.nome, cpf: c.cpf || '', telefone: c.telefone || '' })
                          setModalEditar(c)
                        }}>✏️ Editar dados</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {semFiado.length > 0 && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
                Clientes sem fiado ({semFiado.length})
              </div>
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <table>
                  <thead><tr><th>Nome</th><th>CPF</th><th>Telefone</th><th></th></tr></thead>
                  <tbody>
                    {semFiado.map(c => (
                      <tr key={c.id}>
                        <td>
                          <div style={{ fontWeight: 500 }}>{c.nome}</div>
                          <TagEnvelope c={c} />
                        </td>
                        <td style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-2)' }}>{c.cpf || '—'}</td>
                        <td style={{ color: 'var(--text-2)' }}>{c.telefone || '—'}</td>
                        <td>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button className="btn btn-secondary btn-sm" onClick={() => {
                              setFormEditar({ nome: c.nome, cpf: c.cpf || '', telefone: c.telefone || '' })
                              setModalEditar(c)
                            }}>✏️</button>
                            <button className="btn btn-secondary btn-sm" onClick={() => setModalFiado(c)}>Ver conta</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Modal novo cliente */}
      <Modal open={modalNovo} onClose={() => setModalNovo(false)} title="Novo cliente">
        <form onSubmit={e => { e.preventDefault(); criarCliente.mutate(form) }}>
          <div className="form-group"><label>Nome</label><input value={form.nome} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))} required /></div>
          <div className="form-group"><label>CPF</label><input placeholder="000.000.000-00" value={form.cpf} onChange={e => setForm(p => ({ ...p, cpf: e.target.value }))} /></div>
          <div className="form-group"><label>Telefone</label><input value={form.telefone} onChange={e => setForm(p => ({ ...p, telefone: e.target.value }))} /></div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setModalNovo(false)}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={criarCliente.isPending}>Cadastrar</button>
          </div>
        </form>
      </Modal>

      {/* Modal conta fiado */}
      <Modal open={!!modalFiado} onClose={() => setModalFiado(null)} title={`Conta fiado — ${modalFiado?.nome}`} width={640}>
        {fiado ? (
          <div>
            {fiado.conta?.titular && fiado.conta.titular.id !== modalFiado?.id && (
              <div style={{ background: '#EEF2FF', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8, border: '1px solid #C7D2FE' }}>
                <span>📁</span>
                <span style={{ color: '#4338CA' }}>Este cliente pertence ao envelope de <strong>{fiado.conta.titular.nome}</strong></span>
              </div>
            )}

            {/* Saldo total combinado: fiado + carnê */}
            {(() => {
              const totalCarnePendente = (carnesCliente || [])
                .filter(p => p.status === 'pendente')
                .reduce((s, p) => s + parseFloat(p.valor), 0)
              const totalGeral = parseFloat(fiado.conta.saldo_devedor) + totalCarnePendente
              return (
                <div style={{ background: totalGeral > 0 ? 'var(--warning-bg)' : 'var(--success-bg)', borderRadius: 10, padding: '14px 18px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-3)' }}>
                      Saldo total (fiado + carnê)
                    </div>
                    <div style={{ fontFamily: 'Syne', fontSize: 26, fontWeight: 800 }}>{fmt(totalGeral)}</div>
                    {totalCarnePendente > 0 && (
                      <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
                        {fmt(fiado.conta.saldo_devedor)} fiado + {fmt(totalCarnePendente)} carnê
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => setModalDebito(true)}>+ Lançar débito</button>
                    {pessoasDaConta.length > 1 && (
                      <button className="btn btn-secondary btn-sm" onClick={() => setModalTransferir(true)} title="Passar o saldo de uma pessoa do envelope para outra">⇄ Transferir saldo</button>
                    )}
                    <button className="btn btn-secondary btn-sm" onClick={() => setModalAjuste(true)} title="Acertar o saldo com o envelope físico">± Ajustar saldo</button>
                  </div>
                </div>
              )
            })()}

            {fiado.saldo_por_pessoa?.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Saldo por pessoa</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {fiado.saldo_por_pessoa.map(p => (
                    <div key={p.cliente.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--surface)', borderRadius: 8, border: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 30, height: 30, borderRadius: '50%', background: p.cliente.id === modalFiado?.id ? 'var(--brand)' : 'var(--surface-2)', color: p.cliente.id === modalFiado?.id ? 'white' : 'var(--text-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{initials(p.cliente.nome)}</div>
                        <div>
                          <div style={{ fontWeight: 500, fontSize: 13 }}>{p.cliente.nome}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{fmt(p.debitos)} em compras · {fmt(p.creditos)} pago</div>
                        </div>
                      </div>
                      <span style={{ fontWeight: 700, color: p.saldo > 0 ? 'var(--danger)' : 'var(--success)' }}>{fmt(p.saldo)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Carnês do cliente */}
            {carnesCliente?.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Carnês (vendas parceladas)
                </div>
                {(() => {
                  const porVenda = carnesCliente.reduce((acc, p) => {
                    if (!acc[p.venda_id]) acc[p.venda_id] = []
                    acc[p.venda_id].push(p)
                    return acc
                  }, {})
                  return Object.entries(porVenda).map(([vendaId, parcelasDoCarne]) => {
                    const pagas = parcelasDoCarne.filter(p => p.status === 'pago').length
                    const totalCarne = parcelasDoCarne.reduce((s, p) => s + parseFloat(p.valor), 0)
                    const pendentes = parcelasDoCarne.filter(p => p.status === 'pendente')
                    const proximaParcela = pendentes.sort((a,b) => new Date(a.vencimento) - new Date(b.vencimento))[0]
                    return (
                      <div key={vendaId} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', marginBottom: 8, background: 'var(--surface)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600 }}>Venda #{vendaId}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
                              {pagas}/{parcelasDoCarne.length} parcelas pagas
                              {proximaParcela && ` · próxima em ${formatarDataBR(proximaParcela.vencimento)}`}
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontWeight: 700, fontSize: 14 }}>{fmt(totalCarne)}</span>
                            <button
                              className="btn btn-secondary btn-sm"
                              disabled={reimprimindoCarne == vendaId}
                              onClick={() => handleReimprimirCarne(vendaId, modalFiado?.nome)}
                              style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                            >
                              <Printer size={11} /> {reimprimindoCarne == vendaId ? '...' : 'Reimprimir'}
                            </button>
                            <button
                              className="btn btn-danger btn-sm"
                              disabled={cancelarVenda.isPending}
                              onClick={() => {
                                if (confirm(`Cancelar a Venda #${vendaId}? Isso vai apagar o carnê e devolver o estoque dos itens cadastrados.`)) {
                                  cancelarVenda.mutate(vendaId)
                                }
                              }}
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })
                })()}
              </div>
            )}

            <div style={{ background: 'var(--surface-2)', borderRadius: 8, padding: '12px 14px', marginBottom: 16 }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                {['dinheiro','pix','debito','credito'].map(f => (
                  <button key={f} onClick={() => setFormaPagamento(f)} style={{
                    padding: '5px 10px', borderRadius: 8, fontSize: 12, fontWeight: 500,
                    background: formaPagamento === f ? '#1A1916' : 'white',
                    color: formaPagamento === f ? 'white' : 'var(--text-2)',
                    border: `1px solid ${formaPagamento === f ? '#1A1916' : 'var(--border)'}`,
                    cursor: 'pointer',
                  }}>
                    {f === 'dinheiro' ? '💵 Dinheiro' : f === 'pix' ? '📲 PIX' : f === 'debito' ? '💳 Débito' : '💳 Crédito'}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 100 }}>
                  <label style={{ fontSize: 11 }}>Valor do pagamento</label>
                  <input type="number" step="0.01" min="0.01" placeholder="R$ 0,00"
                    value={pagamento.valor} onChange={e => setPagamento(p => ({ ...p, valor: e.target.value }))} />
                </div>
                <div style={{ width: 140 }}>
                  <label style={{ fontSize: 11 }}>Data do pagamento</label>
                  <input type="date" max={hojeISO()} value={pagamento.data} onChange={e => setPagamento(p => ({ ...p, data: e.target.value }))} />
                </div>
                {pessoasDaConta.length > 1 && (
                  <div style={{ flex: 1, minWidth: 140 }}>
                    <label style={{ fontSize: 11 }}>Referente a quem</label>
                    <select value={pagamento.cliente_id} onChange={e => setPagamento(p => ({ ...p, cliente_id: e.target.value }))}>
                      <option value="">Conta geral</option>
                      {pessoasDaConta.map(p => <option key={p.id} value={p.id}>{nomePessoa(p)}</option>)}
                    </select>
                  </div>
                )}
                <button className="btn btn-primary" onClick={() => pagar.mutate()} disabled={!pagamento.valor || pagar.isPending}>
                  <DollarSign size={13} /> Registrar pagamento
                </button>
              </div>
              {pagamento.data && pagamento.data !== hojeISO() && (
                <div style={{ marginTop: 8, fontSize: 11, color: '#B45309' }}>
                  ⏱ Pagamento retroativo: vai constar em {formatarDataBR(pagamento.data)} (também em Recebimentos).
                </div>
              )}

              {ultimoPagamento && (
                <div style={{ marginTop: 10, padding: '8px 12px', background: 'var(--success-bg)', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: 'var(--success)', fontWeight: 500 }}>
                    ✓ Pagamento de {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(ultimoPagamento.valor)} registrado
                  </span>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => gerarReciboPagamento(
                      ultimoPagamento.nome || modalFiado.nome, ultimoPagamento.valor, ultimoPagamento.forma, 'Fiado',
                      ultimoPagamento.data && ultimoPagamento.data !== hojeISO() ? formatarDataBR(ultimoPagamento.data) : undefined
                    )}
                  >
                    🖨️ Imprimir recibo
                  </button>
                </div>
              )}
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Membros do envelope ({dependentes.length + 1})</div>
                <button className="btn btn-secondary btn-sm" onClick={() => setModalVincular(true)}><UserPlus size={12} /> Adicionar membro</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div onClick={() => setMembroSelecionado(modalFiado)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 8, cursor: 'pointer', background: 'var(--brand-light)', border: '1px solid rgba(232,64,10,0.15)' }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--brand)', color: 'white', fontSize: 11, fontWeight: 700, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{initials(modalFiado?.nome)}</div>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--brand)' }}>{modalFiado?.nome}</span>
                    <span style={{ fontSize: 10, color: 'var(--brand)', opacity: 0.7, marginLeft: 6 }}>(titular)</span>
                  </div>
                  <span style={{ fontWeight: 700, fontSize: 13, color: fiado.saldo_por_pessoa?.find(p => p.cliente.id === modalFiado?.id)?.saldo > 0 ? 'var(--danger)' : 'var(--success)' }}>
                    {fmt(fiado.saldo_por_pessoa?.find(p => p.cliente.id === modalFiado?.id)?.saldo || 0)}
                  </span>
                </div>
                {dependentes.map(d => {
                  const saldoMembro = fiado.saldo_dependentes?.[d.id] ?? fiado.saldo_por_pessoa?.find(p => p.cliente.id === d.id)?.saldo ?? 0
                  return (
                    <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 8, cursor: 'pointer', background: 'var(--surface)', border: '1px solid var(--border)' }}
                      onClick={() => setMembroSelecionado(d)}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'var(--surface)'}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--surface-2)', color: 'var(--text-2)', fontSize: 11, fontWeight: 700, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{initials(d.nome)}</div>
                      <div style={{ flex: 1 }}><span style={{ fontWeight: 500, fontSize: 13 }}>{d.nome}</span></div>
                      <span style={{ fontWeight: 700, fontSize: 13, color: saldoMembro > 0 ? 'var(--danger)' : 'var(--success)' }}>{fmt(saldoMembro)}</span>
                      <button onClick={e => { e.stopPropagation(); if (confirm(`Remover ${d.nome} do envelope?`)) desvincular.mutate(d.id) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 0, display: 'flex', marginLeft: 4 }}>
                        <X size={13} />
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>

            <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Histórico completo</h3>
            <div style={{ maxHeight: 320, overflow: 'auto' }}>
              <HistoricoLancamentos
                lancamentos={fiado.lancamentos}
                mostrarPessoa
                onVenda={setModalVenda}
                onPagamento={setModalPagamento}
                onEditar={abrirEdicao}
                onEstornar={pedirEstorno}
              />
            </div>
            <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 6 }}>
              O histórico dos membros fica na conta de cada um: clique no nome em "Membros do envelope".
            </p>
          </div>
        ) : (
          <div style={{ textAlign: 'center', color: 'var(--text-3)', padding: 32 }}>
            <p>Este cliente não possui conta fiado ainda.</p>
            <p style={{ fontSize: 12, marginTop: 4, marginBottom: 20 }}>A conta é criada automaticamente na primeira venda fiado,<br />ou crie manualmente para migrar um saldo existente.</p>
            <button className="btn btn-primary" onClick={() => setModalDebito(true)}>+ Criar conta e lançar débito inicial</button>
          </div>
        )}
      </Modal>

      <Modal open={modalDebito} onClose={() => setModalDebito(false)} title="Lançar débito manual">
        <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 16 }}>Use para registrar compras anotadas no papel ou valores que o cliente já deve.</p>
        {pessoasDaConta.length > 1 && (
          <div className="form-group">
            <label>Quem comprou</label>
            <select value={debito.cliente_id} onChange={e => setDebito(p => ({ ...p, cliente_id: e.target.value }))}>
              {pessoasDaConta.map(p => <option key={p.id} value={p.isTitular ? '' : p.id}>{nomePessoa(p)}</option>)}
            </select>
          </div>
        )}
        <div style={{ display: 'flex', gap: 10 }}>
          <div className="form-group" style={{ flex: 1 }}>
            <label>Valor (R$)</label>
            <input type="number" step="0.01" min="0.01" value={debito.valor} onChange={e => setDebito(p => ({ ...p, valor: e.target.value }))} autoFocus />
          </div>
          <div className="form-group" style={{ width: 160 }}>
            <label>Data da compra</label>
            <input type="date" max={hojeISO()} value={debito.data} onChange={e => setDebito(p => ({ ...p, data: e.target.value }))} />
          </div>
        </div>
        <div className="form-group">
          <label>Descrição</label>
          <input value={debito.descricao} onChange={e => setDebito(p => ({ ...p, descricao: e.target.value }))} />
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary" onClick={() => setModalDebito(false)}>Cancelar</button>
          <button className="btn btn-primary" disabled={!debito.valor || lancarDebito.isPending} onClick={() => lancarDebito.mutate()}>Lançar débito</button>
        </div>
      </Modal>

      {/* Transferir saldo entre pessoas do envelope */}
      <Modal open={modalTransferir} onClose={() => setModalTransferir(false)} title="Transferir saldo">
        <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 16 }}>
          Passa a dívida de uma pessoa para outra. <strong>Não conta como pagamento nem como venda</strong>: os dois lançamentos ficam ligados no histórico.
        </p>
        <div className="form-group">
          <label>De (quem tinha a dívida)</label>
          <select value={transf.origem_id} onChange={e => {
            const origem = pessoasDaConta.find(p => String(p.id) === e.target.value)
            setTransf(t => ({ ...t, origem_id: e.target.value, valor: origem && origem.saldo > 0 ? origem.saldo.toFixed(2) : '' }))
          }}>
            <option value="">Selecione...</option>
            {pessoasDaConta.map(p => <option key={p.id} value={p.id} disabled={p.saldo <= 0}>{nomePessoa(p)}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label>Para (quem vai assumir)</label>
          <select value={transf.destino_id} onChange={e => setTransf(t => ({ ...t, destino_id: e.target.value }))}>
            <option value="">Selecione...</option>
            {pessoasDaConta.filter(p => String(p.id) !== String(transf.origem_id)).map(p => <option key={p.id} value={p.id}>{nomePessoa(p)}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div className="form-group" style={{ flex: 1 }}>
            <label>Valor (R$){origemTransf && <span style={{ color: 'var(--text-3)', fontWeight: 400 }}> · saldo {fmt(origemTransf.saldo)}</span>}</label>
            <input type="number" step="0.01" min="0.01" value={transf.valor} onChange={e => setTransf(t => ({ ...t, valor: e.target.value }))} />
          </div>
          <div className="form-group" style={{ width: 160 }}>
            <label>Data</label>
            <input type="date" max={hojeISO()} value={transf.data} onChange={e => setTransf(t => ({ ...t, data: e.target.value }))} />
          </div>
        </div>
        <div className="form-group">
          <label>Observação (opcional)</label>
          <input placeholder="Ex.: Vitória não pagou, Rosana assumiu" value={transf.observacao} onChange={e => setTransf(t => ({ ...t, observacao: e.target.value }))} />
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary" onClick={() => setModalTransferir(false)}>Cancelar</button>
          <button className="btn btn-primary"
            disabled={!transf.origem_id || !transf.destino_id || !transf.valor || transferir.isPending}
            onClick={() => transferir.mutate()}>⇄ Transferir</button>
        </div>
      </Modal>

      {/* Ajuste de saldo (acerto com o envelope físico) */}
      <Modal open={modalAjuste} onClose={() => setModalAjuste(false)} title="Ajustar saldo">
        <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 16 }}>
          Para acertar o sistema com o envelope físico quando não dá para saber a origem da diferença.
          <strong> Não entra em Recebimentos nem em Vendas.</strong> Se foi um pagamento real que não foi lançado, use "Registrar pagamento" com a data certa.
        </p>
        {pessoasDaConta.length > 1 && (
          <div className="form-group">
            <label>Pessoa</label>
            <select value={ajuste.cliente_id} onChange={e => setAjuste(a => ({ ...a, cliente_id: e.target.value }))}>
              {pessoasDaConta.map(p => <option key={p.id} value={p.isTitular ? '' : p.id}>{nomePessoa(p)}</option>)}
            </select>
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          {[['credito', '− Diminuir dívida'], ['debito', '+ Aumentar dívida']].map(([v, label]) => (
            <button key={v} type="button" onClick={() => setAjuste(a => ({ ...a, tipo: v }))} style={{
              flex: 1, padding: '8px 10px', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer',
              background: ajuste.tipo === v ? '#1A1916' : 'white', color: ajuste.tipo === v ? 'white' : 'var(--text-2)',
              border: `1px solid ${ajuste.tipo === v ? '#1A1916' : 'var(--border)'}`,
            }}>{label}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div className="form-group" style={{ flex: 1 }}>
            <label>Valor (R$)</label>
            <input type="number" step="0.01" min="0.01" value={ajuste.valor} onChange={e => setAjuste(a => ({ ...a, valor: e.target.value }))} />
          </div>
          <div className="form-group" style={{ width: 160 }}>
            <label>Data</label>
            <input type="date" max={hojeISO()} value={ajuste.data} onChange={e => setAjuste(a => ({ ...a, data: e.target.value }))} />
          </div>
        </div>
        <div className="form-group">
          <label>Motivo (obrigatório)</label>
          <input placeholder="Ex.: conferência com envelope físico" value={ajuste.observacao} onChange={e => setAjuste(a => ({ ...a, observacao: e.target.value }))} />
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary" onClick={() => setModalAjuste(false)}>Cancelar</button>
          <button className="btn btn-primary"
            disabled={!ajuste.valor || ajuste.observacao.trim().length < 3 || ajustar.isPending}
            onClick={() => ajustar.mutate()}>Salvar ajuste</button>
        </div>
      </Modal>

      {/* Corrigir data / forma / descrição de um lançamento */}
      <Modal open={!!editLanc} onClose={() => setEditLanc(null)} title="Corrigir lançamento" width={460}>
        {editLanc && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', marginBottom: 16 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <BadgeNatureza l={editLanc} />
                <span style={{ fontSize: 13 }}>{editLanc.cliente?.nome}</span>
              </div>
              <strong style={{ color: editLanc.tipo === 'debito' ? 'var(--danger)' : 'var(--success)' }}>
                {editLanc.tipo === 'debito' ? '+' : '-'}{fmt(editLanc.valor)}
              </strong>
            </div>
            <div className="form-group">
              <label>Data real</label>
              <input type="date" max={hojeISO()} value={editLanc.data_lancamento} onChange={e => setEditLanc(x => ({ ...x, data_lancamento: e.target.value }))} />
            </div>
            {naturezaDe(editLanc) === 'pagamento' && (
              <div className="form-group">
                <label>Forma de pagamento</label>
                <select value={editLanc.forma_pagamento} onChange={e => setEditLanc(x => ({ ...x, forma_pagamento: e.target.value }))}>
                  <option value="">Não informada</option>
                  <option value="dinheiro">Dinheiro</option>
                  <option value="pix">PIX</option>
                  <option value="debito">Cartão débito</option>
                  <option value="credito">Cartão crédito</option>
                </select>
              </div>
            )}
            <div className="form-group">
              <label>Descrição</label>
              <input value={editLanc.descricao} onChange={e => setEditLanc(x => ({ ...x, descricao: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Observação</label>
              <input value={editLanc.observacao} onChange={e => setEditLanc(x => ({ ...x, observacao: e.target.value }))} />
            </div>
            <p style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 14 }}>
              O valor não pode ser alterado aqui. Se o valor está errado, estorne (↩) e lance de novo.
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setEditLanc(null)}>Cancelar</button>
              <button className="btn btn-primary" disabled={!editLanc.data_lancamento || editarLancamento.isPending} onClick={() => editarLancamento.mutate()}>Salvar</button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={modalVincular} onClose={() => { setModalVincular(false); setBuscaVincular(''); setResultadosVincular([]) }} title={`Adicionar membro ao envelope de ${modalFiado?.nome}`}>
        <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 14 }}>Busque um cliente cadastrado para adicionar ao envelope.</p>
        <div className="form-group" style={{ position: 'relative' }}>
          <label>Buscar cliente</label>
          <Search size={13} style={{ position: 'absolute', left: 10, top: 32, color: 'var(--text-3)' }} />
          <input placeholder="Nome do cliente..." value={buscaVincular} onChange={e => handleBuscaVincular(e.target.value)} style={{ paddingLeft: 30 }} autoFocus />
          {resultadosVincular.length > 0 && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, background: 'white', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.1)', marginTop: 2, overflow: 'hidden' }}>
              {resultadosVincular.map(c => (
                <button key={c.id} type="button" onClick={() => vincular.mutate(c.id)} style={{ width: '100%', padding: '10px 12px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', borderBottom: '1px solid var(--surface-2)', fontFamily: 'DM Sans', fontSize: 13 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'var(--text-2)' }}>{initials(c.nome)}</div>
                    <div>
                      <div style={{ fontWeight: 500 }}>{c.nome}</div>
                      <TagEnvelope c={c} />
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 8 }}>O cliente precisa estar cadastrado. Se não estiver, feche e cadastre primeiro.</p>
      </Modal>

      <Modal open={!!membroSelecionado} onClose={() => setMembroSelecionado(null)} title={`Conta de ${membroSelecionado?.nome}`} width={560}>
        {membroSelecionado && !fiadoMembro && (
          <div style={{ textAlign: 'center', color: 'var(--text-3)', padding: 24 }}>{erroMembro ? 'Esta pessoa ainda não tem lançamentos no fiado.' : 'Carregando...'}</div>
        )}
        {membroSelecionado && fiadoMembro && (() => {
          // Conta própria do membro (cada pessoa do envelope tem a sua)
          const lancamentos = fiadoMembro.lancamentos.filter(l => l.cliente?.id === membroSelecionado.id)
          const debitos = lancamentos.filter(l => l.tipo === 'debito').reduce((s, l) => s + parseFloat(l.valor), 0)
          const creditos = lancamentos.filter(l => l.tipo === 'credito').reduce((s, l) => s + parseFloat(l.valor), 0)
          const saldo = debitos - creditos
          return (
            <div>
              <div style={{ background: saldo > 0 ? 'var(--warning-bg)' : 'var(--success-bg)', borderRadius: 10, padding: '14px 18px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-3)' }}>Saldo devedor</div>
                  <div style={{ fontFamily: 'Syne', fontSize: 26, fontWeight: 800 }}>{fmt(saldo)}</div>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-2)', textAlign: 'right' }}>
                  <div>{fmt(debitos)} em compras</div>
                  <div>{fmt(creditos)} pago</div>
                </div>
              </div>
              <HistoricoLancamentos
                lancamentos={lancamentos}
                onVenda={setModalVenda}
                onPagamento={setModalPagamento}
                onEditar={abrirEdicao}
                onEstornar={pedirEstorno}
              />
            </div>
          )
        })()}
      </Modal>

      <Modal open={!!modalEditar} onClose={() => setModalEditar(null)} title={`Editar — ${modalEditar?.nome}`}>
        <form onSubmit={e => { e.preventDefault(); atualizarCliente.mutate(formEditar) }}>
          <div className="form-group">
            <label>Nome</label>
            <input value={formEditar.nome} onChange={e => setFormEditar(p => ({ ...p, nome: e.target.value }))} required />
          </div>
          <div className="form-group">
            <label>CPF</label>
            <input placeholder="000.000.000-00" value={formEditar.cpf} onChange={e => setFormEditar(p => ({ ...p, cpf: e.target.value }))} />
          </div>
          <div className="form-group">
            <label>Telefone</label>
            <input placeholder="(43) 99999-9999" value={formEditar.telefone} onChange={e => setFormEditar(p => ({ ...p, telefone: e.target.value }))} />
          </div>
          {atualizarCliente.isError && (
            <p style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 12 }}>
              {atualizarCliente.error?.response?.data?.message || 'Erro ao salvar.'}
            </p>
          )}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setModalEditar(null)}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={atualizarCliente.isPending}>Salvar alterações</button>
          </div>
        </form>
      </Modal>

      <Modal open={!!modalVenda} onClose={() => setModalVenda(null)} title={`Venda #${modalVenda?.id}`} width={560}>
        {modalVenda && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, fontSize: 13, color: 'var(--text-2)' }}>
              <span>Data: {new Date(modalVenda.created_at).toLocaleString('pt-BR')}</span>
              <span>Forma: {modalVenda.forma_pagamento}</span>
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
            {modalVenda.assinatura && (
              <div style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 8 }}>Assinatura do cliente</div>
                <img src={modalVenda.assinatura} alt="Assinatura" style={{ maxWidth: '100%', border: '1px solid var(--border)', borderRadius: 6 }} />
              </div>
            )}
            {modalVenda.forma_pagamento === 'carne' && modalVenda.parcelas?.length > 0 && (
              <div style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                <button
                  className="btn btn-primary"
                  style={{ width: '100%', justifyContent: 'center' }}
                  onClick={() => imprimirCarne(modalVenda, modalVenda.cliente?.nome)}
                >
                  🖨️ Reimprimir carnê
                </button>
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal open={!!modalPagamento} onClose={() => setModalPagamento(null)} title="Detalhes do pagamento" width={440}>
        {modalPagamento && (() => {
          const desc = modalPagamento.descricao || ''
          const dataPgto = modalPagamento.data_lancamento && String(modalPagamento.data_lancamento).split('T')[0] !== String(modalPagamento.created_at).split('T')[0]
            ? formatarDataBR(String(modalPagamento.data_lancamento))
            : new Date(modalPagamento.created_at).toLocaleString('pt-BR')
          const forma = modalPagamento.forma_pagamento ? modalPagamento.forma_pagamento : desc.includes('PIX') ? 'pix' : desc.includes('dinheiro') ? 'dinheiro' : desc.includes('débito') ? 'debito' : desc.includes('crédito') ? 'credito' : desc
          return (
            <div>
              <div style={{ background: 'var(--success-bg)', borderRadius: 10, padding: '16px 18px', marginBottom: 16, textAlign: 'center' }}>
                <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-3)' }}>Valor pago</div>
                <div style={{ fontFamily: 'Syne', fontSize: 30, fontWeight: 800, color: 'var(--success)' }}>{fmt(modalPagamento.valor)}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13, marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-3)' }}>Data</span>
                  <strong>{dataPgto}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-3)' }}>Pago por</span>
                  <strong>{modalPagamento.cliente?.nome || '—'}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-3)' }}>Forma</span>
                  <strong>{modalPagamento.descricao || 'Pagamento'}</strong>
                </div>
              </div>
              <button
                className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={() => gerarReciboPagamento(
                  modalPagamento.cliente?.nome || modalFiado?.nome || 'Cliente',
                  modalPagamento.valor,
                  forma,
                  'Fiado',
                  dataPgto
                )}
              >
                🖨️ Reimprimir recibo
              </button>
            </div>
          )
        })()}
      </Modal>
    </div>
  )
}