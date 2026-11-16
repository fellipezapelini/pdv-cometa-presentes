import { useEffect } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Check, X, Clock, Package, MapPin, Truck } from 'lucide-react'
import api from '../../api/client'
import { LojaLayout } from './loja'

function fmt(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)
}

const statusConfig = {
  pendente:   { label: 'Aguardando pagamento', color: '#92580A', bg: '#FEF3E2', icon: Clock },
  pago:       { label: 'Pagamento confirmado', color: '#1A7A4A', bg: '#E8F5EE', icon: Check },
  separando:  { label: 'Separando seu pedido', color: '#185FA5', bg: '#E6F1FB', icon: Package },
  enviado:    { label: 'Pedido enviado', color: '#185FA5', bg: '#E6F1FB', icon: Truck },
  entregue:   { label: 'Pedido entregue', color: '#1A7A4A', bg: '#E8F5EE', icon: Check },
  cancelado:  { label: 'Pedido cancelado', color: '#C0392B', bg: '#FDECEA', icon: X },
}

export default function ConfirmacaoPedido() {
  const { codigo } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const statusMP = searchParams.get('status')

  const { data: pedido, isLoading } = useQuery({
    queryKey: ['pedido', codigo],
    queryFn: () => api.get(`/vitrine/pedidos/${codigo}`).then(r => r.data),
    refetchInterval: statusMP === 'pendente' ? 5000 : false,
  })

  if (isLoading) return (
    <LojaLayout><div className="vt-vazio">
      <p style={{ color: '#A09E98' }}>Carregando pedido...</p>
    </div></LojaLayout>
  )

  if (!pedido) return (
    <LojaLayout><div className="vt-vazio">
      <p style={{ color: '#C0392B' }}>Pedido não encontrado.</p>
    </div></LojaLayout>
  )

  const cfg = statusConfig[pedido.status] || statusConfig.pendente
  const StatusIcon = cfg.icon

  return (
    <LojaLayout><div style={{ padding: '36px 16px 8px' }}>
      <div style={{ maxWidth: 580, margin: '0 auto' }}>

        {/* Status */}
        <div style={{ background: cfg.bg, borderRadius: 14, padding: '24px', textAlign: 'center', marginBottom: 24 }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
            <StatusIcon size={24} color={cfg.color} />
          </div>
          <h1 style={{ fontFamily: 'Syne', fontSize: 22, fontWeight: 800, color: cfg.color, marginBottom: 6 }}>
            {cfg.label}
          </h1>
          <p style={{ color: cfg.color, opacity: 0.8, fontSize: 14 }}>
            Pedido <strong>{pedido.codigo}</strong>
          </p>
        </div>

        {/* Detalhes */}
        <div style={{ background: 'white', border: '1px solid #E4E2DC', borderRadius: 12, padding: 20, marginBottom: 16 }}>
          <h2 style={{ fontFamily: 'Syne', fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Itens do pedido</h2>
          {pedido.itens?.map(item => (
            <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, padding: '6px 0', borderBottom: '1px solid #F2F1EE' }}>
              <span style={{ color: '#6B6860' }}>{item.nome_produto} <span style={{ color: '#A09E98' }}>×{item.quantidade}</span></span>
              <span style={{ fontWeight: 500 }}>{fmt(item.subtotal)}</span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginTop: 10, color: '#6B6860' }}>
            <span>Frete ({pedido.tipo_entrega === 'retirada' ? 'Retirada na loja' : pedido.transportadora})</span>
            <span>{pedido.valor_frete > 0 ? fmt(pedido.valor_frete) : 'Grátis'}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 16, marginTop: 10, paddingTop: 10, borderTop: '1px solid #E4E2DC' }}>
            <span>Total</span>
            <span style={{ color: '#E8400A', fontFamily: 'Syne' }}>{fmt(pedido.valor_total)}</span>
          </div>
        </div>

        {/* Entrega */}
        <div style={{ background: 'white', border: '1px solid #E4E2DC', borderRadius: 12, padding: 20, marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            {pedido.tipo_entrega === 'retirada' ? <MapPin size={16} color="#E8400A" /> : <Truck size={16} color="#E8400A" />}
            <h2 style={{ fontFamily: 'Syne', fontSize: 15, fontWeight: 700 }}>
              {pedido.tipo_entrega === 'retirada' ? 'Retirada na loja' : 'Entrega'}
            </h2>
          </div>
          {pedido.tipo_entrega === 'retirada' ? (
            <p style={{ color: '#6B6860', fontSize: 13 }}>Av. Londrina, 323 · Jardim San Rafael · Ibiporã, PR</p>
          ) : (
            <div>
              <p style={{ color: '#6B6860', fontSize: 13 }}>{pedido.endereco_destino}, {pedido.cidade_destino} - {pedido.uf_destino}</p>
              {pedido.codigo_rastreio && (
                <p style={{ fontSize: 13, marginTop: 6 }}>Rastreio: <strong>{pedido.codigo_rastreio}</strong></p>
              )}
              {pedido.prazo_entrega && (
                <p style={{ fontSize: 13, color: '#A09E98', marginTop: 4 }}>Prazo estimado: {pedido.prazo_entrega} dias úteis</p>
              )}
            </div>
          )}
        </div>

        <button onClick={() => navigate('/')} style={{ width: '100%', background: '#1A1916', color: 'white', border: 'none', borderRadius: 10, padding: '12px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'Syne' }}>
          Continuar comprando
        </button>
      </div>
    </div></LojaLayout>
  )
}
