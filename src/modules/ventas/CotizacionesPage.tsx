import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDatos } from '../../hooks/useDatos'
import { nombreTercero, rucTercero } from '../../services/datos'
import { cambiarEstadoCotizacion } from '../../services/operaciones'
import { fechaCorta, moneda, totalConIgv } from '../../utils/format'
import type { Cotizacion } from '../../types'
import PageHeader from '../../components/PageHeader'
import PasoAPaso from '../../components/PasoAPaso'
import DataTable from '../../components/DataTable'
import Badge from '../../components/Badge'
import Icon from '../../components/Icon'
import DocumentoModal from '../../components/DocumentoModal'
import DetalleModal from '../../components/DetalleModal'

export default function CotizacionesPage() {
  const { datos: d, ejecutar } = useDatos()
  const ir = useNavigate()
  const [nuevo, setNuevo] = useState(false)
  const [ver, setVer] = useState<Cotizacion | null>(null)
  const r = d.cotizaciones
  const cuenta = (e: string) => r.filter(x => x.estado === e).length
  return (
    <>
      <PageHeader titulo="Cotización" descripcion="Prepara propuestas para clientes. Si el cliente acepta pasa a orden de venta; si no, queda rechazada." acciones={<button className="pri" onClick={() => setNuevo(true)}>+ Nueva cotización</button>} />
      <PasoAPaso clave="cotizaciones" />
      <div className="stps">
        {([['/cotizaciones', 'Cotización'], ['/cotizaciones', 'Aceptación del cliente'], ['/ventas', 'Orden de venta'], ['/facturacion', 'Facturación'], ['/cuentas-por-cobrar', 'Estado de cuenta']] as const).map((s, i) => (
          <button key={i} onClick={() => ir(s[0])}><i>{i + 1}</i>{s[1]}</button>
        ))}
      </div>
      <div className="k">{['Borrador', 'Enviada', 'Rechazada', 'Procesada'].map(e => <div key={e}><small>{e}</small><b>{cuenta(e)}</b></div>)}</div>
      <DataTable
        filas={r}
        texto={x => x.id + nombreTercero(d, x.cliente) + rucTercero(d, x.cliente)}
        cabecera={false}
        fecha={x => x.fecha}
        estado={x => x.estado}
        placeholder="Buscar cotización o cliente…"
        csv={{ archivo: 'cotizaciones', fila: x => [x.id, fechaCorta(x.fecha), nombreTercero(d, x.cliente), x.vigencia + ' días', moneda(totalConIgv(x.lineas)), x.estado, x.ordenVenta ?? '—'] }}
        columnas={[
          { titulo: 'Número', celda: x => <code>{x.id}</code>, orden: x => x.id },
          { titulo: 'Fecha', celda: x => fechaCorta(x.fecha), orden: x => x.fecha },
          { titulo: 'Cliente', celda: x => <>{nombreTercero(d, x.cliente)}<br /><small className="mut">RUC {rucTercero(d, x.cliente)}</small></>, orden: x => nombreTercero(d, x.cliente) },
          { titulo: 'Vigencia', celda: x => x.vigencia + ' días' },
          { titulo: 'Total', celda: x => moneda(totalConIgv(x.lineas)), orden: x => totalConIgv(x.lineas) },
          { titulo: 'Estado', celda: x => <Badge estado={x.estado} />, orden: x => x.estado },
          { titulo: 'Vínculo', celda: x => x.ordenVenta ?? '—' },
          { titulo: 'Acciones', celda: x => (
            <div className="acts">
              <button className="ib" title="Ver detalle" onClick={() => setVer(x)}><Icon nombre="eye" /></button>
              {x.estado === 'Borrador' && <button onClick={() => ejecutar(c => cambiarEstadoCotizacion(c, x.id, 'enviar'))}><Icon nombre="send" />Enviar</button>}
              {x.estado === 'Enviada' && <>
                <button className="pri" onClick={() => ejecutar(c => cambiarEstadoCotizacion(c, x.id, 'aceptar'))}><Icon nombre="check" />Aceptó</button>
                <button onClick={() => ejecutar(c => cambiarEstadoCotizacion(c, x.id, 'rechazar'))}><Icon nombre="x" />No aceptó</button>
              </>}
            </div>
          ) }
        ]}
      />
      {nuevo && <DocumentoModal tipo="COT" onClose={() => setNuevo(false)} />}
      {ver && <DetalleModal titulo={ver.id} subtitulo={`${nombreTercero(d, ver.cliente)} · ${fechaCorta(ver.fecha)}`} lineas={ver.lineas} onClose={() => setVer(null)} />}
    </>
  )
}
