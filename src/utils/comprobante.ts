import { Pdf, type Color } from './pdf'
import { fechaCorta, moneda } from './format'
import { EMPRESA, MEDIOS_PAGO } from '../services/datos'

export interface DatosComprobante {
  id: string
  tipo: 'Factura' | 'Boleta'
  fecha: string
  cliente: string
  ruc: string
  ordenVenta: string
  /** Contado o Crédito */
  pago: string
  lineas: { nombre: string; cantidad: number; precio: number }[]
  /** Total con IGV tal como está guardado en el comprobante */
  total: number
  pagado: number
}

const MORADO: Color = [0.545, 0.361, 0.965]
const GRIS: Color = [0.42, 0.4, 0.53]
const IGV = 0.18

const cortar = (s: string, max: number) => (s.length > max ? s.slice(0, max - 3) + '...' : s)
// Helvetica: ancho medio aproximado de un carácter = 0,52 × tamaño
const derecha = (s: string, xFin: number, size: number) => xFin - s.length * size * 0.52

/** Medios de pago que se imprimen en el comprobante: Yape / Plin y cuenta bancaria (los datos salen de MEDIOS_PAGO). */
export const medioYape = () => MEDIOS_PAGO.find(m => m.medio === 'Yape / Plin')
export const medioBanco = () => MEDIOS_PAGO.find(m => m.medio === 'Transferencia bancaria')

/** Comprobante en PDF (representación interna, con los datos para pagar por Yape/Plin o transferencia). */
export function comprobantePdf(c: DatosComprobante): Blob {
  const p = new Pdf()
  const subtotal = c.total / (1 + IGV)
  const igv = c.total - subtotal
  const saldo = Math.max(0, c.total - c.pagado)

  p.rect(0, 742, 595, 100, MORADO)
  p.text(EMPRESA.nombre, 50, 800, { size: 20, bold: true, color: [1, 1, 1] })
  p.text(c.tipo + ' electronica', 50, 778, { size: 12, color: [1, 1, 1] })
  p.text(c.id, 380, 800, { size: 14, bold: true, color: [1, 1, 1] })
  p.text('RUC ' + EMPRESA.ruc, 380, 780, { size: 10, color: [1, 1, 1] })

  let y = 712
  const dato = (k: string, v: string, x: number, yy: number) => {
    p.text(k, x, yy, { size: 9, color: GRIS })
    p.text(v || '-', x, yy - 14, { size: 11, bold: true })
  }
  dato('Cliente', cortar(c.cliente, 40), 50, y)
  dato('RUC / DNI', c.ruc, 330, y)
  dato('Fecha de emision', fechaCorta(c.fecha), 450, y)
  y -= 38
  dato('Orden de venta', c.ordenVenta, 50, y)
  dato('Forma de pago', c.pago, 330, y)
  y -= 34
  p.line(50, y, 545, y)
  y -= 20

  // Tabla de productos
  p.text('PRODUCTO', 50, y, { size: 9, bold: true, color: MORADO })
  p.text('CANT.', 355, y, { size: 9, bold: true, color: MORADO })
  p.text('P. UNIT.', 410, y, { size: 9, bold: true, color: MORADO })
  p.text('IMPORTE', 490, y, { size: 9, bold: true, color: MORADO })
  y -= 8
  p.line(50, y, 545, y)
  y -= 18

  const reservado = 330 // espacio inferior para totales, medios de pago y pie
  const caben = Math.max(1, Math.floor((y - reservado) / 20))
  const visibles = c.lineas.length > caben ? caben - 1 : c.lineas.length
  c.lineas.slice(0, visibles).forEach(l => {
    p.text(cortar(l.nombre, 54), 50, y, { size: 10 })
    p.text(String(l.cantidad), 360, y, { size: 10 })
    p.text(moneda(l.precio), 410, y, { size: 10 })
    p.text(moneda(l.cantidad * l.precio), 490, y, { size: 10 })
    y -= 20
  })
  if (visibles < c.lineas.length) {
    p.text(`... y ${c.lineas.length - visibles} producto(s) mas (ver el detalle en el sistema)`, 50, y, { size: 9, color: GRIS })
    y -= 20
  }

  // Totales
  p.line(50, y + 8, 545, y + 8)
  y -= 8
  const total = (etq: string, val: string, bold = false, size = 10) => {
    p.text(etq, 340, y, { size, bold, color: bold ? [0.1, 0.1, 0.15] : GRIS })
    p.text(val, derecha(val, 545, size), y, { size, bold })
    y -= bold ? 22 : 17
  }
  total('Subtotal (sin IGV)', moneda(subtotal))
  total('IGV 18%', moneda(igv))
  total('TOTAL', moneda(c.total), true, 13)
  total('Pagado', moneda(c.pagado))
  total('Saldo pendiente', moneda(saldo), true, 11)

  // Medios de pago (siempre visibles)
  y = Math.min(y - 10, 250)
  p.rect(50, y - 142, 495, 162, [0.96, 0.95, 0.99])
  p.text('MEDIOS DE PAGO', 62, y, { size: 9, bold: true, color: MORADO })
  const yape = medioYape()
  const banco = medioBanco()
  const bloque = (titulo: string, datos: [string, string][] | undefined, x: number) => {
    let yy = y - 22
    p.text(titulo, x, yy, { size: 11, bold: true })
    yy -= 18
    ;(datos ?? []).forEach(([k, v]) => {
      p.text(k, x, yy, { size: 8, color: GRIS })
      p.text(cortar(v, 36), x, yy - 11, { size: 10, bold: true })
      yy -= 26
    })
  }
  bloque('Yape / Plin', yape?.datos, 62)
  bloque('Transferencia o deposito bancario', banco?.datos, 300)
  p.text('Indica el N. de operacion al enviar tu pago.', 62, y - 134, { size: 8, color: GRIS })

  p.line(50, 60, 545, 60)
  p.text('Representacion interna generada por YCLOUD ERP. No reemplaza al comprobante electronico emitido ante SUNAT.', 50, 44, { size: 8, color: GRIS })
  return p.blob()
}
