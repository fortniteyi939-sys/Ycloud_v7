import { useState } from 'react'
import { useDatos } from '../../hooks/useDatos'
import { ALMACENES, nombreTercero, rucTercero } from '../../services/datos'
import { facturarOrdenVenta } from '../../services/operaciones'
import { fechaCorta, moneda, sumar, totalConIgv } from '../../utils/format'
import type { OrdenVenta } from '../../types'
import PageHeader from '../../components/PageHeader'
import PasoAPaso from '../../components/PasoAPaso'
import DataTable from '../../components/DataTable'
import PanelResumen from '../../components/PanelResumen'
import Badge from '../../components/Badge'
import Icon from '../../components/Icon'
import DocumentoModal from '../../components/DocumentoModal'
import DetalleModal from '../../components/DetalleModal'

export default function OrdenesVentaPage() {
  const { datos: d, ejecutar } = useDatos()
  const [nuevo, setNuevo] = useState(false)
  const [ver, setVer] = useState<OrdenVenta | null>(null)
  const r = d.ordenesVenta
  return (
    <>
      <PageHeader titulo="Orden de venta" descripcion="Registra pedidos de clientes con almacén, forma de pago y comprobante." acciones={<button className="pri" onClick={() => setNuevo(true)}>+ Nueva orden</button>} />
      <PasoAPaso clave="ventas" />
      <div className="lay">
        <DataTable
          filas={r}
          texto={x => x.id + nombreTercero(d, x.cliente) + rucTercero(d, x.cliente)}
          estado={x => x.estado}
          fecha={x => x.fecha}
          almacen={x => x.almacen}
          almacenes={ALMACENES}
          placeholder="Buscar orden, cliente o RUC…"
          csv={{ archivo: 'ordenes-venta', fila: x => [x.id, fechaCorta(x.fecha), nombreTercero(d, x.cliente), x.almacen, x.pago, x.comprobante ?? '—', moneda(totalConIgv(x.lineas)), x.estado] }}
          columnas={[
            { titulo: 'N.º documento', celda: x => <code>{x.id}</code>, orden: x => x.id },
            { titulo: 'Fecha', celda: x => fechaCorta(x.fecha), orden: x => x.fecha },
            { titulo: 'Cliente', celda: x => nombreTercero(d, x.cliente), orden: x => nombreTercero(d, x.cliente) },
            { titulo: 'Almacén', celda: x => x.almacen },
            { titulo: 'Forma de pago', celda: x => x.pago },
            { titulo: 'Comprobante', celda: x => x.comprobante ?? '—' },
            { titulo: 'Importe', celda: x => moneda(totalConIgv(x.lineas)), orden: x => totalConIgv(x.lineas) },
            { titulo: 'Estado', celda: x => <Badge estado={x.estado} />, orden: x => x.estado },
            { titulo: '', celda: x => (
              <div className="acts">
                {x.estado === 'Pendiente' && <button className="pri" onClick={() => ejecutar(c => facturarOrdenVenta(c, x.id))}><Icon nombre="fac" />Facturar</button>}
                <button className="ib" title="Ver detalle" onClick={() => setVer(x)}><Icon nombre="eye" /></button>
              </div>
            ) }
          ]}
        />
        <PanelResumen general={[['Órdenes', r.length], ['Pendientes', r.filter(x => x.estado === 'Pendiente').length], ['Facturadas', r.filter(x => x.estado === 'Facturada').length], ['Vendido', moneda(sumar(r.filter(x => x.estado !== 'Anulada'), x => totalConIgv(x.lineas)))]]} />
      </div>
      {nuevo && <DocumentoModal tipo="OV" onClose={() => setNuevo(false)} />}
      {ver && <DetalleModal titulo={ver.id} subtitulo={`${nombreTercero(d, ver.cliente)} · ${fechaCorta(ver.fecha)} · ${ver.almacen}`} lineas={ver.lineas} onClose={() => setVer(null)} />}
    </>
  )
}
