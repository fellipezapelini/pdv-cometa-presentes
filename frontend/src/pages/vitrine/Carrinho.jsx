import { Link, useNavigate } from 'react-router-dom'
import { Trash2, Plus, Minus, ShoppingBag, ArrowLeft, Store, Truck, ShieldCheck } from 'lucide-react'
import { LojaLayout, FotoProduto, fmt, useCarrinho, useTitulo } from './loja'

export default function Carrinho() {
  const navigate = useNavigate()
  const { carrinho, setCarrinho } = useCarrinho()
  useTitulo('Carrinho')

  function alterar(id, delta) {
    setCarrinho(c => c.map(i => i.produto_id === id
      ? { ...i, quantidade: Math.min(i.max || 99, Math.max(1, i.quantidade + delta)) }
      : i))
  }
  const remover = id => setCarrinho(c => c.filter(i => i.produto_id !== id))

  const total = carrinho.reduce((s, i) => s + i.preco * i.quantidade, 0)
  const itens = carrinho.reduce((s, i) => s + i.quantidade, 0)

  if (carrinho.length === 0) {
    return (
      <LojaLayout>
        <div className="vt-container">
          <div className="vt-vazio" style={{ padding: '80px 20px' }}>
            <ShoppingBag size={52} />
            <h3>Seu carrinho está vazio</h3>
            <p>Que tal dar uma olhada nos nossos produtos?</p>
            <button className="vt-btn vt-btn-azul" style={{ marginTop: 18 }} onClick={() => navigate('/')}>Ver produtos</button>
          </div>
        </div>
      </LojaLayout>
    )
  }

  return (
    <LojaLayout>
      <div className="vt-container">
        <div className="vt-carrinho">
          <div>
            <button onClick={() => navigate('/')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--vt-texto-2)', fontSize: 14, marginBottom: 12, padding: 0 }}>
              <ArrowLeft size={16} /> Continuar comprando
            </button>
            <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 16 }}>Carrinho <span style={{ color: 'var(--vt-texto-3)', fontSize: 18 }}>({itens} {itens === 1 ? 'item' : 'itens'})</span></h1>

            <div className="vt-painel">
              {carrinho.map(item => (
                <div key={item.produto_id} className="vt-item">
                  <Link to={`/produtos/${item.produto_id}`} className="vt-item-foto">
                    <FotoProduto produto={{ id: item.produto_id, nome: item.nome, foto_url: item.foto_url }} />
                  </Link>
                  <div style={{ minWidth: 0 }}>
                    <Link to={`/produtos/${item.produto_id}`} style={{ fontWeight: 500, display: 'block', marginBottom: 4 }}>{item.nome}</Link>
                    <div style={{ color: 'var(--vt-texto-3)', fontSize: 13 }}>{fmt(item.preco)} cada</div>
                  </div>
                  <div className="vt-item-acoes" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div className="vt-qtd" style={{ height: 38 }}>
                      <button onClick={() => alterar(item.produto_id, -1)} aria-label="Diminuir"><Minus size={14} /></button>
                      <span>{item.quantidade}</span>
                      <button onClick={() => alterar(item.produto_id, 1)} disabled={item.quantidade >= (item.max || 99)} aria-label="Aumentar"><Plus size={14} /></button>
                    </div>
                    <strong style={{ fontFamily: 'Syne', fontSize: 17, minWidth: 86, textAlign: 'right' }}>{fmt(item.preco * item.quantidade)}</strong>
                    <button onClick={() => remover(item.produto_id)} aria-label="Remover" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--vt-texto-3)', padding: 4, display: 'flex' }}>
                      <Trash2 size={17} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <aside className="vt-painel vt-resumo">
            <h3 style={{ fontSize: 18, marginBottom: 12 }}>Resumo do pedido</h3>
            <div className="vt-resumo-linha"><span>Produtos ({itens})</span><span>{fmt(total)}</span></div>
            <div className="vt-resumo-linha" style={{ color: 'var(--vt-texto-3)' }}><span>Entrega</span><span>no próximo passo</span></div>
            <div className="vt-resumo-total"><span>Total</span><strong>{fmt(total)}</strong></div>
            <button className="vt-btn vt-btn-comprar vt-btn-bloco" style={{ marginTop: 18 }} onClick={() => navigate('/checkout')}>
              Finalizar compra
            </button>
            <div style={{ display: 'grid', gap: 8, marginTop: 18, fontSize: 13, color: 'var(--vt-texto-2)' }}>
              <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}><Store size={15} /> Retirada grátis na loja</span>
              <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}><Truck size={15} /> Envio para todo o Brasil</span>
              <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}><ShieldCheck size={15} /> Pagamento pelo Mercado Pago</span>
            </div>
          </aside>
        </div>
      </div>
    </LojaLayout>
  )
}
