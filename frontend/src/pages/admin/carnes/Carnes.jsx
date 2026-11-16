import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, AlertTriangle, Search, Printer } from 'lucide-react'
import PageHeader from '../../../components/PageHeader'
import api from '../../../api/client'

function fmt(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)
}

function fmtData(d) {
  if (!d) return '—'
  const soData = d.split('T')[0]
  const [ano, mes, dia] = soData.split('-')
  if (!ano || !mes || !dia) return '—'
  return `${dia}/${mes}/${ano}`
}

function statusParcela(p) {
  if (p.status === 'pago') return { label: 'Pago', cor: 'var(--success)', bg: 'var(--success-bg)' }
  const hoje = new Date(); hoje.setHours(0,0,0,0)
  const venc = new Date(p.vencimento + 'T00:00:00')
  if (venc < hoje) return { label: 'Atrasada', cor: 'var(--danger)', bg: '#FEF2F2' }
  const diffDias = Math.ceil((venc - hoje) / 86400000)
  if (diffDias <= 5) return { label: 'Vence em breve', cor: '#B45309', bg: '#FFFBEB' }
  return { label: 'Pendente', cor: 'var(--text-3)', bg: 'var(--surface-2)' }
}

// ─── PIX + impressão (mesma lógica do PDV) ────────────────────────────
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

