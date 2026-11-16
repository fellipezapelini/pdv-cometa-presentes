import { useState, useRef, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Trash2, Check, PenLine, FileDown, X, Plus } from 'lucide-react'
import PageHeader from '../../../components/PageHeader'
import Modal from '../../../components/Modal'
import api from '../../../api/client'

function fmt(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)
}

function gerarCupomHTML(carrinho, cliente, pagamento) {
  const data = new Date().toLocaleString('pt-BR')
  const itens = carrinho.map(i => `
    <tr>
      <td style="padding:4px 0;font-size:13px;">${i.nome}</td>
      <td style="padding:4px 0;font-size:13px;text-align:center;">${i.quantidade}</td>
      <td style="padding:4px 0;font-size:13px;text-align:right;">${fmt(i.preco)}</td>
      <td style="padding:4px 0;font-size:13px;text-align:right;">${fmt(i.preco * i.quantidade)}</td>
    </tr>
  `).join('')
  const total = carrinho.reduce((s, i) => s + i.preco * i.quantidade, 0)
  const formaStr = { dinheiro: 'Dinheiro', pix: 'PIX', debito: 'Débito', credito: 'Crédito', fiado: 'Fiado', carne: 'Carnê' }[pagamento] || pagamento

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Cupom</title>
  <style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Courier New', monospace; width: 80mm; max-width: 80mm; margin: 0 auto; padding: 4mm 3mm; font-size: 11px; line-height: 1.4; }
  h2 { text-align: center; font-size: 13px; margin-bottom: 2px; }
  .sub { text-align: center; font-size: 10px; color: #333; margin-bottom: 6px; }
  hr { border: none; border-top: 1px dashed #000; margin: 5px 0; }
  table { width: 100%; border-collapse: collapse; }
  th { font-size: 10px; text-align: left; padding: 2px 0; border-bottom: 1px solid #000; }
  td { font-size: 11px; padding: 2px 0; vertical-align: top; }
  .total { font-size: 14px; font-weight: bold; text-align: right; margin-top: 4px; }
  .forma { font-size: 10px; color: #333; text-align: right; margin-top: 2px; }
  .assinatura { margin-top: 16px; }
  .linha { border-bottom: 1px solid #000; margin-top: 40px; margin-bottom: 3px; }
  .label { font-size: 10px; color: #333; }
  @media print { @page { size: 80mm auto; margin: 0; } body { width: 80mm; padding: 4mm 3mm; } }
  </style>
  </head><body>
  <h2>Cometa Papelaria & Presentes</h2>
  <div class="sub">Av. Londrina, 323 · Ibiporã-PR · ${data}</div>
  <hr>
  ${cliente ? `<div style="font-size:13px;margin-bottom:8px;"><strong>Cliente:</strong> ${cliente}</div>` : ''}
  <table><thead><tr><th>Item</th><th style="text-align:center">Qtd</th><th style="text-align:right">Preço</th><th style="text-align:right">Total</th></tr></thead>
  <tbody>${itens}</tbody></table>
  <hr>
  <div class="total">TOTAL: ${fmt(total)}</div>
  <div class="forma">Pagamento: ${formaStr}</div>
  <hr>
  ${pagamento === 'fiado' ? `<div class="assinatura">
    <div style="font-size:12px;color:#666;">Declaro que recebi os produtos acima e me comprometo a pagar <strong>${fmt(total)}</strong>.</div>
    <div class="linha"></div>
    <div class="label">Assinatura: ${cliente || '_______________________'}</div>
  </div>` : ''}
  </body></html>`
}

// ─── Geração do payload PIX (padrão EMV/Bacen) ────────────────────────────
function gerarPayloadPix({ chave, nome, cidade, valor, txid }) {
  function tlv(id, value) {
    const len = String(value.length).padStart(2, '0')
    return `${id}${len}${value}`
  }
  const merchantAccount = tlv('00', 'br.gov.bcb.pix') + tlv('01', chave)
  const valorStr = valor.toFixed(2)
  let payload =
    tlv('00', '01') +
    tlv('26', merchantAccount) +
    tlv('52', '0000') +
    tlv('53', '986') +
    tlv('54', valorStr) +
    tlv('58', 'BR') +
    tlv('59', nome.substring(0, 25)) +
    tlv('60', cidade.substring(0, 15)) +
    tlv('62', tlv('05', txid.substring(0, 25))) +
    '6304'
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
    const payloadPix = gerarPayloadPix({
      chave: PIX_CHAVE, nome: PIX_NOME, cidade: PIX_CIDADE,
      valor: parseFloat(p.valor), txid,
    })
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(payloadPix)}`
    const valorFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(p.valor)

    return `
    <div class="folha">
      <!-- Parte principal (fica com o cliente) -->
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
            <div class="campo">
              <span class="campo-label">CLIENTE</span>
              <span class="campo-valor">${clienteNome}</span>
            </div>
            <div class="campo">
              <span class="campo-label">VENCIMENTO</span>
              <span class="campo-valor campo-vencimento">${formatarDataBR(p.vencimento)}</span>
            </div>
            <div class="campo">
              <span class="campo-label">ITENS COMPRADOS</span>
              <div class="itens-lista">${itensHTML}</div>
            </div>
            <div class="assinatura-area">
              <div class="assinatura-linha"></div>
              <div class="assinatura-texto">Assinatura do cliente</div>
            </div>
          </div>

          <div class="corpo-direita">
            <div class="valor-destaque">
              <div class="valor-label">VALOR DA PARCELA</div>
              <div class="valor-numero">${valorFmt}</div>
            </div>
            <div class="pix-box">
              <img src="${qrUrl}" alt="QR Code PIX" class="qr-img" />
              <div class="pix-texto">Escaneie para pagar via PIX</div>
              <div class="pix-chave">Chave (CNPJ): ${CNPJ_FORMATADO}</div>
            </div>
          </div>
        </div>
      </div>

      <div class="linha-corte">✂ - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -</div>

      <!-- Canhoto de controle (fica com a loja) -->
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

  .cabecalho {
    display: flex; justify-content: space-between; align-items: flex-start;
    border-bottom: 3px solid #E8400A; padding-bottom: 12px; margin-bottom: 16px;
  }
  .loja-nome { font-weight: 800; font-size: 20px; }
  .loja-endereco { font-size: 11px; color: #666; margin-top: 2px; }
  .cabecalho-parcela { text-align: right; }
  .parcela-numero {
    background: #E8400A; color: white; font-weight: 700; font-size: 13px;
    padding: 5px 14px; border-radius: 20px; display: inline-block;
  }
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

  .valor-destaque {
    background: #FFF4EF; border: 2px solid #E8400A; border-radius: 12px;
    padding: 14px; text-align: center; margin-bottom: 16px;
  }
  .valor-label { font-size: 10px; font-weight: 700; color: #999; letter-spacing: 0.06em; }
  .valor-numero { font-size: 28px; font-weight: 800; color: #E8400A; margin-top: 4px; }

  .pix-box { text-align: center; border: 1px solid #ddd; border-radius: 12px; padding: 14px; }
  .qr-img { width: 150px; height: 150px; }
  .pix-texto { font-size: 11px; font-weight: 600; margin-top: 8px; }
  .pix-chave { font-size: 10px; color: #666; margin-top: 3px; }

  .linha-corte { text-align: center; font-size: 10px; color: #aaa; margin: 14px 0; letter-spacing: 1px; }

  .canhoto {
    border: 1.5px dashed #ccc; border-radius: 8px; padding: 10px 14px;
    font-size: 11px; color: #555;
  }
  .canhoto-item { padding: 2px 0; }

  @media print {
    @page { size: A4; margin: 0; }
    .folha { page-break-after: always; }
  }
  </style></head><body>
  ${paginasHTML}
  </body></html>`

  const win = window.open('', '_blank')
  win.document.write(html)
  win.document.close()
  setTimeout(() => win.print(), 800)
}

const linhaVazia = () => ({ id: Date.now() + Math.random(), quantidade: '', nome: '', preco: '', produto_id: null, avulso: true })

export default function PDV() {
  const qc = useQueryClient()
  const canvasRef = useRef(null)
  const isDrawing = useRef(false)
  const buscarTimer = useRef(null)
  const buscarClienteTimer = useRef(null)
  const linhasRef = useRef({})

  const [linhas, setLinhas] = useState([linhaVazia()])
  const [cliente, setCliente] = useState({ id: null, nome: '', envelope: null })
  const [resultadosCliente, setResultadosCliente] = useState([])
  const [pagamento, setPagamento] = useState('dinheiro')
  const [parcelas, setParcelas] = useState(1)
  const [sucesso, setSucesso] = useState(false)
  const [assinaturaSalva, setAssinaturaSalva] = useState(null)
  const [modalAssinatura, setModalAssinatura] = useState(false)
  const [carrinhoFinalizado, setCarrinhoFinalizado] = useState([])
  const [sugestoes, setSugestoes] = useState({ id: null, lista: [] })

  // Carnê
  const [numeroParcelas, setNumeroParcelas] = useState(6)
  const [valorParcela, setValorParcela] = useState('')
  const [primeiraParcela, setPrimeiraParcela] = useState('')

  const total = linhas.reduce((s, l) => s + (parseFloat(l.quantidade) || 0) * (parseFloat(l.preco) || 0), 0)
  const linhasValidas = linhas.filter(l => l.nome && l.preco && l.quantidade)

  function focarLinha(id, campo = 'qtd') {
    setTimeout(() => { linhasRef.current[`${id}_${campo}`]?.focus() }, 30)
  }

  function atualizarLinha(id, campo, valor) {
    setLinhas(ls => ls.map(l => l.id === id ? { ...l, [campo]: valor } : l))
  }

  function removerLinha(id) {
    setLinhas(ls => ls.length === 1 ? [linhaVazia()] : ls.filter(l => l.id !== id))
  }

  function adicionarLinha() {
    const nova = linhaVazia()
    setLinhas(ls => [...ls, nova])
    focarLinha(nova.id, 'qtd')
  }

  function handlePrecoEnter(e, id) {
    if (e.key === 'Enter') { e.preventDefault(); adicionarLinha() }
  }

  async function handleNomeChange(id, valor) {
    atualizarLinha(id, 'nome', valor)
    clearTimeout(buscarTimer.current)
    if (valor.length < 2) { setSugestoes({ id: null, lista: [] }); return }
    buscarTimer.current = setTimeout(async () => {
      const r = await api.get('/produtos', { params: { search: valor } })
      setSugestoes({ id, lista: r.data.data || [] })
    }, 300)
  }

  function selecionarProduto(linhaId, produto) {
    setLinhas(ls => ls.map(l => l.id === linhaId ? {
      ...l, nome: produto.nome, preco: produto.preco_venda,
      produto_id: produto.id, estoque: produto.quantidade, avulso: false,
    } : l))
    setSugestoes({ id: null, lista: [] })
    setTimeout(() => linhasRef.current[`${linhaId}_preco`]?.focus(), 30)
  }

  function handleBuscaCliente(v) {
    setCliente({ id: null, nome: v, envelope: null })
    clearTimeout(buscarClienteTimer.current)
    if (v.length < 2) { setResultadosCliente([]); return }
    buscarClienteTimer.current = setTimeout(async () => {
      const params = { search: v }
      if (pagamento === 'fiado' || pagamento === 'carne') params.com_fiado = 1
      const r = await api.get('/clientes', { params })
      setResultadosCliente(r.data.data || [])
    }, 300)
  }

  // Canvas assinatura
  useEffect(() => {
    if (!modalAssinatura || !canvasRef.current) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.strokeStyle = '#1A1916'; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round'

    function getPos(e) {
      const rect = canvas.getBoundingClientRect()
      const scaleX = canvas.width / rect.width, scaleY = canvas.height / rect.height
      if (e.touches) return { x: (e.touches[0].clientX - rect.left) * scaleX, y: (e.touches[0].clientY - rect.top) * scaleY }
      return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY }
    }
    function start(e) { e.preventDefault(); isDrawing.current = true; const p = getPos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y) }
    function draw(e) { e.preventDefault(); if (!isDrawing.current) return; const p = getPos(e); ctx.lineTo(p.x, p.y); ctx.stroke() }
    function end(e) { e.preventDefault(); isDrawing.current = false }

    canvas.addEventListener('mousedown', start); canvas.addEventListener('mousemove', draw); canvas.addEventListener('mouseup', end)
    canvas.addEventListener('touchstart', start, { passive: false }); canvas.addEventListener('touchmove', draw, { passive: false }); canvas.addEventListener('touchend', end)
    return () => {
      canvas.removeEventListener('mousedown', start); canvas.removeEventListener('mousemove', draw); canvas.removeEventListener('mouseup', end)
      canvas.removeEventListener('touchstart', start); canvas.removeEventListener('touchmove', draw); canvas.removeEventListener('touchend', end)
    }
  }, [modalAssinatura])

  function limparAssinatura() {
    const canvas = canvasRef.current; if (!canvas) return
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height)
  }

  function salvarAssinatura() { setAssinaturaSalva(canvasRef.current?.toDataURL('image/png')); setModalAssinatura(false) }

  const finalizar = useMutation({
    mutationFn: () => {
      const itensCadastrados = [], itensAvulsos = []
      for (const l of linhasValidas) {
        const qtd = parseInt(l.quantidade)
        if (l.produto_id && !l.avulso && !(l.estoque !== undefined && qtd > l.estoque)) {
          itensCadastrados.push({ produto_id: l.produto_id, quantidade: qtd })
        } else {
          itensAvulsos.push({ nome: l.nome, preco: parseFloat(l.preco), quantidade: qtd })
        }
      }
      return api.post('/vendas', {
        cliente_id: cliente.id || null,
        forma_pagamento: pagamento,
        parcelas,
        itens: itensCadastrados,
        itens_avulsos: itensAvulsos,
        ...(pagamento === 'carne' ? {
          numero_parcelas: parseInt(numeroParcelas),
          valor_parcela: parseFloat(valorParcela),
          primeira_parcela: primeiraParcela,
        } : {}),
      })
    },
    onSuccess: (response) => {
      setCarrinhoFinalizado([...linhasValidas])
      qc.invalidateQueries({ queryKey: ['produtos'] })
      if (pagamento === 'carne') {
        imprimirCarne(response.data, cliente.nome)
        setSucesso(true)
      } else if (pagamento === 'fiado') {
        setModalAssinatura(true)
      } else {
        setSucesso(true)
      }
    },
  })

  function gerarPDF() {
    const html = gerarCupomHTML(
      carrinhoFinalizado.map(l => ({ nome: l.nome, preco: parseFloat(l.preco), quantidade: parseInt(l.quantidade) })),
      cliente.nome || null, pagamento
    )
    const win = window.open('', '_blank')
    win.document.write(html); win.document.close()
    setTimeout(() => win.print(), 500)
  }

  function novaVenda() {
    setLinhas([linhaVazia()]); setCliente({ id: null, nome: '', envelope: null })
    setPagamento('dinheiro'); setParcelas(1); setSucesso(false)
    setAssinaturaSalva(null); setCarrinhoFinalizado([])
    setNumeroParcelas(6); setValorParcela(''); setPrimeiraParcela('')
  }

  if (sucesso && !modalAssinatura) return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, paddingTop: 60 }}>
      <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--success-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Check size={28} color="var(--success)" />
      </div>
      <h2 style={{ fontFamily: 'Syne', fontSize: 22 }}>Venda registrada!</h2>
      <p style={{ color: 'var(--text-2)', fontSize: 15 }}>Total: <strong>{fmt(total)}</strong></p>
      {assinaturaSalva && (
        <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 12, textAlign: 'center' }}>
          <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 8 }}>Assinatura capturada</p>
          <img src={assinaturaSalva} alt="Assinatura" style={{ maxWidth: 260, border: '1px solid var(--border)', borderRadius: 6 }} />
        </div>
      )}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
        {pagamento !== 'carne' && (
          <button className="btn btn-secondary" onClick={gerarPDF}><FileDown size={14} /> Imprimir cupom</button>
        )}
        <button className="btn btn-primary btn-lg" onClick={novaVenda}>Nova venda</button>
      </div>
    </div>
  )

  return (
    <div style={{ padding: 16 }} className="page-enter">
      <PageHeader title="PDV" subtitle="Ponto de venda" />

      {/* Romaneio */}
      <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 16 }}>
        <div style={{ padding: '10px 14px', background: 'var(--surface-2)', borderBottom: '1px solid var(--border)', display: 'grid', gridTemplateColumns: '60px 1fr 100px 36px', gap: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase' }}>Qtd</div>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase' }}>Produto</div>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', textAlign: 'right' }}>Preço/un</div>
          <div></div>
        </div>

        <div style={{ padding: '8px 14px' }}>
          {linhas.map(linha => (
            <div key={linha.id} style={{ position: 'relative', display: 'grid', gridTemplateColumns: '60px 1fr 100px 36px', gap: 8, marginBottom: 6, alignItems: 'center' }}>
              <input ref={el => linhasRef.current[`${linha.id}_qtd`] = el} type="number" min="1" placeholder="Qtd" value={linha.quantidade}
                onChange={e => atualizarLinha(linha.id, 'quantidade', e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); linhasRef.current[`${linha.id}_nome`]?.focus() } }}
                style={{ padding: '7px 8px', textAlign: 'center', fontSize: 14 }} />

              <div style={{ position: 'relative' }}>
                <input ref={el => linhasRef.current[`${linha.id}_nome`] = el} type="text" placeholder="Nome do produto" value={linha.nome}
                  onChange={e => handleNomeChange(linha.id, e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); linhasRef.current[`${linha.id}_preco`]?.focus() } }}
                  style={{ fontSize: 14, padding: '7px 10px' }} />
                {sugestoes.id === linha.id && sugestoes.lista.length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200, background: 'white', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.1)', marginTop: 2, overflow: 'hidden' }}>
                    {sugestoes.lista.slice(0, 6).map(p => (
                      <button key={p.id} type="button" onMouseDown={() => selecionarProduto(linha.id, p)} style={{ width: '100%', padding: '8px 12px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', borderBottom: '1px solid var(--surface-2)', fontFamily: 'DM Sans', fontSize: 13, display: 'flex', justifyContent: 'space-between' }}>
                        <span>{p.nome}</span>
                        <span style={{ color: 'var(--brand)', fontWeight: 600 }}>{fmt(p.preco_venda)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <input ref={el => linhasRef.current[`${linha.id}_preco`] = el} type="number" step="0.01" min="0" placeholder="0,00" value={linha.preco}
                onChange={e => atualizarLinha(linha.id, 'preco', e.target.value)}
                onKeyDown={e => handlePrecoEnter(e, linha.id)}
                style={{ padding: '7px 8px', textAlign: 'right', fontSize: 14 }} />

              <button onClick={() => removerLinha(linha.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={15} />
              </button>

              {linha.quantidade && linha.preco && (
                <div style={{ gridColumn: '1/-1', textAlign: 'right', fontSize: 12, color: 'var(--text-3)', marginTop: -4, marginBottom: 2 }}>
                  = {fmt((parseFloat(linha.quantidade) || 0) * (parseFloat(linha.preco) || 0))}
                </div>
              )}
            </div>
          ))}
        </div>

        <div style={{ padding: '8px 14px', borderTop: '1px solid var(--surface-2)' }}>
          <button className="btn btn-secondary btn-sm" onClick={adicionarLinha} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <Plus size={13} /> Adicionar linha (Enter)
          </button>
        </div>

        <div style={{ padding: '12px 14px', borderTop: '2px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface)' }}>
          <span style={{ fontWeight: 600, color: 'var(--text-2)' }}>{linhasValidas.length} item(s)</span>
          <span style={{ fontFamily: 'Syne', fontSize: 24, fontWeight: 800, color: 'var(--brand)' }}>{fmt(total)}</span>
        </div>
      </div>

      {/* Cliente */}
      <div className="card" style={{ marginBottom: 12 }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>
          {(pagamento === 'fiado' || pagamento === 'carne') ? 'Cliente (obrigatório)' : 'Cliente (opcional)'}
        </h3>
        <div style={{ position: 'relative' }}>
          <input placeholder="Nome do cliente..." value={cliente.nome} onChange={e => handleBuscaCliente(e.target.value)} />
          {resultadosCliente.length > 0 && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, background: 'white', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.1)', marginTop: 2, overflow: 'hidden' }}>
              {resultadosCliente.map(c => (
                <button key={c.id} type="button" onClick={() => {
                  setCliente({ id: c.id, nome: c.nome, envelope: c.envelope_titular_nome || (c.e_titular ? 'titular' : null) })
                  setResultadosCliente([])
                }} style={{ width: '100%', padding: '9px 12px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', borderBottom: '1px solid var(--surface-2)', fontFamily: 'DM Sans' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontWeight: 500, fontSize: 13 }}>{c.nome}</div>
                      <div style={{ fontSize: 11, marginTop: 2 }}>
                        {c.e_titular && c.tem_fiado && (
                          <span style={{ color: 'var(--brand)', fontWeight: 600 }}>📁 Envelope próprio (titular)</span>
                        )}
                        {c.envelope_titular_nome && (
                          <span style={{ color: 'var(--text-3)' }}>📄 Envelope de <strong>{c.envelope_titular_nome}</strong></span>
                        )}
                        {!c.tem_fiado && !c.envelope_titular_nome && (
                          <span style={{ color: 'var(--text-3)' }}>Sem fiado</span>
                        )}
                      </div>
                    </div>
                    {c.tem_fiado && <span className="badge badge-warning" style={{ fontSize: 10, flexShrink: 0 }}>fiado</span>}
                  </div>
                </button>
              ))}
            </div>
          )}
          {cliente.id && (
            <div style={{ fontSize: 12, color: 'var(--success)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              ✓ <strong>{cliente.nome}</strong>
              {cliente.envelope === 'titular' && <span style={{ color: 'var(--brand)', fontSize: 11 }}>📁 Envelope próprio</span>}
              {cliente.envelope && cliente.envelope !== 'titular' && <span style={{ color: 'var(--text-3)', fontSize: 11 }}>📄 Envelope de {cliente.envelope}</span>}
              <button type="button" onClick={() => setCliente({ id: null, nome: '', envelope: null })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', fontSize: 12 }}>trocar</button>
            </div>
          )}
        </div>
      </div>

      {/* Pagamento + finalizar */}
      <div className="card" style={{ background: '#1A1916', border: 'none' }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          {['dinheiro','pix','debito','credito','fiado','carne'].map(f => (
            <button key={f} onClick={() => setPagamento(f)} style={{ padding: '6px 12px', borderRadius: 8, fontSize: 13, fontWeight: 500, background: pagamento === f ? 'var(--brand)' : 'rgba(255,255,255,0.1)', color: 'white', border: 'none', cursor: 'pointer' }}>
              {f === 'debito' ? 'Débito' : f === 'credito' ? 'Crédito' : f === 'carne' ? 'Carnê' : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {pagamento === 'credito' && (
          <div style={{ marginBottom: 12 }}>
            <select value={parcelas} onChange={e => setParcelas(parseInt(e.target.value))} style={{ background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, padding: '6px 10px', fontSize: 13, fontFamily: 'DM Sans' }}>
              {[1,2,3,4,5,6,7,8,9,10,11,12].map(n => <option key={n} value={n} style={{ color: '#000' }}>{n}x {fmt(total/n)}</option>)}
            </select>
          </div>
        )}

        {pagamento === 'carne' && (
          <div style={{ marginBottom: 12, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            <div>
              <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>Nº de parcelas</label>
              <input
                type="number" min="1" max="36"
                value={numeroParcelas}
                onChange={e => setNumeroParcelas(e.target.value)}
                style={{ fontSize: 13 }}
              />
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>Valor de cada parcela</label>
              <input
                type="number" step="0.01" placeholder={numeroParcelas ? (total / numeroParcelas).toFixed(2) : '0,00'}
                value={valorParcela}
                onChange={e => setValorParcela(e.target.value)}
                style={{ fontSize: 13 }}
              />
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>1ª parcela vence em</label>
              <input
                type="date"
                value={primeiraParcela}
                onChange={e => setPrimeiraParcela(e.target.value)}
                style={{ fontSize: 13 }}
              />
            </div>
          </div>
        )}

        {(pagamento === 'fiado' || pagamento === 'carne') && !cliente.id && (
          <p style={{ fontSize: 12, color: '#FFB74D', marginBottom: 10 }}>⚠ Informe o cliente para venda {pagamento === 'carne' ? 'em carnê' : 'fiado'}.</p>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>Total</span>
          <span style={{ fontFamily: 'Syne', fontSize: 28, fontWeight: 800, color: 'white' }}>{fmt(total)}</span>
        </div>

        <button
          className="btn btn-primary btn-lg"
          style={{ width: '100%', justifyContent: 'center' }}
          disabled={
            linhasValidas.length === 0 || finalizar.isPending ||
            ((pagamento === 'fiado' || pagamento === 'carne') && !cliente.id) ||
            (pagamento === 'carne' && (!numeroParcelas || !valorParcela || !primeiraParcela))
          }
          onClick={() => finalizar.mutate()}
        >
          {finalizar.isPending ? 'Processando...' : pagamento === 'fiado' ? '⭐ Finalizar e assinar' : pagamento === 'carne' ? '📋 Gerar carnê' : 'Finalizar venda'}
        </button>

        {finalizar.isError && (
          <p style={{ color: '#FF8A80', fontSize: 12, marginTop: 8, textAlign: 'center' }}>
            {finalizar.error?.response?.data?.message || 'Erro ao registrar venda.'}
          </p>
        )}
      </div>

      {/* Modal assinatura */}
      <Modal open={modalAssinatura} onClose={() => { setModalAssinatura(false); setSucesso(true) }} title={`Assinatura — ${cliente.nome}`} width={500}>
        <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 12 }}>
          Peça para o cliente assinar abaixo confirmando a compra fiado de <strong>{fmt(total)}</strong>.
        </p>
        <div style={{ border: '2px solid var(--border)', borderRadius: 10, overflow: 'hidden', marginBottom: 12, background: 'white', touchAction: 'none' }}>
          <canvas ref={canvasRef} width={460} height={180} style={{ width: '100%', height: 180, display: 'block', cursor: 'crosshair' }} />
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between' }}>
          <button className="btn btn-secondary btn-sm" onClick={limparAssinatura}><X size={12} /> Limpar</button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary" onClick={() => { setModalAssinatura(false); setSucesso(true) }}>Pular</button>
            <button className="btn btn-primary" onClick={() => { salvarAssinatura(); setSucesso(true) }}>
              <PenLine size={14} /> Confirmar assinatura
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}