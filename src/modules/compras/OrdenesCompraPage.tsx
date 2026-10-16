import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useDatos } from '../../hooks/useDatos'
import { ALMACENES, nombreTercero, rucTercero } from '../../services/datos'
import { recibirOrdenCompra } from '../../services/operaciones'
import { fechaCorta, moneda, sumar, totalConIgv } from '../../utils/format'
import type { OrdenCompra } from '../../types'
import PageHeader from '../../components/PageHeader'
import PasoAPaso from '../../components/PasoAPaso'
import DataTable from '../../components/DataTable'
import PanelResumen from '../../components/PanelResumen'
import Badge from '../../components/Badge'
import Icon from '../../components/Icon'
import DocumentoModal from '../../components/DocumentoModal'
import DetalleModal from '../../components/DetalleModal'

export default function OrdenesCompraPage() {
  const { datos: d, ejecutar } = useDatos()
  // /compras?reponer=PRD-001 abre la orden con ese producto (botón "Reponer" del panel)
  const [params, setParams] = useSearchParams()
  const productoInicial = params.get('reponer') ?? undefined
  const [nuevo, setNuevo] = useState(Boolean(productoInicial))
  const [ver, setVer] = useState<OrdenCompra | null>(null)
  const r = d.ordenesCompra
  const pend = r.filter(o => o.estado === 'Pendiente').length

  return (
    <>
      <PageHeader titulo="Orden de compra" descripcion="Emite órdenes a proveedores. Al recibirlas, el stock se actualiza automáticamente." acciones={<button className="pri" onClick={() => setNuevo(true)}>+ Nueva orden</button>} />
      <PasoAPaso clave="oc" />
      <div className="lay">
        <DataTable
          filas={r}
          texto={x => x.id + nombreTercero(d, x.proveedor) + rucTercero(d, x.proveedor)}
          estado={x => x.estado}
          fecha={x => x.fecha}
          almacen={x => x.almacen}
          almacenes={ALMACENES}
          placeholder="Buscar orden, proveedor o RUC…"
          csv={{ archivo: 'ordenes-compra', fila: x => [x.id, fechaCorta(x.fecha), nombreTercero(d, x.proveedor), x.almacen, x.pago, moneda(totalConIgv(x.lineas)), x.estado] }}
          columnas={[
            { titulo: 'N.º documento', celda: x => <code>{x.id}</code>, orden: x => x.id },
            { titulo: 'Fecha', celda: x => fechaCorta(x.fecha), orden: x => x.fecha },
            { titulo: 'Proveedor', celda: x => nombreTercero(d, x.proveedor), orden: x => nombreTercero(d, x.proveedor) },
            { titulo: 'Almacén', celda: x => x.almacen },
            { titulo: 'Forma de pago', celda: x => x.pago },
            { titulo: 'Importe', celda: x => moneda(totalConIgv(x.lineas)), orden: x => totalConIgv(x.lineas) },
            { titulo: 'Estado', celda: x => <Badge estado={x.estado} />, orden: x => x.estado },
            { titulo: '', celda: x => (
              <div className="acts">
                {x.estado === 'Pendiente' && <button className="pri" onClick={() => ejecutar(c => recibirOrdenCompra(c, x.id))}><Icon nombre="ing" />Recibir</button>}
                <button className="ib" title="Ver detalle" onClick={() => setVer(x)}><Icon nombre="eye" /></button>
              </div>
            ) }
          ]}
        />
        <PanelResumen
          general={[['Órdenes', r.length], ['Pendientes', pend], ['Recibidas', r.length - pend], ['Comprado', moneda(sumar(r.filter(o => o.estado === 'Recibida'), o => totalConIgv(o.lineas)))]]}
          alerta={pend ? { texto: `${pend} órdenes pendientes de recepción. Hay órdenes de compra que requieren ingreso al almacén.`, ruta: '/recepcion', boton: 'Ver pendientes' } : undefined}
        />
      </div>
      {nuevo && <DocumentoModal tipo="OC" productoInicial={productoInicial} onClose={() => { setNuevo(false); setParams({}) }} />}
      {ver && <DetalleModal titulo={ver.id} subtitulo={`${nombreTercero(d, ver.proveedor)} · ${fechaCorta(ver.fecha)} · ${ver.almacen}`} lineas={ver.lineas} onClose={() => setVer(null)} />}
    </>
  )
}
