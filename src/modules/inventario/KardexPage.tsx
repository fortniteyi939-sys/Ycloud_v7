import { useDatos } from '../../hooks/useDatos'
import { ALMACENES, nombreProducto, nombreTercero } from '../../services/datos'
import { fechaCorta, sumar } from '../../utils/format'
import PageHeader from '../../components/PageHeader'
import PasoAPaso from '../../components/PasoAPaso'
import DataTable from '../../components/DataTable'
import PanelResumen from '../../components/PanelResumen'
import Badge from '../../components/Badge'

export default function KardexPage() {
  const { datos: d } = useDatos()
  const k = d.kardex
  return (
    <>
      <PageHeader titulo="Movimiento de Kardex" descripcion="Entradas y salidas de inventario generadas automáticamente por compras y ventas." />
      <PasoAPaso clave="kardex" />
      <div className="lay">
        <DataTable
          filas={k}
          texto={x => x.documento + nombreProducto(d, x.producto) + nombreTercero(d, x.tercero)}
          estado={x => x.operacion}
          fecha={x => x.fecha}
          almacen={x => x.almacen}
          almacenes={ALMACENES}
          placeholder="Buscar producto, documento o tercero…"
          csv={{ archivo: 'kardex', fila: x => [fechaCorta(x.fecha), x.documento, x.operacion, nombreProducto(d, x.producto), x.almacen, nombreTercero(d, x.tercero), (x.operacion === 'Entrada' ? '+' : '−') + x.cantidad, x.saldo] }}
          columnas={[
            { titulo: 'Fecha', celda: x => fechaCorta(x.fecha), orden: x => x.fecha },
            { titulo: 'Documento', celda: x => <code>{x.documento}</code>, orden: x => x.documento },
            { titulo: 'Operación', celda: x => <Badge estado={x.operacion} />, orden: x => x.operacion },
            { titulo: 'Producto', celda: x => nombreProducto(d, x.producto), orden: x => nombreProducto(d, x.producto) },
            { titulo: 'Almacén', celda: x => x.almacen },
            { titulo: 'Tercero', celda: x => nombreTercero(d, x.tercero) },
            { titulo: 'Cantidad', celda: x => (x.operacion === 'Entrada' ? '+' : '−') + x.cantidad, orden: x => x.cantidad },
            { titulo: 'Saldo', celda: x => x.saldo }
          ]}
        />
        <PanelResumen general={[['Movimientos', k.length], ['Entradas', sumar(k.filter(x => x.operacion === 'Entrada'), x => x.cantidad)], ['Salidas', sumar(k.filter(x => x.operacion === 'Salida'), x => x.cantidad)], ['Productos movidos', new Set(k.map(x => x.producto)).size]]} />
      </div>
    </>
  )
}
