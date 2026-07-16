-- Permite al admin borrar un documento tributario de SU restaurante.
-- tax_documents es deny-all; el borrado va por este RPC con guard de admin y de
-- pertenencia (restaurant_id desde la sesión). NOTA: borrar el registro local no
-- anula un DTE ya aceptado por el SII (eso se hace con una nota de crédito);
-- hoy aplica al flujo simulado y a la limpieza de documentos de prueba.
create or replace function public.dte_delete_document(p_id bigint)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_rid bigint;
begin
  if not public.current_user_is_admin() then raise exception 'No autorizado'; end if;
  v_rid := public.current_user_restaurant_id();
  delete from public.tax_documents where id = p_id and restaurant_id = v_rid;
  if not found then raise exception 'Documento no encontrado'; end if;
end;
$$;

revoke all on function public.dte_delete_document(bigint) from public, anon;
grant execute on function public.dte_delete_document(bigint) to authenticated, service_role;
