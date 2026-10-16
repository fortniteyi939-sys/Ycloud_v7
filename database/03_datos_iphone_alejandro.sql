-- =====================================================================
--  YCLOUD ERP · Carga inicial: catálogo de iPhones, proveedores e inventario
--  Usuario responsable: Alejandro (sgbyi93@gmail.com)
-- =====================================================================
--  CÓMO USARLO
--   1. Ya debe estar instalado 01_esquema_erp.sql y existir tu usuario.
--   2. EDITA los bloques marcados con  >>> EDITAR  (proveedores, costos,
--      precios y cantidades). Los valores que vienen son REFERENCIALES.
--   3. Supabase > SQL Editor > pega TODO el archivo > Run.
--
--  QUÉ HACE
--   · Crea categorías (iPhone 15 / 16 / 17), los productos y 2 proveedores.
--   · Crea UNA orden de compra por proveedor y la RECIBE en el almacén
--     ALM-01 con las funciones del sistema, así el stock queda en
--     `inventarios` y cada entrada queda en el Kardex.
--   · Todo queda a nombre de Alejandro: ordenes_compra.created_by,
--     movimientos_inventario.created_by y la auditoría (el script se
--     ejecuta "como" él, siempre que sea admin o tenga compras.crear y
--     compras.recibir).
--
--  Se puede ejecutar más de una vez: no duplica productos, proveedores
--  ni la carga inicial de stock.
-- =====================================================================

do $$
declare
  v_email constant text := 'sgbyi93@gmail.com';       -- usuario dueño de la carga
  v_uid   uuid;
  v_alm   bigint;
  v_suc   bigint;
  v_prov  record;
  v_lineas jsonb;
  v_oc    public.ordenes_compra;
  v_obs   constant text := 'Carga inicial de inventario iPhone';
  v_ordenes int := 0;
