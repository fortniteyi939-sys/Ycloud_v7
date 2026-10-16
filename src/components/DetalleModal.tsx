import type { Linea } from '../types'
import { useDatos } from '../hooks/useDatos'
import { nombreProducto } from '../services/datos'
import { moneda, totalConIgv } from '../utils/format'
import Modal from './Modal'

/** Muestra las líneas (productos) de una orden, cotización o comprobante. */
export default function DetalleModal({ titulo, subtitulo, lineas, onClose }: { titulo: string; subtitulo: string; lineas: Linea[]; onClose: () => void }) {
  const { datos: d } = useDatos()
  return (
    <Modal titulo={titulo} onClose={onClose}>
      <p className="mut">{subtitulo}</p>
      <div className="sc">
        <table className="rt">
          <thead><tr><th>Producto</th><th>Cant.</th><th>Precio</th><th>Subtotal</th></tr></thead>
          <tbody>{lineas.map(l => <tr key={l.producto}><td data-l="Producto">{nombreProducto(d, l.producto)}</td><td data-l="Cant.">{l.cantidad}</td><td data-l="Precio">{moneda(l.precio)}</td><td data-l="Subtotal">{moneda(l.cantidad * l.precio)}</td></tr>)}</tbody>
        </table>
      </div>
      <p style={{ textAlign: 'right' }}><b>Total (IGV incl.) {moneda(totalConIgv(lineas))}</b></p>
    </Modal>
  )
}
