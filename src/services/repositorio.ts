import { supabase } from './supabase'
import type { Cobro, Comprobante, Cotizacion, Datos, Linea, MovKardex, OrdenCompra, OrdenVenta, Producto, Tercero } from '../types'
import { ALMACENES, SUCURSALES } from './datos'

/**
 * Acceso a Supabase con el esquema 01_esquema_erp.sql.
 *  · Lectura: carga las tablas y las convierte al objeto `Datos` que usan las pantallas
 *    (las pantallas siguen viendo códigos como CLI-0001, OV-2026-0001, F001-000001).
 *  · Escritura: las operaciones llaman a las funciones RPC del esquema (facturar, recibir, crear documentos…)
 *    o insertan en las tablas de catálogo / pagos. La lógica de negocio vive en la base de datos.
 */
type Fila = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

export const db = () => {
  if (!supabase) throw new Error('Supabase no está configurado.')
  return supabase
}

/** Traducción código visible -> id numérico de la base (se rellena en cada carga). */
const IDS = {
  producto: new Map<string, number>(), cliente: new Map<string, number>(), proveedor: new Map<string, number>(),
  almacen: new Map<string, number>(), sucursal: new Map<string, number>(),
  cotizacion: new Map<string, number>(), ordenVenta: new Map<string, number>(), ordenCompra: new Map<string, number>(), comprobante: new Map<string, number>()
}
export type TipoId = keyof typeof IDS
export function idDe(tipo: TipoId, codigo: string): number {
  const id = IDS[tipo].get(codigo)
  if (id === undefined) throw new Error(`No se encontró ${tipo} «${codigo}». Actualiza los datos e inténtalo de nuevo.`)
  return id
}

/** Lee una tabla completa (Supabase devuelve máx. 1000 filas por consulta, por eso se pagina). */
async function leer(tabla: string, filtro?: (q: any) => any, orden: string[] = ['id']): Promise<Fila[]> { // eslint-disable-line @typescript-eslint/no-explicit-any
  const todas: Fila[] = []
  for (let desde = 0; ; desde += 1000) {
    let q = db().from(tabla).select('*')
    if (filtro) q = filtro(q)
    for (const col of orden) q = q.order(col)
    const { data, error } = await q.range(desde, desde + 999)
    if (error) throw new Error(`${tabla}: ${error.message}`)
    todas.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }
  return todas
}

const num = (x: unknown) => Number(x ?? 0)
const opc = <T,>(x: T | null | undefined) => (x === null || x === undefined || x === '' ? undefined : x)
/** Fecha de negocio en hora de Lima a partir de un timestamp. */
const fechaLima = (ts: string) => new Date(ts).toLocaleDateString('en-CA', { timeZone: 'America/Lima' })
const condicion = (dias: number) => (dias > 0 ? `Crédito ${dias} días` : 'Contado')

