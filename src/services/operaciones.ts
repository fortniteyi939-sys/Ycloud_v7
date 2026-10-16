import type { Datos, Linea, Pago, Resultado } from '../types'
import { pagado, stockTotal } from './datos'
import { db, idDe } from './repositorio'
import { moneda, subtotal, sumar } from '../utils/format'

// Cada operación recibe los datos actuales (solo para validar rápido en pantalla) y devuelve un Resultado.
// La lógica real (stock, kardex, numeración, crédito, estados) la ejecuta la base de datos mediante funciones RPC;
// si la base rechaza algo, se muestra su mensaje.
const ok = (mensaje: string): Resultado => ({ ok: true, mensaje })
const fallo = (mensaje: string): Resultado => ({ ok: false, mensaje })

/** Ejecuta una llamada a Supabase y convierte su error en un Resultado. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function llamar(p: PromiseLike<{ data: any; error: { message: string } | null }>, exito: (data: any) => string): Promise<Resultado> {
  const { data, error } = await p
  if (error) return fallo(error.message)
  return ok(exito(data))
}

// ---------- compras ----------
export async function recibirOrdenCompra(_d: Datos, id: string): Promise<Resultado> {
  return llamar(db().rpc('recibir_orden_compra', { p_id: idDe('ordenCompra', id) }), () => 'Ingreso registrado: el stock aumentó')
}

// ---------- ventas ----------
export async function facturarOrdenVenta(_d: Datos, id: string): Promise<Resultado> {
  return llamar(db().rpc('facturar_orden_venta', { p_id: idDe('ordenVenta', id) }),
    (c: { numero?: string } | null) => `Comprobante ${c?.numero ?? ''} emitido; stock descontado`)
}

export async function cambiarEstadoCotizacion(_d: Datos, id: string, accion: 'enviar' | 'rechazar' | 'aceptar'): Promise<Resultado> {
  const p_id = idDe('cotizacion', id)
  if (accion === 'enviar') return llamar(db().rpc('cotizacion_cambiar_estado', { p_id, p_estado: 'Enviada' }), () => 'Cotización enviada')
  if (accion === 'rechazar') return llamar(db().rpc('cotizacion_cambiar_estado', { p_id, p_estado: 'Rechazada' }), () => 'Marcada como no aceptada')
  return llamar(db().rpc('cotizacion_aceptar', { p_id }), (o: { numero?: string } | null) => 'Aceptada: se creó ' + (o?.numero ?? 'la orden de venta'))
}

export interface NuevoDocumento {
  tipo: 'OC' | 'COT' | 'OV'
  fecha: string
  tercero: string
  almacen: string
  pago: Pago
  vigencia: number
  comprobante: 'Factura' | 'Boleta'
  lineas: Linea[]
  descuento: number
  obs: string
  sucursal: string
  /** días de crédito (solo si el pago es a crédito) */
  dias: number
  /** N.º de cuotas (solo órdenes de venta) */
  cuotas: number
}

export async function crearDocumento(_d: Datos, n: NuevoDocumento): Promise<Resultado> {
  const esCompra = n.tipo === 'OC'
  if (!n.tercero) return fallo('Selecciona un ' + (esCompra ? 'proveedor' : 'cliente'))
  if (!n.lineas.length) return fallo('Agrega al menos un producto')
  if (n.lineas.some(l => !(l.cantidad > 0) || !(l.precio > 0))) return fallo('Revisa cantidades y precios')
  const sb = subtotal(n.lineas)
  if (n.descuento < 0 || n.descuento >= sb) return fallo('El descuento debe ser menor al subtotal')
  if (n.tipo !== 'COT' && !n.almacen) return fallo('No hay almacenes: crea uno en la tabla almacenes de Supabase')

  const sucursal_id = n.sucursal ? idDe('sucursal', n.sucursal) : null
  const comun = { fecha: n.fecha, sucursal_id, descuento: n.descuento, observaciones: n.obs.trim() || null }
  const credito = n.pago === 'Crédito'

  if (n.tipo === 'COT') {
    const p_lineas = n.lineas.map(l => ({ producto_id: idDe('producto', l.producto), cantidad: l.cantidad, precio_unitario: l.precio }))
    const p_cab = { ...comun, cliente_id: idDe('cliente', n.tercero), vigencia_dias: n.vigencia }
    return llamar(db().rpc('crear_cotizacion', { p_cab, p_lineas }), (c: { numero?: string } | null) => 'Creado ' + (c?.numero ?? ''))
  }
  if (n.tipo === 'OC') {
    const p_lineas = n.lineas.map(l => ({ producto_id: idDe('producto', l.producto), cantidad: l.cantidad, costo_unitario: l.precio }))
    const p_cab = { ...comun, proveedor_id: idDe('proveedor', n.tercero), almacen_id: idDe('almacen', n.almacen), forma_pago: n.pago, dias_credito: credito ? n.dias : 0 }
    return llamar(db().rpc('crear_orden_compra', { p_cab, p_lineas }), (o: { numero?: string } | null) => 'Creado ' + (o?.numero ?? ''))
  }
  const p_lineas = n.lineas.map(l => ({ producto_id: idDe('producto', l.producto), cantidad: l.cantidad, precio_unitario: l.precio }))
  const p_cab = {
    ...comun, cliente_id: idDe('cliente', n.tercero), almacen_id: idDe('almacen', n.almacen), forma_pago: n.pago,
    dias_credito: credito ? n.dias : 0, num_cuotas: n.cuotas, tipo_comprobante: n.comprobante
  }
  return llamar(db().rpc('crear_orden_venta', { p_cab, p_lineas }), (o: { numero?: string } | null) => 'Creado ' + (o?.numero ?? ''))
}

