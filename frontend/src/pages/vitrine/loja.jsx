/* Peças compartilhadas da vitrine: dados da loja, carrinho, layout, card de produto. */
/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ShoppingBag, Search, MapPin, Truck, Store, ShieldCheck, Clock, Phone, Check, Plus } from 'lucide-react'
import api from '../../api/client'
import logo from '../../assets/logo.jpg.jpg'
import './vitrine.css'

// ─── Dados da loja (edite aqui) ──────────────────────────────────────────────
export const LOJA = {
  nome: 'Cometa Presentes',
  slogan: 'Papelaria, presentes e utilidades',
  endereco: 'Av. Londrina, 323 · Jardim San Rafael',
  cidade: 'Ibiporã · PR',
  cnpj: '07.683.355/0001-71',
  anos: 21,
  mapa: 'https://www.google.com/maps/search/?api=1&query=Av.+Londrina,+323,+Ibipor%C3%A3+-+PR',
  whatsapp: '', // ex.: '5543999999999' — quando preenchido, aparece o botão de WhatsApp
  horario: '',  // ex.: 'Seg a sex 8h–18h · Sáb 8h–12h'
}

export function fmt(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)
}

export function useTitulo(titulo) {
  useEffect(() => {
    document.title = titulo ? `${titulo} · ${LOJA.nome}` : `${LOJA.nome} · ${LOJA.slogan} em Ibiporã`
  }, [titulo])
}

// ─── Carrinho (guardado no navegador) ────────────────────────────────────────
const CHAVE_CARRINHO = 'cometa_carrinho'
const CarrinhoCtx = createContext(null)

export function CarrinhoProvider({ children }) {
  const [carrinho, setCarrinho] = useState(() => {
    try { return JSON.parse(localStorage.getItem(CHAVE_CARRINHO)) || [] } catch { return [] }
  })
  const [aviso, setAviso] = useState(null)
  const timer = useRef(null)

  useEffect(() => {
    try { localStorage.setItem(CHAVE_CARRINHO, JSON.stringify(carrinho)) } catch { /* modo privado */ }
  }, [carrinho])

  function adicionar(produto, quantidade = 1) {
    setCarrinho(c => {
      const max = produto.max_compra || 99
      const existe = c.find(i => i.produto_id === produto.id)
      if (existe) return c.map(i => i.produto_id === produto.id ? { ...i, quantidade: Math.min(max, i.quantidade + quantidade), max } : i)
      return [...c, { produto_id: produto.id, nome: produto.nome, preco: produto.preco, foto_url: produto.foto_url, quantidade: Math.min(max, quantidade), max }]
    })
    setAviso(produto.nome)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setAviso(null), 3500)
  }

  return (
    <CarrinhoCtx.Provider value={{ carrinho, setCarrinho, adicionar, aviso, fecharAviso: () => setAviso(null) }}>
      {children}
    </CarrinhoCtx.Provider>
  )
}

export function useCarrinho() { return useContext(CarrinhoCtx) }

// ─── Imagem do produto (com arte padrão quando não há foto) ──────────────────
const TONS = [['#EEF1FB', '#22348A'], ['#FFF1EA', '#C93507'], ['#FFF8E1', '#A67C00'], ['#EAF6F0', '#13804B'], ['#F3EEFB', '#6B3FA0'], ['#EAF4FB', '#1F6F9E']]

export function FotoProduto({ produto }) {
  const [erro, setErro] = useState(false)
  if (produto.foto_url && !erro) {
    return <img src={produto.foto_url} alt={produto.nome} loading="lazy" onError={() => setErro(true)} />
  }
  const palavras = (produto.nome || '?').split(' ').filter(w => /^[A-Za-zÀ-ú]/.test(w))
  const letras = (palavras[0]?.[0] || '?') + (palavras[1]?.[0] || '')
  const [fundo, cor] = TONS[(produto.id || 0) % TONS.length]
  return (
    <div className="vt-sem-foto" style={{ background: fundo, color: cor }}>
      <div className="vt-sem-foto-letras">{letras.toUpperCase()}</div>
      <img src={logo} alt="" className="vt-sem-foto-logo" />
    </div>
  )
}

