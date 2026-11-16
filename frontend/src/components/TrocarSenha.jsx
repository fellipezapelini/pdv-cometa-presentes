import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import Modal from './Modal'
import api from '../api/client'

// Campos de senha nova como "texto mascarado": o navegador e os gerenciadores de senha não
// os reconhecem como senha e não preenchem com a senha salva. Sem suporte à máscara, cai no type=password.
const MASCARA_OK = typeof CSS !== 'undefined' && CSS.supports?.('-webkit-text-security', 'disc')

/** Campo de senha com botão para mostrar/esconder (ajuda a ver o que o navegador preencheu sozinho). */
function CampoSenha({ label, value, onChange, autoComplete, aviso, avisoCor = 'var(--danger)', nome }) {
  const [ver, setVer] = useState(false)
  const [travado, setTravado] = useState(true) // readOnly até o foco: impede preenchimento automático ao abrir
  const [sufixo] = useState(() => Math.random().toString(36).slice(2, 7)) // nome imprevisível para o autofill
  const nova = autoComplete === 'new-password'
  const mascarar = nova && MASCARA_OK
  return (
    <div className="form-group">
      <label>{label}</label>
      <div style={{ position: 'relative' }}>
        <input
          type={ver || mascarar ? 'text' : 'password'}
          name={nova ? `campo-${nome}-${sufixo}` : 'senha-atual'}
          value={value}
          onChange={onChange}
          autoComplete={nova ? 'off' : autoComplete}
          readOnly={nova && travado}
          onFocus={() => setTravado(false)}
          required
          spellCheck={false}
          autoCapitalize="off"
          style={{ paddingRight: 40, ...(mascarar && !ver ? { WebkitTextSecurity: 'disc' } : {}) }}
          data-lpignore={nova ? 'true' : undefined}
          data-1p-ignore={nova ? 'true' : undefined}
          data-bwignore={nova ? 'true' : undefined}
          data-form-type={nova ? 'other' : undefined}
        />
        <button type="button" onClick={() => setVer(v => !v)} title={ver ? 'Esconder' : 'Mostrar'}
          style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 6, display: 'flex' }}>
          {ver ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
      {aviso && <div style={{ fontSize: 12, color: avisoCor, marginTop: 4 }}>{aviso}</div>}
    </div>
  )
}

/** Troca a senha do usuário logado. As outras sessões abertas são encerradas. */
export default function TrocarSenha({ open, onClose }) {
  const vazio = { senha_atual: '', nova_senha: '', nova_senha_confirmation: '' }
  const [form, setForm] = useState(vazio)
  const [erro, setErro] = useState('')
  const [ok, setOk] = useState(false)
  const [salvando, setSalvando] = useState(false)

  const set = campo => e => { const v = e.target.value; setForm(f => ({ ...f, [campo]: v })); setErro('') }
  const fraca = form.nova_senha && form.nova_senha.length < 10
  const igualAtual = form.nova_senha && form.nova_senha === form.senha_atual
  const diferente = form.nova_senha_confirmation && form.nova_senha !== form.nova_senha_confirmation
  // Por que o botão está bloqueado (mostrado embaixo, para não parecer que "não faz nada")
  const bloqueio = !form.senha_atual || !form.nova_senha || !form.nova_senha_confirmation ? 'Preencha os três campos.'
    : igualAtual ? 'Botão bloqueado: a nova senha está igual à atual.'
    : fraca ? 'Botão bloqueado: a nova senha precisa de 10 caracteres.'
    : diferente ? 'Botão bloqueado: a confirmação não confere.'
    : null

  function fechar() {
    setForm(vazio); setErro(''); setOk(false); onClose()
  }

  async function salvar(e) {
    e.preventDefault()
    setErro(''); setSalvando(true)
    try {
      await api.put('/auth/senha', form)
      setOk(true)
      setForm(vazio)
    } catch (err) {
      const d = err?.response?.data
      if (err?.response?.status === 429) setErro('Muitas tentativas. Espere 1 minuto e tente de novo.')
      else setErro(d?.errors ? Object.values(d.errors).flat().join(' ') : (d?.message || 'Não foi possível trocar a senha.'))
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Modal open={open} onClose={fechar} title="Trocar senha" width={420}>
      {ok ? (
        <div>
          <p style={{ color: 'var(--success)', fontWeight: 600, marginBottom: 8 }}>✓ Senha alterada.</p>
          <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 16 }}>
            Os outros aparelhos que estavam conectados com esta conta foram desconectados.
            Se o navegador perguntar, atualize a senha salva nele.
          </p>
          <button className="btn btn-primary" onClick={fechar}>Fechar</button>
        </div>
      ) : (
        <form onSubmit={salvar}>
          <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 14 }}>
            Dica: use o 👁 para conferir os campos. Alguns navegadores preenchem sozinhos com a senha salva.
          </p>
          <CampoSenha label="Senha atual" value={form.senha_atual} onChange={set('senha_atual')} autoComplete="current-password" />
          <CampoSenha label="Nova senha" nome="nova" value={form.nova_senha} onChange={set('nova_senha')} autoComplete="new-password"
            aviso={igualAtual ? 'A nova senha está igual à senha atual. Clique no 👁 para conferir, apague e digite uma senha diferente.' : fraca ? 'Use pelo menos 10 caracteres.' : null}
            avisoCor={igualAtual ? 'var(--danger)' : 'var(--warning)'} />
          <CampoSenha label="Repita a nova senha" nome="repete" value={form.nova_senha_confirmation} onChange={set('nova_senha_confirmation')} autoComplete="new-password"
            aviso={diferente ? 'As senhas não são iguais.' : null} />
          {erro && <p style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 12 }}>{erro}</p>}
          {bloqueio && <p style={{ fontSize: 12, color: 'var(--text-3)', textAlign: 'right', marginBottom: 8 }}>{bloqueio}</p>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-secondary" onClick={fechar}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={!!bloqueio || salvando}>
              {salvando ? 'Salvando...' : 'Trocar senha'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  )
}
