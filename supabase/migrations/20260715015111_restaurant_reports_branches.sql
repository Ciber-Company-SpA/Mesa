-- Bloque C: funciones de reportes avanzados y multi-sucursal para el panel
-- del restaurante. SECURITY DEFINER con guard de admin del propio restaurante
-- (current_user_is_admin + current_user_restaurant_id); nunca exponen datos
-- de restaurantes ajenos.

-- C4: margen y rentabilidad por producto (ingreso vs costo de receta)
create or replace function public.get_product_margins(
  p_restaurant_id bigint, p_from timestamptz, p_to timestamptz
)
returns table(
  product_name text, units bigint, revenue numeric,
  unit_cost numeric, total_cost numeric, margin numeric, margin_pct numeric
)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not (public.current_user_is_admin() and public.current_user_restaurant_id() = p_restaurant_id) then
    raise exception 'No autorizado';
  end if;

  return query
  with sold as (
    select oi.product_id,
           oi.product_name,
           sum(oi.product_quantity)::bigint as units,
           sum(oi.product_quantity * oi.product_price)::numeric as revenue
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
    where o.restaurant_id = p_restaurant_id
      and o.status_id = 4
      and o.created_at >= p_from and o.created_at < p_to
    group by oi.product_id, oi.product_name
  ),
  cost as (
    select pr.product_id, sum(pr.cantidad * ing.precio)::numeric as unit_cost
    from public.product_recipes pr
    join public.ingredients ing on ing.id = pr.ingredient_id
    where pr.restaurant_id = p_restaurant_id and pr.product_id is not null
    group by pr.product_id
  )
  select
    s.product_name,
    s.units,
    s.revenue,
    coalesce(c.unit_cost, 0),
    (coalesce(c.unit_cost, 0) * s.units),
    (s.revenue - coalesce(c.unit_cost, 0) * s.units),
    case when s.revenue > 0
      then round(((s.revenue - coalesce(c.unit_cost, 0) * s.units) / s.revenue) * 100, 1)
      else 0 end
  from sold s
  left join cost c on c.product_id = s.product_id
  order by s.revenue desc;
end;
$$;

-- C5: ventas y pedidos por hora del día (hora local de Chile)
create or replace function public.get_peak_hours(
  p_restaurant_id bigint, p_from timestamptz, p_to timestamptz
)
returns table(hour integer, orders bigint, revenue numeric)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not (public.current_user_is_admin() and public.current_user_restaurant_id() = p_restaurant_id) then
    raise exception 'No autorizado';
  end if;

  return query
  select
    h.hour::integer,
    count(o.id)::bigint,
    coalesce(sum(o.total) filter (where o.status_id = 4), 0)::numeric
  from generate_series(0, 23) as h(hour)
  left join public.orders o
    on extract(hour from (o.created_at at time zone 'America/Santiago')) = h.hour
   and o.restaurant_id = p_restaurant_id
   and o.created_at >= p_from and o.created_at < p_to
  group by h.hour
  order by h.hour;
end;
$$;

-- C6: sucursales del grupo del restaurante del admin (consolidado read-only).
-- Devuelve vacío si el restaurante no pertenece a ninguna organización.
create or replace function public.get_my_organization_branches()
returns table(
  restaurant_id bigint, restaurant_name text,
  orders_total bigint, revenue_total numeric, tables_count bigint, is_current boolean
)
language plpgsql stable security definer set search_path = public
as $$
declare
  v_rid bigint;
  v_org bigint;
begin
  if not public.current_user_is_admin() then raise exception 'No autorizado'; end if;
  v_rid := public.current_user_restaurant_id();
  select organization_id into v_org from public.restaurant_accounts where restaurant_id = v_rid;
  if v_org is null then return; end if;

  return query
  select
    r.id,
    r.restaurant_name::text,
    (select count(*) from public.orders o where o.restaurant_id = r.id)::bigint,
    (select coalesce(sum(o.total), 0) from public.orders o where o.restaurant_id = r.id and o.status_id = 4)::numeric,
    (select count(*) from public.tables t where t.restaurant_id = r.id)::bigint,
    (r.id = v_rid)
  from public.restaurant_accounts ra
  join public.restaurants r on r.id = ra.restaurant_id
  where ra.organization_id = v_org
  order by r.restaurant_name;
end;
$$;

do $$
declare fn text;
begin
  for fn in
    select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in ('get_product_margins','get_peak_hours','get_my_organization_branches')
  loop
    execute format('revoke all on function %s from public, anon', fn);
    execute format('grant execute on function %s to authenticated, service_role', fn);
  end loop;
end $$;
