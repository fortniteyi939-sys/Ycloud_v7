import { useState, type ChangeEvent, type FormEvent } from 'react'
import { useAuth } from '../hooks/useAuth'
import { configurado } from '../services/supabase'

export default function LoginPage() {
  const { iniciarSesion, registrarse } = useAuth()
  const [registro, setRegistro] = useState(false)
  const [f, setF] = useState({ nombres: '', email: '', pass: '', pass2: '' })
  const [msg, setMsg] = useState<{ texto: string; ok: boolean } | null>(null)
  const [enviando, setEnviando] = useState(false)
  const campo = (k: keyof typeof f) => (e: ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value })
  const error = (texto: string) => setMsg({ texto, ok: false })

  async function enviar(e: FormEvent) {
    e.preventDefault()
    const email = f.email.trim()
    if (!email || !f.pass) return error('Completa correo y contraseña.')
    if (registro) {
      if (!f.nombres.trim()) return error('Escribe tus nombres.')
      if (f.pass.length < 6) return error('La contraseña debe tener al menos 6 caracteres.')
      if (f.pass !== f.pass2) return error('Las contraseñas no coinciden.')
    }
    setEnviando(true)
    const r = registro ? await registrarse(f.nombres.trim(), email, f.pass) : await iniciarSesion(email, f.pass)
    setEnviando(false)
    if (r.error) error(r.error)
    else if (r.aviso) { setMsg({ texto: r.aviso, ok: true }); setRegistro(false) }
  }

  return (
    <div className="auth">
      <form className="acard" onSubmit={enviar} noValidate>
        <div className="alogo"><i><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M7 18a4 4 0 010-8 5 5 0 019.6-1A4.5 4.5 0 0117 18z" /><path d="M9.8 11l2.2 2.6 2.2-2.6M12 13.6V16" /></svg></i><span>YCLOUD</span></div>
        <h1>{registro ? 'Crear cuenta' : 'Iniciar sesión'}</h1>
        <p className="mut">{registro ? 'Regístrate para acceder al ERP.' : 'Ingresa con tu usuario del ERP.'}</p>
        {!configurado && <div className="amsg">Falta configurar Supabase: crea el archivo <code>.env</code> con <code>VITE_SUPABASE_URL</code> y <code>VITE_SUPABASE_ANON_KEY</code> (ver <code>.env.example</code>) y reinicia <code>npm run dev</code>.</div>}
        {msg && <div className={'amsg' + (msg.ok ? ' o' : '')}>{msg.texto}</div>}
        {registro && <label>Nombres<input value={f.nombres} onChange={campo('nombres')} autoComplete="name" placeholder="Tu nombre completo" /></label>}
        <label>Correo<input type="email" value={f.email} onChange={campo('email')} autoComplete="email" placeholder="correo@empresa.com" /></label>
        <label>Contraseña<input type="password" value={f.pass} onChange={campo('pass')} autoComplete={registro ? 'new-password' : 'current-password'} placeholder="Mínimo 6 caracteres" /></label>
        {registro && <>
          <label>Repetir contraseña<input type="password" value={f.pass2} onChange={campo('pass2')} autoComplete="new-password" /></label>
          <small className="mut">Las cuentas nuevas entran con rol <b>Consulta</b> (solo lectura). Un administrador te asigna el rol definitivo.</small>
        </>}
        <button className="pri wide" type="submit" disabled={!configurado || enviando}>{enviando ? 'Procesando…' : registro ? 'Registrarme' : 'Entrar'}</button>
        <p className="alt mut">{registro ? '¿Ya tienes cuenta?' : '¿No tienes cuenta?'} <a href="#" onClick={e => { e.preventDefault(); setRegistro(!registro); setMsg(null) }}>{registro ? 'Inicia sesión' : 'Regístrate'}</a></p>
      </form>
    </div>
  )
}