// ─── Card de produto ─────────────────────────────────────────────────────────
export function ProdutoCard({ produto }) {
  const navigate = useNavigate()
  const { adicionar } = useCarrinho()
  const [ok, setOk] = useState(false)

  function add(e) {
    e.stopPropagation()
    adicionar(produto)
    setOk(true)
    setTimeout(() => setOk(false), 1400)
  }

  return (
    <div className="vt-card" onClick={() => navigate(`/produtos/${produto.id}`)}>
      <div className="vt-card-foto">
        <FotoProduto produto={produto} />
        {produto.estoque === 'ultimas' && <span className="vt-selo-ultimas">Últimas unidades</span>}
      </div>
      <div className="vt-card-corpo">
        {produto.categoria && produto.categoria.nome !== 'Outros' && <div className="vt-card-cat">{produto.categoria.nome}</div>}
        <Link to={`/produtos/${produto.id}`} className="vt-card-nome" onClick={e => e.stopPropagation()}>{produto.nome}</Link>
        <div className="vt-card-preco">{fmt(produto.preco)}</div>
        <button className={`vt-card-add ${ok ? 'ok' : ''}`} onClick={add}>
          {ok ? <><Check size={15} /> Adicionado</> : <><Plus size={15} /> Adicionar</>}
        </button>
      </div>
    </div>
  )
}

