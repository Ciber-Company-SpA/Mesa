-- ============================================================================
-- FASE 5: cerrar dos bypass que quedaban.
--
-- CRÍTICO #1: las RPC viejas por table_id seguían EJECUTABLES por anon vía el
--   grant heredado de PUBLIC. `CREATE FUNCTION` otorga EXECUTE a PUBLIC por
--   defecto; las migraciones que solo hicieron `revoke ... from anon/authenticated`
--   NO quitaron ese grant, así que anon (miembro de PUBLIC) seguía pudiendo
--   llamarlas (confirmado contra Supabase con request_bill). El frontend usa
--   EXCLUSIVAMENTE las versiones *_qr, así que las eliminamos por completo:
--   sin función, no hay grant que explotar.
--
-- CRÍTICO #2: cualquier cuenta authenticated podía insertar restaurantes basura
--   (policy "Allow public insert restaurants" WITH CHECK(true) + grant ALL). El
--   alta real ocurre en handle_new_user (SECURITY DEFINER) durante el signup, así
--   que no hace falta ningún INSERT público.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- CRÍTICO #1 — eliminar las RPC públicas viejas (reemplazadas por las *_qr).
-- ----------------------------------------------------------------------------
drop function if exists public.request_bill(bigint, text);
drop function if exists public.claim_diner_slot(bigint, text);
drop function if exists public.get_orders_for_table(bigint);
drop function if exists public.create_public_order(bigint, jsonb, text);

-- ----------------------------------------------------------------------------
-- CRÍTICO #2 — quitar el INSERT público sobre restaurants.
-- ----------------------------------------------------------------------------
drop policy if exists "Allow public insert restaurants" on public.restaurants;
revoke insert on public.restaurants from anon;
revoke insert on public.restaurants from authenticated;

commit;
