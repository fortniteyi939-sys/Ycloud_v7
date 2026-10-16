import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import { DatosProvider } from './hooks/useDatos'
import MainLayout from './layouts/MainLayout'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import ReportesPage from './pages/ReportesPage'
import ClientesPage from './modules/clientes/ClientesPage'
import ProveedoresPage from './modules/proveedores/ProveedoresPage'
import CotizacionesPage from './modules/ventas/CotizacionesPage'
import OrdenesVentaPage from './modules/ventas/OrdenesVentaPage'
import FacturacionPage from './modules/ventas/FacturacionPage'
import OrdenesCompraPage from './modules/compras/OrdenesCompraPage'
import RecepcionPage from './modules/compras/RecepcionPage'
import ProductosPage from './modules/inventario/ProductosPage'
import StockPage from './modules/inventario/StockPage'
import KardexPage from './modules/inventario/KardexPage'
import CuentasPorCobrarPage from './modules/finanzas/CuentasPorCobrarPage'
import UsuariosPage from './modules/administracion/UsuariosPage'
import MantenimientosPage from './modules/administracion/MantenimientosPage'

export default function App() {
  const { cargando, perfil } = useAuth()
  if (cargando) return <div className="auth"><p className="mut">Cargando…</p></div>
  if (!perfil) return <LoginPage />
  const esAdmin = perfil.rol?.codigo === 'admin'
  return (
    <DatosProvider>
      <Routes>
        <Route element={<MainLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="cotizaciones" element={<CotizacionesPage />} />
          <Route path="ventas" element={<OrdenesVentaPage />} />
          <Route path="facturacion" element={<FacturacionPage />} />
          <Route path="compras" element={<OrdenesCompraPage />} />
          <Route path="recepcion" element={<RecepcionPage />} />
          <Route path="mantenimientos" element={<MantenimientosPage />}>
            <Route index element={<Navigate to="clientes" replace />} />
            <Route path="clientes" element={<ClientesPage />} />
            <Route path="proveedores" element={<ProveedoresPage />} />
            <Route path="productos" element={<ProductosPage />} />
          </Route>
          <Route path="clientes" element={<Navigate to="/mantenimientos/clientes" replace />} />
          <Route path="proveedores" element={<Navigate to="/mantenimientos/proveedores" replace />} />
          <Route path="productos" element={<Navigate to="/mantenimientos/productos" replace />} />
          <Route path="stock" element={<StockPage />} />
          <Route path="kardex" element={<KardexPage />} />
          <Route path="cuentas-por-cobrar" element={<CuentasPorCobrarPage />} />
          <Route path="reportes" element={<ReportesPage />} />
          {esAdmin && <Route path="usuarios" element={<UsuariosPage />} />}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </DatosProvider>
  )
}
