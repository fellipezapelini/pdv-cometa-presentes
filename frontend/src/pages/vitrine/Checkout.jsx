import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { ArrowLeft, Truck, Store, Loader, Check } from 'lucide-react'
import api from '../../api/client'
import { LojaLayout, useTitulo } from './loja'

function fmt(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)
}

function mascaraCEP(v) {
  return v.replace(/\D/g, '').replace(/(\d{5})(\d)/, '$1-$2').slice(0, 9)
}

export default function Checkout({ carrinho, setCarrinho }) {
  const navigate = useNavigate()
  useTitulo('Finalizar compra')
  const [etapa, setEtapa] = useState(1) // 1=dados, 2=entrega, 3=pagamento
  const [form, setForm] = useState({ nome: '', email: '', cpf: '', telefone: '' })
  const [entrega, setEntrega] = useState({ tipo: 'retirada', cep: '', endereco: '', cidade: '', uf: '', numero: '' })
  const [opcoesFretes, setOpcoesFretes] = useState([])
  const [freteSelecionado, setFreteSelecionado] = useState(null)
  const [calculandoFrete, setCalculandoFrete] = useState(false)
  const [erroFrete, setErroFrete] = useState('')

  const totalProdutos = carrinho.reduce((s, i) => s + i.preco * i.quantidade, 0)
  const totalPedido = totalProdutos + (freteSelecionado?.preco || 0)

  async function calcularFrete() {
    const cep = entrega.cep.replace(/\D/g, '')
    if (cep.length !== 8) { setErroFrete('CEP inválido.'); return }
    setCalculandoFrete(true)
    setErroFrete('')
    try {
      // Dimensões padrão simplificadas por item
      const itens = carrinho.map(i => ({
        peso: 0.3, altura: 10, largura: 15, comprimento: 20,
        quantidade: i.quantidade,
      }))
      const r = await api.post('/vitrine/frete/calcular', { cep_destino: cep, itens })
      setOpcoesFretes(r.data)
    } catch {
      setErroFrete('Não foi possível calcular o frete para este CEP.')
    } finally {
      setCalculandoFrete(false)
    }
  }

  async function buscarCEP(cep) {
    const c = cep.replace(/\D/g, '')
    if (c.length !== 8) return
    try {
      const r = await fetch(`https://viacep.com.br/ws/${c}/json/`)
      const d = await r.json()
      if (!d.erro) {
        setEntrega(p => ({ ...p, endereco: d.logradouro, cidade: d.localidade, uf: d.uf }))
      }
    } catch {}
  }

  const criarPedido = useMutation({
    mutationFn: () => api.post('/vitrine/pedidos', {
      comprador_nome: form.nome,
      comprador_email: form.email,
      comprador_cpf: form.cpf || null,
      comprador_telefone: form.telefone || null,
      tipo_entrega: entrega.tipo,
      cep_destino: entrega.tipo === 'envio' ? entrega.cep.replace(/\D/g, '') : null,
      endereco_destino: entrega.tipo === 'envio' ? `${entrega.endereco}, ${entrega.numero}` : null,
      cidade_destino: entrega.tipo === 'envio' ? entrega.cidade : null,
      uf_destino: entrega.tipo === 'envio' ? entrega.uf : null,
      transportadora: freteSelecionado?.nome || null,
      valor_frete: freteSelecionado?.preco || 0,
      prazo_entrega: freteSelecionado?.prazo || null,
      itens: carrinho.map(i => ({ produto_id: i.produto_id, quantidade: i.quantidade })),
    }),
    onSuccess: (r) => {
      const { pedido, mp_preference_id, mp_public_key } = r.data
      setCarrinho([])
      // Redireciona para o Mercado Pago
      if (mp_preference_id) {
        window.location.href = `https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=${mp_preference_id}`
      } else {
        navigate(`/pedido/${pedido.codigo}`)
      }
    },
  })

  if (carrinho.length === 0) {
    navigate('/')
    return null
  }

  return (
    <LojaLayout>
      <div style={{ maxWidth: 820, margin: '0 auto', padding: '28px 16px 8px' }}>
        <button onClick={() => navigate('/carrinho')} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: '#6B6860', fontSize: 14, marginBottom: 24, fontFamily: 'DM Sans' }}>
          <ArrowLeft size={16} /> Voltar ao carrinho
        </button>

        <h1 style={{ fontFamily: 'Syne', fontSize: 24, fontWeight: 800, marginBottom: 28 }}>Finalizar compra</h1>

        {/* Progresso */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 32 }}>
          {['Seus dados', 'Entrega', 'Pagamento'].map((label, i) => (
            <div key={i} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                background: etapa > i + 1 ? '#1A7A4A' : etapa === i + 1 ? '#E8400A' : '#E4E2DC',
                color: etapa >= i + 1 ? 'white' : '#A09E98',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700,
              }}>
                {etapa > i + 1 ? <Check size={14} /> : i + 1}
              </div>
              <span style={{ fontSize: 13, fontWeight: etapa === i + 1 ? 600 : 400, color: etapa === i + 1 ? '#1A1916' : '#A09E98' }}>{label}</span>
              {i < 2 && <div style={{ flex: 1, height: 1, background: '#E4E2DC', marginLeft: 8 }} />}
            </div>
          ))}
        </div>

        <div className="vt-ck-grade" style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 24, alignItems: 'start' }}>
          <div>
            {/* Etapa 1 — Dados */}
            {etapa === 1 && (
              <div style={{ background: 'white', border: '1px solid #E4E2DC', borderRadius: 12, padding: 24 }}>
                <h2 style={{ fontFamily: 'Syne', fontSize: 17, fontWeight: 700, marginBottom: 20 }}>Seus dados</h2>
                <div className="vt-ck-campos" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div style={{ gridColumn: '1/-1' }}>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#6B6860', marginBottom: 5 }}>Nome completo *</label>
                    <input value={form.nome} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))} style={{ width: '100%', padding: '9px 12px', border: '1px solid #E4E2DC', borderRadius: 8, fontSize: 14, fontFamily: 'DM Sans', outline: 'none' }} />
                  </div>
                  <div style={{ gridColumn: '1/-1' }}>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#6B6860', marginBottom: 5 }}>E-mail *</label>
                    <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} style={{ width: '100%', padding: '9px 12px', border: '1px solid #E4E2DC', borderRadius: 8, fontSize: 14, fontFamily: 'DM Sans', outline: 'none' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#6B6860', marginBottom: 5 }}>CPF</label>
                    <input value={form.cpf} onChange={e => setForm(p => ({ ...p, cpf: e.target.value }))} placeholder="000.000.000-00" style={{ width: '100%', padding: '9px 12px', border: '1px solid #E4E2DC', borderRadius: 8, fontSize: 14, fontFamily: 'DM Sans', outline: 'none' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#6B6860', marginBottom: 5 }}>Telefone / WhatsApp</label>
                    <input value={form.telefone} onChange={e => setForm(p => ({ ...p, telefone: e.target.value }))} placeholder="(43) 99999-9999" style={{ width: '100%', padding: '9px 12px', border: '1px solid #E4E2DC', borderRadius: 8, fontSize: 14, fontFamily: 'DM Sans', outline: 'none' }} />
                  </div>
                </div>
                <button
                  disabled={!form.nome || !form.email}
                  onClick={() => setEtapa(2)}
                  style={{ marginTop: 20, width: '100%', background: '#E8400A', color: 'white', border: 'none', borderRadius: 10, padding: '12px', fontSize: 14, fontWeight: 600, cursor: !form.nome || !form.email ? 'not-allowed' : 'pointer', opacity: !form.nome || !form.email ? 0.5 : 1, fontFamily: 'Syne' }}
                >
                  Continuar →
                </button>
              </div>
            )}

            {/* Etapa 2 — Entrega */}
            {etapa === 2 && (
              <div style={{ background: 'white', border: '1px solid #E4E2DC', borderRadius: 12, padding: 24 }}>
                <h2 style={{ fontFamily: 'Syne', fontSize: 17, fontWeight: 700, marginBottom: 20 }}>Como deseja receber?</h2>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
                  {[
                    { value: 'retirada', icon: Store, label: 'Retirar na loja', sub: 'Av. Londrina, 323 · Ibiporã' },
                    { value: 'envio', icon: Truck, label: 'Receber em casa', sub: 'Entrega para todo o Brasil' },
                  ].map(({ value, icon: Icon, label, sub }) => (
                    <div key={value} onClick={() => setEntrega(p => ({ ...p, tipo: value }))} style={{ border: `2px solid ${entrega.tipo === value ? '#E8400A' : '#E4E2DC'}`, borderRadius: 10, padding: '14px 16px', cursor: 'pointer', background: entrega.tipo === value ? '#FFF0EB' : 'white', transition: 'all 0.15s' }}>
                      <Icon size={20} color={entrega.tipo === value ? '#E8400A' : '#A09E98'} style={{ marginBottom: 6 }} />
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{label}</div>
                      <div style={{ fontSize: 12, color: '#A09E98', marginTop: 2 }}>{sub}</div>
                    </div>
                  ))}
                </div>

                {entrega.tipo === 'envio' && (
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 12, marginBottom: 12 }}>
                      <div>
                        <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#6B6860', marginBottom: 5 }}>CEP *</label>
                        <input
                          value={entrega.cep}
                          onChange={e => setEntrega(p => ({ ...p, cep: mascaraCEP(e.target.value) }))}
                          onBlur={e => buscarCEP(e.target.value)}
                          placeholder="00000-000"
                          style={{ width: '100%', padding: '9px 12px', border: '1px solid #E4E2DC', borderRadius: 8, fontSize: 14, fontFamily: 'DM Sans', outline: 'none' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#6B6860', marginBottom: 5 }}>Endereço</label>
                        <input value={entrega.endereco} onChange={e => setEntrega(p => ({ ...p, endereco: e.target.value }))} style={{ width: '100%', padding: '9px 12px', border: '1px solid #E4E2DC', borderRadius: 8, fontSize: 14, fontFamily: 'DM Sans', outline: 'none' }} />
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 60px', gap: 12, marginBottom: 14 }}>
                      <div>
                        <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#6B6860', marginBottom: 5 }}>Número</label>
                        <input value={entrega.numero} onChange={e => setEntrega(p => ({ ...p, numero: e.target.value }))} style={{ width: '100%', padding: '9px 12px', border: '1px solid #E4E2DC', borderRadius: 8, fontSize: 14, fontFamily: 'DM Sans', outline: 'none' }} />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#6B6860', marginBottom: 5 }}>Cidade</label>
                        <input value={entrega.cidade} onChange={e => setEntrega(p => ({ ...p, cidade: e.target.value }))} style={{ width: '100%', padding: '9px 12px', border: '1px solid #E4E2DC', borderRadius: 8, fontSize: 14, fontFamily: 'DM Sans', outline: 'none' }} />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#6B6860', marginBottom: 5 }}>UF</label>
                        <input value={entrega.uf} onChange={e => setEntrega(p => ({ ...p, uf: e.target.value }))} maxLength={2} style={{ width: '100%', padding: '9px 12px', border: '1px solid #E4E2DC', borderRadius: 8, fontSize: 14, fontFamily: 'DM Sans', outline: 'none' }} />
                      </div>
                    </div>

                    <button onClick={calcularFrete} disabled={calculandoFrete || !entrega.cep} style={{ background: '#1A1916', color: 'white', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 13, cursor: 'pointer', fontFamily: 'DM Sans', display: 'flex', alignItems: 'center', gap: 6 }}>
                      {calculandoFrete ? <><Loader size={14} /> Calculando...</> : 'Calcular frete'}
                    </button>

                    {erroFrete && <p style={{ color: '#C0392B', fontSize: 13, marginTop: 8 }}>{erroFrete}</p>}

                    {opcoesFretes.length > 0 && (
                      <div style={{ marginTop: 16 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#6B6860', marginBottom: 8 }}>Escolha a transportadora:</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {opcoesFretes.map(op => (
                            <div key={op.id} onClick={() => setFreteSelecionado(op)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: `2px solid ${freteSelecionado?.id === op.id ? '#E8400A' : '#E4E2DC'}`, borderRadius: 8, padding: '10px 14px', cursor: 'pointer', background: freteSelecionado?.id === op.id ? '#FFF0EB' : 'white' }}>
                              <div>
                                <div style={{ fontWeight: 600, fontSize: 13 }}>{op.nome} <span style={{ color: '#A09E98', fontWeight: 400 }}>· {op.empresa}</span></div>
                                <div style={{ fontSize: 12, color: '#A09E98' }}>Prazo: {op.prazo} dias úteis</div>
                              </div>
                              <span style={{ fontWeight: 700, color: '#E8400A' }}>{fmt(op.preco)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <button
                  disabled={entrega.tipo === 'envio' && !freteSelecionado}
                  onClick={() => setEtapa(3)}
                  style={{ width: '100%', background: '#E8400A', color: 'white', border: 'none', borderRadius: 10, padding: '12px', fontSize: 14, fontWeight: 600, cursor: entrega.tipo === 'envio' && !freteSelecionado ? 'not-allowed' : 'pointer', opacity: entrega.tipo === 'envio' && !freteSelecionado ? 0.5 : 1, fontFamily: 'Syne' }}
                >
                  Continuar →
                </button>
              </div>
            )}

            {/* Etapa 3 — Pagamento */}
            {etapa === 3 && (
              <div style={{ background: 'white', border: '1px solid #E4E2DC', borderRadius: 12, padding: 24 }}>
                <h2 style={{ fontFamily: 'Syne', fontSize: 17, fontWeight: 700, marginBottom: 8 }}>Pagamento</h2>
                <p style={{ color: '#6B6860', fontSize: 13, marginBottom: 24, lineHeight: 1.6 }}>
                  Ao clicar em "Ir para pagamento", você será redirecionado para o Mercado Pago onde poderá pagar com PIX, cartão de crédito ou débito.
                </p>

                <div style={{ background: '#F2F1EE', borderRadius: 10, padding: '14px 16px', marginBottom: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                    <span style={{ color: '#6B6860' }}>Produtos</span>
                    <span>{fmt(totalProdutos)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 10 }}>
                    <span style={{ color: '#6B6860' }}>Frete ({entrega.tipo === 'retirada' ? 'Retirada na loja' : freteSelecionado?.nome})</span>
                    <span>{entrega.tipo === 'retirada' ? 'Grátis' : fmt(freteSelecionado?.preco)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 16, borderTop: '1px solid #E4E2DC', paddingTop: 10 }}>
                    <span>Total</span>
                    <span style={{ color: '#E8400A', fontFamily: 'Syne' }}>{fmt(totalPedido)}</span>
                  </div>
                </div>

                {criarPedido.isError && (
                  <p style={{ color: '#C0392B', fontSize: 13, marginBottom: 12 }}>
                    {criarPedido.error?.response?.data?.message || 'Erro ao criar pedido. Tente novamente.'}
                  </p>
                )}

                <button
                  onClick={() => criarPedido.mutate()}
                  disabled={criarPedido.isPending}
                  style={{ width: '100%', background: '#E8400A', color: 'white', border: 'none', borderRadius: 10, padding: '14px', fontSize: 15, fontWeight: 700, cursor: criarPedido.isPending ? 'not-allowed' : 'pointer', fontFamily: 'Syne', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                >
                  {criarPedido.isPending ? <><Loader size={16} /> Criando pedido...</> : 'Ir para pagamento →'}
                </button>
              </div>
            )}
          </div>

          {/* Resumo */}
          <div style={{ background: 'white', border: '1px solid #E4E2DC', borderRadius: 12, padding: 20, position: 'sticky', top: 150 }} className="vt-ck-resumo">
            <h3 style={{ fontFamily: 'Syne', fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Resumo</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
              {carrinho.map(i => (
                <div key={i.produto_id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: '#6B6860', flex: 1, marginRight: 8 }}>{i.nome} <span style={{ color: '#A09E98' }}>×{i.quantidade}</span></span>
                  <span style={{ fontWeight: 500 }}>{fmt(i.preco * i.quantidade)}</span>
                </div>
              ))}
            </div>
            <div style={{ borderTop: '1px solid #E4E2DC', paddingTop: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 700 }}>
                <span>Total</span>
                <span style={{ color: '#E8400A', fontFamily: 'Syne' }}>{fmt(totalPedido)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </LojaLayout>
  )
}
