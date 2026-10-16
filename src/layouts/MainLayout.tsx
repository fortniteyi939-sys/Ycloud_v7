import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useDatos } from '../hooks/useDatos'
import Icon from '../components/Icon'
import AyudaModal from '../components/AyudaModal'

const CLAVE_AYUDA = 'enterprisecloud-ayuda-vista'

// Menú lateral (mismo orden y nombres que YCLOUD v11). El 4.º valor limita el ítem a un rol.
const MENU: { grupo: string; items: [string, string, string, string?][] }[] = [
  { grupo: 'Inicio', items: [['/', 'Panel de control', 'dash']] },
  { grupo: 'Compras', items: [['/compras', 'Orden de compra', 'oc'], ['/recepcion', 'Ingreso al Kardex', 'ing']] },
  { grupo: 'Ventas', items: [['/cotizaciones', 'Cotización', 'cot'], ['/ventas', 'Orden de venta', 'ov'], ['/facturacion', 'Facturación', 'fac'], ['/cuentas-por-cobrar', 'Estado de cuenta', 'cta']] },
  { grupo: 'Inventarios', items: [['/kardex', 'Movimiento de Kardex', 'kdx'], ['/stock', 'Stock de productos', 'stk']] },
  { grupo: 'Administración', items: [['/reportes', 'Reportes', 'rep'], ['/mantenimientos', 'Mantenimientos', 'mant'], ['/usuarios', 'Usuarios', 'usr', 'admin']] }
]

export default function MainLayout() {
  const { perfil, cerrarSesion } = useAuth()
  const { recargar } = useDatos()
  const [mini, setMini] = useState(false)
  const [abierto, setAbierto] = useState(false)
  // la guía "¿Cómo usar?" se abre sola la primera vez
  const [ayuda, setAyuda] = useState(() => { try { return !localStorage.getItem(CLAVE_AYUDA) } catch { return false } })
  const cerrarAyuda = () => { setAyuda(false); try { localStorage.setItem(CLAVE_AYUDA, '1') } catch { /* sin almacenamiento */ } }
  const alternarTema = () => {
    const r = document.documentElement
    r.dataset.theme = (r.dataset.theme ?? 'dark') === 'dark' ? 'light' : 'dark'
  }

  return (
    <div className="app">
      <aside className={(mini ? 'mini ' : '') + (abierto ? 'open' : '')}>
        <div className="lg">
          <i><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M7 18a4 4 0 010-8 5 5 0 019.6-1A4.5 4.5 0 0117 18z" /><path d="M9.8 11l2.2 2.6 2.2-2.6M12 13.6V16" /></svg></i>
          <span className="tx" style={{ letterSpacing: '.08em' }}>YCLOUD</span>
        </div>
        {MENU.map(g => (
          <div key={g.grupo}>
            <div className="gl">{g.grupo}</div>
            {g.items.filter(it => !it[3] || it[3] === perfil?.rol?.codigo).map(([ruta, nombre, ic]) => (
              <NavLink key={ruta} to={ruta} end={ruta === '/'} title={nombre} onClick={() => setAbierto(false)} className={({ isActive }) => 'nv' + (isActive ? ' on' : '')}>
                <Icon nombre={ic} /><span className="tx">{nombre}</span>
              </NavLink>
            ))}
          </div>
        ))}
        <div className="gl"></div>
        <button className="nv" onClick={() => setMini(!mini)} title="Contraer menú"><Icon nombre="mi" /><span className="tx">Contraer</span></button>
      </aside>
      <div className="main">
        <div className="top">
          <button className="mb" onClick={() => setAbierto(!abierto)}>☰ Menú</button>
          <span className="mut">YCLOUD ERP</span>
          <span>
            <span className="mut">{perfil?.nombres}{perfil?.rol ? ' · ' + perfil.rol.nombre : ''}</span>{' '}
            <button onClick={() => setAyuda(true)}>? Cómo usar</button>{' '}
            <button onClick={alternarTema}>◐ Tema</button>{' '}
            <button onClick={() => void recargar()} title="Volver a leer los datos de Supabase">↻ Actualizar</button>{' '}
            <button onClick={() => void cerrarSesion()}>⎋ Salir</button>
          </span>
        </div>
        <Outlet />
      </div>
      {ayuda && <AyudaModal onClose={cerrarAyuda} />}
    </div>
  )
}
