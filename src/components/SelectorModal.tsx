import { useEffect, useRef, useState } from 'react'
import type { Columna } from './DataTable'

interface Props<T> {
  titulo: string
  subtitulo: string
  filas: T[]
  columnas: Columna<T>[]
  /** texto sobre el que busca el cuadro de búsqueda */
  texto: (x: T) => string
  onElegir: (x: T) => void
  onClose: () => void
  /** filtros rápidos tipo "chip" (p. ej. segmentos de cliente) */
  chips?: string[]
  chip?: (x: T) => string
}

const POR_PAGINA = 5

/** Ventana de selección (clientes, proveedores, productos): buscar, filtrar por chip y tocar una fila. */
export default function SelectorModal<T>(p: Props<T>) {
  const [q, setQ] = useState('')
  const [pag, setPag] = useState(0)
  const [ch, setCh] = useState('')
  const buscador = useRef<HTMLInputElement>(null)
  useEffect(() => { buscador.current?.focus() }, [])

  const filas = p.filas.filter(x => (!ch || p.chip?.(x) === ch) && (!q || p.texto(x).toLowerCase().includes(q.toLowerCase())))
  const paginas = Math.max(1, Math.ceil(filas.length / POR_PAGINA))
  const actual = Math.min(pag, paginas - 1)
  const visibles = filas.slice(actual * POR_PAGINA, actual * POR_PAGINA + POR_PAGINA)

  return (
    <div className="ov on" style={{ zIndex: 25 }} onMouseDown={e => e.target === e.currentTarget && p.onClose()}>
      <div className="md big" style={{ width: 'min(760px,100%)' }}>
        <div className="mh">
          <div><h3>{p.titulo}</h3><small className="mut">{p.subtitulo}</small></div>
          <button onClick={p.onClose}>✕</button>
        </div>
        <div className="pkb">
          <div className="pks">
            <input ref={buscador} value={q} onChange={e => { setQ(e.target.value); setPag(0) }} placeholder="Buscar por nombre, código o RUC…" />
            {p.chips && (
              <div className="chp">
                {['', ...p.chips].map(c => <button key={c} className={c === ch ? 'on' : ''} onClick={() => { setCh(c); setPag(0) }}>{c || 'Todos'}</button>)}
              </div>
            )}
          </div>
          <div className="sc">
            <table>
              <thead><tr>{p.columnas.map((c, i) => <th key={i}>{c.titulo}</th>)}</tr></thead>
              <tbody>
                {visibles.map((x, i) => <tr key={i} className="pr" onClick={() => p.onElegir(x)}>{p.columnas.map((c, j) => <td key={j}>{c.celda(x)}</td>)}</tr>)}
                {!visibles.length && <tr><td colSpan={p.columnas.length} className="mut">Sin resultados</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="pg">
            <span className="mut">{filas.length} resultados · toca una fila para elegirla</span>
            <span><button onClick={() => setPag(Math.max(0, actual - 1))}>‹</button> {actual + 1}/{paginas} <button onClick={() => setPag(Math.min(paginas - 1, actual + 1))}>›</button></span>
          </div>
        </div>
      </div>
    </div>
  )
}
