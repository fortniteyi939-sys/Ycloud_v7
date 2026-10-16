import type { Comprobante } from '../types'
import { useDatos } from '../hooks/useDatos'
import { usePdfUrl } from '../hooks/usePdfUrl'
import { nombreProducto, nombreTercero, pagado, rucTercero } from '../services/datos'
import { comprobantePdf, medioBanco, medioYape } from '../utils/comprobante'
import { fechaCorta, moneda } from '../utils/format'
import Icon from './Icon'

/** Comprobante en PDF con los medios de pago (Yape / Plin y cuenta bancaria). */
export default function ComprobanteModal({ comprobante: c, onClose }: { comprobante: Comprobante; onClose: () => void }) {
  const { datos: d } = useDatos()
  const cliente = nombreTercero(d, c.cliente)
  const ruc = rucTercero(d, c.cliente)
  const lineas = (d.ordenesVenta.find(o => o.id === c.ordenVenta)?.lineas ?? []).map(l => ({ nombre: nombreProducto(d, l.producto), cantidad: l.cantidad, precio: l.precio }))
  const cobrado = pagado(c)

  const url = usePdfUrl(
    () => comprobantePdf({ id: c.id, tipo: c.tipo, fecha: c.fecha, cliente, ruc, ordenVenta: c.ordenVenta, pago: c.pago, lineas, total: c.total, pagado: cobrado }),
    [c.id, c.total, cobrado, cliente, ruc, d]
  )
  const medios = [medioYape(), medioBanco()].filter((m): m is NonNullable<typeof m> => !!m)

  return (
    <div className="ov on" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="md big">
        <div className="mh">
          <i><Icon nombre="fac" /></i>
          <div><h3>{c.tipo} {c.id}</h3><small className="mut">{cliente} · {fechaCorta(c.fecha)} · Total {moneda(c.total)}</small></div>
          <button onClick={onClose}>✕</button>
        </div>

        <div className="pm">
          <div className="pf">
            <h4 className="sec">Medios de pago</h4>
            {medios.map(m => (
              <div className="mpd" key={m.medio}>
                <b>{m.etiqueta}</b>
                {m.datos.map(([k, v]) => <div key={k}><span className="mut">{k}</span><b>{v}</b></div>)}
              </div>
            ))}
            <p className="mut">Saldo pendiente: <b>{moneda(Math.max(0, c.total - cobrado))}</b>. El cliente debe indicar el N.º de operación al pagar.</p>
          </div>

          <div className="pv">
            <h4 className="sec">Comprobante en PDF</h4>
            {url && <iframe title="Comprobante PDF" src={url} />}
            <small className="mut">Si el PDF no se ve en esta ventana (celulares, algunos navegadores), usa «Abrir» o «Descargar».</small>
          </div>
        </div>

        <div className="ft pmf">
          <button onClick={onClose}>Cerrar</button>
          {url && <a className="bt" href={url} target="_blank" rel="noopener noreferrer">Abrir en pestaña nueva</a>}
          {url && <a className="bt pri" href={url} download={`comprobante-${c.id}.pdf`}>Descargar PDF</a>}
        </div>
      </div>
    </div>
  )
}
