import { Link } from 'react-router-dom'
import { useDatos } from '../../hooks/useDatos'
import { ALMACENES, stockTotal } from '../../services/datos'
import { moneda, sumar } from '../../utils/format'
import PageHeader from '../../components/PageHeader'
import PasoAPaso from '../../components/PasoAPaso'
import DataTable from '../../components/DataTable'
import PanelResumen from '../../components/PanelResumen'
import Badge from '../../components/Badge'

export default function StockPage() {
  const { datos: d } = useDatos()
  const r = d.productos.map(p => ({ ...p, estado: stockTotal(p) < p.minimo ? 'Stock bajo' : 'Disponible' }))
  const bajos = r.filter(x => x.estado === 'Stock bajo').length
  return (
    <>
      <PageHeader titulo="Stock de productos" descripcion="Existencias actuales por almacén, actualizadas en tiempo real." />
      <PasoAPaso clave="stock" />
      <div className="lay">
        <DataTable
          filas={r}
          texto={x => x.id + x.nombre + x.categoria}
          estado={x => x.estado}
          placeholder="Buscar producto, código o categoría…"
          csv={{ archivo: 'stock', fila: x => [x.id, x.nombre, ...x.stock, stockTotal(x), x.estado] }}
          columnas={[
            { titulo: 'Código', celda: x => <code>{x.id}</code>, orden: x => x.id },
            { titulo: 'Producto', celda: x => <>{x.nombre}<br /><small className="mut">{x.categoria}</small></>, orden: x => x.nombre },
            ...ALMACENES.map((a, i) => ({ titulo: 'Almacén ' + a, celda: (x: (typeof r)[number]) => x.stock[i], orden: (x: (typeof r)[number]) => x.stock[i] })),
            { titulo: 'Total', celda: x => <b>{stockTotal(x)} UND</b>, orden: x => stockTotal(x) },
            { titulo: 'Estado', celda: x => <Badge estado={x.estado} />, orden: x => x.estado }
          ]}
        />
        <PanelResumen
          general={[['Productos', r.length], ['Unidades totales', sumar(r, stockTotal).toLocaleString('es-PE')], ['Stock bajo', bajos], ['Valorizado', moneda(sumar(r, p => stockTotal(p) * p.costo))]]}
          alerta={bajos ? { texto: `${bajos} productos con stock bajo.`, ruta: '/compras', boton: 'Crear compra' } : undefined}
        />
      </div>
      <p className="mut"><Link to="/mantenimientos/productos">Ver catálogo de productos →</Link></p>
    </>
  )
}
