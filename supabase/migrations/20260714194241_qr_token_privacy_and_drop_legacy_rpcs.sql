-- Auditoría jul 2026, pendientes menores:
--  1) resolve_qr_token exponía current_waiter_id (id interno de staff) a
--     cualquier portador del QR. Se quita de la salida; el único consumidor
--     (src/app/r/[qrCode]/route.ts, flujo de reclamo de mesa por el mesero)
--     ahora lo lee de tables con su sesión, que la RLS ya le permite.
--     Cambiar las columnas de retorno exige DROP + CREATE, por lo que se
--     reponen owner y grants explícitamente.
--  2) Se eliminan 4 RPCs sin ningún call site en el código (verificado en
--     Mesa y Messa-APP-): restos del flujo multi-restaurante. Recuperables
--     desde el historial de migraciones si se retoma esa funcionalidad.

-- 1) resolve_qr_token sin current_waiter_id
drop function public.resolve_qr_token(text);

create function public.resolve_qr_token(p_qr_token text)
returns table(table_id bigint, table_number integer, restaurant_id bigint)
language sql
stable
security definer
set search_path = public
as $$
  select t.id, t.table_number, t.restaurant_id
  from public.table_qr_codes q
  join public.tables t on t.qr_code_id = q.id
  where q.qr_code = p_qr_token
    and q.qr_active = true;
$$;

alter function public.resolve_qr_token(text) owner to postgres;
revoke all on function public.resolve_qr_token(text) from public;
grant execute on function public.resolve_qr_token(text) to anon, authenticated, service_role;

-- 2) RPCs legado sin uso
drop function if exists public.complete_restaurant_setup(character varying);
drop function if exists public.create_owned_restaurant(text);
drop function if exists public.list_my_restaurants();
drop function if exists public.set_active_restaurant(bigint);
