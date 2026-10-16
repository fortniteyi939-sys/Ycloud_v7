import { useState } from 'react'
import { useDatos } from '../../hooks/useDatos'
import { ALMACENES, estadoComprobante, nombreTercero } from '../../services/datos'
import { fechaCorta, moneda, sumar } from '../../utils/format'
import type { Comprobante } from '../../types'
import PageHeader from '../../components/PageHeader'
import PasoAPaso from '../../components/PasoAPaso'
import DataTable from '../../components/DataTable'
import PanelResumen from '../../components/PanelResumen'
import Badge from '../../components/Badge'
import Icon from '../../components/Icon'
import DetalleModal from '../../components/DetalleModal'

export default function FacturacionPage() {
  const { datos: d } = useDatos()
  const [ver, setVer] = useState<Comprobante | null>(null)
  const pend = d.ordenesVenta.filter(o => o.estado === 'Pendiente').length
  const filas = d.comprobantes.map(c => ({ ...c, estado: estadoComprobante(c), almacen: d.ordenesVenta.find(o => o.id === c.ordenVenta)?.almacen ?? '' }))
  const lineasDe = (c: Comprobante) => d.ordenesVenta.find(o => o.id === c.ordenVenta)?.lineas ?? []
  return (
    <>
      <PageHeader titulo="Facturación" descripcion="Comprobantes emitidos. Al facturar una orden de venta, el stock se descuenta automáticamente." />
      <PasoAPaso clave="facturacion" />
      <div className="lay">
        <DataTable
          filas={filas}
          texto={x => x.id + nombreTercero(d, x.cliente)}
          estado={x => x.estado}
          fecha={x => x.fecha}
          almacen={x => x.almacen}
          almacenes={ALMACENES}
          placeholder="Buscar comprobante o cliente…"
          csv={{ archivo: 'comprobantes', fila: x => [x.id, fechaCorta(x.fecha), nombreTercero(d, x.cliente), x.almacen, x.pago, x.tipo, moneda(x.total), x.estado] }}
          columnas={[
            { titulo: 'N.º documento', celda: x => <code>{x.id}</code>, orden: x => x.id },
            { titulo: 'Fecha', celda: x => fechaCorta(x.fecha), orden: x => x.fecha },
            { titulo: 'Cliente', celda: x => nombreTercero(d, x.cliente), orden: x => nombreTercero(d, x.cliente) },
            { titulo: 'Almacén', celda: x => x.almacen },
            { titulo: 'Forma de pago', celda: x => x.pago },
            { titulo: 'Tipo', celda: x => x.tipo },
            { titulo: 'Importe', celda: x => moneda(x.total), orden: x => x.total },
            { titulo: 'Estado', celda: x => <Badge estado={x.estado} />, orden: x => x.estado },
            { titulo: '', celda: x => <button className="ib" title="Ver detalle" onClick={() => setVer(x)}><Icon nombre="eye" /></button> }
          ]}
        />
        <PanelResumen
          general={[['Comprobantes', filas.length], ['OV por facturar', pend], ['Facturado', moneda(sumar(filas, x => x.total))], ['Al crédito', moneda(sumar(filas.filter(x => x.pago === 'Crédito'), x => x.total))]]}
          alerta={pend ? { texto: `${pend} órdenes de venta pendientes de facturación.`, ruta: '/ventas', boton: 'Ver pendientes' } : undefined}
        />
      </div>
      {ver && <DetalleModal titulo={ver.id} subtitulo={`${nombreTercero(d, ver.cliente)} · ${fechaCorta(ver.fecha)} · Ref. ${ver.ordenVenta}`} lineas={lineasDe(ver)} onClose={() => setVer(null)} />}
    </>
  )
}
