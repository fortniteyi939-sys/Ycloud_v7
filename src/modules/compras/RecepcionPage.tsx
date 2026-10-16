import { useDatos } from '../../hooks/useDatos'
import { ALMACENES, nombreTercero } from '../../services/datos'
import { fechaCorta, sumar } from '../../utils/format'
import PageHeader from '../../components/PageHeader'
import PasoAPaso from '../../components/PasoAPaso'
import DataTable from '../../components/DataTable'
import PanelResumen from '../../components/PanelResumen'
import Badge from '../../components/Badge'

export default function RecepcionPage() {
  const { datos: d } = useDatos()
  const todas = d.ordenesCompra
  const r = todas.filter(o => o.estado === 'Recibida')   // solo notas de ingreso ya registradas
  const pend = todas.filter(o => o.estado === 'Pendiente').length
  return (
    <>
      <PageHeader titulo="Ingreso al Kardex" descripcion="Notas de ingreso de las órdenes de compra ya recibidas. Para recibir una orden pendiente, usa «Recibir» en Orden de compra." />
      <PasoAPaso clave="recepcion" />
      <div className="lay">
        <DataTable
          filas={r}
          texto={x => x.id + nombreTercero(d, x.proveedor)}
          estado={x => x.estado}
          fecha={x => x.fechaRecepcion ?? x.fecha}
          almacen={x => x.almacen}
          almacenes={ALMACENES}
          placeholder="Buscar nota, OC o proveedor…"
          csv={{ archivo: 'recepcion', fila: x => [x.id, fechaCorta(x.fecha), nombreTercero(d, x.proveedor), x.almacen, sumar(x.lineas, l => l.cantidad), x.estado] }}
          columnas={[
            { titulo: 'N.º documento', celda: x => <code>{x.id}</code>, orden: x => x.id },
            { titulo: 'Fecha', celda: x => fechaCorta(x.fechaRecepcion ?? x.fecha), orden: x => x.fechaRecepcion ?? x.fecha },
            { titulo: 'Proveedor', celda: x => nombreTercero(d, x.proveedor), orden: x => nombreTercero(d, x.proveedor) },
            { titulo: 'Almacén', celda: x => x.almacen },
            { titulo: 'Unidades', celda: x => sumar(x.lineas, l => l.cantidad) },
            { titulo: 'Estado', celda: x => <Badge estado={x.estado} />, orden: x => x.estado }
          ]}
        />
        <PanelResumen general={[['Notas de ingreso', r.length], ['OC por recibir', pend], ['Unidades ingresadas', sumar(d.kardex.filter(k => k.operacion === 'Entrada'), k => k.cantidad)], ['Almacenes activos', ALMACENES.length]]} />
      </div>
    </>
  )
}
