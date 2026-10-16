import { Pdf, type Color } from './pdf'
import { fechaCorta, moneda } from './format'
import type { MedioPago } from '../services/datos'
import { EMPRESA } from '../services/datos'

export interface DatosConstancia {
  comprobante: string
  cliente: string
  ruc: string
  fecha: string
  importe: number
  saldo: number
  medio: MedioPago
  operacion: string
  /** false = vista previa antes de registrar el pago */
  registrado: boolean
}

const MORADO: Color = [0.545, 0.361, 0.965]
const GRIS: Color = [0.42, 0.4, 0.53]

/** Constancia de pago en PDF (documento interno, no es un comprobante electrónico). */
export function constanciaPdf(c: DatosConstancia): Blob {
  const p = new Pdf()

  p.rect(0, 742, 595, 100, MORADO)
  p.text(EMPRESA.nombre, 50, 800, { size: 20, bold: true, color: [1, 1, 1] })
  p.text('Constancia de pago', 50, 778, { size: 12, color: [1, 1, 1] })
  p.text('Ref. ' + c.comprobante, 380, 800, { size: 12, bold: true, color: [1, 1, 1] })
  p.text('RUC ' + EMPRESA.ruc, 380, 780, { size: 10, color: [1, 1, 1] })

  let y = 705
  if (!c.registrado) {
    p.rect(50, y - 6, 495, 24, [1, 0.95, 0.78])
    p.text('VISTA PREVIA - el pago todavia no esta registrado', 60, y + 2, { size: 10, bold: true, color: [0.55, 0.35, 0] })
    y -= 40
  }

  const fila = (etiqueta: string, valor: string) => {
    p.text(etiqueta, 50, y, { size: 10, color: GRIS })
    p.text(valor || '-', 190, y, { size: 11, bold: true })
    p.line(50, y - 8, 545, y - 8)
    y -= 26
  }

  p.text('DETALLE DEL PAGO', 50, y, { size: 9, bold: true, color: MORADO })
  y -= 24
  fila('Cliente', c.cliente)
  fila('RUC', c.ruc)
  fila('Comprobante', c.comprobante)
  fila('Fecha de pago', fechaCorta(c.fecha))
  fila('Medio de pago', c.medio.etiqueta)
  fila('N.º de operación', c.medio.requiereOperacion ? c.operacion : 'No aplica (efectivo)')

  y -= 6
  p.rect(50, y - 62, 495, 74, [0.93, 0.91, 0.99])
  p.text('Importe pagado', 66, y - 8, { size: 10, color: GRIS })
  p.text(moneda(c.importe), 66, y - 40, { size: 26, bold: true, color: MORADO })
  p.text('Saldo pendiente', 340, y - 8, { size: 10, color: GRIS })
  p.text(moneda(c.saldo), 340, y - 40, { size: 20, bold: true, color: c.saldo > 0.005 ? [0.76, 0.23, 0.23] : [0.04, 0.48, 0.37] })
  y -= 100

  if (c.medio.datos.length) {
    p.text('DATOS PARA REALIZAR EL PAGO', 50, y, { size: 9, bold: true, color: MORADO })
    y -= 24
    c.medio.datos.forEach(([k, v]) => fila(k, v))
  }

  p.line(50, 60, 545, 60)
  p.text('Documento interno generado por YCLOUD ERP. No reemplaza al comprobante electronico emitido.', 50, 44, { size: 8, color: GRIS })
  return p.blob()
}
