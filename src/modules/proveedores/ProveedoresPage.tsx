import { useState } from 'react'
import { useDatos } from '../../hooks/useDatos'

import { alternarActivo } from '../../services/operaciones'
import PageHeader from '../../components/PageHeader'
import PasoAPaso from '../../components/PasoAPaso'
import DataTable from '../../components/DataTable'
import Badge from '../../components/Badge'
import RegistroModal from '../../components/RegistroModal'

export default function ProveedoresPage() {
  const { datos: d, ejecutar } = useDatos()
  const [nuevo, setNuevo] = useState(false)
  return (
    <>
      <PageHeader titulo="Proveedores" descripcion="Datos de tus proveedores." acciones={<button className="pri" onClick={() => setNuevo(true)}>+ Nuevo proveedor</button>} />
      <PasoAPaso clave="mantenimiento" />
      <DataTable
        filas={d.proveedores.map(t => ({ ...t, estado: t.activo ? 'Activo' : 'Inactivo' }))}
        texto={x => x.id + x.nombre + x.ruc}
        estado={x => x.estado}
        placeholder="Buscar por nombre, código o RUC…"
        columnas={[
          { titulo: 'Código', celda: x => <code>{x.id}</code>, orden: x => x.id },
          { titulo: 'Razón social', celda: x => x.nombre, orden: x => x.nombre },
          { titulo: 'RUC', celda: x => x.ruc },
          
          { titulo: 'Estado', celda: x => <Badge estado={x.estado} /> },
          { titulo: '', celda: x => <button onClick={() => ejecutar(c => alternarActivo(c, x.id))}>{x.activo ? 'Desactivar' : 'Activar'}</button> }
        ]}
      />
      {nuevo && <RegistroModal tipo="proveedor" onClose={() => setNuevo(false)} />}
    </>
  )
}
