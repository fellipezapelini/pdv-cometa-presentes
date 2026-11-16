import { useEffect } from 'react'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import { Store, Truck, ShieldCheck, Award, SearchX, ArrowRight } from 'lucide-react'
import api from '../../api/client'
import logo from '../../assets/logo.jpg.jpg'
import { LojaLayout, ProdutoCard, GradeCarregando, LOJA, useTitulo } from './loja'

const ORDENS = [
  ['relevancia', 'Destaques'],
  ['novidades', 'Novidades'],
  ['menor_preco', 'Menor preço'],
  ['maior_preco', 'Maior preço'],
  ['nome', 'Nome (A–Z)'],
]

export default function Home() {
  const navigate = useNavigate()
  const location = useLocation()
  const [params, setParams] = useSearchParams()
  const busca = params.get('busca') || ''
  const categoria = params.get('categoria') || ''
  const ordem = params.get('ordem') || 'relevancia'
  const filtrando = !!(busca || categoria)

  const { data: categorias } = useQuery({
    queryKey: ['vitrine-categorias'],
    queryFn: () => api.get('/vitrine/categorias').then(r => r.data),
    staleTime: 5 * 60_000,
  })
  const catNome = categorias?.find(c => c.slug === categoria)?.nome

  useTitulo(busca ? `Busca: ${busca}` : catNome || null)

  const { data, isLoading, isError, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['vitrine-produtos', busca, categoria, ordem],
    queryFn: ({ pageParam }) => api.get('/vitrine/produtos', {
      params: { busca: busca || undefined, categoria: categoria || undefined, ordem, page: pageParam },
    }).then(r => r.data),
    initialPageParam: 1,
    getNextPageParam: ult => (ult.current_page < ult.last_page ? ult.current_page + 1 : undefined),
  })

  const produtos = data?.pages.flatMap(p => p.data) || []
  const total = data?.pages[0]?.total ?? 0

  // Leva até a lista quando a busca/categoria muda (link com #produtos)
  useEffect(() => {
    if (location.hash === '#produtos') {
      document.getElementById('produtos')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [location])

  function mudarOrdem(v) {
    const p = new URLSearchParams(params)
    if (v === 'relevancia') p.delete('ordem'); else p.set('ordem', v)
    setParams(p, { replace: true })
  }

  const linkBtn = { background: 'none', border: 'none', color: 'var(--vt-azul-2)', cursor: 'pointer', fontSize: 'inherit', padding: 0, textDecoration: 'underline' }

  return (
    <LojaLayout>
      {!filtrando && (
        <>
          <section className="vt-hero">
            <div className="vt-container">
              <div>
                <div className="vt-hero-selo"><Award size={14} /> Há {LOJA.anos} anos em Ibiporã</div>
                <h1>Tudo para presentear, <em>estudar</em> e organizar.</h1>
                <p>Papelaria, presentes, utilidades, brinquedos e cosméticos. Compre pelo site e retire na loja ou receba em casa.</p>
                <div className="vt-hero-acoes">
                  <a href="#produtos" className="vt-btn vt-btn-comprar">Ver produtos <ArrowRight size={17} /></a>
                  <a href={LOJA.mapa} target="_blank" rel="noreferrer" className="vt-btn" style={{ background: 'rgba(255,255,255,.1)', color: '#fff', border: '1.5px solid rgba(255,255,255,.25)' }}>
                    Como chegar
                  </a>
                </div>
              </div>
              <div className="vt-hero-arte"><div><img src={logo} alt="Cometa Presentes" /></div></div>
            </div>
          </section>

          <div className="vt-container">
            <div className="vt-beneficios">
              <div className="vt-beneficio"><div className="vt-beneficio-icone"><Store size={19} /></div><div><strong>Retire na loja</strong><span>Grátis, em Ibiporã</span></div></div>
              <div className="vt-beneficio"><div className="vt-beneficio-icone"><Truck size={19} /></div><div><strong>Envio para o Brasil</strong><span>Frete calculado no pedido</span></div></div>
              <div className="vt-beneficio"><div className="vt-beneficio-icone"><ShieldCheck size={19} /></div><div><strong>Compra segura</strong><span>Pix e cartão pelo Mercado Pago</span></div></div>
              <div className="vt-beneficio"><div className="vt-beneficio-icone"><Award size={19} /></div><div><strong>{LOJA.anos} anos de loja</strong><span>Atendimento de quem conhece</span></div></div>
            </div>
          </div>
        </>
      )}

      <section className="vt-secao" id="produtos" style={{ scrollMarginTop: 150 }}>
        <div className="vt-container">
          <div className="vt-secao-topo">
            <div>
              <h2>{busca ? `Resultados para “${busca}”` : catNome || 'Nossos produtos'}</h2>
              {!isLoading && (
                <p>
                  {total} produto{total === 1 ? '' : 's'}
                  {filtrando && <> · <button onClick={() => navigate('/#produtos')} style={linkBtn}>ver todos</button></>}
                </p>
              )}
            </div>
            <select className="vt-select" value={ordem} onChange={e => mudarOrdem(e.target.value)} aria-label="Ordenar por">
              {ORDENS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
            </select>
          </div>

          {isLoading ? <GradeCarregando /> : isError ? (
            <div className="vt-vazio"><h3>Não foi possível carregar os produtos</h3><p>Tente atualizar a página em instantes.</p></div>
          ) : produtos.length === 0 ? (
            <div className="vt-vazio">
              <SearchX size={42} />
              <h3>Nada encontrado</h3>
              <p>Tente outra palavra ou <button onClick={() => navigate('/#produtos')} style={linkBtn}>veja todos os produtos</button>.</p>
            </div>
          ) : (
            <>
              <div className="vt-grade">
                {produtos.map(p => <ProdutoCard key={p.id} produto={p} />)}
              </div>
              {hasNextPage && (
                <div style={{ textAlign: 'center', marginTop: 28 }}>
                  <button className="vt-btn vt-btn-claro" onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
                    {isFetchingNextPage ? 'Carregando...' : `Ver mais produtos (${total - produtos.length})`}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </LojaLayout>
  )
}
