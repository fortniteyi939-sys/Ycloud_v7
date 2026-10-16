-- =====================================================================
-- 04 · Nuevo medio de pago: Tarjeta
-- Ejecutar UNA vez en el SQL Editor de Supabase (después de 01_esquema_erp.sql).
-- Los medios existentes (Efectivo, Transferencia bancaria, Depósito en cuenta,
-- Yape / Plin, Cheque) no cambian. La regla "todo medio distinto de Efectivo
-- exige número de operación" sigue aplicando a Tarjeta.
-- =====================================================================
alter type public.medio_pago add value if not exists 'Tarjeta';
