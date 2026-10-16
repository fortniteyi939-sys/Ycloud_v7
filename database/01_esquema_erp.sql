-- =====================================================================
--  YCLOUD ERP · Esquema de base de datos para Supabase (PostgreSQL 15+)
-- =====================================================================
--  CÓMO USARLO
--   1. Crea un proyecto nuevo en Supabase.
--   2. Abre  SQL Editor > New query, pega TODO este archivo y pulsa Run.
--   3. (Opcional) Ejecuta después 02_datos_demo.sql para cargar datos de ejemplo.
--   4. Regístrate desde Authentication: el PRIMER usuario queda como
--      administrador; los siguientes entran con rol "consulta" (solo lectura)
--      y el admin les asigna rol en la tabla public.usuarios.
--   5. Recomendado: desactiva el registro público (Authentication > Providers
--      > Email > "Allow new users to sign up") cuando ya creaste tus usuarios.
--
--  Está pensado para ejecutarse UNA sola vez en un proyecto limpio.
--
--  QUÉ INCLUYE
--   · Catálogos: sucursales, almacenes, categorías, productos, clientes,
--     proveedores, cuentas financieras.
--   · Ventas: cotizaciones -> órdenes de venta -> comprobantes (facturación)
--     -> pagos (cobranzas / estado de cuenta).
--   · Compras: órdenes de compra -> recepción -> pagos a proveedor (CxP).
--   · Inventario: stock por almacén (inventarios) + Kardex
--     (movimientos_inventario), ajustes y transferencias.
--   · Seguridad: roles, permisos, RLS en todas las tablas, auditoría
--     inmutable, documentos con Supabase Storage.
--   · Lógica de negocio en funciones (RPC) para que sea atómica y segura:
--       crear_cotizacion / crear_orden_venta / crear_orden_compra
--       cotizacion_cambiar_estado / cotizacion_aceptar
--       recibir_orden_compra      (suma stock + kardex)
--       facturar_orden_venta      (emite comprobante, descuenta stock, cobra contado)
--       anular_orden / ajustar_stock / transferir_stock
--       dashboard_resumen / serie_ventas_compras
-- =====================================================================


-- =====================================================================
-- 0. BASE
-- =====================================================================
create schema if not exists interno;
comment on schema interno is 'Funciones internas del ERP. No se expone por la API.';

-- Fecha de negocio en hora de Lima (Supabase trabaja en UTC)
create or replace function public.hoy()
returns date language sql stable as $$
  select (now() at time zone 'America/Lima')::date
$$;


-- =====================================================================
-- 1. TIPOS (ENUM)
-- =====================================================================
create type public.segmento_cliente      as enum ('Distribuidor', 'Mayorista', 'Minorista');
create type public.forma_pago            as enum ('Contado', 'Crédito');
create type public.tipo_comprobante      as enum ('Factura', 'Boleta');
create type public.estado_cotizacion     as enum ('Borrador', 'Enviada', 'Rechazada', 'Procesada');
create type public.estado_orden_venta    as enum ('Pendiente', 'Facturada', 'Anulada');
create type public.estado_orden_compra   as enum ('Pendiente', 'Recibida', 'Anulada');
create type public.medio_pago            as enum ('Efectivo', 'Transferencia bancaria', 'Depósito en cuenta', 'Yape / Plin', 'Cheque');
create type public.tipo_pago             as enum ('Cobro', 'Pago');
create type public.tipo_movimiento       as enum ('Entrada', 'Salida');
create type public.motivo_movimiento     as enum ('Compra', 'Venta', 'Ajuste', 'Transferencia', 'Inventario inicial');
create type public.tipo_cuenta           as enum ('Caja', 'Banco');

create sequence public.seq_cliente;
create sequence public.seq_proveedor;
create sequence public.seq_producto;


-- =====================================================================
-- 2. SEGURIDAD Y ADMINISTRACIÓN
-- =====================================================================
create table public.roles (
  id          smallint generated always as identity primary key,
  codigo      text not null unique,
  nombre      text not null,
  descripcion text
);

create table public.permisos (
  id          smallint generated always as identity primary key,
  codigo      text not null unique,          -- modulo.accion
  modulo      text not null,
  descripcion text
);

create table public.roles_permisos (
  rol_id     smallint not null references public.roles (id)    on delete cascade,
  permiso_id smallint not null references public.permisos (id) on delete cascade,
  primary key (rol_id, permiso_id)
);

