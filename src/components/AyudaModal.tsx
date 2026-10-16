import Modal from './Modal'

/** Guía rápida "¿Cómo usar?": el recorrido de un negocio en 7 pasos. */
export default function AyudaModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal titulo="¿Cómo usar YCLOUD?" onClose={onClose}>
      <p className="mut">YCLOUD sigue el recorrido real de un negocio. Haz esto en orden:</p>
      <ol className="hl">
        <li><b>Preparar</b>: en Mantenimientos crea tus productos, clientes y proveedores.</li>
        <li><b>Comprar</b>: crea una orden de compra a tu proveedor.</li>
        <li><b>Recibir</b>: cuando llegue, pulsa “Recibir”; el stock sube.</li>
        <li><b>Cotizar</b>: envía precios a tu cliente.</li>
        <li><b>Vender</b>: si acepta, se crea la orden de venta.</li>
        <li><b>Facturar</b>: emite el comprobante; el stock baja.</li>
        <li><b>Cobrar</b>: registra el pago en Estado de cuenta.</li>
      </ol>
      <p>Cada pantalla tiene un cuadro con el siguiente paso. Todo lo que registres se guarda en Supabase y lo ven los demás usuarios.</p>
    </Modal>
  )
}
