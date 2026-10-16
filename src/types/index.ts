export interface Producto { id: string; nombre: string; categoria: string; costo: number; precio: number; minimo: number; activo: boolean; stock: number[] }
export interface Tercero { id: string; nombre: string; ruc: string; segmento: string; activo: boolean; contacto?: string; direccion?: string; telefono?: string; correo?: string; condicion?: string; limite: number }
export interface Linea { producto: string; cantidad: number; precio: number }
export type Pago = 'Contado' | 'Crédito'

export interface OrdenCompra { id: string; fecha: string; proveedor: string; almacen: string; pago: Pago; lineas: Linea[]; estado: 'Pendiente' | 'Recibida' | 'Anulada'; fechaRecepcion?: string; obs?: string; sucursal?: string; dias?: number; descuento?: number }
export interface Cotizacion { id: string; fecha: string; cliente: string; vigencia: number; lineas: Linea[]; estado: 'Borrador' | 'Enviada' | 'Rechazada' | 'Procesada'; ordenVenta?: string; obs?: string; sucursal?: string; descuento?: number }
export interface OrdenVenta { id: string; fecha: string; cliente: string; almacen: string; pago: Pago; lineas: Linea[]; estado: 'Pendiente' | 'Facturada' | 'Anulada'; comprobante?: string; tipoComprobante?: 'Factura' | 'Boleta'; obs?: string; sucursal?: string; dias?: number; cuotas?: number; descuento?: number }
export interface Cobro { fecha: string; monto: number; medio?: string; operacion?: string }
export interface Comprobante { id: string; fecha: string; cliente: string; ordenVenta: string; pago: Pago; total: number; cobros: Cobro[]; tipo: 'Factura' | 'Boleta'; vendedor?: string }
export interface MovKardex { fecha: string; documento: string; operacion: 'Entrada' | 'Salida'; producto: string; almacen: string; tercero: string; cantidad: number; saldo: number }

export interface Datos {
  productos: Producto[]
  clientes: Tercero[]
  proveedores: Tercero[]
  ordenesCompra: OrdenCompra[]
  cotizaciones: Cotizacion[]
  ordenesVenta: OrdenVenta[]
  comprobantes: Comprobante[]
  kardex: MovKardex[]
}

export type Resultado = { ok: boolean; mensaje: string }

export interface Perfil { id: string; nombres: string; email: string | null; activo: boolean; rol: { codigo: string; nombre: string } | null }
