import { useState } from 'react'
import { useDatos } from '../../hooks/useDatos'
import { deudaCliente } from '../../services/datos'
import { alternarActivo } from '../../services/operaciones'
import { moneda } from '../../utils/format'
import PageHeader from '../../components/PageHeader'
import PasoAPaso from '../../components/PasoAPaso'
import DataTable from '../../components/DataTable'
import Badge from '../../components/Badge'
import RegistroModal from '../../components/RegistroModal'

export default function ClientesPage() {
  const { datos: d, ejecutar } = useDatos()
  const [nuevo, setNuevo] = useState(false)
  return (
    <>
      <PageHeader titulo="Clientes" descripcion="Datos de tus clientes, segmento y estado de crédito." acciones={<button className="pri" onClick={() => setNuevo(true)}>+ Nuevo cliente</button>} />
      <PasoAPaso clave="mantenimiento" />
      <DataTable
        filas={d.clientes.map(t => ({ ...t, estado: t.activo ? 'Activo' : 'Inactivo' }))}
        texto={x => x.id + x.nombre + x.ruc}
        estado={x => x.estado}
        placeholder="Buscar por nombre, código o RUC…"
        columnas={[
          { titulo: 'Código', celda: x => <code>{x.id}</code>, orden: x => x.id },
          { titulo: 'Razón social', celda: x => x.nombre, orden: x => x.nombre },
          { titulo: 'RUC', celda: x => x.ruc },
          { titulo: 'Segmento', celda: x => <span className="b">{x.segmento}</span>, orden: x => x.segmento },
          { titulo: 'Línea de crédito', celda: x => moneda(x.limite) },
          { titulo: 'Deuda', celda: x => <b className="dn">{moneda(deudaCliente(d, x.id))}</b>, orden: x => deudaCliente(d, x.id) },
          { titulo: 'Estado', celda: x => <Badge estado={x.estado} /> },
          { titulo: '', celda: x => <button onClick={() => ejecutar(c => alternarActivo(c, x.id))}>{x.activo ? 'Desactivar' : 'Activar'}</button> }
        ]}
      />
      {nuevo && <RegistroModal tipo="cliente" onClose={() => setNuevo(false)} />}
    </>
  )
}
