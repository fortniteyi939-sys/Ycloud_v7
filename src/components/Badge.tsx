const OK = ['Recibida', 'Facturada', 'Pagado', 'Aceptada', 'Procesada', 'Entrada', 'Activo', 'Disponible']
const WARN = ['Pendiente', 'Enviada', 'Pago parcial', 'Salida']
const BAD = ['Rechazada', 'Anulada', 'Stock bajo', 'Inactivo']

export default function Badge({ estado }: { estado: string }) {
  const clase = OK.includes(estado) ? 'ok' : WARN.includes(estado) ? 'warn' : BAD.includes(estado) ? 'bad' : ''
  return <span className={'b ' + clase}>{estado}</span>
}
