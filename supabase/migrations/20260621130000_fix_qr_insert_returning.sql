-- ============================================================================
-- FIX: crear QR de mesa fallaba tras endurecer el SELECT de table_qr_codes.
--
-- La migración 20260614180000 restringió el SELECT de table_qr_codes a los QR
-- ya ligados a una mesa del propio restaurante. Pero createTableQR hace
-- INSERT ... RETURNING (vía .select() de PostgREST), y el RETURNING vuelve a
-- pasar por la policy de SELECT. Como el QR recién creado aún no está ligado a
-- ninguna mesa (la mesa se crea después), la policy lo filtra → 0 filas →
-- ".single()" falla → "Error al crear el codigo QR" (y deja un QR huérfano).
--
-- Solución: crear el QR mediante una RPC SECURITY DEFINER (ignora RLS en el
-- RETURNING, igual que el resto de RPCs del proyecto). No relaja la seguridad:
-- exige que el llamante tenga restaurante (igual que la policy de INSERT) y el
-- QR sigue sin ser legible por PostgREST hasta ligarse a una mesa.
-- ============================================================================

begin;

create or replace function public.admin_create_table_qr(p_qr_code text)
returns public.table_qr_codes
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_row public.table_qr_codes;
begin
  if public.current_user_restaurant_id() is null then
    raise exception 'no autorizado';
  end if;

  if coalesce(length(p_qr_code), 0) < 8 then
    raise exception 'token QR inválido';
  end if;

  insert into public.table_qr_codes (qr_code, qr_active)
  values (p_qr_code, true)
  returning * into v_row;

  return v_row;
end;
$$;

alter function public.admin_create_table_qr(text) owner to postgres;
revoke all on function public.admin_create_table_qr(text) from public;
grant execute on function public.admin_create_table_qr(text) to authenticated, service_role;

commit;