// ---------- finanzas ----------
export async function registrarCobranza(d: Datos, id: string, monto: number, medio: string, operacion: string, fecha: string): Promise<Resultado> {
  const f = d.comprobantes.find(x => x.id === id)
  if (!f) return fallo('Comprobante no encontrado')
  const deuda = f.total - pagado(f)
  if (!(monto > 0) || monto > deuda + 0.005) return fallo('Importe inválido (máx. ' + moneda(deuda) + ')')
  if (!fecha) return fallo('Indica la fecha del pago')
  if (medio !== 'Efectivo' && !operacion.trim()) return fallo('Escribe el N.º de operación')
  return llamar(
    db().from('pagos').insert({ tipo: 'Cobro', comprobante_id: idDe('comprobante', id), fecha, monto, medio_pago: medio, numero_operacion: operacion.trim() || null }).select('id'),
    () => 'Cobranza registrada · ' + medio)
}

// ---------- catálogos ----------
export type TipoCatalogo = 'cliente' | 'proveedor' | 'producto'

const DIAS: Record<string, number> = { 'Contado': 0, 'Crédito 30 días': 30, 'Crédito 60 días': 60 }

export async function crearRegistro(_d: Datos, tipo: TipoCatalogo, v: Record<string, string>): Promise<Resultado> {
  const nombre = (v.nombre ?? '').trim()
  if (!nombre) return fallo('Escribe un nombre')
  const texto = (k: string) => (v[k] ?? '').trim() || null

  if (tipo === 'producto') {
    if ((+v.costo || 0) < 0 || (+v.precio || 0) < 0) return fallo('Costo y precio no pueden ser negativos')
    const categoria = (v.categoria ?? '').trim() || 'General'
    const c = await db().from('categorias').upsert({ nombre: categoria }, { onConflict: 'nombre' }).select('id').single()
    if (c.error) return fallo(c.error.message)
    return llamar(db().from('productos').insert({ nombre, categoria_id: c.data.id, costo: +v.costo || 0, precio_venta: +v.precio || 0, stock_minimo: +v.minimo || 0 }).select('id'), () => 'Producto creado')
  }

  const ruc = (v.ruc ?? '').trim()
  if (!/^\d{11}$/.test(ruc)) return fallo('El RUC debe tener 11 dígitos')
  const comun = { razon_social: nombre, ruc, contacto: texto('contacto'), telefono: texto('telefono'), correo: texto('correo'), direccion: texto('direccion') }
  const dias = v.condicion in DIAS ? { dias_credito: DIAS[v.condicion] } : {}   // "Según segmento": lo completa la base

  if (tipo === 'proveedor') return llamar(db().from('proveedores').insert({ ...comun, ...dias }).select('id'), () => 'Proveedor creado')
  const linea = v.limite !== undefined && v.limite !== '' ? { linea_credito: +v.limite } : {}   // vacío: la base usa el valor por segmento
  return llamar(db().from('clientes').insert({ ...comun, segmento: v.segmento || 'Minorista', ...dias, ...linea }).select('id'), () => 'Cliente creado')
}

export async function alternarActivo(d: Datos, id: string): Promise<Resultado> {
  const todos = [...d.clientes, ...d.proveedores, ...d.productos]
  const x = todos.find(r => r.id === id)
  if (!x) return fallo('Registro no encontrado')
  const tabla = id.startsWith('CLI') ? 'clientes' : id.startsWith('PRV') ? 'proveedores' : 'productos'
  const clave = id.startsWith('CLI') ? 'cliente' : id.startsWith('PRV') ? 'proveedor' : 'producto'
  const { data, error } = await db().from(tabla).update({ activo: !x.activo }).eq('id', idDe(clave, id)).select('id')
  if (error) return fallo(error.message)
  if (!data?.length) return fallo('No tienes permiso para modificar este registro')
  return ok('Estado actualizado')
}

export const unidadesTotales = (d: Datos) => sumar(d.productos, stockTotal)
