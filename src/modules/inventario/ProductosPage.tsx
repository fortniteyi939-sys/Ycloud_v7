import { useState } from 'react'
import { useDatos } from '../../hooks/useDatos'
import { stockTotal } from '../../services/datos'
import { alternarActivo } from '../../services/operaciones'
import { moneda } from '../../utils/format'
import PageHeader from '../../components/PageHeader'
import PasoAPaso from '../../components/PasoAPaso'
import DataTable from '../../components/DataTable'
import Badge from '../../components/Badge'
import RegistroModal from '../../components/RegistroModal'

export default function ProductosPage() {
  const { datos: d, ejecutar } = useDatos()
  const [nuevo, setNuevo] = useState(false)
  return (
    <>
      <PageHeader titulo="Productos" descripcion="Catálogo de productos. Créalos aquí antes de usarlos en compras y ventas." acciones={<button className="pri" onClick={() => setNuevo(true)}>+ Nuevo producto</button>} />
      <PasoAPaso clave="mantenimiento" />
      <DataTable
        filas={d.productos.map(p => ({ ...p, estado: p.activo ? 'Activo' : 'Inactivo' }))}
        texto={x => x.id + x.nombre + x.categoria}
        estado={x => x.estado}
        placeholder="Buscar producto, código o categoría…"
        columnas={[
          { titulo: 'Código', celda: x => <code>{x.id}</code>, orden: x => x.id },
          { titulo: 'Producto', celda: x => x.nombre, orden: x => x.nombre },
          { titulo: 'Categoría', celda: x => x.categoria, orden: x => x.categoria },
          { titulo: 'Costo', celda: x => moneda(x.costo), orden: x => x.costo },
          { titulo: 'Precio', celda: x => moneda(x.precio), orden: x => x.precio },
          { titulo: 'Stock', celda: x => stockTotal(x), orden: x => stockTotal(x) },
          { titulo: 'Estado', celda: x => <Badge estado={x.estado} /> },
          { titulo: '', celda: x => <button onClick={() => ejecutar(c => alternarActivo(c, x.id))}>{x.activo ? 'Desactivar' : 'Activar'}</button> }
        ]}
      />
      {nuevo && <RegistroModal tipo="producto" onClose={() => setNuevo(false)} />}
    </>
  )
}
