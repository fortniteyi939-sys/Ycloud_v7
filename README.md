# 02_FRONTEND · YCLOUD ERP

Frontend **React + TypeScript** (Vite) del ERP YCLOUD, organizado según el capítulo 14 del Documento Maestro.

## Ejecutar
```
npm install
cp .env.example .env     # completa VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY
npm run dev
```
Requiere Node.js 18+. Para producción: `npm run build` (incluye chequeo de tipos).
En Vercel: agrega las dos variables `VITE_...` en Settings > Environment Variables y redeploy (`vercel.json` ya incluye el rewrite para las rutas).

## Estructura (cap. 14)
```
src/
├── components/   DataTable, Modal, Badge, PageHeader, PanelResumen, DocumentoModal,
│                 SelectorModal (buscar cliente/proveedor/producto), FichaTercero (datos + crédito), AyudaModal…
├── layouts/      MainLayout (menú lateral + barra superior)
├── pages/        LoginPage, DashboardPage, ReportesPage
├── modules/
│   ├── ventas/          Cotizaciones, Órdenes de venta, Facturación
│   ├── compras/         Órdenes de compra, Recepción
│   ├── inventario/      Productos, Stock, Kardex
│   ├── clientes/        Clientes
│   ├── proveedores/     Proveedores
│   ├── finanzas/        Cuentas por cobrar (cobranzas)
│   └── administracion/  Usuarios (lee/edita public.usuarios; solo admin)
├── services/     supabase.ts, auth.ts, repositorio.ts (lee Supabase), datos.ts (consultas), operaciones.ts (llama a las funciones RPC)
├── hooks/        useAuth, useDatos (carga y guarda en Supabase)
├── types/        interfaces TypeScript
└── utils/        formato de moneda/fechas, CSV, guía "siguiente paso"
```

## Autenticación (Supabase Auth + esquema 04_DATABASE)
- Registro: `signUp` crea el usuario en `auth.users`; el trigger `fn_nuevo_usuario` crea su perfil en `public.usuarios` (el primero es `admin`, los demás `consulta`).
- Login: valida con Supabase Auth, carga perfil y rol desde `public.usuarios` y bloquea usuarios con `activo = false`.
- El menú "Usuarios" solo aparece para el rol `admin`.

## Datos (Supabase)
No hay datos de demostración: todo se lee y se guarda en Supabase con el esquema `01_esquema_erp.sql` (no incluyas `02_datos_demo.sql`).
- **Lectura**: `services/repositorio.ts` carga las tablas y las convierte al modelo que usan las pantallas (códigos CLI-0001, OV-2026-0001, F001-000001…).
- **Escritura**: `services/operaciones.ts` llama a las funciones del esquema — `crear_cotizacion`, `crear_orden_venta`, `crear_orden_compra`, `cotizacion_cambiar_estado`, `cotizacion_aceptar`, `recibir_orden_compra`, `facturar_orden_venta` — e inserta en `clientes`, `proveedores`, `productos`, `categorias` y `pagos`. Stock, Kardex, numeración, línea de crédito y estados los controla la base de datos; si rechaza algo, la app muestra su mensaje.
- Los permisos (RLS) dependen del rol del usuario en `public.usuarios`: `consulta` solo lee; `vendedor` cotiza/vende/factura; `compras`, `almacenero`, `contador`, `gerente` y `admin` según la matriz `roles_permisos`.
- Almacenes y sucursales activos salen de las tablas `almacenes` y `sucursales`.
- Para tener stock inicial: crea una orden de compra y regístrala como recibida (o usa la función `ajustar_stock`).
- El botón «↻ Actualizar» vuelve a leer los datos.

## Funciones migradas desde ycloud-erp_v11
- Guía «? Cómo usar» (se abre sola la primera vez) y cuadro «siguiente paso» también en Reportes y catálogos.
- Listas con encabezado «Lista de registros», filtro por **fecha**, estado, almacén, orden, paginación y CSV (incluida Recepción).
- Formulario de documentos con **sucursal**, forma de pago (Contado / Crédito 30 / 60 días), **N.º de cuotas**, tipo de comprobante (F001 / B001), descuento global y observaciones.
- Ventanas de **selección** de cliente/proveedor (chips por segmento) y de producto (stock del almacén elegido, aviso «en la orden»).
- Ficha del cliente/proveedor (dirección, contacto, condición de pago) y **estado de crédito** con barra de uso de la línea.
- Panel de control: lista de órdenes de venta recientes con filtros y botón «Facturar», y «Nueva venta / Nueva compra / Reponer» abren el formulario en el mismo panel.
- Cuentas por cobrar: columna **Vendedor**. Cotizaciones: barra con los 5 pasos del flujo.

## Menú lateral (igual que YCLOUD v11)
Inicio · Compras (Orden de compra, Ingreso al Kardex) · Ventas (Cotización, Orden de venta, Facturación, Estado de cuenta) · Inventarios (Movimiento de Kardex, Stock de productos) · Administración (Reportes, Mantenimientos y, solo para `admin`, Usuarios).
**Mantenimientos** agrupa en pestañas los catálogos de Clientes, Proveedores y Productos (`/mantenimientos/clientes|proveedores|productos`); las rutas antiguas `/clientes`, `/proveedores` y `/productos` redirigen allí.

## Base de datos
Los scripts están en `database/`: `01_esquema_erp.sql` (esquema completo, ejecutar una vez en un proyecto limpio) y `03_datos_iphone_alejandro.sql` (carga inicial opcional de iPhones y proveedores; edita los datos antes de ejecutar).
**Nunca subas el archivo `.env`** (ya está en `.gitignore`); usa `.env.example` como plantilla.
