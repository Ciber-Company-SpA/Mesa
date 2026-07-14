-- Portal de proveedor (administracion.tumesaqr.com): cimientos de identidad
-- y acceso cross-tenant de SOLO LECTURA.
--
-- Diseño de seguridad:
--  * La identidad de "operador de plataforma" es ORTOGONAL al modelo de
--    tenants: no se usa users.role_id (eso es staff de un restaurante), sino
--    una allowlist por email en platform_admins. Así se puede pre-autorizar
--    a alguien que todavía no tiene cuenta.
--  * platform_admins tiene RLS deny-all: solo se lee vía funciones
--    SECURITY DEFINER. Nadie la consulta directamente.
--  * Todas las funciones cross-tenant validan is_platform_owner() como
--    primera línea y solo LEEN. No hay escritura cross-tenant en v1.
--  * EXECUTE solo para authenticated (nunca anon): un autenticado que no
--    esté en la allowlist recibe 'No autorizado'.

-- 1) Allowlist de operadores de plataforma
create table if not exists public.platform_admins (
  email      text primary key,
  note       text,
  created_at timestamptz not null default now()
);

alter table public.platform_admins enable row level security;
-- Sin políticas => deny-all. Solo accesible vía funciones SECURITY DEFINER.

-- Pre-autorizar al dueño. Aún no tiene cuenta: quedará activo en cuanto
-- exista un auth.users con este email.
insert into public.platform_admins (email, note)
values ('administracion@cyber-company.cl', 'Dueño de la plataforma')
on conflict (email) do nothing;

-- 2) Guard: ¿la sesión actual pertenece a un operador de plataforma?
create or replace function public.is_platform_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from auth.users au
    join public.platform_admins pa on lower(pa.email) = lower(au.email)
    where au.id = auth.uid()
  );
$$;

revoke all on function public.is_platform_owner() from public;
grant execute on function public.is_platform_owner() to authenticated, service_role;

-- 3) Métricas globales de la plataforma
create or replace function public.platform_metrics()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v jsonb;
begin
  if not public.is_platform_owner() then
    raise exception 'No autorizado';
  end if;

  select jsonb_build_object(
    'restaurants_total',        (select count(*) from public.restaurants),
    'restaurants_active_7d',    (select count(distinct restaurant_id) from public.orders
                                   where created_at >= now() - interval '7 days'),
    'orders_total',             (select count(*) from public.orders),
    'orders_today',             (select count(*) from public.orders
                                   where created_at >= date_trunc('day', now())),
    'revenue_total',            (select coalesce(sum(total), 0) from public.orders where status_id = 4),
    'revenue_today',            (select coalesce(sum(total), 0) from public.orders
                                   where status_id = 4 and created_at >= date_trunc('day', now())),
    'staff_total',              (select count(*) from public.users where restaurant_id is not null),
    'tables_total',             (select count(*) from public.tables)
  ) into v;

  return v;
end;
$$;

revoke all on function public.platform_metrics() from public;
grant execute on function public.platform_metrics() to authenticated, service_role;

-- 4) Listado de restaurantes con métricas por restaurante
create or replace function public.platform_list_restaurants()
returns table(
  restaurant_id     bigint,
  restaurant_name   text,
  restaurant_city   text,
  created_at        timestamptz,
  delivery_enabled  boolean,
  tables_count      bigint,
  waiters_count     bigint,
  admins_count      bigint,
  orders_total      bigint,
  orders_today      bigint,
  revenue_total     bigint,
  revenue_today     bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_platform_owner() then
    raise exception 'No autorizado';
  end if;

  return query
  select
    r.id,
    r.restaurant_name::text,
    r.restaurant_city,
    r.created_at::timestamptz,
    r.delivery_enabled,
    (select count(*) from public.tables t where t.restaurant_id = r.id),
    (select count(*) from public.users u where u.restaurant_id = r.id and u.role_id = 1),
    (select count(*) from public.users u where u.restaurant_id = r.id and u.role_id = 2),
    (select count(*) from public.orders o where o.restaurant_id = r.id),
    (select count(*) from public.orders o where o.restaurant_id = r.id
        and o.created_at >= date_trunc('day', now())),
    (select coalesce(sum(o.total), 0) from public.orders o where o.restaurant_id = r.id and o.status_id = 4),
    (select coalesce(sum(o.total), 0) from public.orders o where o.restaurant_id = r.id
        and o.status_id = 4 and o.created_at >= date_trunc('day', now()))
  from public.restaurants r
  order by r.created_at desc nulls last;
end;
$$;

revoke all on function public.platform_list_restaurants() from public;
grant execute on function public.platform_list_restaurants() to authenticated, service_role;

-- 5) Detalle de un restaurante: info + staff + mesas + pedidos recientes
create or replace function public.platform_restaurant_detail(p_restaurant_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v jsonb;
begin
  if not public.is_platform_owner() then
    raise exception 'No autorizado';
  end if;

  select jsonb_build_object(
    'restaurant', (
      select to_jsonb(x) from (
        select r.id, r.restaurant_name, r.restaurant_city, r.created_at,
               r.delivery_enabled, r.delivery_slug, r.output_mode
        from public.restaurants r where r.id = p_restaurant_id
      ) x
    ),
    'staff', (
      select coalesce(jsonb_agg(
        jsonb_build_object('id', u.id, 'name', u.user_name, 'email', u.user_email, 'role_id', u.role_id)
        order by u.role_id, u.id), '[]'::jsonb)
      from public.users u where u.restaurant_id = p_restaurant_id
    ),
    'tables', (
      select coalesce(jsonb_agg(
        jsonb_build_object('id', t.id, 'number', t.table_number)
        order by t.table_number), '[]'::jsonb)
      from public.tables t where t.restaurant_id = p_restaurant_id
    ),
    'recent_orders', (
      select coalesce(jsonb_agg(o order by o.created_at desc), '[]'::jsonb)
      from (
        select o.id, o.order_number, o.total, o.status_id, o.created_at, o.table_id
        from public.orders o where o.restaurant_id = p_restaurant_id
        order by o.created_at desc limit 20
      ) o
    )
  ) into v;

  if v->'restaurant' is null then
    raise exception 'Restaurante no encontrado';
  end if;

  return v;
end;
$$;

revoke all on function public.platform_restaurant_detail(bigint) from public;
grant execute on function public.platform_restaurant_detail(bigint) to authenticated, service_role;
