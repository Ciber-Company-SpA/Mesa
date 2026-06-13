-- ============================================================================
-- PERF: índice de orders por table_id  (IMPORTANTE 🟠 #2 — "explota al escalar")
--
-- Problema:
--   La RPC get_orders_for_table_qr filtra por (o.table_id = ...) y corre cada
--   3 segundos por cada menú abierto (polling del comensal). Hoy NO existe
--   ningún índice que empiece por table_id en orders -> cada consulta hace
--   un Seq Scan de toda la tabla. Con varias mesas activas en paralelo, esto
--   degrada rápido.
--
--   Los índices existentes (idx_orders_reporting, idx_orders_restaurant_status_created)
--   empiezan por restaurant_id, así que NO sirven para filtrar por table_id.
--
-- Solución:
--   Índice compuesto (table_id, status_id, created_at DESC). Cubre:
--     - el filtro por table_id de la RPC del comensal,
--     - el filtrado por estado (cuando se filtran activos/pagados en SQL),
--     - el orden por created_at sin sort adicional.
--
-- Nota sobre el costo: cada índice extra ralentiza un poco los INSERT de
-- pedidos. Vale la pena porque la lectura (cada 3s, muchas mesas) ocurre
-- órdenes de magnitud más seguido que la escritura.
-- ============================================================================

create index if not exists idx_orders_table_status_created
  on public.orders using btree (table_id, status_id, created_at desc);