import type { Comprobante, Datos, Producto } from '../types'
import { sumar } from '../utils/format'

// Listas de configuración: se llenan al cargar desde Supabase (tablas `almacenes` y `sucursales`).
// Son arreglos mutables porque varias pantallas los importan directamente.
export const ALMACENES: string[] = []
export const SUCURSALES: string[] = []

// ---------- consultas sobre los datos cargados ----------
export const stockTotal = (p: Producto) => sumar(p.stock, x => x)
export const productoPorId = (d: Datos, id: string) => d.productos.find(p => p.id === id)
export const nombreProducto = (d: Datos, id: string) => productoPorId(d, id)?.nombre ?? id
export const tercero = (d: Datos, id: string) => [...d.clientes, ...d.proveedores].find(x => x.id === id)
export const nombreTercero = (d: Datos, id: string) => tercero(d, id)?.nombre ?? id
export const rucTercero = (d: Datos, id: string) => tercero(d, id)?.ruc ?? ''
export const pagado = (c: Comprobante) => sumar(c.cobros, x => x.monto)
export const estadoComprobante = (c: Comprobante) => (pagado(c) >= c.total - 0.005 ? 'Pagado' : pagado(c) > 0 ? 'Pago parcial' : 'Pendiente')
export const deudaCliente = (d: Datos, id: string) => sumar(d.comprobantes.filter(f => f.cliente === id), f => f.total - pagado(f))

// ---------- catálogos fijos del formulario de documentos ----------
export const CONDICIONES_PAGO = ['Contado', 'Crédito 30 días', 'Crédito 60 días']
export const COMPROBANTES: { tipo: 'Factura' | 'Boleta'; etiqueta: string }[] = [
  { tipo: 'Factura', etiqueta: 'F001 · Factura electrónica' },
  { tipo: 'Boleta', etiqueta: 'B001 · Boleta electrónica' }
]

// ---------- medios de pago para cobranzas ----------
// Los nombres deben coincidir con el enum `medio_pago` de la base de datos (ver database/04_medios_pago.sql).
// ⚠ DATOS DE EJEMPLO: reemplaza las cuentas, el número de Yape/Plin y la razón social por los reales de tu empresa.
export const EMPRESA = { nombre: 'YCLOUD ERP S.A.C.', ruc: '20000000001' }

export interface MedioPago {
  medio: string
  /** Texto corto para el botón */
  etiqueta: string
  /** Pide número de operación (coincide con la regla de la base de datos: todo menos Efectivo) */
  requiereOperacion: boolean
  placeholderOperacion: string
  /** Texto de ayuda bajo el selector */
  ayuda: string
  /** Datos que ve el cliente para pagar con este medio */
  datos: [string, string][]
}

const CUENTA_BCP: [string, string][] = [
  ['Banco', 'BCP · Cuenta corriente en soles'],
  ['N.º de cuenta', '193-0000000-0-00'],
  ['CCI', '002-193-000000000000-00'],
  ['Titular', EMPRESA.nombre]
]

export const MEDIOS_PAGO: MedioPago[] = [
  { medio: 'Efectivo', etiqueta: 'Efectivo', requiereOperacion: false, placeholderOperacion: '', ayuda: 'Pago recibido en caja. No requiere número de operación.', datos: [] },
  { medio: 'Transferencia bancaria', etiqueta: 'Transferencia bancaria', requiereOperacion: true, placeholderOperacion: 'N.º de operación del banco', ayuda: 'El cliente transfiere a la cuenta de la empresa y envía el número de operación.', datos: CUENTA_BCP },
  { medio: 'Yape / Plin', etiqueta: 'Yape / Plin', requiereOperacion: true, placeholderOperacion: 'N.º de operación de Yape o Plin', ayuda: 'El cliente paga desde su celular al número de la empresa.', datos: [['Yape / Plin', '999 999 999'], ['Titular', EMPRESA.nombre]] },
  { medio: 'Depósito en cuenta', etiqueta: 'Depósito en cuenta', requiereOperacion: true, placeholderOperacion: 'N.º de operación del voucher', ayuda: 'Depósito en ventanilla, agente o app. Registra el número del voucher.', datos: CUENTA_BCP },
  { medio: 'Tarjeta', etiqueta: 'Tarjeta', requiereOperacion: true, placeholderOperacion: 'Código de autorización del POS', ayuda: 'Pago con tarjeta de crédito o débito en el POS.', datos: [] },
  { medio: 'Cheque', etiqueta: 'Cheque', requiereOperacion: true, placeholderOperacion: 'N.º de cheque', ayuda: 'Cheque a nombre de la empresa.', datos: [['A nombre de', EMPRESA.nombre], ['RUC', EMPRESA.ruc]] }
]