export function GradeCarregando({ n = 8 }) {
  return (
    <div className="vt-grade">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="vt-card" style={{ cursor: 'default' }}>
          <div className="vt-card-foto vt-skel" style={{ borderRadius: 0 }} />
          <div className="vt-card-corpo">
            <div className="vt-skel" style={{ height: 14, width: '90%' }} />
            <div className="vt-skel" style={{ height: 14, width: '60%' }} />
            <div className="vt-skel" style={{ height: 22, width: '40%', marginTop: 8 }} />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Layout: aviso + cabeçalho + categorias + rodapé ─────────────────────────
export function LojaLayout({ children }) {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { carrinho, aviso, fecharAviso } = useCarrinho()
  const [busca, setBusca] = useState(params.get('busca') || '')
  const totalItens = carrinho.reduce((s, i) => s + i.quantidade, 0)
  const catAtual = params.get('categoria') || ''

  const { data: categorias } = useQuery({
    queryKey: ['vitrine-categorias'],
    queryFn: () => api.get('/vitrine/categorias').then(r => r.data),
    staleTime: 5 * 60_000,
  })

  // Acompanha a busca da URL (ex.: ao voltar no navegador)
  const buscaUrl = params.get('busca') || ''
  const [ultimaUrl, setUltimaUrl] = useState(buscaUrl)
  if (buscaUrl !== ultimaUrl) { setUltimaUrl(buscaUrl); setBusca(buscaUrl) }

  function buscar(e) {
    e.preventDefault()
    const p = new URLSearchParams()
    if (busca.trim()) p.set('busca', busca.trim())
    navigate(`/${p.toString() ? `?${p}` : ''}#produtos`)
  }

  const mostrarCategorias = (categorias?.length || 0) > 1

  return (
    <div className="vt">
      <div className="vt-aviso">
        <div className="vt-container">
          <span><Store size={13} /> Retire grátis na loja em Ibiporã</span>
          <span><Truck size={13} /> Enviamos para todo o Brasil</span>
          <span><ShieldCheck size={13} /> Pagamento seguro pelo Mercado Pago</span>
        </div>
      </div>

      <header className="vt-header">
        <div className="vt-container vt-header-linha">
          <Link to="/" className="vt-marca" onClick={() => setBusca('')}>
            <img src={logo} alt="Cometa Presentes" />
            <div>
              <div className="vt-marca-nome">Cometa</div>
              <div className="vt-marca-sub">Presentes · Ibiporã</div>
            </div>
          </Link>

          <form className="vt-busca" onSubmit={buscar} role="search">
            <input type="search" placeholder="O que você procura?" value={busca} onChange={e => setBusca(e.target.value)} aria-label="Buscar produtos" />
            <button type="submit" aria-label="Buscar"><Search size={17} /></button>
          </form>

          <div className="vt-acoes">
            <button className="vt-btn-carrinho" onClick={() => navigate('/carrinho')} aria-label="Carrinho">
              <ShoppingBag size={19} />
              <span className="vt-btn-carrinho-txt">Carrinho</span>
              {totalItens > 0 && <span className="vt-badge-carrinho">{totalItens}</span>}
            </button>
          </div>
        </div>

        {mostrarCategorias && (
          <nav className="vt-nav" aria-label="Categorias">
            <div className="vt-container">
              <button className={`vt-chip ${!catAtual ? 'ativo' : ''}`} onClick={() => navigate('/#produtos')}>Todos</button>
              {categorias.map(c => (
                <button key={c.id} className={`vt-chip ${catAtual === c.slug ? 'ativo' : ''}`} onClick={() => navigate(`/?categoria=${c.slug}#produtos`)}>
                  {c.nome}
                </button>
              ))}
            </div>
          </nav>
        )}
      </header>

      <main className="vt-main">{children}</main>

      <footer className="vt-rodape">
        <div className="vt-container">
          <div className="vt-rodape-grade">
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <img src={logo} alt="" style={{ width: 42, height: 42, background: '#fff', borderRadius: 10, padding: 3 }} />
                <div style={{ fontFamily: 'Syne', fontWeight: 800, color: '#fff', fontSize: 18 }}>{LOJA.nome}</div>
              </div>
              <p style={{ maxWidth: 340 }}>
                Há {LOJA.anos} anos em Ibiporã com papelaria, presentes, utilidades, brinquedos, cosméticos e muito mais.
              </p>
              <div className="vt-pagamentos">
                <span>Pix</span><span>Cartão de crédito</span><span>Mercado Pago</span>
              </div>
            </div>
            <div>
              <h4>Visite a loja</h4>
              <ul>
                <li><MapPin size={15} style={{ marginTop: 3, flexShrink: 0 }} /><a href={LOJA.mapa} target="_blank" rel="noreferrer">{LOJA.endereco}<br />{LOJA.cidade}</a></li>
                {LOJA.horario && <li><Clock size={15} style={{ marginTop: 3, flexShrink: 0 }} />{LOJA.horario}</li>}
                {LOJA.whatsapp && <li><Phone size={15} style={{ marginTop: 3, flexShrink: 0 }} /><a href={`https://wa.me/${LOJA.whatsapp}`} target="_blank" rel="noreferrer">WhatsApp</a></li>}
              </ul>
            </div>
            <div>
              <h4>Compre com tranquilidade</h4>
              <ul>
                <li><Store size={15} style={{ marginTop: 3, flexShrink: 0 }} />Retirada grátis na loja</li>
                <li><Truck size={15} style={{ marginTop: 3, flexShrink: 0 }} />Envio para todo o Brasil</li>
                <li><ShieldCheck size={15} style={{ marginTop: 3, flexShrink: 0 }} />Pagamento processado pelo Mercado Pago</li>
              </ul>
            </div>
          </div>
          <div className="vt-rodape-base">
            <span>© {new Date().getFullYear()} {LOJA.nome} · CNPJ {LOJA.cnpj}</span>
            <button onClick={() => navigate('/admin/login')}>Área do vendedor</button>
          </div>
        </div>
      </footer>

      {LOJA.whatsapp && (
        <a href={`https://wa.me/${LOJA.whatsapp}`} target="_blank" rel="noreferrer" aria-label="Falar no WhatsApp"
          style={{ position: 'fixed', right: 18, bottom: 18, width: 54, height: 54, borderRadius: '50%', background: '#25D366', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px rgba(0,0,0,.2)', zIndex: 90 }}>
          <Phone size={24} />
        </a>
      )}

      {aviso && (
        <div className="vt-toast" role="status">
          <Check size={16} /> <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 220 }}>{aviso}</span> adicionado
          <button onClick={() => { fecharAviso(); navigate('/carrinho') }}>Ver carrinho</button>
        </div>
      )}
    </div>
  )
}
