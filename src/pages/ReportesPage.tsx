import { useState } from 'react'
import { useDatos } from '../hooks/useDatos'
import type { Datos } from '../types'
import { estadoComprobante, nombreTercero, pagado, stockTotal } from '../services/datos'
import { fechaCorta, moneda, sumar, totalConIgv } from '../utils/format'
import PageHeader from '../components/PageHeader'
import PasoAPaso from '../components/PasoAPaso'
import Modal from '../components/Modal'

interface Reporte { titulo: string; descripcion: string; generar: (d: Datos) => { encabezados: string[]; filas: (string | number)[][] } }

const agrupar = <T,>(a: T[], k: (x: T) => string) => {
  const m = new Map<string, T[]>()
  a.forEach(x => m.set(k(x), [...(m.get(k(x)) ?? []), x]))
  return [...m.entries()]
}

const REPORTES: Reporte[] = [
  { titulo: 'Ventas por período', descripcion: 'Comprobantes y total por día', generar: d => ({ encabezados: ['Fecha', 'Comprobantes', 'Total'], filas: agrupar(d.comprobantes, f => f.fecha).map(([k, v]) => [fechaCorta(k), v.length, moneda(sumar(v, x => x.total))]) }) },
  { titulo: 'Compras por proveedor', descripcion: 'Órdenes y monto por proveedor', generar: d => ({ encabezados: ['Proveedor', 'Órdenes', 'Total'], filas: agrupar(d.ordenesCompra, o => o.proveedor).map(([k, v]) => [nombreTercero(d, k), v.length, moneda(sumar(v, o => totalConIgv(o.lineas)))]) }) },
  { titulo: 'Stock valorizado', descripcion: 'Unidades por costo', generar: d => ({ encabezados: ['Producto', 'Unidades', 'Valor'], filas: d.productos.map(p => [p.nombre, stockTotal(p), moneda(stockTotal(p) * p.costo)]) }) },
  { titulo: 'Movimientos de Kardex', descripcion: 'Resumen por operación', generar: d => ({ encabezados: ['Operación', 'Movimientos', 'Unidades'], filas: agrupar(d.kardex, k => k.operacion).map(([k, v]) => [k, v.length, sumar(v, x => x.cantidad)]) }) },
  { titulo: 'Cuentas por cobrar', descripcion: 'Saldos pendientes por comprobante', generar: d => ({ encabezados: ['Comprobante', 'Cliente', 'Saldo'], filas: d.comprobantes.filter(f => f.total - pagado(f) > 0.005).map(f => [f.id, nombreTercero(d, f.cliente), moneda(f.total - pagado(f))]) }) },
  { titulo: 'Comprobantes emitidos', descripcion: 'Listado completo', generar: d => ({ encabezados: ['N.º', 'Fecha', 'Cliente', 'Total', 'Estado'], filas: d.comprobantes.map(f => [f.id, fechaCorta(f.fecha), nombreTercero(d, f.cliente), moneda(f.total), estadoComprobante(f)]) }) }
]

export default function ReportesPage() {
  const { datos: d } = useDatos()
  const [abierto, setAbierto] = useState<Reporte | null>(null)
  const datos = abierto?.generar(d)
  return (
    <>
      <PageHeader titulo="Reportes" descripcion="Información consolidada para tus decisiones." />
      <PasoAPaso clave="reportes" />
      <div className="k">
        {REPORTES.map(r => <div key={r.titulo}><b style={{ fontSize: 16 }}>{r.titulo}</b><p className="mut">{r.descripcion}</p><button onClick={() => setAbierto(r)}>Consultar →</button></div>)}
      </div>
      {abierto && datos && (
        <Modal titulo={abierto.titulo} onClose={() => setAbierto(null)}>
          <div className="sc"><table>
            <thead><tr>{datos.encabezados.map(h => <th key={h}>{h}</th>)}</tr></thead>
            <tbody>
              {datos.filas.map((f, i) => <tr key={i}>{f.map((c, j) => <td key={j}>{c}</td>)}</tr>)}
              {!datos.filas.length && <tr><td colSpan={datos.encabezados.length} className="mut">Sin resultados</td></tr>}
            </tbody>
          </table></div>
        </Modal>
      )}
    </>
  )
}
