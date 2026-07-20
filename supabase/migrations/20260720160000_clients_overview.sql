-- ============================================================================
-- VISTA UNIFICADA DE CLIENTES (portal)
--
-- Un "cliente" = una cuenta B2B. Puede ser:
--   - 'group'  : una cadena (organización) con 1..N sucursales (plan Personalizado).
--   - 'single' : un local suelto (restaurante sin organización).
-- Reemplaza la dualidad Clientes(por local) + Organizaciones(por grupo) por una
-- sola lista donde cada fila es un cliente. Guard is_platform_owner.
-- ============================================================================

create or replace function public.platform_clients_overview()
  returns jsonb
  language plpgsql
  stable
  security definer
  set search_path = public
as $$
declare v jsonb;
begin
  if not public.is_platform_owner() then raise exception 'No autorizado'; end if;

  select coalesce(jsonb_agg(to_jsonb(c) order by c.name), '[]'::jsonb) into v from (
    -- CADENAS (una fila por organización)
    select
      'group'::text as kind,
      o.id          as id,
      o.name::text  as name,
      o.max_branches,
      (select count(*) from public.restaurant_accounts ra where ra.organization_id = o.id)::bigint as branches,
      coalesce((
        select sum((select count(*) from public.tables t where t.restaurant_id = ra.restaurant_id))
        from public.restaurant_accounts ra where ra.organization_id = o.id
      ), 0)::bigint as tables_count,
      (
        select p.name from public.restaurant_accounts ra
        join public.plans p on p.id = ra.plan_id
        where ra.organization_id = o.id order by ra.restaurant_id limit 1
      )::text as plan_name,
      (
        select case
          when bool_or(ra.account_status = 'suspended') then 'suspended'
          when bool_or(ra.account_status = 'past_due')  then 'past_due'
          when bool_or(ra.account_status = 'trial')     then 'trial'
          when bool_or(ra.account_status = 'active')    then 'active'
          else 'cancelled' end
        from public.restaurant_accounts ra where ra.organization_id = o.id
      )::text as account_status,
      o.city::text as city
    from public.organizations o

    union all

    -- LOCALES SUELTOS (una fila por restaurante sin organización)
    select
      'single'::text as kind,
      r.id           as id,
      r.restaurant_name::text as name,
      null::int      as max_branches,
      1::bigint      as branches,
      (select count(*) from public.tables t where t.restaurant_id = r.id)::bigint as tables_count,
      p.name::text   as plan_name,
      coalesce(ra.account_status, 'active')::text as account_status,
      r.restaurant_city::text as city
    from public.restaurants r
    left join public.restaurant_accounts ra on ra.restaurant_id = r.id
    left join public.plans p on p.id = ra.plan_id
    where ra.organization_id is null
  ) c;

  return v;
end;
$$;

alter function public.platform_clients_overview() owner to postgres;
revoke all on function public.platform_clients_overview() from public, anon;
grant execute on function public.platform_clients_overview() to authenticated, service_role;
