-- ============================================================================
-- FIX: lectura del carrito de mesa para anon tras el hardening de Fase 2.
--
-- Problema:
--   La política RLS "cart read for active table" sobre table_cart_items hace
--   EXISTS (SELECT 1 FROM tables t JOIN table_qr_codes q ...). Esa subconsulta
--   se evalúa con los privilegios del rol que consulta (anon). La Fase 2
--   revocó SELECT sobre public.tables y public.table_qr_codes a anon, así que
--   la política revienta con "permission denied for table tables" (42501) y el
--   comensal no puede leer su propio carrito (fetchItems) ni recibir realtime.
--
-- Solución:
--   Mover el chequeo de "mesa con QR activo" a una función SECURITY DEFINER
--   (is_table_active) que lee tables/table_qr_codes con privilegios del owner,
--   y reescribir la política para llamarla. anon NO recupera SELECT directo
--   sobre tables/table_qr_codes: el hardening de Fase 2 se mantiene.
-- ============================================================================

begin;

create or replace function public.is_table_active(p_table_id bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.tables t
    join public.table_qr_codes q on q.id = t.qr_code_id
    where t.id = p_table_id
      and q.qr_active = true
  );
$$;

alter function public.is_table_active(bigint) owner to postgres;
revoke all on function public.is_table_active(bigint) from public;
grant execute on function public.is_table_active(bigint) to anon, authenticated, service_role;

-- Reescribir la política de lectura del carrito para usar el helper definer.
drop policy if exists "cart read for active table" on public.table_cart_items;
create policy "cart read for active table"
  on public.table_cart_items
  for select
  to authenticated, anon
  using (public.is_table_active(table_id));

commit;
