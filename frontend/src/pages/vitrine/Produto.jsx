import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Minus, Plus, ShoppingBag, Zap, Store, Truck, ShieldCheck, ChevronRight, CircleCheck, CircleAlert } from 'lucide-react'
import api from '../../api/client'
import { LojaLayout, ProdutoCard, FotoProduto, fmt, useCarrinho, useTitulo, LOJA } from './loja'

export default function Produto() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { adicionar } = useCarrinho()
  const [qtd, setQtd] = useState(1)
  const [idAtual, setIdAtual] = useState(id)
  if (id !== idAtual) { setIdAtual(id); setQtd(1) } // trocou de produto (relacionados)

  const { data: p, isLoading, isError } = useQuery({
    queryKey: ['vitrine-produto', id],
    queryFn: () => api.get(`/vitrine/produtos/${id}`).then(r => r.data),
    retry: false,
  })

  useTitulo(p?.nome || (isError ? 'Produto indisponível' : null))

  if (isLoading) {
    return (
      <LojaLayout>
        <div className="vt-container" style={{ padding: '28px 20px' }}>
          <div className="vt-produto">
            <div className="vt-produto-foto vt-skel" />
            <div>
              <div className="vt-skel" style={{ height: 30, width: '80%', marginBottom: 14 }} />
              <div className="vt-skel" style={{ height: 40, width: '35%' }} />
            </div>
          </div>
        </div>
      </LojaLayout>
    )
  }

  if (isError || !p) {
    return (
      <LojaLayout>
        <div className="vt-container">
          <div className="vt-vazio">
            <h3>Este produto não está disponível</h3>
            <p>Ele pode ter esgotado ou saído da vitrine.</p>
            <button className="vt-btn vt-btn-azul" style={{ marginTop: 16 }} onClick={() => navigate('/')}>Ver outros produtos</button>
          </div>
        </div>
      </LojaLayout>
    )
  }

  const max = p.max_compra || 1

  return (
    <LojaLayout>
      <div className="vt-container">
        <nav className="vt-trilha" aria-label="Você está em">
          <Link to="/">Início</Link>
          <ChevronRight size={13} />
          {p.categoria && p.categoria.nome !== 'Outros' && (
            <><Link to={`/?categoria=${p.categoria.slug}#produtos`}>{p.categoria.nome}</Link><ChevronRight size={13} /></>
          )}
          <span style={{ color: 'var(--vt-texto-2)' }}>{p.nome}</span>
        </nav>

        <div className="vt-produto">
          <div className="vt-produto-foto"><FotoProduto produto={p} /></div>

          <div>
            {p.categoria && p.categoria.nome !== 'Outros' && <div className="vt-card-cat">{p.categoria.nome}</div>}
            <h1>{p.nome}</h1>
            <div className="vt-produto-preco">{fmt(p.preco)}</div>
            <div className="vt-produto-disp" style={{ color: p.estoque === 'ultimas' ? '#A06A00' : 'var(--vt-verde)' }}>
              {p.estoque === 'ultimas' ? <><CircleAlert size={16} /> Últimas unidades</> : <><CircleCheck size={16} /> Em estoque</>}
            </div>

            <div className="vt-produto-compra">
              <div className="vt-qtd" aria-label="Quantidade">
                <button onClick={() => setQtd(q => Math.max(1, q - 1))} aria-label="Diminuir"><Minus size={16} /></button>
                <span>{qtd}</span>
                <button onClick={() => setQtd(q => Math.min(max, q + 1))} disabled={qtd >= max} aria-label="Aumentar"><Plus size={16} /></button>
              </div>
              <button className="vt-btn vt-btn-azul" onClick={() => adicionar(p, qtd)}>
                <ShoppingBag size={18} /> Adicionar ao carrinho
              </button>
              <button className="vt-btn vt-btn-comprar" onClick={() => { adicionar(p, qtd); navigate('/carrinho') }}>
                <Zap size={18} /> Comprar agora
              </button>
            </div>

            <div className="vt-info-entrega">
              <div><Store size={20} color="var(--vt-azul-2)" /><p><strong>Retire grátis na loja</strong><span>{LOJA.endereco} · {LOJA.cidade}</span></p></div>
              <div><Truck size={20} color="var(--vt-azul-2)" /><p><strong>Receba em casa</strong><span>Calcule o frete com seu CEP ao finalizar a compra</span></p></div>
              <div><ShieldCheck size={20} color="var(--vt-azul-2)" /><p><strong>Pagamento seguro</strong><span>Pix ou cartão, processado pelo Mercado Pago</span></p></div>
            </div>

            {p.descricao && <div className="vt-descricao">{p.descricao}</div>}
          </div>
        </div>

        {p.relacionados?.length > 0 && (
          <section className="vt-secao">
            <div className="vt-secao-topo"><h2>Você também pode gostar</h2></div>
            <div className="vt-grade">
              {p.relacionados.slice(0, 4).map(r => <ProdutoCard key={r.id} produto={r} />)}
            </div>
          </section>
        )}
      </div>
    </LojaLayout>
  )
}