begin
  -- 1) Usuario ----------------------------------------------------------
  select id into v_uid from public.usuarios where email = v_email and activo;
  if v_uid is null then
    raise exception 'No existe un usuario activo con el correo %', v_email;
  end if;

  -- A partir de aquí, auth.uid() = Alejandro (solo dentro de esta transacción)
  perform set_config('request.jwt.claim.sub', v_uid::text, true);
  perform set_config('request.jwt.claims',
                     json_build_object('sub', v_uid, 'role', 'authenticated')::text, true);

  select id into v_alm from public.almacenes   where codigo = 'ALM-01';
  select id into v_suc from public.sucursales  where codigo = 'SUC-01';
  if v_alm is null then raise exception 'No existe el almacén ALM-01'; end if;

  -- 2) Categorías -------------------------------------------------------
  insert into public.categorias (nombre, descripcion) values
    ('iPhone 15', 'Smartphones Apple iPhone 15'),
    ('iPhone 16', 'Smartphones Apple iPhone 16'),
    ('iPhone 17', 'Smartphones Apple iPhone 17')
  on conflict (nombre) do nothing;

  -- 3) Proveedores ------------------------------------------------------
  -- >>> EDITAR: todos los datos de abajo son FICTICIOS; reemplázalos por los reales.
  --     Estos campos son los que se muestran en la ficha del proveedor de la app:
  --     dirección, contacto, teléfono, correo y condición de pago.
  --     RUC: 11 dígitos y único. dias_credito = 0 -> "Contado"; 30 -> "Crédito 30 días".
  --     Si el RUC ya existe, el script ACTUALIZA sus datos de contacto (así puedes
  --     corregirlos y volver a ejecutar).
  insert into public.proveedores (razon_social, ruc, contacto, telefono, correo, direccion, dias_credito) values
    ('Importadora Mobile Lima S.A.C.',      '20600000011', 'Ana Flores',   '913959500',
     'compras@mobilelima.ejemplo.pe', 'Av. Javier Prado Este 1200, San Borja, Lima', 0),
    ('Tecnología Móvil del Perú S.A.C.',    '20600000028', 'Luis Quispe',  '987654321',
     'ventas@tecmovil.ejemplo.pe',    'Jr. de la Unión 350, Cercado de Lima, Lima', 30)
  on conflict (ruc) do update
    set contacto     = excluded.contacto,
        telefono     = excluded.telefono,
        correo       = excluded.correo,
        direccion    = excluded.direccion,
        dias_credito = excluded.dias_credito;

  -- 4) Productos + stock inicial ----------------------------------------
  -- >>> EDITAR: costo y precio_venta en soles SIN IGV (referenciales),
  --     stock_minimo, cantidad inicial (cant) y RUC del proveedor.
  create temp table tmp_iphone (
    categoria text, nombre text, descripcion text,
    costo numeric, precio numeric, minimo numeric, cant numeric, prov_ruc text
  ) on commit drop;

  insert into tmp_iphone values
    ('iPhone 15', 'iPhone 15 128GB',            'Apple iPhone 15 · 128 GB',            2700, 3300, 3,  8, '20600000011'),
    ('iPhone 15', 'iPhone 15 256GB',            'Apple iPhone 15 · 256 GB',            3100, 3800, 3,  6, '20600000011'),
    ('iPhone 16', 'iPhone 16 128GB',            'Apple iPhone 16 · 128 GB',            3100, 3800, 3, 10, '20600000011'),
    ('iPhone 16', 'iPhone 16 256GB',            'Apple iPhone 16 · 256 GB',            3500, 4300, 3,  8, '20600000011'),
    ('iPhone 16', 'iPhone 16 Plus 128GB',       'Apple iPhone 16 Plus · 128 GB',       3500, 4300, 2,  5, '20600000011'),
    ('iPhone 16', 'iPhone 16 Pro 128GB',        'Apple iPhone 16 Pro · 128 GB',        4100, 4900, 3,  6, '20600000028'),
    ('iPhone 16', 'iPhone 16 Pro 256GB',        'Apple iPhone 16 Pro · 256 GB',        4500, 5400, 3,  6, '20600000028'),
    ('iPhone 16', 'iPhone 16 Pro Max 256GB',    'Apple iPhone 16 Pro Max · 256 GB',    5000, 5900, 2,  5, '20600000028'),
    ('iPhone 17', 'iPhone 17 256GB',            'Apple iPhone 17 · 256 GB',            3600, 4400, 3, 10, '20600000028'),
    ('iPhone 17', 'iPhone 17 Pro 256GB',        'Apple iPhone 17 Pro · 256 GB',        4900, 5800, 3,  6, '20600000028'),
    ('iPhone 17', 'iPhone 17 Pro Max 256GB',    'Apple iPhone 17 Pro Max · 256 GB',    5500, 6500, 2,  5, '20600000028'),
    ('iPhone 17', 'iPhone 17 Pro Max 512GB',    'Apple iPhone 17 Pro Max · 512 GB',    6400, 7500, 2,  3, '20600000028');

  insert into public.productos (nombre, categoria_id, unidad, costo, precio_venta, stock_minimo, descripcion)
  select t.nombre, c.id, 'UND', t.costo, t.precio, t.minimo, t.descripcion
  from tmp_iphone t
  join public.categorias c on c.nombre = t.categoria
  where not exists (select 1 from public.productos p where p.nombre = t.nombre);

  -- 5) Una orden de compra por proveedor, recibida en ALM-01 ------------
  for v_prov in
    select distinct pr.id, pr.dias_credito, pr.razon_social, t.prov_ruc
    from tmp_iphone t
    join public.proveedores pr on pr.ruc = t.prov_ruc
    order by t.prov_ruc
  loop
    -- si ya se hizo la carga inicial para este proveedor, no se repite
    if exists (select 1 from public.ordenes_compra
               where proveedor_id = v_prov.id and observaciones = v_obs) then
      continue;
    end if;

    select jsonb_agg(jsonb_build_object(
             'producto_id',    p.id,
             'cantidad',       t.cant,
             'costo_unitario', t.costo) order by p.id)
      into v_lineas
    from tmp_iphone t
    join public.productos p on p.nombre = t.nombre
    where t.prov_ruc = v_prov.prov_ruc;

    select * into v_oc from public.crear_orden_compra(
      jsonb_build_object(
        'proveedor_id',  v_prov.id,
        'almacen_id',    v_alm,
        'sucursal_id',   v_suc,
        'forma_pago',    case when v_prov.dias_credito > 0 then 'Crédito' else 'Contado' end,
        'dias_credito',  v_prov.dias_credito,
        'observaciones', v_obs),
      v_lineas);

    perform public.recibir_orden_compra(v_oc.id);
    v_ordenes := v_ordenes + 1;
    raise notice 'Orden % recibida (%)', v_oc.numero, v_prov.razon_social;
  end loop;

  raise notice 'Listo: % orden(es) de compra creadas y recibidas a nombre de %.', v_ordenes, v_email;
end $$;


-- =====================================================================
--  VERIFICACIÓN (opcional): ejecuta estas consultas después
-- =====================================================================
-- Stock por producto:
--   select codigo, nombre, categoria, stock_total, stock_minimo, estado from public.v_stock_producto order by codigo;
-- Kardex de la carga (debe mostrar a Alejandro como autor):
--   select m.fecha, p.nombre, m.tipo, m.cantidad, m.saldo_total, u.nombres as usuario
--   from public.movimientos_inventario m
--   join public.productos p on p.id = m.producto_id
--   left join public.usuarios u on u.id = m.created_by
--   order by m.id desc limit 20;
-- Órdenes de compra creadas:
--   select numero, proveedor, total, estado, fecha_recepcion from public.v_ordenes_compra order by id desc;
