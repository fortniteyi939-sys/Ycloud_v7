import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useDatos } from '../../hooks/useDatos'
import PageHeader from '../../components/PageHeader'

/** Mantenimientos: catálogos de la operación (clientes, proveedores y productos) en pestañas. */
export default function MantenimientosPage() {
  const { datos: d } = useDatos()
  const { pathname } = useLocation()
  const ir = useNavigate()
  const pestanas: [string, string, number][] = [
    ['clientes', 'Clientes', d.clientes.length],
    ['proveedores', 'Proveedores', d.proveedores.length],
    ['productos', 'Productos', d.productos.length]
  ]
  return (
    <>
      <PageHeader titulo="Mantenimientos" descripcion="Administra los catálogos de tu operación." />
      <div className="tabs">
        {pestanas.map(([ruta, titulo, n]) => (
          <button key={ruta} className={pathname.endsWith('/' + ruta) ? 'on' : ''} onClick={() => ir('/mantenimientos/' + ruta)}>{titulo} · {n}</button>
        ))}
      </div>
      <Outlet />
    </>
  )
}
