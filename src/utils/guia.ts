// Textos de ayuda "siguiente paso" que se muestran arriba de cada pantalla
export const GUIA: Record<string, { paso: string; texto: string; ruta: string; boton: string }> = {
  oc: { paso: 'Paso 1 de 6', texto: 'Pulsa “+ Nueva orden”, elige proveedor y productos. Cuando llegue la mercadería, pulsa “Recibir”.', ruta: '/recepcion', boton: 'Siguiente: Ingreso al Kardex' },
  recepcion: { paso: 'Paso 2 de 6', texto: 'Aquí aparecen las notas de ingreso de las compras ya recibidas. Para recibir una orden pendiente, pulsa “Recibir” en Orden de compra.', ruta: '/cotizaciones', boton: 'Siguiente: Cotización' },
  cotizaciones: { paso: 'Paso 3 de 6', texto: 'Crea una cotización, pulsa “Enviar” y luego “Aceptó” o “No aceptó”. Si acepta, se crea la orden de venta.', ruta: '/ventas', boton: 'Siguiente: Orden de venta' },
  ventas: { paso: 'Paso 4 de 6', texto: 'Pulsa “Facturar” en los pedidos pendientes para emitir el comprobante y descontar el stock.', ruta: '/facturacion', boton: 'Siguiente: Facturación' },
  facturacion: { paso: 'Paso 5 de 6', texto: 'Aquí ves los comprobantes emitidos. Si el stock no alcanza al facturar, el sistema te avisa.', ruta: '/cuentas-por-cobrar', boton: 'Siguiente: Estado de cuenta' },
  cxc: { paso: 'Paso 6 de 6', texto: 'Pulsa “Cobrar” para registrar un pago total o parcial del cliente.', ruta: '/', boton: 'Volver al panel' },
  kardex: { paso: 'Consulta', texto: 'Historial automático de entradas y salidas. Se genera solo al recibir y al facturar.', ruta: '/stock', boton: 'Ver stock' },
  stock: { paso: 'Consulta', texto: '“Stock bajo” significa que conviene crear una orden de compra.', ruta: '/compras', boton: 'Crear compra' },
  reportes: { paso: 'Consulta', texto: 'Pulsa “Consultar” en un reporte para verlo en pantalla.', ruta: '/', boton: 'Volver al panel' },
  mantenimiento: { paso: 'Datos base', texto: 'Aquí creas clientes, proveedores y productos antes de usarlos en compras y ventas.', ruta: '/compras', boton: 'Ir a compras' }
}