create table public.sucursales (
  id         bigint generated always as identity primary key,
  codigo     text not null unique,
  nombre     text not null,
  direccion  text,
  activo     boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.almacenes (
  id          bigint generated always as identity primary key,
  codigo      text not null unique,
  nombre      text not null,
  sucursal_id bigint references public.sucursales (id),
  direccion   text,
  activo      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- Perfil de la aplicación; el login lo gestiona Supabase Auth (auth.users)
create table public.usuarios (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text,
  nombres     text not null,
  telefono    text,
  rol_id      smallint not null references public.roles (id),
  sucursal_id bigint references public.sucursales (id),
  activo      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.configuracion (
  clave       text primary key,
  valor       jsonb not null,
  descripcion text,
  updated_at  timestamptz not null default now()
);

-- Correlativos de documentos (OC-2026-0001, F001-000001, ...)
create table public.series_documentos (
  tipo   text    not null,
  serie  text    not null default '',
  anio   integer not null default 0,         -- 0 = no reinicia por año
  ultimo bigint  not null default 0,
  primary key (tipo, serie, anio)
);

create table public.auditoria (
  id               bigint generated always as identity primary key,
  fecha            timestamptz not null default now(),
  usuario_id       uuid,                      -- sin FK: el historial se conserva
  usuario_email    text,
  accion           text not null,             -- INSERT / UPDATE / DELETE
  modulo           text,
  tabla            text not null,
  registro_id      text,
  datos_anteriores jsonb,
  datos_nuevos     jsonb,
  resultado        text not null default 'OK'
);


-- =====================================================================
-- 3. CATÁLOGOS
-- =====================================================================
create table public.categorias (
  id          bigint generated always as identity primary key,
  nombre      text not null unique,
  descripcion text,
  created_at  timestamptz not null default now()
);

create table public.productos (
  id           bigint generated always as identity primary key,
  codigo       text not null unique default ('PRD-' || lpad(nextval('public.seq_producto')::text, 3, '0')),
  nombre       text not null,
  categoria_id bigint references public.categorias (id),
  unidad       text not null default 'UND',
  costo        numeric(14,4) not null default 0 check (costo >= 0),
  precio_venta numeric(14,4) not null default 0 check (precio_venta >= 0),
  stock_minimo numeric(14,2) not null default 0 check (stock_minimo >= 0),
  descripcion  text,
  activo       boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table public.clientes (
  id            bigint generated always as identity primary key,
  codigo        text not null unique default ('CLI-' || lpad(nextval('public.seq_cliente')::text, 4, '0')),
  razon_social  text not null,
  ruc           text not null unique check (ruc ~ '^[0-9]{11}$'),
  segmento      public.segmento_cliente not null default 'Minorista',
  direccion     text,
  contacto      text,
  telefono      text,
  correo        text,
  dias_credito  integer not null check (dias_credito >= 0),      -- se completa según segmento
  linea_credito numeric(14,2) not null check (linea_credito >= 0), -- se completa según segmento
  activo        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table public.proveedores (
  id           bigint generated always as identity primary key,
  codigo       text not null unique default ('PRV-' || lpad(nextval('public.seq_proveedor')::text, 4, '0')),
  razon_social text not null,
  ruc          text not null unique check (ruc ~ '^[0-9]{11}$'),
  direccion    text,
  contacto     text,
  telefono     text,
  correo       text,
  dias_credito integer not null default 0 check (dias_credito >= 0),
  activo       boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table public.cuentas_financieras (
  id            bigint generated always as identity primary key,
  nombre        text not null unique,
  tipo          public.tipo_cuenta not null,
  banco         text,
  numero_cuenta text,
  moneda        char(3) not null default 'PEN',
  saldo_inicial numeric(14,2) not null default 0,
  activo        boolean not null default true,
  created_at    timestamptz not null default now()
);


-- =====================================================================
-- 4. INVENTARIO Y KARDEX
-- =====================================================================
create table public.inventarios (
  producto_id bigint not null references public.productos (id),
  almacen_id  bigint not null references public.almacenes (id),
  cantidad    numeric(14,2) not null default 0 check (cantidad >= 0),
  updated_at  timestamptz not null default now(),
  primary key (producto_id, almacen_id)
);

create table public.movimientos_inventario (        -- Kardex
  id               bigint generated always as identity primary key,
  fecha            timestamptz not null default now(),
  producto_id      bigint not null references public.productos (id),
  almacen_id       bigint not null references public.almacenes (id),
  tipo             public.tipo_movimiento not null,
  motivo           public.motivo_movimiento not null,
  cantidad         numeric(14,2) not null check (cantidad > 0),
  saldo_almacen    numeric(14,2) not null,
  saldo_total      numeric(14,2) not null,
  documento_tipo   text,
  documento_id     bigint,
  documento_numero text,
  tercero_tipo     text,
  tercero_id       bigint,
  tercero_nombre   text,
  observaciones    text,
  created_by       uuid default auth.uid() references public.usuarios (id) on delete set null
);


-- =====================================================================
-- 5. VENTAS
--    (Totales: subtotal = suma de líneas; descuento global; IGV 18 %.
--     base, igv y total son columnas generadas -> siempre consistentes.)
-- =====================================================================
create table public.cotizaciones (
  id             bigint generated always as identity primary key,
  numero         text not null unique,
  fecha          date not null default public.hoy(),
  cliente_id     bigint not null references public.clientes (id),
  sucursal_id    bigint references public.sucursales (id),
  vendedor_id    uuid default auth.uid() references public.usuarios (id) on delete set null,
  vigencia_dias  integer not null default 15 check (vigencia_dias > 0),
  moneda         char(3) not null default 'PEN',
  subtotal       numeric(14,2) not null default 0,
  descuento      numeric(14,2) not null default 0 check (descuento >= 0),
  base_imponible numeric(14,2) generated always as (case when subtotal > descuento then subtotal - descuento else 0 end) stored,
  igv            numeric(14,2) generated always as (round((case when subtotal > descuento then subtotal - descuento else 0 end) * 0.18, 2)) stored,
  total          numeric(14,2) generated always as (round((case when subtotal > descuento then subtotal - descuento else 0 end) * 1.18, 2)) stored,
  estado         public.estado_cotizacion not null default 'Borrador',
  observaciones  text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table public.cotizacion_detalle (
  id              bigint generated always as identity primary key,
  cotizacion_id   bigint not null references public.cotizaciones (id) on delete cascade,
  producto_id     bigint not null references public.productos (id),
  cantidad        numeric(14,2) not null check (cantidad > 0),
  precio_unitario numeric(14,4) not null check (precio_unitario > 0),
  subtotal        numeric(14,2) generated always as (round(cantidad * precio_unitario, 2)) stored
);

create table public.ordenes_venta (
  id               bigint generated always as identity primary key,
  numero           text not null unique,
  fecha            date not null default public.hoy(),
  cliente_id       bigint not null references public.clientes (id),
  sucursal_id      bigint references public.sucursales (id),
  almacen_id       bigint not null references public.almacenes (id),
  vendedor_id      uuid default auth.uid() references public.usuarios (id) on delete set null,
  cotizacion_id    bigint unique references public.cotizaciones (id),
  forma_pago       public.forma_pago not null default 'Contado',
  dias_credito     integer not null default 0,
  num_cuotas       integer not null default 0 check (num_cuotas >= 0),
  tipo_comprobante public.tipo_comprobante not null default 'Factura',
  moneda           char(3) not null default 'PEN',
  subtotal         numeric(14,2) not null default 0,
  descuento        numeric(14,2) not null default 0 check (descuento >= 0),
  base_imponible   numeric(14,2) generated always as (case when subtotal > descuento then subtotal - descuento else 0 end) stored,
  igv              numeric(14,2) generated always as (round((case when subtotal > descuento then subtotal - descuento else 0 end) * 0.18, 2)) stored,
  total            numeric(14,2) generated always as (round((case when subtotal > descuento then subtotal - descuento else 0 end) * 1.18, 2)) stored,
  estado           public.estado_orden_venta not null default 'Pendiente',
  observaciones    text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint ov_credito_chk check (
    (forma_pago = 'Contado' and dias_credito = 0) or (forma_pago = 'Crédito' and dias_credito > 0)
  )
);

create table public.orden_venta_detalle (
  id              bigint generated always as identity primary key,
  orden_venta_id  bigint not null references public.ordenes_venta (id) on delete cascade,
  producto_id     bigint not null references public.productos (id),
  cantidad        numeric(14,2) not null check (cantidad > 0),
  precio_unitario numeric(14,4) not null check (precio_unitario > 0),
  subtotal        numeric(14,2) generated always as (round(cantidad * precio_unitario, 2)) stored
);

-- Comprobantes de pago (facturación). Solo se crean con facturar_orden_venta()
create table public.comprobantes (
  id                bigint generated always as identity primary key,
  numero            text not null unique,                    -- F001-000146
  tipo              public.tipo_comprobante not null,
  serie             text not null,
  fecha             date not null default public.hoy(),
  fecha_vencimiento date not null,
  cliente_id        bigint not null references public.clientes (id),
  orden_venta_id    bigint not null unique references public.ordenes_venta (id),
  vendedor_id       uuid references public.usuarios (id) on delete set null,
  forma_pago        public.forma_pago not null,
  moneda            char(3) not null default 'PEN',
  subtotal          numeric(14,2) not null,
  descuento         numeric(14,2) not null default 0,
  base_imponible    numeric(14,2) generated always as (case when subtotal > descuento then subtotal - descuento else 0 end) stored,
  igv               numeric(14,2) generated always as (round((case when subtotal > descuento then subtotal - descuento else 0 end) * 0.18, 2)) stored,
  total             numeric(14,2) generated always as (round((case when subtotal > descuento then subtotal - descuento else 0 end) * 1.18, 2)) stored,
  monto_cobrado     numeric(14,2) not null default 0 check (monto_cobrado >= 0),
  saldo             numeric(14,2) generated always as (
                      case when round((case when subtotal > descuento then subtotal - descuento else 0 end) * 1.18, 2) > monto_cobrado
                           then round((case when subtotal > descuento then subtotal - descuento else 0 end) * 1.18, 2) - monto_cobrado
                           else 0 end) stored,
  estado_pago       text generated always as (
                      case when monto_cobrado >= round((case when subtotal > descuento then subtotal - descuento else 0 end) * 1.18, 2) - 0.005 then 'Pagado'
                           when monto_cobrado > 0 then 'Pago parcial'
                           else 'Pendiente' end) stored,
  created_at        timestamptz not null default now(),
  constraint comprobante_cobro_chk check (
    monto_cobrado <= round((case when subtotal > descuento then subtotal - descuento else 0 end) * 1.18, 2) + 0.005
  )
);

create table public.comprobante_detalle (
  id              bigint generated always as identity primary key,
  comprobante_id  bigint not null references public.comprobantes (id) on delete cascade,
  producto_id     bigint not null references public.productos (id),
  descripcion     text not null,
  cantidad        numeric(14,2) not null check (cantidad > 0),
  precio_unitario numeric(14,4) not null check (precio_unitario > 0),
  subtotal        numeric(14,2) generated always as (round(cantidad * precio_unitario, 2)) stored
);


-- =====================================================================
-- 6. COMPRAS
-- =====================================================================
create table public.ordenes_compra (
  id              bigint generated always as identity primary key,
  numero          text not null unique,
  fecha           date not null default public.hoy(),
  proveedor_id    bigint not null references public.proveedores (id),
  sucursal_id     bigint references public.sucursales (id),
  almacen_id      bigint not null references public.almacenes (id),
  forma_pago      public.forma_pago not null default 'Contado',
  dias_credito    integer not null default 0,
  moneda          char(3) not null default 'PEN',
  subtotal        numeric(14,2) not null default 0,
  descuento       numeric(14,2) not null default 0 check (descuento >= 0),
  base_imponible  numeric(14,2) generated always as (case when subtotal > descuento then subtotal - descuento else 0 end) stored,
  igv             numeric(14,2) generated always as (round((case when subtotal > descuento then subtotal - descuento else 0 end) * 0.18, 2)) stored,
  total           numeric(14,2) generated always as (round((case when subtotal > descuento then subtotal - descuento else 0 end) * 1.18, 2)) stored,
  monto_pagado    numeric(14,2) not null default 0 check (monto_pagado >= 0),
  saldo           numeric(14,2) generated always as (
                    case when round((case when subtotal > descuento then subtotal - descuento else 0 end) * 1.18, 2) > monto_pagado
                         then round((case when subtotal > descuento then subtotal - descuento else 0 end) * 1.18, 2) - monto_pagado
                         else 0 end) stored,
  estado          public.estado_orden_compra not null default 'Pendiente',
  fecha_recepcion timestamptz,
  observaciones   text,
  created_by      uuid default auth.uid() references public.usuarios (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint oc_credito_chk check (
    (forma_pago = 'Contado' and dias_credito = 0) or (forma_pago = 'Crédito' and dias_credito > 0)
  ),
  constraint oc_pago_chk check (
    monto_pagado = 0 or estado = 'Recibida'
  )
);

create table public.orden_compra_detalle (
  id              bigint generated always as identity primary key,
  orden_compra_id bigint not null references public.ordenes_compra (id) on delete cascade,
  producto_id     bigint not null references public.productos (id),
  cantidad        numeric(14,2) not null check (cantidad > 0),
  costo_unitario  numeric(14,4) not null check (costo_unitario > 0),
  subtotal        numeric(14,2) generated always as (round(cantidad * costo_unitario, 2)) stored
);


-- =====================================================================
-- 7. FINANZAS (cobros a clientes y pagos a proveedores)
-- =====================================================================
create table public.pagos (
  id               bigint generated always as identity primary key,
  tipo             public.tipo_pago not null,
  comprobante_id   bigint references public.comprobantes (id),
  orden_compra_id  bigint references public.ordenes_compra (id),
  fecha            date not null default public.hoy(),
  monto            numeric(14,2) not null check (monto > 0),
  medio_pago       public.medio_pago not null default 'Efectivo',
  numero_operacion text,
  cuenta_id        bigint references public.cuentas_financieras (id),
  observaciones    text,
  created_by       uuid default auth.uid() references public.usuarios (id) on delete set null,
  created_at       timestamptz not null default now(),
  constraint pago_destino_chk check (
    (tipo = 'Cobro' and comprobante_id is not null and orden_compra_id is null) or
    (tipo = 'Pago'  and orden_compra_id is not null and comprobante_id is null)
  ),
  constraint pago_operacion_chk check (
    medio_pago = 'Efectivo' or nullif(trim(numero_operacion), '') is not null
  )
);


-- =====================================================================
-- 8. DOCUMENTOS (metadatos; el archivo vive en Supabase Storage)
-- =====================================================================
create table public.documentos (
  id             bigint generated always as identity primary key,
  nombre         text not null,
  tipo_documento text not null default 'Otro'
                 check (tipo_documento in ('Factura','Contrato','Orden','Comprobante','Cotización','Otro')),
  entidad_tipo   text check (entidad_tipo in ('cliente','proveedor','producto','cotizacion','orden_venta','orden_compra','comprobante')),
  entidad_id     bigint,
  bucket         text not null default 'documentos',
  ruta_storage   text not null,
  mime_type      text,
  tamano_bytes   bigint check (tamano_bytes >= 0),
  descripcion    text,
  subido_por     uuid default auth.uid() references public.usuarios (id) on delete set null,
  created_at     timestamptz not null default now(),
  unique (bucket, ruta_storage),
  constraint documento_entidad_chk check ((entidad_tipo is null) = (entidad_id is null))
);


-- =====================================================================
-- 9. ÍNDICES
-- =====================================================================
create index on public.usuarios (rol_id);
create index on public.almacenes (sucursal_id);
create index on public.productos (categoria_id);
create index on public.productos (nombre);
create index on public.clientes (razon_social);
create index on public.proveedores (razon_social);
create index on public.inventarios (almacen_id);
create index on public.movimientos_inventario (producto_id, fecha desc);
create index on public.movimientos_inventario (fecha desc);
create index on public.movimientos_inventario (documento_tipo, documento_id);
create index on public.cotizaciones (cliente_id, fecha desc);
create index on public.cotizaciones (estado);
create index on public.cotizacion_detalle (cotizacion_id);
create index on public.cotizacion_detalle (producto_id);
create index on public.ordenes_venta (cliente_id, fecha desc);
create index on public.ordenes_venta (estado);
create index on public.ordenes_venta (fecha desc);
create index on public.orden_venta_detalle (orden_venta_id);
create index on public.orden_venta_detalle (producto_id);
create index on public.comprobantes (cliente_id, fecha desc);
create index on public.comprobantes (fecha desc);
create index on public.comprobantes (saldo) where saldo > 0;
create index on public.comprobante_detalle (comprobante_id);
create index on public.ordenes_compra (proveedor_id, fecha desc);
create index on public.ordenes_compra (estado);
create index on public.orden_compra_detalle (orden_compra_id);
create index on public.orden_compra_detalle (producto_id);
create index on public.pagos (comprobante_id);
create index on public.pagos (orden_compra_id);
create index on public.pagos (fecha desc);
create index on public.documentos (entidad_tipo, entidad_id);
create index on public.auditoria (fecha desc);
create index on public.auditoria (tabla, registro_id);


-- =====================================================================
-- 10. FUNCIONES DE SOPORTE
-- =====================================================================

-- ¿El usuario autenticado tiene este permiso? (admin tiene todos)
create or replace function public.tiene_permiso(p_codigo text)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.usuarios u
    join public.roles r on r.id = u.rol_id
    left join public.roles_permisos rp on rp.rol_id = r.id
    left join public.permisos p on p.id = rp.permiso_id
    where u.id = auth.uid()
      and u.activo
      and (r.codigo = 'admin' or p.codigo = p_codigo)
  );
$$;

-- Para las funciones RPC: usuario con permiso, service_role o consola SQL
create or replace function interno.exigir_permiso(p_codigo text)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is not null then
    if not public.tiene_permiso(p_codigo) then
      raise exception 'No tienes permiso para esta operación (%)', p_codigo using errcode = '42501';
    end if;
  elsif coalesce(auth.jwt() ->> 'role', '') <> 'service_role'
        and session_user not in ('postgres', 'supabase_admin') then
    raise exception 'Debes iniciar sesión' using errcode = '28000';
  end if;
end;
$$;

create or replace function interno.fn_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Correlativo atómico por tipo/serie/año
create or replace function interno.siguiente_correlativo(p_tipo text, p_serie text default '', p_anio integer default 0)
returns bigint
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_n bigint;
begin
  insert into public.series_documentos (tipo, serie, anio, ultimo)
  values (p_tipo, p_serie, p_anio, 1)
  on conflict (tipo, serie, anio)
  do update set ultimo = public.series_documentos.ultimo + 1
  returning ultimo into v_n;
  return v_n;
end;
$$;

-- Número de documento: PREFIJO-AAAA-0001  (argumento del trigger = prefijo)
create or replace function interno.fn_asignar_numero()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_anio integer := extract(year from coalesce(new.fecha, public.hoy()))::integer;
begin
  if new.numero is null then
    new.numero := tg_argv[0] || '-' || v_anio::text || '-' ||
                  lpad(interno.siguiente_correlativo(tg_argv[0], '', v_anio)::text, 4, '0');
  end if;
  return new;
end;
$$;

-- Línea de crédito y plazo por defecto según segmento
create or replace function interno.fn_cliente_defaults()
returns trigger language plpgsql as $$
begin
  if new.dias_credito is null then
    new.dias_credito := case new.segmento when 'Distribuidor' then 60 when 'Mayorista' then 30 else 0 end;
  end if;
  if new.linea_credito is null then
    new.linea_credito := case new.segmento when 'Distribuidor' then 60000 when 'Mayorista' then 30000 else 10000 end;
  end if;
  return new;
end;
$$;

-- Evita que un usuario cambie estados "a mano": solo las funciones del sistema
-- (que activan erp.rpc) pueden hacerlo. La consola SQL / service_role no se restringe.
create or replace function interno.fn_proteger_estado()
returns trigger language plpgsql as $$
begin
  if coalesce(current_setting('erp.rpc', true), '') <> 'on' and auth.uid() is not null then
    if tg_op = 'INSERT' then
      if new.estado::text <> tg_argv[0] then
        raise exception 'Un documento nuevo debe crearse en estado %', tg_argv[0] using errcode = '42501';
      end if;
    else
      if old.estado::text <> tg_argv[0] then
        raise exception 'El documento está % y ya no admite cambios', old.estado using errcode = '42501';
      end if;
      if new.estado is distinct from old.estado then
        raise exception 'El estado solo puede cambiarse con las funciones del sistema' using errcode = '42501';
      end if;
    end if;
  end if;
  return new;
end;
$$;

-- El detalle solo se edita mientras el documento está en Borrador / Pendiente
create or replace function interno.fn_detalle_editable()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_fila   jsonb;
  v_estado text;
begin
  if coalesce(current_setting('erp.rpc', true), '') = 'on' or auth.uid() is null then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;

  if tg_op = 'DELETE' then v_fila := to_jsonb(old); else v_fila := to_jsonb(new); end if;

  execute format('select estado::text from public.%I where id = $1', tg_argv[0])
    into v_estado
    using (v_fila ->> tg_argv[1])::bigint;

  if v_estado is not null and v_estado not in ('Borrador', 'Pendiente') then
    raise exception 'El documento está % y ya no admite cambios en su detalle', v_estado using errcode = '42501';
  end if;

  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;

-- Recalcula el subtotal de la cabecera al cambiar el detalle
create or replace function interno.fn_totales_documento()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_fila jsonb;
  v_id   bigint;
begin
  if tg_op = 'DELETE' then v_fila := to_jsonb(old); else v_fila := to_jsonb(new); end if;
  v_id := (v_fila ->> tg_argv[1])::bigint;

  execute format(
    'update public.%I set subtotal = coalesce((select sum(d.subtotal) from public.%I d where d.%I = $1), 0) where id = $1',
    tg_argv[0], tg_table_name, tg_argv[1])
  using v_id;

  return null;
end;
$$;

-- Movimiento de inventario + Kardex (única vía para tocar el stock)
create or replace function interno.mover_inventario(
  p_producto       bigint,
  p_almacen        bigint,
  p_tipo           public.tipo_movimiento,
  p_motivo         public.motivo_movimiento,
  p_cantidad       numeric,
  p_doc_tipo       text default null,
  p_doc_id         bigint default null,
  p_doc_numero     text default null,
  p_tercero_tipo   text default null,
  p_tercero_id     bigint default null,
  p_tercero_nombre text default null,
  p_obs            text default null
)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_actual     numeric;
  v_saldo_alm  numeric;
  v_total      numeric;
  v_desc       text;
begin
  if p_cantidad is null or p_cantidad <= 0 then
    raise exception 'La cantidad debe ser mayor a cero';
  end if;

  insert into public.inventarios (producto_id, almacen_id, cantidad)
  values (p_producto, p_almacen, 0)
  on conflict (producto_id, almacen_id) do nothing;

  select cantidad into v_actual
  from public.inventarios
  where producto_id = p_producto and almacen_id = p_almacen
  for update;

  if p_tipo = 'Salida' then
    if v_actual < p_cantidad then
      select p.nombre || ' en ' || a.nombre into v_desc
      from public.productos p, public.almacenes a
      where p.id = p_producto and a.id = p_almacen;
      raise exception 'Stock insuficiente de % (disponible: %, requerido: %)', v_desc, v_actual, p_cantidad
        using errcode = '23514';
    end if;
    v_saldo_alm := v_actual - p_cantidad;
  else
    v_saldo_alm := v_actual + p_cantidad;
  end if;

  update public.inventarios
     set cantidad = v_saldo_alm, updated_at = now()
   where producto_id = p_producto and almacen_id = p_almacen;

  select coalesce(sum(cantidad), 0) into v_total
  from public.inventarios where producto_id = p_producto;

  insert into public.movimientos_inventario
    (producto_id, almacen_id, tipo, motivo, cantidad, saldo_almacen, saldo_total,
     documento_tipo, documento_id, documento_numero,
     tercero_tipo, tercero_id, tercero_nombre, observaciones)
  values
    (p_producto, p_almacen, p_tipo, p_motivo, p_cantidad, v_saldo_alm, v_total,
     p_doc_tipo, p_doc_id, p_doc_numero,
     p_tercero_tipo, p_tercero_id, p_tercero_nombre, p_obs);
end;
$$;

create or replace function interno.validar_lineas(p_lineas jsonb)
returns void language plpgsql immutable as $$
begin
  if p_lineas is null or jsonb_typeof(p_lineas) <> 'array' or jsonb_array_length(p_lineas) = 0 then
    raise exception 'Agrega al menos un producto';
  end if;
end;
$$;

-- Cobros / pagos: valida contra el saldo y actualiza el documento
create or replace function interno.fn_pago_antes_insert()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_saldo  numeric;
  v_estado text;
  v_prev   text := coalesce(current_setting('erp.rpc', true), '');
begin
  if new.tipo = 'Cobro' then
    select saldo into v_saldo from public.comprobantes where id = new.comprobante_id for update;
    if not found then raise exception 'El comprobante no existe'; end if;
    if new.monto > v_saldo + 0.005 then
      raise exception 'El importe (%) supera el saldo pendiente (%)', new.monto, v_saldo using errcode = '23514';
    end if;
    update public.comprobantes set monto_cobrado = monto_cobrado + new.monto where id = new.comprobante_id;
  else
    select estado::text, saldo into v_estado, v_saldo
    from public.ordenes_compra where id = new.orden_compra_id for update;
    if not found then raise exception 'La orden de compra no existe'; end if;
    if v_estado <> 'Recibida' then
      raise exception 'Solo se pueden pagar órdenes de compra recibidas';
    end if;
    if new.monto > v_saldo + 0.005 then
      raise exception 'El importe (%) supera el saldo pendiente (%)', new.monto, v_saldo using errcode = '23514';
    end if;
    perform set_config('erp.rpc', 'on', true);
    update public.ordenes_compra set monto_pagado = monto_pagado + new.monto where id = new.orden_compra_id;
    perform set_config('erp.rpc', v_prev, true);
  end if;
  return new;
end;
$$;

create or replace function interno.fn_pago_despues_delete()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_prev text := coalesce(current_setting('erp.rpc', true), '');
begin
  if old.tipo = 'Cobro' then
    update public.comprobantes
       set monto_cobrado = greatest(monto_cobrado - old.monto, 0)
     where id = old.comprobante_id;
  else
    perform set_config('erp.rpc', 'on', true);
    update public.ordenes_compra
       set monto_pagado = greatest(monto_pagado - old.monto, 0)
     where id = old.orden_compra_id;
    perform set_config('erp.rpc', v_prev, true);
  end if;
  return old;
end;
$$;

-- Auditoría genérica (argumento del trigger = nombre del módulo)
create or replace function interno.fn_auditar()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_old jsonb;
  v_new jsonb;
  v_ref jsonb;
begin
  if tg_op = 'INSERT' then
    v_new := to_jsonb(new); v_ref := v_new;
  elsif tg_op = 'UPDATE' then
    v_old := to_jsonb(old); v_new := to_jsonb(new); v_ref := v_new;
    if v_old = v_new then return null; end if;
  else
    v_old := to_jsonb(old); v_ref := v_old;
  end if;

  insert into public.auditoria
    (usuario_id, usuario_email, accion, modulo, tabla, registro_id, datos_anteriores, datos_nuevos)
  values
    (auth.uid(),
     (select u.email from public.usuarios u where u.id = auth.uid()),
     tg_op, tg_argv[0], tg_table_name,
     coalesce(v_ref ->> 'id', concat_ws(':', v_ref ->> 'rol_id', v_ref ->> 'permiso_id')),
     v_old, v_new);
  return null;
end;
$$;

create or replace function interno.fn_auditoria_inmutable()
returns trigger language plpgsql as $$
begin
  raise exception 'El registro de auditoría es de solo lectura';
end;
$$;

-- Alta automática del perfil cuando se crea un usuario en Supabase Auth
create or replace function interno.fn_nuevo_usuario()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_rol smallint;
begin
  select id into v_rol
  from public.roles
  where codigo = case when exists (select 1 from public.usuarios) then 'consulta' else 'admin' end;

  insert into public.usuarios (id, email, nombres, rol_id)
  values (
    new.id,
    new.email,
    coalesce(nullif(new.raw_user_meta_data ->> 'nombres', ''),
             nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
             'Usuario'),
    v_rol)
  on conflict (id) do nothing;
  return new;
end;
$$;


-- =====================================================================
-- 11. TRIGGERS
-- =====================================================================
-- updated_at
do $$
declare t text;
begin
  foreach t in array array['usuarios','productos','clientes','proveedores','cotizaciones','ordenes_compra','ordenes_venta'] loop
    execute format('create trigger trg_%1$s_updated_at before update on public.%1$I for each row execute function interno.fn_set_updated_at()', t);
  end loop;
end $$;

-- Valores por defecto de cliente
create trigger trg_clientes_defaults before insert on public.clientes
  for each row execute function interno.fn_cliente_defaults();

-- Numeración automática
create trigger trg_cotizaciones_numero  before insert on public.cotizaciones
  for each row execute function interno.fn_asignar_numero('COT');
create trigger trg_ordenes_venta_numero before insert on public.ordenes_venta
  for each row execute function interno.fn_asignar_numero('OV');
create trigger trg_ordenes_compra_numero before insert on public.ordenes_compra
  for each row execute function interno.fn_asignar_numero('OC');

-- Protección de estados
create trigger trg_cotizaciones_estado  before insert or update on public.cotizaciones
  for each row execute function interno.fn_proteger_estado('Borrador');
create trigger trg_ordenes_venta_estado before insert or update on public.ordenes_venta
  for each row execute function interno.fn_proteger_estado('Pendiente');
create trigger trg_ordenes_compra_estado before insert or update on public.ordenes_compra
  for each row execute function interno.fn_proteger_estado('Pendiente');

-- Detalle: editable solo en borrador/pendiente + recálculo de totales
create trigger trg_cotdet_editable before insert or update or delete on public.cotizacion_detalle
  for each row execute function interno.fn_detalle_editable('cotizaciones', 'cotizacion_id');
create trigger trg_cotdet_totales  after insert or update or delete on public.cotizacion_detalle
  for each row execute function interno.fn_totales_documento('cotizaciones', 'cotizacion_id');

create trigger trg_ovdet_editable before insert or update or delete on public.orden_venta_detalle
  for each row execute function interno.fn_detalle_editable('ordenes_venta', 'orden_venta_id');
create trigger trg_ovdet_totales  after insert or update or delete on public.orden_venta_detalle
  for each row execute function interno.fn_totales_documento('ordenes_venta', 'orden_venta_id');

create trigger trg_ocdet_editable before insert or update or delete on public.orden_compra_detalle
  for each row execute function interno.fn_detalle_editable('ordenes_compra', 'orden_compra_id');
create trigger trg_ocdet_totales  after insert or update or delete on public.orden_compra_detalle
  for each row execute function interno.fn_totales_documento('ordenes_compra', 'orden_compra_id');

-- Pagos
create trigger trg_pagos_antes_insert before insert on public.pagos
  for each row execute function interno.fn_pago_antes_insert();
create trigger trg_pagos_despues_delete after delete on public.pagos
  for each row execute function interno.fn_pago_despues_delete();

-- Auditoría: catálogos y administración (todas las operaciones)
do $$
declare r record;
begin
  for r in
    select * from (values
      ('categorias',          'Catálogos'),
      ('clientes',            'Comercial'),
      ('proveedores',         'Compras'),
      ('productos',           'Inventario'),
      ('almacenes',           'Inventario'),
      ('sucursales',          'Administración'),
      ('cuentas_financieras', 'Finanzas'),
      ('usuarios',            'Administración'),
      ('roles',               'Administración'),
      ('roles_permisos',      'Administración'),
      ('documentos',          'Documentos'),
      ('configuracion',       'Administración')
    ) as x(tabla, modulo)
  loop
    execute format('create trigger trg_aud_%1$s after insert or update or delete on public.%1$I for each row execute function interno.fn_auditar(%2$L)', r.tabla, r.modulo);
  end loop;

  -- Documentos de negocio: alta, baja y cambios de estado
  for r in
    select * from (values
      ('cotizaciones',  'Comercial'),
      ('ordenes_venta', 'Comercial'),
      ('ordenes_compra','Compras')
    ) as x(tabla, modulo)
  loop
    execute format('create trigger trg_aud_%1$s_ins_del after insert or delete on public.%1$I for each row execute function interno.fn_auditar(%2$L)', r.tabla, r.modulo);
    execute format('create trigger trg_aud_%1$s_estado after update of estado on public.%1$I for each row execute function interno.fn_auditar(%2$L)', r.tabla, r.modulo);
  end loop;
end $$;

create trigger trg_aud_comprobantes after insert or delete on public.comprobantes
  for each row execute function interno.fn_auditar('Comercial');
create trigger trg_aud_pagos after insert or delete on public.pagos
  for each row execute function interno.fn_auditar('Finanzas');

-- La auditoría no se modifica ni se borra
create trigger trg_auditoria_inmutable before update or delete on public.auditoria
  for each row execute function interno.fn_auditoria_inmutable();


-- =====================================================================
-- 12. FUNCIONES DE NEGOCIO (RPC)
--     Se llaman desde la app con supabase.rpc('nombre', {...})
-- =====================================================================

-- Saldo que el cliente debe actualmente
create or replace function public.saldo_pendiente_cliente(p_cliente bigint)
returns numeric language sql stable as $$
  select coalesce(sum(saldo), 0) from public.comprobantes where cliente_id = p_cliente
$$;

-- ---------------------------------------------------------------------
-- crear_cotizacion
--   p_cab    = {"cliente_id":1,"sucursal_id":1,"fecha":"2026-10-15","vigencia_dias":15,
--               "descuento":0,"observaciones":"..."}
--   p_lineas = [{"producto_id":1,"cantidad":10,"precio_unitario":9.00}, ...]
-- ---------------------------------------------------------------------
create or replace function public.crear_cotizacion(p_cab jsonb, p_lineas jsonb)
returns public.cotizaciones
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_cot  public.cotizaciones;
  v_cli  public.clientes;
  v_sub  numeric;
  v_desc numeric := coalesce((p_cab ->> 'descuento')::numeric, 0);
begin
  perform interno.exigir_permiso('ventas.crear');
  perform interno.validar_lineas(p_lineas);

  select * into v_cli from public.clientes where id = (p_cab ->> 'cliente_id')::bigint;
  if not found then raise exception 'Selecciona un cliente'; end if;
  if not v_cli.activo then raise exception 'El cliente % está inactivo', v_cli.razon_social; end if;

  select coalesce(sum(round(l.cantidad * l.precio_unitario, 2)), 0) into v_sub
  from jsonb_to_recordset(p_lineas) as l(producto_id bigint, cantidad numeric, precio_unitario numeric);

  if v_desc < 0 or v_desc >= v_sub then
    raise exception 'El descuento debe ser menor al subtotal';
  end if;

  insert into public.cotizaciones (fecha, cliente_id, sucursal_id, vendedor_id, vigencia_dias, descuento, observaciones)
  values (
    coalesce((p_cab ->> 'fecha')::date, public.hoy()),
    v_cli.id,
    nullif(p_cab ->> 'sucursal_id', '')::bigint,
    auth.uid(),
    coalesce((p_cab ->> 'vigencia_dias')::integer, 15),
    v_desc,
    nullif(trim(p_cab ->> 'observaciones'), '')
  )
  returning * into v_cot;

  insert into public.cotizacion_detalle (cotizacion_id, producto_id, cantidad, precio_unitario)
  select v_cot.id, l.producto_id, l.cantidad, l.precio_unitario
  from jsonb_to_recordset(p_lineas) as l(producto_id bigint, cantidad numeric, precio_unitario numeric);

  select * into v_cot from public.cotizaciones where id = v_cot.id;
  return v_cot;
end;
$$;

-- ---------------------------------------------------------------------
-- crear_orden_venta  (valida la línea de crédito, igual que la app)
--   p_cab = {"cliente_id":1,"almacen_id":1,"sucursal_id":1,"forma_pago":"Crédito",
--            "dias_credito":30,"num_cuotas":0,"tipo_comprobante":"Factura",
--            "descuento":0,"observaciones":"..."}
-- ---------------------------------------------------------------------
create or replace function public.crear_orden_venta(p_cab jsonb, p_lineas jsonb)
returns public.ordenes_venta
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_ov    public.ordenes_venta;
  v_cli   public.clientes;
  v_sub   numeric;
  v_desc  numeric := coalesce((p_cab ->> 'descuento')::numeric, 0);
  v_forma public.forma_pago := coalesce(nullif(p_cab ->> 'forma_pago', ''), 'Contado')::public.forma_pago;
  v_dias  integer;
  v_total numeric;
  v_disp  numeric;
begin
  perform interno.exigir_permiso('ventas.crear');
  perform interno.validar_lineas(p_lineas);

  select * into v_cli from public.clientes where id = (p_cab ->> 'cliente_id')::bigint;
  if not found then raise exception 'Selecciona un cliente'; end if;
  if not v_cli.activo then raise exception 'El cliente % está inactivo', v_cli.razon_social; end if;

  select coalesce(sum(round(l.cantidad * l.precio_unitario, 2)), 0) into v_sub
  from jsonb_to_recordset(p_lineas) as l(producto_id bigint, cantidad numeric, precio_unitario numeric);

  if v_desc < 0 or v_desc >= v_sub then
    raise exception 'El descuento debe ser menor al subtotal';
  end if;

  v_dias := case
    when v_forma = 'Contado' then 0
    else coalesce(nullif((p_cab ->> 'dias_credito')::integer, 0), nullif(v_cli.dias_credito, 0), 30)
  end;

  if v_forma = 'Crédito' then
    v_total := round((v_sub - v_desc) * 1.18, 2);
    v_disp  := v_cli.linea_credito - public.saldo_pendiente_cliente(v_cli.id);
    if v_total > v_disp then
      raise exception 'Supera la línea de crédito disponible (S/ %)', round(greatest(v_disp, 0), 2)
        using errcode = '23514';
    end if;
  end if;

  insert into public.ordenes_venta
    (fecha, cliente_id, sucursal_id, almacen_id, vendedor_id, forma_pago, dias_credito,
     num_cuotas, tipo_comprobante, descuento, observaciones)
  values (
    coalesce((p_cab ->> 'fecha')::date, public.hoy()),
    v_cli.id,
    nullif(p_cab ->> 'sucursal_id', '')::bigint,
    (p_cab ->> 'almacen_id')::bigint,
    auth.uid(),
    v_forma,
    v_dias,
    coalesce((p_cab ->> 'num_cuotas')::integer, 0),
    coalesce(nullif(p_cab ->> 'tipo_comprobante', ''), 'Factura')::public.tipo_comprobante,
    v_desc,
    nullif(trim(p_cab ->> 'observaciones'), '')
  )
  returning * into v_ov;

  insert into public.orden_venta_detalle (orden_venta_id, producto_id, cantidad, precio_unitario)
  select v_ov.id, l.producto_id, l.cantidad, l.precio_unitario
  from jsonb_to_recordset(p_lineas) as l(producto_id bigint, cantidad numeric, precio_unitario numeric);

  select * into v_ov from public.ordenes_venta where id = v_ov.id;
  return v_ov;
end;
$$;

-- ---------------------------------------------------------------------
-- crear_orden_compra
--   p_cab    = {"proveedor_id":1,"almacen_id":1,"sucursal_id":1,"forma_pago":"Crédito",
--               "dias_credito":30,"descuento":0,"observaciones":"..."}
--   p_lineas = [{"producto_id":1,"cantidad":60,"costo_unitario":6.00}, ...]
-- ---------------------------------------------------------------------
create or replace function public.crear_orden_compra(p_cab jsonb, p_lineas jsonb)
returns public.ordenes_compra
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_oc    public.ordenes_compra;
  v_prov  public.proveedores;
  v_sub   numeric;
  v_desc  numeric := coalesce((p_cab ->> 'descuento')::numeric, 0);
  v_forma public.forma_pago := coalesce(nullif(p_cab ->> 'forma_pago', ''), 'Contado')::public.forma_pago;
  v_dias  integer;
begin
  perform interno.exigir_permiso('compras.crear');
  perform interno.validar_lineas(p_lineas);

  select * into v_prov from public.proveedores where id = (p_cab ->> 'proveedor_id')::bigint;
  if not found then raise exception 'Selecciona un proveedor'; end if;
  if not v_prov.activo then raise exception 'El proveedor % está inactivo', v_prov.razon_social; end if;

  select coalesce(sum(round(l.cantidad * l.costo_unitario, 2)), 0) into v_sub
  from jsonb_to_recordset(p_lineas) as l(producto_id bigint, cantidad numeric, costo_unitario numeric);

  if v_desc < 0 or v_desc >= v_sub then
    raise exception 'El descuento debe ser menor al subtotal';
  end if;

  v_dias := case
    when v_forma = 'Contado' then 0
    else coalesce(nullif((p_cab ->> 'dias_credito')::integer, 0), nullif(v_prov.dias_credito, 0), 30)
  end;

  insert into public.ordenes_compra
    (fecha, proveedor_id, sucursal_id, almacen_id, forma_pago, dias_credito, descuento, observaciones, created_by)
  values (
    coalesce((p_cab ->> 'fecha')::date, public.hoy()),
    v_prov.id,
    nullif(p_cab ->> 'sucursal_id', '')::bigint,
    (p_cab ->> 'almacen_id')::bigint,
    v_forma,
    v_dias,
    v_desc,
    nullif(trim(p_cab ->> 'observaciones'), ''),
    auth.uid()
  )
  returning * into v_oc;

  insert into public.orden_compra_detalle (orden_compra_id, producto_id, cantidad, costo_unitario)
  select v_oc.id, l.producto_id, l.cantidad, l.costo_unitario
  from jsonb_to_recordset(p_lineas) as l(producto_id bigint, cantidad numeric, costo_unitario numeric);

  select * into v_oc from public.ordenes_compra where id = v_oc.id;
  return v_oc;
end;
$$;

-- ---------------------------------------------------------------------
-- Cotización: Borrador -> Enviada -> Rechazada
-- ---------------------------------------------------------------------
create or replace function public.cotizacion_cambiar_estado(p_id bigint, p_estado public.estado_cotizacion)
returns public.cotizaciones
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_cot public.cotizaciones;
begin
  perform interno.exigir_permiso('ventas.crear');

  select * into v_cot from public.cotizaciones where id = p_id for update;
  if not found then raise exception 'La cotización no existe'; end if;

  if not ((v_cot.estado = 'Borrador' and p_estado = 'Enviada')
       or (v_cot.estado = 'Enviada'  and p_estado = 'Rechazada')) then
    raise exception 'Cambio de estado no permitido: % -> %', v_cot.estado, p_estado;
  end if;

  perform set_config('erp.rpc', 'on', true);
  update public.cotizaciones set estado = p_estado where id = p_id returning * into v_cot;
  perform set_config('erp.rpc', 'off', true);
  return v_cot;
end;
$$;

-- ---------------------------------------------------------------------
-- Cotización aceptada por el cliente -> crea la orden de venta (a crédito)
-- ---------------------------------------------------------------------
create or replace function public.cotizacion_aceptar(p_id bigint, p_almacen_id bigint default null)
returns public.ordenes_venta
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_cot public.cotizaciones;
  v_cli public.clientes;
  v_ov  public.ordenes_venta;
  v_alm bigint;
begin
  perform interno.exigir_permiso('ventas.crear');

  select * into v_cot from public.cotizaciones where id = p_id for update;
  if not found then raise exception 'La cotización no existe'; end if;
  if v_cot.estado <> 'Enviada' then
    raise exception 'Solo se puede aceptar una cotización en estado Enviada (actual: %)', v_cot.estado;
  end if;

  select * into v_cli from public.clientes where id = v_cot.cliente_id;

  v_alm := coalesce(p_almacen_id, (select id from public.almacenes where activo order by codigo limit 1));
  if v_alm is null then raise exception 'No hay almacenes activos'; end if;

  insert into public.ordenes_venta
    (fecha, cliente_id, sucursal_id, almacen_id, vendedor_id, cotizacion_id,
     forma_pago, dias_credito, descuento, observaciones)
  values
    (public.hoy(), v_cot.cliente_id, v_cot.sucursal_id, v_alm, coalesce(v_cot.vendedor_id, auth.uid()), v_cot.id,
     'Crédito', coalesce(nullif(v_cli.dias_credito, 0), 30), v_cot.descuento, v_cot.observaciones)
  returning * into v_ov;

  insert into public.orden_venta_detalle (orden_venta_id, producto_id, cantidad, precio_unitario)
  select v_ov.id, d.producto_id, d.cantidad, d.precio_unitario
  from public.cotizacion_detalle d
  where d.cotizacion_id = v_cot.id
  order by d.id;

  perform set_config('erp.rpc', 'on', true);
  update public.cotizaciones set estado = 'Procesada' where id = v_cot.id;
  perform set_config('erp.rpc', 'off', true);

  select * into v_ov from public.ordenes_venta where id = v_ov.id;
  return v_ov;
end;
$$;

-- ---------------------------------------------------------------------
-- Recepción de compra: suma stock al almacén y registra el Kardex
-- ---------------------------------------------------------------------
create or replace function public.recibir_orden_compra(p_id bigint)
returns public.ordenes_compra
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_oc   public.ordenes_compra;
  v_prov text;
  r      record;
begin
  perform interno.exigir_permiso('compras.recibir');

  select * into v_oc from public.ordenes_compra where id = p_id for update;
  if not found then raise exception 'La orden de compra no existe'; end if;
  if v_oc.estado <> 'Pendiente' then
    raise exception 'La orden % ya está %', v_oc.numero, v_oc.estado;
  end if;

  select razon_social into v_prov from public.proveedores where id = v_oc.proveedor_id;

  for r in
    select producto_id, cantidad from public.orden_compra_detalle where orden_compra_id = v_oc.id order by id
  loop
    perform interno.mover_inventario(
      r.producto_id, v_oc.almacen_id, 'Entrada', 'Compra', r.cantidad,
      'orden_compra', v_oc.id, v_oc.numero, 'proveedor', v_oc.proveedor_id, v_prov);
  end loop;

  perform set_config('erp.rpc', 'on', true);
  update public.ordenes_compra
     set estado = 'Recibida', fecha_recepcion = now()
   where id = v_oc.id
   returning * into v_oc;
  perform set_config('erp.rpc', 'off', true);

  return v_oc;
end;
$$;

-- ---------------------------------------------------------------------
-- Facturación: emite el comprobante, descuenta stock (Kardex) y, si la
-- venta es al contado, registra el cobro completo.
-- ---------------------------------------------------------------------
create or replace function public.facturar_orden_venta(
  p_id               bigint,
  p_medio_pago       public.medio_pago default 'Efectivo',
  p_numero_operacion text default null,
  p_cuenta_id        bigint default null
)
returns public.comprobantes
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_ov    public.ordenes_venta;
  v_cli   public.clientes;
  v_comp  public.comprobantes;
  v_serie text;
  v_num   text;
  r       record;
begin
  perform interno.exigir_permiso('ventas.facturar');

  select * into v_ov from public.ordenes_venta where id = p_id for update;
  if not found then raise exception 'La orden de venta no existe'; end if;
  if v_ov.estado <> 'Pendiente' then
    raise exception 'La orden % ya está %', v_ov.numero, v_ov.estado;
  end if;
  if not exists (select 1 from public.orden_venta_detalle where orden_venta_id = v_ov.id) then
    raise exception 'La orden no tiene productos';
  end if;

  select * into v_cli from public.clientes where id = v_ov.cliente_id;

  v_serie := case when v_ov.tipo_comprobante = 'Boleta' then 'B001' else 'F001' end;
  v_num   := v_serie || '-' || lpad(interno.siguiente_correlativo('COMPROBANTE', v_serie, 0)::text, 6, '0');

  insert into public.comprobantes
    (numero, tipo, serie, fecha, fecha_vencimiento, cliente_id, orden_venta_id, vendedor_id,
     forma_pago, moneda, subtotal, descuento)
  values
    (v_num, v_ov.tipo_comprobante, v_serie, public.hoy(), public.hoy() + v_ov.dias_credito,
     v_ov.cliente_id, v_ov.id, v_ov.vendedor_id, v_ov.forma_pago, v_ov.moneda, v_ov.subtotal, v_ov.descuento)
  returning * into v_comp;

  insert into public.comprobante_detalle (comprobante_id, producto_id, descripcion, cantidad, precio_unitario)
  select v_comp.id, d.producto_id, p.nombre, d.cantidad, d.precio_unitario
  from public.orden_venta_detalle d
  join public.productos p on p.id = d.producto_id
  where d.orden_venta_id = v_ov.id
  order by d.id;

  for r in
    select producto_id, cantidad from public.orden_venta_detalle where orden_venta_id = v_ov.id order by id
  loop
    perform interno.mover_inventario(
      r.producto_id, v_ov.almacen_id, 'Salida', 'Venta', r.cantidad,
      'comprobante', v_comp.id, v_comp.numero, 'cliente', v_cli.id, v_cli.razon_social);
  end loop;

  if v_ov.forma_pago = 'Contado' then
    insert into public.pagos (tipo, comprobante_id, fecha, monto, medio_pago, numero_operacion, cuenta_id)
    values ('Cobro', v_comp.id, public.hoy(), v_comp.total, p_medio_pago, p_numero_operacion, p_cuenta_id);
  end if;

  perform set_config('erp.rpc', 'on', true);
  update public.ordenes_venta set estado = 'Facturada' where id = v_ov.id;
  perform set_config('erp.rpc', 'off', true);

  select * into v_comp from public.comprobantes where id = v_comp.id;
  return v_comp;
end;
$$;

-- ---------------------------------------------------------------------
-- Anular una orden pendiente   p_tipo = 'compra' | 'venta'
-- ---------------------------------------------------------------------
create or replace function public.anular_orden(p_tipo text, p_id bigint)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if p_tipo = 'compra' then
    perform interno.exigir_permiso('compras.anular');
    perform 1 from public.ordenes_compra where id = p_id and estado = 'Pendiente' for update;
    if not found then raise exception 'Solo se pueden anular órdenes de compra pendientes'; end if;
    perform set_config('erp.rpc', 'on', true);
    update public.ordenes_compra set estado = 'Anulada' where id = p_id;
    perform set_config('erp.rpc', 'off', true);
  elsif p_tipo = 'venta' then
    perform interno.exigir_permiso('ventas.anular');
    perform 1 from public.ordenes_venta where id = p_id and estado = 'Pendiente' for update;
    if not found then raise exception 'Solo se pueden anular órdenes de venta pendientes'; end if;
    perform set_config('erp.rpc', 'on', true);
    update public.ordenes_venta set estado = 'Anulada' where id = p_id;
    perform set_config('erp.rpc', 'off', true);
  else
    raise exception 'Tipo inválido: use ''compra'' o ''venta''';
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- Ajuste de inventario: deja el stock del almacén en p_nuevo_stock
-- ---------------------------------------------------------------------
create or replace function public.ajustar_stock(
  p_producto    bigint,
  p_almacen     bigint,
  p_nuevo_stock numeric,
  p_motivo      text default null
)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_actual numeric;
  v_dif    numeric;
begin
  perform interno.exigir_permiso('inventario.ajustar');
  if p_nuevo_stock is null or p_nuevo_stock < 0 then
    raise exception 'El stock debe ser mayor o igual a cero';
  end if;

  insert into public.inventarios (producto_id, almacen_id, cantidad)
  values (p_producto, p_almacen, 0)
  on conflict (producto_id, almacen_id) do nothing;

  select cantidad into v_actual
  from public.inventarios
  where producto_id = p_producto and almacen_id = p_almacen
  for update;

  v_dif := p_nuevo_stock - v_actual;
  if v_dif = 0 then return; end if;

  perform interno.mover_inventario(
    p_producto, p_almacen,
    (case when v_dif > 0 then 'Entrada' else 'Salida' end)::public.tipo_movimiento,
    'Ajuste', abs(v_dif),
    'ajuste', null, 'AJUSTE', null, null, null, p_motivo);
end;
$$;

-- ---------------------------------------------------------------------
-- Transferencia de stock entre almacenes
-- ---------------------------------------------------------------------
create or replace function public.transferir_stock(
  p_producto bigint,
  p_origen   bigint,
  p_destino  bigint,
  p_cantidad numeric,
  p_obs      text default null
)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_ref text := 'TRF-' || to_char(now() at time zone 'America/Lima', 'YYYYMMDD-HH24MISS');
begin
  perform interno.exigir_permiso('inventario.ajustar');
  if p_origen = p_destino then raise exception 'El almacén de origen y destino deben ser distintos'; end if;

  perform interno.mover_inventario(
    p_producto, p_origen, 'Salida', 'Transferencia', p_cantidad,
    'transferencia', null, v_ref, null, null, null, p_obs);
  perform interno.mover_inventario(
    p_producto, p_destino, 'Entrada', 'Transferencia', p_cantidad,
    'transferencia', null, v_ref, null, null, null, p_obs);
end;
$$;

-- ---------------------------------------------------------------------
-- Dashboard
-- ---------------------------------------------------------------------
create or replace function public.dashboard_resumen(p_dias integer default 7)
returns jsonb
language plpgsql stable
as $$
declare
  v_hoy     date := public.hoy();
  v_ini     date := public.hoy() - (p_dias - 1);
  v_ini_ant date := public.hoy() - (2 * p_dias - 1);
  v_fin_ant date := public.hoy() - p_dias;
  v_v  numeric;
  v_va numeric;
  v_c  numeric;
  v_ca numeric;
begin
  select coalesce(sum(total) filter (where fecha >= v_ini), 0),
         coalesce(sum(total) filter (where fecha <= v_fin_ant), 0)
    into v_v, v_va
  from public.comprobantes
  where fecha >= v_ini_ant and fecha <= v_hoy;

  select coalesce(sum(total) filter (where (fecha_recepcion at time zone 'America/Lima')::date >= v_ini), 0),
         coalesce(sum(total) filter (where (fecha_recepcion at time zone 'America/Lima')::date <= v_fin_ant), 0)
    into v_c, v_ca
  from public.ordenes_compra
  where estado = 'Recibida'
    and (fecha_recepcion at time zone 'America/Lima')::date >= v_ini_ant;

  return jsonb_build_object(
    'dias', p_dias,
    'ventas', v_v,
    'ventas_anterior', v_va,
    'variacion_ventas_pct', case when v_va > 0 then round((v_v / v_va - 1) * 100, 1) end,
    'compras', v_c,
    'compras_anterior', v_ca,
    'variacion_compras_pct', case when v_ca > 0 then round((v_c / v_ca - 1) * 100, 1) end,
    'unidades_en_stock', (select coalesce(sum(cantidad), 0) from public.inventarios),
    'categorias', (select count(*) from public.categorias),
    'almacenes', (select count(*) from public.almacenes where activo),
    'ordenes_venta_pendientes', (select count(*) from public.ordenes_venta where estado = 'Pendiente'),
    'ordenes_compra_pendientes', (select count(*) from public.ordenes_compra where estado = 'Pendiente'),
    'alertas_stock', (select count(*) from public.v_stock_producto where estado = 'Stock bajo')
  );
end;
$$;

create or replace function public.serie_ventas_compras(p_dias integer default 7)
returns table (fecha date, ventas numeric, compras numeric)
language sql stable as $$
  select d::date,
         coalesce((select sum(c.total) from public.comprobantes c where c.fecha = d::date), 0),
         coalesce((select sum(o.total) from public.ordenes_compra o
                   where o.estado = 'Recibida'
                     and (o.fecha_recepcion at time zone 'America/Lima')::date = d::date), 0)
  from generate_series((public.hoy() - (p_dias - 1))::timestamp, public.hoy()::timestamp, interval '1 day') as d
  order by 1
$$;


-- =====================================================================
-- 13. VISTAS (respetan RLS del usuario que consulta)
-- =====================================================================
create view public.v_stock_producto with (security_invoker = true) as
select p.id as producto_id,
       p.codigo,
       p.nombre,
       c.nombre as categoria,
       p.unidad,
       p.costo,
       p.precio_venta,
       p.stock_minimo,
       p.activo,
       coalesce(sum(coalesce(i.cantidad, 0)), 0) as stock_total,
       jsonb_object_agg(a.codigo, coalesce(i.cantidad, 0)) as stock_por_almacen,
       coalesce(sum(coalesce(i.cantidad, 0)), 0) * p.costo as valorizado,
       case when coalesce(sum(coalesce(i.cantidad, 0)), 0) < p.stock_minimo
            then 'Stock bajo' else 'Disponible' end as estado
from public.productos p
cross join public.almacenes a
left join public.inventarios i on i.producto_id = p.id and i.almacen_id = a.id
left join public.categorias c on c.id = p.categoria_id
group by p.id, c.nombre;

create view public.v_alertas_stock with (security_invoker = true) as
select * from public.v_stock_producto
where estado = 'Stock bajo' and activo
order by (stock_total - stock_minimo);

create view public.v_kardex with (security_invoker = true) as
select m.id,
       m.fecha,
       m.documento_numero,
       m.tipo,
       m.motivo,
       p.id as producto_id,
       p.codigo as producto_codigo,
       p.nombre as producto,
       a.id as almacen_id,
       a.nombre as almacen,
       m.tercero_nombre,
       m.cantidad,
       case when m.tipo = 'Entrada' then m.cantidad else -m.cantidad end as cantidad_signo,
       m.saldo_almacen,
       m.saldo_total
from public.movimientos_inventario m
join public.productos p on p.id = m.producto_id
join public.almacenes a on a.id = m.almacen_id;

create view public.v_cotizaciones with (security_invoker = true) as
select q.id, q.numero, q.fecha, q.estado, q.vigencia_dias,
       q.cliente_id, c.codigo as cliente_codigo, c.razon_social as cliente, c.ruc,
       q.subtotal, q.descuento, q.igv, q.total,
       q.vendedor_id, u.nombres as vendedor,
       ov.numero as orden_venta,
       q.observaciones, q.created_at
from public.cotizaciones q
join public.clientes c on c.id = q.cliente_id
left join public.usuarios u on u.id = q.vendedor_id
left join public.ordenes_venta ov on ov.cotizacion_id = q.id;

create view public.v_ordenes_venta with (security_invoker = true) as
select o.id, o.numero, o.fecha, o.estado,
       o.cliente_id, c.codigo as cliente_codigo, c.razon_social as cliente, c.ruc,
       o.almacen_id, a.nombre as almacen,
       o.sucursal_id, s.nombre as sucursal,
       o.forma_pago, o.dias_credito, o.tipo_comprobante,
       o.subtotal, o.descuento, o.igv, o.total,
       o.vendedor_id, u.nombres as vendedor,
       k.numero as comprobante,
       o.cotizacion_id, o.observaciones, o.created_at
from public.ordenes_venta o
join public.clientes c on c.id = o.cliente_id
join public.almacenes a on a.id = o.almacen_id
left join public.sucursales s on s.id = o.sucursal_id
left join public.usuarios u on u.id = o.vendedor_id
left join public.comprobantes k on k.orden_venta_id = o.id;

create view public.v_ordenes_compra with (security_invoker = true) as
select o.id, o.numero, o.fecha, o.estado,
       o.proveedor_id, p.codigo as proveedor_codigo, p.razon_social as proveedor, p.ruc,
       o.almacen_id, a.nombre as almacen,
       o.sucursal_id, s.nombre as sucursal,
       o.forma_pago, o.dias_credito,
       o.subtotal, o.descuento, o.igv, o.total, o.monto_pagado, o.saldo,
       (select coalesce(sum(d.cantidad), 0) from public.orden_compra_detalle d where d.orden_compra_id = o.id) as unidades,
       o.fecha_recepcion, o.observaciones, o.created_at
from public.ordenes_compra o
join public.proveedores p on p.id = o.proveedor_id
join public.almacenes a on a.id = o.almacen_id
left join public.sucursales s on s.id = o.sucursal_id;

-- Estado de cuenta de clientes (cuentas por cobrar)
create view public.v_estado_cuenta with (security_invoker = true) as
select k.id as comprobante_id,
       k.numero,
       k.fecha,
       k.fecha_vencimiento,
       k.cliente_id,
       c.razon_social as cliente,
       c.ruc,
       u.nombres as vendedor,
       ov.numero as orden_venta,
       k.forma_pago,
       k.total,
       k.monto_cobrado as a_cuenta,
       k.saldo as debe,
       k.estado_pago as estado,
       case when k.saldo > 0 and k.fecha_vencimiento < public.hoy()
            then public.hoy() - k.fecha_vencimiento else 0 end as dias_vencido
from public.comprobantes k
join public.clientes c on c.id = k.cliente_id
join public.ordenes_venta ov on ov.id = k.orden_venta_id
left join public.usuarios u on u.id = k.vendedor_id;

create view public.v_credito_clientes with (security_invoker = true) as
select c.id as cliente_id,
       c.codigo,
       c.razon_social,
       c.segmento,
       c.linea_credito,
       coalesce(sum(k.saldo), 0) as saldo_utilizado,
       greatest(c.linea_credito - coalesce(sum(k.saldo), 0), 0) as disponible,
       case when c.linea_credito > 0
            then round(coalesce(sum(k.saldo), 0) / c.linea_credito * 100, 1) else 0 end as uso_pct
from public.clientes c
left join public.comprobantes k on k.cliente_id = c.id and k.saldo > 0
group by c.id;

-- Cuentas por pagar a proveedores
create view public.v_cuentas_por_pagar with (security_invoker = true) as
select o.id as orden_compra_id,
       o.numero,
       o.fecha,
       (o.fecha_recepcion at time zone 'America/Lima')::date + o.dias_credito as fecha_vencimiento,
       o.proveedor_id,
       p.razon_social as proveedor,
       p.ruc,
       o.total,
       o.monto_pagado as pagado,
       o.saldo as por_pagar
from public.ordenes_compra o
join public.proveedores p on p.id = o.proveedor_id
where o.estado = 'Recibida' and o.saldo > 0;

create view public.v_saldo_cuentas_financieras with (security_invoker = true) as
select cf.id, cf.nombre, cf.tipo, cf.banco, cf.moneda, cf.saldo_inicial,
       cf.saldo_inicial
         + coalesce(sum(case when pg.tipo = 'Cobro' then pg.monto end), 0)
         - coalesce(sum(case when pg.tipo = 'Pago'  then pg.monto end), 0) as saldo_actual
from public.cuentas_financieras cf
left join public.pagos pg on pg.cuenta_id = cf.id
group by cf.id;

-- Reportes de la pantalla "Reportes"
create view public.v_reporte_ventas_dia with (security_invoker = true) as
select fecha, count(*) as comprobantes, sum(total) as total
from public.comprobantes
group by fecha
order by fecha desc;

create view public.v_reporte_compras_proveedor with (security_invoker = true) as
select p.id as proveedor_id, p.razon_social as proveedor, count(*) as ordenes, sum(o.total) as total
from public.ordenes_compra o
join public.proveedores p on p.id = o.proveedor_id
where o.estado = 'Recibida'
group by p.id, p.razon_social
order by total desc;

-- Nombres del documento maestro (ventas / compras) como vistas de compatibilidad
create view public.ventas          with (security_invoker = true) as select * from public.ordenes_venta;
create view public.detalle_ventas  with (security_invoker = true) as select * from public.orden_venta_detalle;
create view public.compras         with (security_invoker = true) as select * from public.ordenes_compra;
create view public.detalle_compras with (security_invoker = true) as select * from public.orden_compra_detalle;


-- =====================================================================
-- 14. DATOS BASE: roles, permisos, sucursales, almacenes, configuración
-- =====================================================================
insert into public.roles (codigo, nombre, descripcion) values
  ('admin',      'Administrador', 'Acceso total al sistema'),
  ('gerente',    'Gerente',       'Todo el negocio, sin administración de usuarios'),
  ('vendedor',   'Vendedor',      'Cotiza, vende y factura'),
  ('compras',    'Compras',       'Órdenes de compra y recepción'),
  ('almacenero', 'Almacenero',    'Recepción, stock, ajustes y transferencias'),
  ('contador',   'Contador',      'Cobranzas, pagos y reportes'),
  ('consulta',   'Consulta',      'Solo lectura');

insert into public.permisos (codigo, modulo, descripcion) values
  ('catalogos.ver',       'Catálogos',      'Ver clientes, proveedores, productos y almacenes'),
  ('catalogos.gestionar', 'Catálogos',      'Crear y editar clientes, proveedores, productos, almacenes'),
  ('compras.ver',         'Compras',        'Ver órdenes de compra'),
  ('compras.crear',       'Compras',        'Crear órdenes de compra'),
  ('compras.recibir',     'Compras',        'Registrar ingreso al almacén'),
  ('compras.anular',      'Compras',        'Anular órdenes de compra pendientes'),
  ('ventas.ver',          'Ventas',         'Ver cotizaciones, órdenes y comprobantes'),
  ('ventas.crear',        'Ventas',         'Crear cotizaciones y órdenes de venta'),
  ('ventas.facturar',     'Ventas',         'Emitir comprobantes'),
  ('ventas.anular',       'Ventas',         'Anular órdenes de venta pendientes'),
  ('inventario.ver',      'Inventario',     'Ver stock y Kardex'),
  ('inventario.ajustar',  'Inventario',     'Ajustes y transferencias de stock'),
  ('finanzas.ver',        'Finanzas',       'Ver cuentas por cobrar/pagar y caja'),
  ('finanzas.cobrar',     'Finanzas',       'Registrar cobranzas'),
  ('finanzas.pagar',      'Finanzas',       'Registrar pagos a proveedores'),
  ('finanzas.gestionar',  'Finanzas',       'Administrar cuentas de caja y bancos'),
  ('documentos.ver',      'Documentos',     'Ver y descargar documentos'),
  ('documentos.subir',    'Documentos',     'Subir documentos'),
  ('documentos.eliminar', 'Documentos',     'Eliminar documentos'),
  ('reportes.ver',        'Reportes',       'Ver reportes y dashboard'),
  ('admin.usuarios',      'Administración', 'Gestionar usuarios'),
  ('admin.roles',         'Administración', 'Gestionar roles y permisos'),
  ('admin.config',        'Administración', 'Cambiar la configuración'),
  ('admin.auditoria',     'Administración', 'Consultar la auditoría');

insert into public.roles_permisos (rol_id, permiso_id)
select r.id, p.id
from public.roles r
join public.permisos p on (
     r.codigo = 'admin'
  or (r.codigo = 'gerente'    and p.codigo not like 'admin.%')
  or (r.codigo = 'vendedor'   and p.codigo in ('catalogos.ver','ventas.ver','ventas.crear','ventas.facturar','inventario.ver','finanzas.ver','documentos.ver','documentos.subir','reportes.ver'))
  or (r.codigo = 'compras'    and p.codigo in ('catalogos.ver','compras.ver','compras.crear','compras.recibir','inventario.ver','documentos.ver','documentos.subir','reportes.ver'))
  or (r.codigo = 'almacenero' and p.codigo in ('catalogos.ver','compras.ver','compras.recibir','inventario.ver','inventario.ajustar','documentos.ver'))
  or (r.codigo = 'contador'   and p.codigo in ('catalogos.ver','ventas.ver','compras.ver','finanzas.ver','finanzas.cobrar','finanzas.pagar','finanzas.gestionar','documentos.ver','documentos.subir','reportes.ver'))
  or (r.codigo = 'consulta'   and p.codigo like '%.ver')
);

insert into public.sucursales (codigo, nombre, direccion) values
  ('SUC-01', 'Sede central',      'Av. Industrial 100, Ate, Lima'),
  ('SUC-02', 'Sucursal Arequipa', 'Arequipa');

insert into public.almacenes (codigo, nombre, sucursal_id)
select x.codigo, x.nombre, s.id
from (values ('ALM-01', 'Principal', 'SUC-01'),
             ('ALM-02', 'Secundario', 'SUC-01'),
             ('ALM-03', 'Arequipa',  'SUC-02')) as x(codigo, nombre, suc)
join public.sucursales s on s.codigo = x.suc;

insert into public.configuracion (clave, valor, descripcion) values
  ('empresa', '{"razon_social":"YCLOUD S.A.C.","ruc":"20000000001","direccion":"Av. Industrial 100, Ate, Lima"}', 'Datos de la empresa (edítalos)'),
  ('moneda',  '"PEN"', 'Moneda por defecto'),
  ('series',  '{"factura":"F001","boleta":"B001"}', 'Series de comprobantes (referencia; las series se aplican en facturar_orden_venta)');


-- =====================================================================
-- 15. SEGURIDAD A NIVEL DE FILA (RLS)
-- =====================================================================
create or replace procedure interno.crear_politicas(
  p_tabla text, p_ver text, p_escribir text, p_borrar text
)
language plpgsql as $$
begin
  execute format('alter table public.%I enable row level security', p_tabla);

  execute format(
    'create policy %I on public.%I for select to authenticated using ((select public.tiene_permiso(%L)))',
    p_tabla || '_select', p_tabla, p_ver);

  if p_escribir is not null then
    execute format(
      'create policy %I on public.%I for insert to authenticated with check ((select public.tiene_permiso(%L)))',
      p_tabla || '_insert', p_tabla, p_escribir);
    execute format(
      'create policy %I on public.%I for update to authenticated using ((select public.tiene_permiso(%L))) with check ((select public.tiene_permiso(%L)))',
      p_tabla || '_update', p_tabla, p_escribir, p_escribir);
  end if;

  if p_borrar is not null then
    execute format(
      'create policy %I on public.%I for delete to authenticated using ((select public.tiene_permiso(%L)))',
      p_tabla || '_delete', p_tabla, p_borrar);
  end if;
end;
$$;

-- Catálogos
call interno.crear_politicas('categorias',   'catalogos.ver', 'catalogos.gestionar', 'catalogos.gestionar');
call interno.crear_politicas('productos',    'catalogos.ver', 'catalogos.gestionar', 'catalogos.gestionar');
call interno.crear_politicas('clientes',     'catalogos.ver', 'catalogos.gestionar', 'catalogos.gestionar');
call interno.crear_politicas('proveedores',  'catalogos.ver', 'catalogos.gestionar', 'catalogos.gestionar');
call interno.crear_politicas('almacenes',    'catalogos.ver', 'catalogos.gestionar', 'catalogos.gestionar');
call interno.crear_politicas('sucursales',   'catalogos.ver', 'catalogos.gestionar', 'catalogos.gestionar');

-- Administración
call interno.crear_politicas('roles',          'catalogos.ver', 'admin.roles',  'admin.roles');
call interno.crear_politicas('permisos',       'catalogos.ver', 'admin.roles',  'admin.roles');
call interno.crear_politicas('roles_permisos', 'catalogos.ver', 'admin.roles',  'admin.roles');
call interno.crear_politicas('configuracion',  'catalogos.ver', 'admin.config', 'admin.config');

-- Ventas (las cabeceras no se borran: se anulan con anular_orden)
call interno.crear_politicas('cotizaciones',         'ventas.ver', 'ventas.crear', null);
call interno.crear_politicas('cotizacion_detalle',   'ventas.ver', 'ventas.crear', 'ventas.crear');
call interno.crear_politicas('ordenes_venta',        'ventas.ver', 'ventas.crear', null);
call interno.crear_politicas('orden_venta_detalle',  'ventas.ver', 'ventas.crear', 'ventas.crear');
call interno.crear_politicas('comprobantes',         'ventas.ver', null, null);   -- solo facturar_orden_venta()
call interno.crear_politicas('comprobante_detalle',  'ventas.ver', null, null);

-- Compras
call interno.crear_politicas('ordenes_compra',        'compras.ver', 'compras.crear', null);
call interno.crear_politicas('orden_compra_detalle',  'compras.ver', 'compras.crear', 'compras.crear');

-- Inventario (el stock solo cambia mediante funciones)
call interno.crear_politicas('inventarios',             'inventario.ver', null, null);
call interno.crear_politicas('movimientos_inventario',  'inventario.ver', null, null);

-- Finanzas
call interno.crear_politicas('cuentas_financieras', 'finanzas.ver', 'finanzas.gestionar', 'finanzas.gestionar');

alter table public.pagos enable row level security;
create policy pagos_select on public.pagos for select to authenticated
  using ((select public.tiene_permiso('finanzas.ver')));
create policy pagos_insert on public.pagos for insert to authenticated
  with check (
    (tipo = 'Cobro' and (select public.tiene_permiso('finanzas.cobrar'))) or
    (tipo = 'Pago'  and (select public.tiene_permiso('finanzas.pagar')))
  );

-- Documentos
call interno.crear_politicas('documentos', 'documentos.ver', 'documentos.subir', 'documentos.eliminar');

-- Usuarios: cada uno ve su perfil; con catalogos.ver se ve el equipo; solo admin edita
alter table public.usuarios enable row level security;
create policy usuarios_select on public.usuarios for select to authenticated
  using (id = (select auth.uid()) or (select public.tiene_permiso('catalogos.ver')));
create policy usuarios_update on public.usuarios for update to authenticated
  using ((select public.tiene_permiso('admin.usuarios')))
  with check ((select public.tiene_permiso('admin.usuarios')));

-- Auditoría: solo lectura para quien tenga admin.auditoria
alter table public.auditoria enable row level security;
create policy auditoria_select on public.auditoria for select to authenticated
  using ((select public.tiene_permiso('admin.auditoria')));

-- Correlativos: nadie accede directamente (solo las funciones)
alter table public.series_documentos enable row level security;


-- =====================================================================
-- 16. STORAGE: bucket privado para documentos
-- =====================================================================
do $$
begin
  insert into storage.buckets (id, name, public, file_size_limit)
  values ('documentos', 'documentos', false, 20971520)
  on conflict (id) do nothing;

  drop policy if exists documentos_storage_select on storage.objects;
  drop policy if exists documentos_storage_insert on storage.objects;
  drop policy if exists documentos_storage_update on storage.objects;
  drop policy if exists documentos_storage_delete on storage.objects;

  create policy documentos_storage_select on storage.objects for select to authenticated
    using (bucket_id = 'documentos' and (select public.tiene_permiso('documentos.ver')));
  create policy documentos_storage_insert on storage.objects for insert to authenticated
    with check (bucket_id = 'documentos' and (select public.tiene_permiso('documentos.subir')));
  create policy documentos_storage_update on storage.objects for update to authenticated
    using (bucket_id = 'documentos' and (select public.tiene_permiso('documentos.subir')))
    with check (bucket_id = 'documentos' and (select public.tiene_permiso('documentos.subir')));
  create policy documentos_storage_delete on storage.objects for delete to authenticated
    using (bucket_id = 'documentos' and (select public.tiene_permiso('documentos.eliminar')));
exception when others then
  raise notice 'No se pudo configurar Storage automáticamente (%). Crea a mano un bucket PRIVADO llamado "documentos".', sqlerrm;
end $$;


-- =====================================================================
-- 17. USUARIOS: alta automática del perfil + usuarios que ya existían
-- =====================================================================
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function interno.fn_nuevo_usuario();

do $$
declare r record;
begin
  for r in
    select u.id, u.email, u.raw_user_meta_data
    from auth.users u
    where not exists (select 1 from public.usuarios x where x.id = u.id)
    order by u.created_at
  loop
    insert into public.usuarios (id, email, nombres, rol_id)
    values (
      r.id, r.email,
      coalesce(nullif(r.raw_user_meta_data ->> 'nombres', ''),
               nullif(split_part(coalesce(r.email, ''), '@', 1), ''),
               'Usuario'),
      (select id from public.roles
       where codigo = case when exists (select 1 from public.usuarios) then 'consulta' else 'admin' end)
    );
  end loop;
end $$;


-- =====================================================================
-- 18. PRIVILEGIOS
--     anon no accede a nada; authenticated solo lo que permitan RLS y funciones
-- =====================================================================
revoke all on all tables    in schema public from anon;
revoke all on all sequences in schema public from anon;

grant usage on sequence public.seq_cliente, public.seq_proveedor, public.seq_producto to authenticated;

do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as firma
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
  loop
    execute format('revoke all on function %s from public, anon', r.firma);
    execute format('grant execute on function %s to authenticated, service_role', r.firma);
  end loop;
end $$;

-- Fin del esquema
