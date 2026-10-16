import { useState, type ReactNode } from 'react'
import { exportarCsv, fechaCorta, hoyMenos } from '../utils/format'

export interface Columna<T> { titulo: string; celda: (x: T) => ReactNode; orden?: (x: T) => string | number }

interface Props<T> {
  filas: T[]
  columnas: Columna<T>[]
  /** texto sobre el que busca el cuadro de búsqueda */
  texto: (x: T) => string
  estado?: (x: T) => string
  estadoInicial?: string
  /** si se indica, muestra el filtro por fecha (debe devolver AAAA-MM-DD) */
  fecha?: (x: T) => string
  almacen?: (x: T) => string | undefined
  almacenes?: string[]
  placeholder?: string
  /** false oculta el encabezado "LISTA DE REGISTROS" (por defecto se muestra) */
  cabecera?: boolean
  /** si se indica, muestra el botón "Exportar CSV" (la fila debe coincidir con las columnas con título) */
  csv?: { archivo: string; fila: (x: T) => (string | number)[] }
}

export default function DataTable<T>(p: Props<T>) {
  const [q, setQ] = useState('')
  const [est, setEst] = useState(p.estadoInicial ?? '')
  const [alm, setAlm] = useState('')
  const [fec, setFec] = useState('')
  const [pag, setPag] = useState(0)
  const [n, setN] = useState(5)
  const [ord, setOrd] = useState<{ i: number; d: 1 | -1 } | null>(null)

  const estados = p.estado ? [...new Set([...p.filas.map(p.estado), ...(est ? [est] : [])])] : []
  let filas = p.filas.filter(x =>
    (!est || p.estado?.(x) === est) && (!fec || p.fecha?.(x) === fec) && (!alm || p.almacen?.(x) === alm) && (!q || p.texto(x).toLowerCase().includes(q.toLowerCase())))
  const f = ord ? p.columnas[ord.i].orden : undefined
  if (ord && f) filas = [...filas].sort((a, b) => (f(a) > f(b) ? 1 : f(a) < f(b) ? -1 : 0) * ord.d)

  const paginas = Math.max(1, Math.ceil(filas.length / n))
  const actual = Math.min(pag, paginas - 1)
  const visibles = filas.slice(actual * n, actual * n + n)
  const cols = p.columnas.filter(c => c.titulo)

  return (
    <div className="c">
      {p.cabecera !== false && (
        <div className="lh">
          <div><b>LISTA DE REGISTROS</b><small>● YCLOUD · Datos en vivo desde Supabase</small></div>
          <span className="pill">{fechaCorta(hoyMenos(0))}</span>
        </div>
      )}
      <div className="tl">
        <input placeholder={p.placeholder ?? 'Buscar…'} value={q} onChange={e => { setQ(e.target.value); setPag(0) }} />
        {p.fecha && <input type="date" title="Filtrar por fecha" value={fec} onChange={e => { setFec(e.target.value); setPag(0) }} />}
        {p.estado && (
          <select value={est} onChange={e => { setEst(e.target.value); setPag(0) }}>
            <option value="">Todos los estados</option>
            {estados.map(e => <option key={e}>{e}</option>)}
          </select>
        )}
        {p.almacen && (
          <select value={alm} onChange={e => { setAlm(e.target.value); setPag(0) }}>
            <option value="">Todos los almacenes</option>
            {(p.almacenes ?? []).map(a => <option key={a}>{a}</option>)}
          </select>
        )}
        {p.csv && <button onClick={() => exportarCsv(p.csv!.archivo, cols.map(c => c.titulo), filas.map(p.csv!.fila))}>⭳ Exportar CSV</button>}
      </div>
      <div className="sc">
        <table>
          <thead>
            <tr>
              {p.columnas.map((c, i) => c.orden
                ? <th key={i} style={{ cursor: 'pointer' }} onClick={() => setOrd({ i, d: ord?.i === i ? (-ord.d as 1 | -1) : 1 })}>{c.titulo}{ord?.i === i ? (ord.d > 0 ? ' ▲' : ' ▼') : ' ⇅'}</th>
                : <th key={i}>{c.titulo}</th>)}
            </tr>
          </thead>
          <tbody>
            {visibles.map((x, i) => <tr key={i}>{p.columnas.map((c, j) => <td key={j}>{c.celda(x)}</td>)}</tr>)}
            {!visibles.length && <tr><td colSpan={p.columnas.length} className="mut">Sin resultados</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="pg">
        <span className="mut">{filas.length ? actual * n + 1 : 0}–{Math.min(filas.length, actual * n + n)} de {filas.length}</span>
        <span className="mut">Filas <select value={n} onChange={e => { setN(+e.target.value); setPag(0) }}>{[5, 10, 25, 50].map(x => <option key={x}>{x}</option>)}</select></span>
        <span><button onClick={() => setPag(Math.max(0, actual - 1))}>‹</button> {actual + 1}/{paginas} <button onClick={() => setPag(Math.min(paginas - 1, actual + 1))}>›</button></span>
      </div>
    </div>
  )
}
