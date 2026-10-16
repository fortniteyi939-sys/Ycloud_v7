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
