-- ============================================================================
-- H-01 (CRÍTICO, CVSS 8.6 · BOLA/IDOR): aislamiento multi-tenant roto en
-- tables y table_qr_codes.
--
-- Las policies de SELECT eran permisivas (USING true) para authenticated, así
-- que cualquier cuenta autenticada (cualquiera puede registrarse) podía leer
-- por PostgREST TODAS las mesas y TODOS los tokens QR de TODOS los restaurantes
-- (fuga cross-tenant del secreto que identifica cada mesa). El control de
-- pertenencia vivía solo en el cliente → se evade llamando la API REST directo.
--
-- Fix: reemplazar el SELECT permisivo por uno acotado al propio tenant, usando
-- el helper existente current_user_restaurant_id() (el mismo que ya usan las
-- policies de UPDATE/DELETE). anon NO tiene grant sobre estas tablas y el menú
-- del cliente se sirve por get_public_menu (SECURITY DEFINER, ignora RLS), así
-- que las nuevas policies solo aplican a authenticated, sin romper nada.
--
-- NOTA: hay otras tablas con SELECT USING(true) (customers, products,
-- categories, restaurants, product_variants) que requieren la misma auditoría;
-- se tratan por separado. Esta migración cierra únicamente H-01.
-- ============================================================================

begin;

-- Aseguramos RLS habilitado (idempotente; ya estaba activo, las policies se
-- aplicaban — el problema era el USING true, no RLS apagado).
alter table public.tables enable row level security;
alter table public.table_qr_codes enable row level security;

-- ----------------------------------------------------------------------------
-- tables: SELECT solo de las mesas del restaurante del usuario.
-- ----------------------------------------------------------------------------
drop policy if exists tables_select on public.tables;
create policy tables_select on public.tables
  for select
  to authenticated
  using (restaurant_id = current_user_restaurant_id());

-- ----------------------------------------------------------------------------
-- table_qr_codes: SELECT solo de los QR cuyas mesas son del propio tenant.
-- (Mismo patrón que la policy de UPDATE "staff updates own restaurant qr codes".)
-- ----------------------------------------------------------------------------
drop policy if exists qr_codes_select on public.table_qr_codes;
create policy qr_codes_select on public.table_qr_codes
  for select
  to authenticated
  using (
    id in (
      select t.qr_code_id
      from public.tables t
      where t.restaurant_id = current_user_restaurant_id()
    )
  );

commit;