// ---------------------------------------------------------------- lectura
export async function cargarTodo(): Promise<Datos> {
  const [alm, suc, cat, prod, inv, cli, prv, usu, cot, cotD, ov, ovD, oc, ocD, comp, pagos, kdx] = await Promise.all([
    leer('almacenes', q => q.eq('activo', true)), leer('sucursales', q => q.eq('activo', true)), leer('categorias'),
    leer('productos'), leer('inventarios', undefined, ['producto_id', 'almacen_id']), leer('clientes'), leer('proveedores'),
    leer('usuarios'), leer('cotizaciones'), leer('cotizacion_detalle'), leer('ordenes_venta'), leer('orden_venta_detalle'),
    leer('ordenes_compra'), leer('orden_compra_detalle'), leer('comprobantes'), leer('pagos', q => q.eq('tipo', 'Cobro')), leer('movimientos_inventario')
  ])
  alm.sort((a, b) => String(a.codigo).localeCompare(String(b.codigo)))
  suc.sort((a, b) => String(a.codigo).localeCompare(String(b.codigo)))

  Object.values(IDS).forEach(m => m.clear())
  ALMACENES.splice(0, ALMACENES.length, ...alm.map(a => a.nombre as string))
  SUCURSALES.splice(0, SUCURSALES.length, ...suc.map(s => s.nombre as string))
  alm.forEach(a => IDS.almacen.set(a.nombre, a.id))
  suc.forEach(s => IDS.sucursal.set(s.nombre, s.id))
  prod.forEach(p => IDS.producto.set(p.codigo, p.id))
  cli.forEach(c => IDS.cliente.set(c.codigo, c.id))
  prv.forEach(p => IDS.proveedor.set(p.codigo, p.id))
  cot.forEach(c => IDS.cotizacion.set(c.numero, c.id))
  ov.forEach(o => IDS.ordenVenta.set(o.numero, o.id))
  oc.forEach(o => IDS.ordenCompra.set(o.numero, o.id))
  comp.forEach(c => IDS.comprobante.set(c.numero, c.id))

  // lookups por id numérico
  const codProd = new Map(prod.map(p => [p.id, p.codigo as string]))
  const codCli = new Map(cli.map(c => [c.id, c.codigo as string]))
  const codPrv = new Map(prv.map(p => [p.id, p.codigo as string]))
  const nomAlm = new Map(alm.map(a => [a.id, a.nombre as string]))
  const nomSuc = new Map(suc.map(s => [s.id, s.nombre as string]))
  const nomCat = new Map(cat.map(c => [c.id, c.nombre as string]))
  const nomUsu = new Map(usu.map(u => [u.id, u.nombres as string]))

  const stockDe = new Map<number, number[]>()
  inv.forEach(r => {
    const i = ALMACENES.indexOf(nomAlm.get(r.almacen_id) ?? '')
    if (i < 0) return
    const v = stockDe.get(r.producto_id) ?? ALMACENES.map(() => 0)
    v[i] = num(r.cantidad)
    stockDe.set(r.producto_id, v)
  })
  const productos: Producto[] = prod.map(p => ({
    id: p.codigo, nombre: p.nombre, categoria: nomCat.get(p.categoria_id) ?? 'General', costo: num(p.costo), precio: num(p.precio_venta),
    minimo: num(p.stock_minimo), activo: p.activo, stock: stockDe.get(p.id) ?? ALMACENES.map(() => 0)
  }))

  const clientes: Tercero[] = cli.map(c => ({
    id: c.codigo, nombre: c.razon_social, ruc: c.ruc, segmento: c.segmento, activo: c.activo, limite: num(c.linea_credito),
    contacto: opc(c.contacto), direccion: opc(c.direccion), telefono: opc(c.telefono), correo: opc(c.correo), condicion: condicion(num(c.dias_credito))
  }))
  const proveedores: Tercero[] = prv.map(p => ({
    id: p.codigo, nombre: p.razon_social, ruc: p.ruc, segmento: 'Proveedor', activo: p.activo, limite: 0,
    contacto: opc(p.contacto), direccion: opc(p.direccion), telefono: opc(p.telefono), correo: opc(p.correo), condicion: condicion(num(p.dias_credito))
  }))

  // líneas de documentos; el descuento global se reparte en el precio para que el total (con IGV) coincida con la base
  const agrupar = (det: Fila[], llave: string, precio: string) => {
    const m = new Map<number, Linea[]>()
    det.forEach(d => m.set(d[llave], [...(m.get(d[llave]) ?? []), { producto: codProd.get(d.producto_id) ?? '', cantidad: num(d.cantidad), precio: num(d[precio]) }]))
    return m
  }
  const lcot = agrupar(cotD, 'cotizacion_id', 'precio_unitario'), lov = agrupar(ovD, 'orden_venta_id', 'precio_unitario'), loc = agrupar(ocD, 'orden_compra_id', 'costo_unitario')
  const neto = (ls: Linea[] | undefined, subtotal: unknown, descuento: unknown): Linea[] => {
    const sb = num(subtotal), ds = num(descuento)
    const f = sb > 0 && ds > 0 && ds < sb ? (sb - ds) / sb : 1
    return (ls ?? []).map(l => ({ ...l, precio: f === 1 ? l.precio : +(l.precio * f).toFixed(4) }))
  }

  const ovDeCot = new Map(ov.filter(o => o.cotizacion_id).map(o => [o.cotizacion_id, o.numero as string]))
  const compDeOv = new Map(comp.map(c => [c.orden_venta_id, c.numero as string]))

  const cotizaciones: Cotizacion[] = cot.map(c => ({
    id: c.numero, fecha: c.fecha, cliente: codCli.get(c.cliente_id) ?? '', vigencia: c.vigencia_dias, estado: c.estado,
    lineas: neto(lcot.get(c.id), c.subtotal, c.descuento), ordenVenta: ovDeCot.get(c.id), obs: opc(c.observaciones),
    sucursal: nomSuc.get(c.sucursal_id), descuento: num(c.descuento)
  }))
  const ordenesVenta: OrdenVenta[] = ov.map(o => ({
    id: o.numero, fecha: o.fecha, cliente: codCli.get(o.cliente_id) ?? '', almacen: nomAlm.get(o.almacen_id) ?? '', pago: o.forma_pago, estado: o.estado,
    lineas: neto(lov.get(o.id), o.subtotal, o.descuento), comprobante: compDeOv.get(o.id), tipoComprobante: o.tipo_comprobante,
    obs: opc(o.observaciones), sucursal: nomSuc.get(o.sucursal_id), dias: opc(num(o.dias_credito) || null), cuotas: opc(num(o.num_cuotas) || null), descuento: num(o.descuento)
  }))
  const ordenesCompra: OrdenCompra[] = oc.map(o => ({
    id: o.numero, fecha: o.fecha, proveedor: codPrv.get(o.proveedor_id) ?? '', almacen: nomAlm.get(o.almacen_id) ?? '', pago: o.forma_pago, estado: o.estado,
    lineas: neto(loc.get(o.id), o.subtotal, o.descuento), obs: opc(o.observaciones), sucursal: nomSuc.get(o.sucursal_id),
    dias: opc(num(o.dias_credito) || null), descuento: num(o.descuento), fechaRecepcion: o.fecha_recepcion ? fechaLima(o.fecha_recepcion) : undefined
  }))

  const cobrosDe = new Map<number, Cobro[]>()
  pagos.forEach(p => cobrosDe.set(p.comprobante_id, [...(cobrosDe.get(p.comprobante_id) ?? []), { fecha: p.fecha, monto: num(p.monto), medio: opc(p.medio_pago), operacion: opc(p.numero_operacion) }]))
  const numOv = new Map(ov.map(o => [o.id, o.numero as string]))
  const comprobantes: Comprobante[] = comp.map(c => ({
    id: c.numero, fecha: c.fecha, cliente: codCli.get(c.cliente_id) ?? '', ordenVenta: numOv.get(c.orden_venta_id) ?? '', pago: c.forma_pago,
    total: num(c.total), tipo: c.tipo, vendedor: nomUsu.get(c.vendedor_id), cobros: cobrosDe.get(c.id) ?? []
  }))

  const kardex: MovKardex[] = kdx.sort((a, b) => b.id - a.id).map(k => ({
    fecha: fechaLima(k.fecha), documento: k.documento_numero ?? '', operacion: k.tipo, producto: codProd.get(k.producto_id) ?? '',
    almacen: nomAlm.get(k.almacen_id) ?? '', tercero: k.tercero_nombre ?? '', cantidad: num(k.cantidad), saldo: num(k.saldo_total)
  }))

  const recientes = <T extends { fecha: string; id: string }>(a: T[]) => a.sort((x, y) => (y.fecha === x.fecha ? y.id.localeCompare(x.id) : y.fecha.localeCompare(x.fecha)))
  return {
    productos, clientes, proveedores, kardex,
    cotizaciones: recientes(cotizaciones), ordenesVenta: recientes(ordenesVenta), ordenesCompra: recientes(ordenesCompra), comprobantes: recientes(comprobantes)
  }
}
