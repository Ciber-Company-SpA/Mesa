-- Rescatada del historial remoto (aplicada vía MCP el 20-jul como 20260720175125).
-- Fix de ambigüedad de columnas en list_branch_admins (aliases explícitos).

create or replace function public.list_branch_admins(p_restaurant_id bigint)
  returns table(user_id bigint, auth_user_id uuid, name text, email text)
  language plpgsql stable security definer set search_path = public as $$
declare v_caller bigint; v_owner bigint;
begin
  select u.id into v_caller from public.users u where u.auth_user_id = auth.uid();
  select owner_user_id into v_owner from public.restaurants where id = p_restaurant_id;
  if v_caller is null or v_owner is null or v_owner <> v_caller then raise exception 'No autorizado'; end if;
  return query
  select u.id, u.auth_user_id, u.user_name::text, u.user_email::text
  from public.users u
  where u.restaurant_id = p_restaurant_id and u.role_id = 2 and u.id <> v_owner
  order by u.user_name;
end; $$;
alter function public.list_branch_admins(bigint) owner to postgres;
revoke all on function public.list_branch_admins(bigint) from public, anon;
grant execute on function public.list_branch_admins(bigint) to authenticated, service_role;
