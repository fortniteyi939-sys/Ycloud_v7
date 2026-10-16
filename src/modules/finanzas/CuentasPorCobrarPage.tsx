import { useState } from 'react'
import { useDatos } from '../../hooks/useDatos'
import { estadoComprobante, nombreTercero, pagado, rucTercero } from '../../services/datos'
import { fechaCorta, moneda, sumar } from '../../utils/format'
import type { Comprobante } from '../../types'
import PageHeader from '../../components/PageHeader'
import PasoAPaso from '../../components/PasoAPaso'
import DataTable from '../../components/DataTable'
import PanelResumen from '../../components/PanelResumen'
import Badge from '../../components/Badge'
import CobranzaModal from '../../components/CobranzaModal'

export default function CuentasPorCobrarPage() {
  const { datos: d } = useDatos()
  const [cobrar, setCobrar] = useState<Comprobante | null>(null)
  const r = d.comprobantes.map(c => ({ ...c, estado: estadoComprobante(c), deuda: c.total - pagado(c) }))
  return (
    <>
      <PageHeader titulo="Estado de cuenta" descripcion="Controla saldos de comprobantes al crédito y registra cobranzas." />
      <PasoAPaso clave="cxc" />
      <div className="lay">
        <DataTable
          filas={r}
          texto={x => x.id + nombreTercero(d, x.cliente) + rucTercero(d, x.cliente)}
          estado={x => x.estado}
          fecha={x => x.fecha}
          placeholder="Buscar cliente, RUC o comprobante…"
          csv={{ archivo: 'cuentas-por-cobrar', fila: x => [fechaCorta(x.fecha), x.id, nombreTercero(d, x.cliente), x.vendedor ?? '', x.estado, moneda(x.total), moneda(x.deuda), moneda(pagado(x))] }}
          columnas={[
            { titulo: 'Fecha venta', celda: x => fechaCorta(x.fecha), orden: x => x.fecha },
            { titulo: 'Documento', celda: x => <><code>{x.id}</code><br /><small className="mut">Ref. {x.ordenVenta}</small></>, orden: x => x.id },
            { titulo: 'Cliente', celda: x => <>{nombreTercero(d, x.cliente)}<br /><small className="mut">RUC {rucTercero(d, x.cliente)}</small></>, orden: x => nombreTercero(d, x.cliente) },
            { titulo: 'Vendedor', celda: x => x.vendedor ?? '—', orden: x => x.vendedor ?? '' },
            { titulo: 'Estado', celda: x => <Badge estado={x.estado} />, orden: x => x.estado },
            { titulo: 'Total', celda: x => moneda(x.total), orden: x => x.total },
            { titulo: 'Debe', celda: x => <b className="dn">{moneda(x.deuda)}</b>, orden: x => x.deuda },
            { titulo: 'A cuenta', celda: x => <span className="up">{moneda(pagado(x))}</span> },
            { titulo: '', celda: x => x.deuda > 0.005 ? <button className="pri" onClick={() => setCobrar(x)}>Cobrar</button> : '' }
          ]}
        />
        <PanelResumen general={[['Por cobrar', moneda(sumar(r, x => x.deuda))], ['Con saldo', r.filter(x => x.deuda > 0.005).length], ['Clientes con deuda', new Set(r.filter(x => x.deuda > 0.005).map(x => x.cliente)).size], ['Cobrado', moneda(sumar(r, pagado))]]} />
      </div>
      {cobrar && <CobranzaModal comprobante={cobrar} onClose={() => setCobrar(null)} />}
    </>
  )
}
