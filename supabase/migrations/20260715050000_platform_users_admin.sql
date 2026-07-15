-- Módulo Usuarios del portal: listado cross-tenant de usuarios + wrapper de
-- auditoría reutilizable. Ambas con guard is_platform_owner.
create or replace function public.platform_users_overview()
returns table (
  user_id bigint,
  auth_user_id uuid,
  name text,
  email text,
  role_id integer,
  role_name text,
  restaurant_id bigint,
  restaurant_name text,
  is_owner boolean,
  setup_completed boolean
)
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_platform_owner() then
    raise exception 'No autorizado';
  end if;
  return query
    select
      u.id,
      u.auth_user_id,
      u.user_name,
      u.user_email,
      u.role_id,
      r.nombre,
      u.restaurant_id,
      rest.restaurant_name::text,
      (rest.owner_user_id = u.id) as is_owner,
      u.setup_completed
    from public.users u
    left join public.roles r on r.id = u.role_id
    left join public.restaurants rest on rest.id = u.restaurant_id
    order by rest.restaurant_name nulls last, u.id;
end;
$$;
revoke all on function public.platform_users_overview() from public, anon;
grant execute on function public.platform_users_overview() to authenticated, service_role;

create or replace function public.platform_audit_event(
  p_action text, p_entity text, p_entity_id text, p_meta jsonb default '{}'::jsonb
)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_platform_owner() then
    raise exception 'No autorizado';
  end if;
  perform public._platform_audit(p_action, p_entity, p_entity_id, coalesce(p_meta, '{}'::jsonb));
end;
$$;
revoke all on function public.platform_audit_event(text, text, text, jsonb) from public, anon;
grant execute on function public.platform_audit_event(text, text, text, jsonb) to authenticated, service_role;
