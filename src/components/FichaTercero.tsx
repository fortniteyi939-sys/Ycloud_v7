import type { Tercero } from '../types'
import { useDatos } from '../hooks/useDatos'
import { deudaCliente } from '../services/datos'
import { moneda } from '../utils/format'

/** Tarjeta con los datos del cliente/proveedor elegido; los clientes muestran además su estado de crédito. */
export default function FichaTercero({ t }: { t: Tercero }) {
  const { datos: d } = useDatos()
  const x = { limite: t.limite, direccion: t.direccion || '—', contacto: t.contacto || '—', telefono: t.telefono || '—', correo: t.correo || '—', condicion: t.condicion || '—' }
  const esCliente = t.id.startsWith('CLI')
  const deuda = esCliente ? deudaCliente(d, t.id) : 0
  const uso = x.limite > 0 ? Math.min(100, (deuda / x.limite) * 100) : deuda > 0 ? 100 : 0
  const nivel = uso < 70 ? 'ok' : uso < 100 ? 'warn' : 'bad'
  const texto = x.limite <= 0 ? 'Sin línea de crédito' : uso < 70 ? 'Crédito saludable' : uso < 100 ? 'Crédito ajustado' : 'Línea excedida'
  return (
    <>
      <div className="pcard">
        <div className="pt"><div><b>{t.nombre}</b><small>RUC {t.ruc} · {t.id}</small></div><span className="b">{t.segmento}</span></div>
        <div className="g2k">
          <div><small>DIRECCIÓN</small>{x.direccion}</div>
          <div><small>CONTACTO</small>{x.contacto}</div>
          <div><small>TELÉFONO</small>{x.telefono}</div>
          <div><small>CORREO</small>{x.correo}</div>
          <div><small>COND. PAGO</small><span className="b">{x.condicion}</span></div>
        </div>
      </div>
      {esCliente && (
        <div className="pcard">
          <div className="pt"><b>Estado de crédito</b><span className={'b ' + nivel}>{texto}</span></div>
          <div className="sr2"><span>Línea total</span><b>{moneda(x.limite)}</b></div>
          <div className="sr2"><span>Saldo utilizado</span><b className="dn">{moneda(deuda)}</b></div>
          <div className="sr2"><span>Disponible</span><b className="up">{moneda(Math.max(0, x.limite - deuda))}</b></div>
          <div className="bar"><i style={{ width: uso + '%' }} /></div>
          {deuda > 0.005 && <small className="wn2">⚠ Este cliente tiene {moneda(deuda)} pendientes de pago.</small>}
        </div>
      )}
    </>
  )
}