export default function Carnes() {
  const qc = useQueryClient()
  const [filtro, setFiltro] = useState('pendente')
  const [busca, setBusca] = useState('')
  const [pagandoId, setPagandoId] = useState(null)
  const [formaEscolhida, setFormaEscolhida] = useState('dinheiro')
  const [reimprimindo, setReimprimindo] = useState(null)

  const { data, isLoading } = useQuery({
    queryKey: ['parcelas', filtro],
    queryFn: () => api.get('/parcelas', { params: filtro !== 'todas' ? { status: filtro } : {} }).then(r => r.data),
  })

  const marcarPaga = useMutation({
    mutationFn: (id) => api.post(`/parcelas/${id}/pagar`, { forma_pagamento: formaEscolhida }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['parcelas'] }),
  })

  const desmarcar = useMutation({
    mutationFn: (id) => api.post(`/parcelas/${id}/desfazer`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['parcelas'] }),
  })

  const cancelarVenda = useMutation({
    mutationFn: (vendaId) => api.delete(`/vendas/${vendaId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['parcelas'] }),
  })

  async function handleReimprimir(vendaId, clienteNome) {
    setReimprimindo(vendaId)
    try {
      const r = await api.get(`/vendas/${vendaId}`)
      imprimirCarne(r.data, clienteNome)
    } catch {
      alert('Erro ao buscar dados do carnê.')
    }
    setReimprimindo(null)
  }

  const parcelas = (data || []).filter(p =>
    !busca || p.cliente?.nome?.toLowerCase().includes(busca.toLowerCase())
  )

  const porCarne = parcelas.reduce((acc, p) => {
    const key = p.venda_id
    if (!acc[key]) acc[key] = { venda_id: key, cliente: p.cliente, itens: [] }
    acc[key].itens.push(p)
    return acc
  }, {})

  const carnes = Object.values(porCarne).sort((a, b) => {
    const va = a.itens.find(p => p.status === 'pendente')?.vencimento || a.itens[0].vencimento
    const vb = b.itens.find(p => p.status === 'pendente')?.vencimento || b.itens[0].vencimento
    return new Date(va) - new Date(vb)
  })

  const atrasadas = parcelas.filter(p => p.status === 'pendente' && new Date(p.vencimento + 'T00:00:00') < new Date().setHours(0,0,0,0))
  const totalPendente = parcelas.filter(p => p.status === 'pendente').reduce((s, p) => s + parseFloat(p.valor), 0)

  return (
    <div style={{ padding: 16 }} className="page-enter">
      <PageHeader title="Carnês" subtitle="Vendas parceladas com vencimento" />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginBottom: 16 }}>
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase' }}>Total pendente</div>
          <div style={{ fontFamily: 'Syne', fontSize: 22, fontWeight: 800 }}>{fmt(totalPendente)}</div>
        </div>
        <div className="card" style={{ textAlign: 'center', background: atrasadas.length ? '#FEF2F2' : undefined }}>
          <div style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase' }}>Parcelas atrasadas</div>
          <div style={{ fontFamily: 'Syne', fontSize: 22, fontWeight: 800, color: atrasadas.length ? 'var(--danger)' : undefined }}>{atrasadas.length}</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {[['pendente','Pendentes'],['pago','Pagas'],['todas','Todas']].map(([v, l]) => (
            <button key={v} onClick={() => setFiltro(v)} style={{
              padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 500,
              background: filtro === v ? '#1A1916' : 'white',
              color: filtro === v ? 'white' : 'var(--text-2)',
              border: `1px solid ${filtro === v ? '#1A1916' : 'var(--border)'}`,
              cursor: 'pointer',
            }}>{l}</button>
          ))}
        </div>
        <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }} />
          <input placeholder="Buscar cliente..." value={busca} onChange={e => setBusca(e.target.value)} style={{ paddingLeft: 30, fontSize: 13 }} />
        </div>
      </div>

      {isLoading ? (
        <div style={{ textAlign: 'center', color: 'var(--text-3)', padding: 32 }}>Carregando...</div>
      ) : carnes.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text-3)' }}>Nenhum carnê encontrado.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {carnes.map(carne => {
            const pagas = carne.itens.filter(p => p.status === 'pago').length
            const totalCarne = carne.itens.reduce((s, p) => s + parseFloat(p.valor), 0)
            return (
              <div key={carne.venda_id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{carne.cliente?.nome}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)' }}>Venda #{carne.venda_id} · {pagas}/{carne.itens.length} parcelas pagas</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 16 }}>{fmt(totalCarne)}</div>
                    <button
                      className="btn btn-secondary btn-sm"
                      disabled={reimprimindo === carne.venda_id}
                      onClick={() => handleReimprimir(carne.venda_id, carne.cliente?.nome)}
                      style={{ display: 'flex', alignItems: 'center', gap: 5 }}
                    >
                      <Printer size={12} /> {reimprimindo === carne.venda_id ? 'Gerando...' : 'Reimprimir'}
                    </button>
                    <button
                      className="btn btn-danger btn-sm"
                      disabled={cancelarVenda.isPending}
                      onClick={() => {
                        if (confirm(`Cancelar a Venda #${carne.venda_id} de ${carne.cliente?.nome}? Isso vai apagar o carnê e devolver o estoque dos itens cadastrados.`)) {
                          cancelarVenda.mutate(carne.venda_id)
                        }
                      }}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '12px 16px' }}>
                  {carne.itens.sort((a,b) => a.numero - b.numero).map(p => {
                    const st = statusParcela(p)
                    return (
                      <div key={p.id} style={{ border: `1px solid ${st.cor === 'var(--text-3)' ? 'var(--border)' : st.cor}`, borderRadius: 10, padding: '10px 12px', minWidth: 140, background: st.bg }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: st.cor }}>Parcela {p.numero}</span>
                          {p.status === 'pendente' && st.label === 'Atrasada' && <AlertTriangle size={12} color="var(--danger)" />}
                          {p.status === 'pago' && <Check size={12} color="var(--success)" />}
                        </div>
                        <div style={{ fontWeight: 700, fontSize: 15 }}>{fmt(p.valor)}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 8 }}>Venc: {fmtData(p.vencimento)}</div>
                        {p.status === 'pendente' ? (
                          pagandoId === p.id ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                              <select value={formaEscolhida} onChange={e => setFormaEscolhida(e.target.value)} style={{ fontSize: 11, padding: '4px 6px' }}>
                                <option value="dinheiro">Dinheiro</option>
                                <option value="pix">PIX</option>
                                <option value="debito">Débito</option>
                                <option value="credito">Crédito</option>
                              </select>
                              <div style={{ display: 'flex', gap: 4 }}>
                                <button className="btn btn-secondary btn-sm" style={{ flex: 1, fontSize: 10, padding: '4px' }} onClick={() => setPagandoId(null)}>Cancelar</button>
                                <button className="btn btn-primary btn-sm" style={{ flex: 1, fontSize: 10, padding: '4px' }} onClick={() => { marcarPaga.mutate(p.id); setPagandoId(null) }}>Confirmar</button>
                              </div>
                            </div>
                          ) : (
                            <button className="btn btn-primary btn-sm" style={{ width: '100%', justifyContent: 'center', fontSize: 11 }} onClick={() => setPagandoId(p.id)}>Marcar paga</button>
                          )
                        ) : (
                          <button className="btn btn-secondary btn-sm" style={{ width: '100%', justifyContent: 'center', fontSize: 11 }} onClick={() => { if (confirm('Desfazer pagamento desta parcela?')) desmarcar.mutate(p.id) }}>Desfazer</button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}