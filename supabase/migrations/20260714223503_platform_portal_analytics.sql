-- Portal de proveedor: funciones analíticas de SOLO LECTURA para enriquecer
-- el dashboard (tendencia, top productos, actividad reciente cross-tenant).
-- Mismo patrón de seguridad: SECURITY DEFINER + guard is_platform_owner()
-- en la primera línea, EXECUTE solo para authenticated.

-- 1) Serie diaria de pedidos y ventas (calendario real, rellena ceros)
create or replace function public.platform_sales_timeseries(p_days integer default 30)
returns table(day date, orders bigint, revenue bigint)
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
  with days as (
    select generate_series(
      (date_trunc('day', now()) - make_interval(days => greatest(p_days, 1) - 1))::date,
      date_trunc('day', now())::date,
      interval '1 day'
    )::date as day
  )
  select
    d.day,
    count(o.id)::bigint as orders,
    coalesce(sum(o.total) filter (where o.status_id = 4), 0)::bigint as revenue
  from days d
  left join public.orders o on o.created_at::date = d.day
  group by d.day
  order by d.day;
end;
$$;

revoke all on function public.platform_sales_timeseries(integer) from public;
grant execute on function public.platform_sales_timeseries(integer) to authenticated, service_role;

-- 2) Top productos por unidades vendidas (global)
create or replace function public.platform_top_products(p_limit integer default 8)
returns table(product_name text, units bigint, revenue bigint)
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
    oi.product_name,
    sum(oi.product_quantity)::bigint as units,
    sum(oi.product_quantity * oi.product_price)::bigint as revenue
  from public.order_items oi
  group by oi.product_name
  order by units desc, revenue desc
  limit greatest(least(p_limit, 50), 1);
end;
$$;

revoke all on function public.platform_top_products(integer) from public;
grant execute on function public.platform_top_products(integer) to authenticated, service_role;

-- 3) Actividad reciente cross-tenant (últimos pedidos con restaurante y mesa)
create or replace function public.platform_recent_activity(p_limit integer default 12)
returns table(
  order_id        bigint,
  order_number    bigint,
  restaurant_id   bigint,
  restaurant_name text,
  table_number    integer,
  total           integer,
  status_id       integer,
  created_at      timestamptz
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
    o.id,
    o.order_number,
    r.id,
    r.restaurant_name::text,
    t.table_number,
    o.total,
    o.status_id,
    o.created_at
  from public.orders o
  join public.restaurants r on r.id = o.restaurant_id
  left join public.tables t on t.id = o.table_id
  order by o.created_at desc
  limit greatest(least(p_limit, 50), 1);
end;
$$;

revoke all on function public.platform_recent_activity(integer) from public;
grant execute on function public.platform_recent_activity(integer) to authenticated, service_role;
