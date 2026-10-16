import { useState } from 'react'
import type { Comprobante } from '../types'
import { useDatos } from '../hooks/useDatos'
import { usePdfUrl } from '../hooks/usePdfUrl'
import { MEDIOS_PAGO, nombreTercero, pagado, rucTercero } from '../services/datos'
import { registrarCobranza } from '../services/operaciones'
import { hoyMenos, moneda } from '../utils/format'
import { constanciaPdf } from '../utils/constancia'
import Icon from './Icon'

/** Registro de cobranza: elige el medio de pago, ve sus datos y una constancia en PDF que se actualiza en vivo. */
export default function CobranzaModal({ comprobante, onClose }: { comprobante: Comprobante; onClose: () => void }) {
  const { datos: d, ejecutar } = useDatos()
  const deuda = comprobante.total - pagado(comprobante)
  const [monto, setMonto] = useState(+deuda.toFixed(2))
  const [medio, setMedio] = useState(MEDIOS_PAGO[0].medio)
  const [operacion, setOperacion] = useState('')
  const [fecha, setFecha] = useState(hoyMenos(0))
  const [guardando, setGuardando] = useState(false)
  const [hecho, setHecho] = useState(false)

  const info = MEDIOS_PAGO.find(m => m.medio === medio) ?? MEDIOS_PAGO[0]
  const cliente = nombreTercero(d, comprobante.cliente)
  const ruc = rucTercero(d, comprobante.cliente)

  // La URL se crea/libera dentro del efecto (compatible con StrictMode); antes se liberaba al montar y el PDF quedaba en blanco.
  const url = usePdfUrl(() => constanciaPdf({
    comprobante: comprobante.id, cliente, ruc, fecha, importe: monto || 0,
    saldo: Math.max(0, deuda - (monto || 0)), medio: info, operacion: operacion.trim(), registrado: hecho
  }), [comprobante.id, cliente, ruc, fecha, monto, deuda, info, operacion, hecho])

  const guardar = async () => {
    setGuardando(true)
    const ok = await ejecutar(c => registrarCobranza(c, comprobante.id, monto, medio, operacion, fecha))
    setGuardando(false)
    if (ok) setHecho(true)
  }

  return (
    <div className="ov on" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="md big">
        <div className="mh">
          <i><Icon nombre="cta" /></i>
          <div><h3>{hecho ? 'Pago registrado' : 'Registrar cobranza'} · {comprobante.id}</h3><small className="mut">{cliente} · Saldo {moneda(deuda)}</small></div>
          <button onClick={onClose}>✕</button>
        </div>

        <div className="pm">
          <div className="pf">
            <h4 className="sec">Medio de pago</h4>
            <div className="mp">
              {MEDIOS_PAGO.map(m => (
                <button key={m.medio} className={m.medio === medio ? 'on' : ''} disabled={hecho} onClick={() => setMedio(m.medio)}>{m.etiqueta}</button>
              ))}
            </div>
            <p className="mut">{info.ayuda}</p>
            {info.datos.length > 0 && (
              <div className="mpd">
                <b>Datos para pagar</b>
                {info.datos.map(([k, v]) => <div key={k}><span className="mut">{k}</span><b>{v}</b></div>)}
              </div>
            )}

            <div className="g2c">
              <label>Importe<input type="number" step=".01" disabled={hecho} value={monto} onChange={e => setMonto(+e.target.value)} /></label>
              <label>Fecha<input type="date" disabled={hecho} value={fecha} onChange={e => setFecha(e.target.value)} /></label>
            </div>
            {info.requiereOperacion && (
              <label>N.º de operación<input disabled={hecho} value={operacion} onChange={e => setOperacion(e.target.value)} placeholder={info.placeholderOperacion} /></label>
            )}
          </div>

          <div className="pv">
            <h4 className="sec">Constancia en PDF</h4>
            {url && <iframe title="Constancia de pago" src={url} />}
            <small className="mut">{hecho ? 'Pago guardado. Puedes descargar la constancia.' : 'Vista previa: se actualiza al cambiar el medio, el importe o la operación.'}</small>
            {url && (
              <div className="ft" style={{ marginTop: 0 }}>
                <a className="bt" href={url} target="_blank" rel="noopener noreferrer">Abrir en pestaña nueva</a>
                <a className="bt" href={url} download={`constancia-${comprobante.id}.pdf`}>Descargar PDF</a>
              </div>
            )}
          </div>
        </div>

        <div className="ft pmf">
          {hecho
            ? <><button onClick={onClose}>Cerrar</button>{url && <a className="bt pri" href={url} download={`constancia-${comprobante.id}.pdf`}>Descargar PDF</a>}</>
            : <><button onClick={onClose}>Cancelar</button><button className="pri" disabled={guardando} onClick={() => void guardar()}><Icon nombre="check" /> Registrar pago</button></>}
        </div>
      </div>
    </div>
  )
}
