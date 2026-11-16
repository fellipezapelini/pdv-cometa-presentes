import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowRight } from 'lucide-react'
import api from '../../../api/client'

function fmt(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)
}

/**
 * Revisão dos produtos "caixa" que a tela antiga de entrada de nota criou junto com a unidade.
 * Cada par precisa ser marcado à mão: a detecção é pelo nome e pode trazer pares errados.
 */
export default function CaixasDuplicadas({ onFechar }) {
  const qc = useQueryClient()
  const [escolhas, setEscolhas] = useState({}) // chave "caixa-unidade" → { marcado, acao, fator }
  const [resultado, setResultado] = useState(null)

  const { data: pares, isLoading } = useQuery({
    queryKey: ['produtos', 'caixas-duplicadas'],
    queryFn: () => api.get('/produtos/caixas-duplicadas').then(r => r.data),
  })

  const chave = p => `${p.caixa_id}-${p.unidade_id}`
  const escolhaDe = p => ({ marcado: false, acao: 'descartar', fator: p.fator_sugerido || '', ...escolhas[chave(p)] })
  const mudar = (p, patch) => setEscolhas(e => ({ ...e, [chave(p)]: { ...escolhaDe(p), ...patch } }))

  // Uma caixa só pode ser resolvida uma vez: marcar um par desmarca os outros da mesma caixa
  function marcar(p, marcado) {
    setEscolhas(e => {
      const novo = { ...e }
      if (marcado) {
        for (const q of pares) {
          if (q.caixa_id === p.caixa_id && chave(q) !== chave(p) && novo[chave(q)]?.marcado) {
            novo[chave(q)] = { ...novo[chave(q)], marcado: false }
          }
        }
      }
      novo[chave(p)] = { ...escolhaDe(p), ...e[chave(p)], marcado }
      return novo
    })
  }

  const marcados = useMemo(() => (pares || []).filter(p => escolhaDe(p).marcado), [pares, escolhas]) // eslint-disable-line react-hooks/exhaustive-deps
  const valorCaixas = marcados.reduce((s, p) => s + Math.max(0, p.caixa_qtd) * parseFloat(p.caixa_custo), 0)
  const faltaFator = marcados.filter(p => escolhaDe(p).acao === 'somar' && !(parseInt(escolhaDe(p).fator) > 0))

  const resolver = useMutation({
    mutationFn: () => api.post('/produtos/caixas-duplicadas', {
      pares: marcados.map(p => {
        const e = escolhaDe(p)
        return { caixa_id: p.caixa_id, unidade_id: p.unidade_id, acao: e.acao, fator: parseInt(e.fator) > 0 ? parseInt(e.fator) : null }
      }),
    }),
    onSuccess: r => {
      setResultado(r.data.resolvidos)
      setEscolhas({})
      qc.invalidateQueries({ queryKey: ['produtos'] })
    },
    onError: err => alert(err?.response?.data?.message || 'Erro ao resolver.'),
  })

  if (resultado) {
    return (
      <div>
        <div style={{ background: 'var(--success-bg)', borderRadius: 8, padding: 12, marginBottom: 12 }}>
          <strong style={{ color: 'var(--success)' }}>✓ {resultado.length} caixa(s) resolvida(s)</strong>
        </div>
        {resultado.map((r, i) => (
          <div key={i} style={{ fontSize: 12, padding: '4px 0', borderBottom: '1px solid var(--surface-2)' }}>
            {r.caixa} → desativada ({r.caixas} cx {r.somadas ? `→ +${r.somadas} un` : 'descartadas'}) · <strong>{r.unidade}</strong>: {r.estoque_unidade} un
          </div>
        ))}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 14 }}>
          <button className="btn btn-secondary" onClick={() => setResultado(null)}>Ver os que sobraram</button>
          <button className="btn btn-primary" onClick={onFechar}>Fechar</button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 12, lineHeight: 1.5 }}>
        A tela antiga de notas criava <strong>um produto para a caixa e outro para a unidade</strong>, e os dois recebiam estoque da mesma mercadoria.
        Marque só os pares em que o da esquerda é realmente a caixa do da direita. Os nomes parecidos podem enganar: confira cada um.
        <ul style={{ margin: '8px 0 0 18px' }}>
          <li><strong>Caixa duplicada</strong> (normal): zera e desativa a caixa. As unidades ficam como estão.</li>
          <li><strong>Somar nas unidades</strong>: só se as caixas estão fisicamente na loja e <em>não</em> foram contadas nas unidades.</li>
        </ul>
        Informando as unidades por caixa, a próxima nota com esse EAN já entra direto na unidade.
      </div>

      {isLoading ? <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-3)' }}>Procurando...</div>
        : !pares?.length ? <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-3)' }}>Nenhuma caixa duplicada encontrada. 🎉</div>
        : (
          <div style={{ maxHeight: '55vh', overflow: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
            {pares.map(p => {
              const e = escolhaDe(p)
              return (
                <div key={chave(p)} style={{ display: 'grid', gridTemplateColumns: '28px 1fr 20px 1fr', gap: 8, alignItems: 'center', padding: '10px 12px', borderBottom: '1px solid var(--surface-2)', background: e.marcado ? '#F0FDF4' : 'white' }}>
                  <input type="checkbox" checked={e.marcado} onChange={ev => marcar(p, ev.target.checked)} style={{ width: 'auto' }} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{p.caixa_nome}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
                      {p.caixa_qtd} cx × {fmt(p.caixa_custo)} = {fmt(Math.max(0, p.caixa_qtd) * p.caixa_custo)} · EAN {p.caixa_sku || '—'}
                      {p.vendas_caixa > 0 && <span style={{ color: '#B45309' }}> · {p.vendas_caixa} vendida(s) como caixa</span>}
                    </div>
                  </div>
                  <ArrowRight size={14} color="var(--text-3)" />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12 }}>
                      <span style={{ color: 'var(--text-3)' }}>…</span> <strong>{p.sufixo || p.unidade_nome}</strong>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{p.unidade_qtd} un × {fmt(p.unidade_custo)} · venda {fmt(p.unidade_venda)}</div>
                    {e.marcado && (
                      <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                        <select value={e.acao} onChange={ev => mudar(p, { acao: ev.target.value })} style={{ fontSize: 12, width: 'auto' }}>
                          <option value="descartar">Caixa duplicada (zerar)</option>
                          <option value="somar">Somar nas unidades</option>
                        </select>
                        <input type="number" min="1" value={e.fator} onChange={ev => mudar(p, { fator: ev.target.value })}
                          placeholder={e.acao === 'somar' ? 'un/caixa *' : 'un/caixa'} title="Unidades em cada caixa"
                          style={{ fontSize: 12, width: 90, borderColor: e.acao === 'somar' && !(parseInt(e.fator) > 0) ? 'var(--danger)' : undefined }} />
                        {e.acao === 'somar' && parseInt(e.fator) > 0 && p.caixa_qtd > 0 && (
                          <span style={{ fontSize: 11, color: 'var(--text-2)' }}>{p.unidade_qtd} → {p.unidade_qtd + p.caixa_qtd * parseInt(e.fator)} un</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, color: 'var(--text-2)' }}>
          {marcados.length} marcado(s){marcados.length > 0 && <> · sai do valor em estoque: <strong>{fmt(valorCaixas)}</strong> (custo das caixas)</>}
          {faltaFator.length > 0 && <div style={{ color: 'var(--danger)' }}>Informe un/caixa nos itens marcados como "Somar".</div>}
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={onFechar}>Fechar</button>
          <button className="btn btn-primary" disabled={!marcados.length || faltaFator.length > 0 || resolver.isPending}
            onClick={() => { if (confirm(`Resolver ${marcados.length} caixa(s)? As caixas serão desativadas.`)) resolver.mutate() }}>
            {resolver.isPending ? 'Resolvendo...' : `Resolver ${marcados.length || ''}`}
          </button>
        </div>
      </div>
    </div>
  )
}
