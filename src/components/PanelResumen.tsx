import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useDatos } from '../hooks/useDatos'
import { moneda, sumar, totalConIgv } from '../utils/format'
import Icon from './Icon'

interface Props { general: [string, ReactNode][]; alerta?: { texto: string; ruta: string; boton: string } }

/** Columna derecha de las listas: resumen general + resumen financiero + alerta opcional. */
export default function PanelResumen({ general, alerta }: Props) {
  const { datos: d } = useDatos()
  const fila = (r: [string, ReactNode]) => <div className="sr" key={r[0]}><span>{r[0]}</span><b>{r[1]}</b></div>
  const financiero: [string, string][] = [
    ['Total compras', moneda(sumar(d.ordenesCompra.filter(o => o.estado === 'Recibida'), o => totalConIgv(o.lineas)))],
    ['Total ventas', moneda(sumar(d.comprobantes, f => f.total))]
  ]
  return (
    <div className="sp">
      <div className="sb"><div className="sh"><Icon nombre="rep" /> Resumen general</div>{general.map(fila)}</div>
      <div className="sb"><div className="sh"><Icon nombre="cta" /> Resumen financiero</div>{financiero.map(fila)}</div>
      {alerta && <div className="al2 wn"><span>{alerta.texto}</span><Link to={alerta.ruta}><button>{alerta.boton} →</button></Link></div>}
    </div>
  )
}
