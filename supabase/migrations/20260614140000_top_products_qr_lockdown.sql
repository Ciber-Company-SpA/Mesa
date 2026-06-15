-- ============================================================================
-- CRÍTICO: get_top_products_today exponía datos comerciales entre tenants.
--
-- Aceptaba un p_restaurant_id arbitrario y un p_from controlado por el cliente,
-- así que con solo la anon key se podía enumerar restaurantes y leer unidades
-- vendidas desde cualquier fecha (p. ej. 1970 → histórico completo).
--
-- Solución: reemplazar por get_top_products_today_qr, que:
--   1. Deriva el restaurante del qr_token (capacidad de la mesa), no de un id
--      arbitrario.
--   2. Calcula el inicio del día EN EL SERVIDOR (zona horaria del negocio),
--      eliminando el parámetro de fecha del cliente.
-- Se eliminan por completo las versiones viejas (sin función no hay grant que
-- explotar, ni siquiera el heredado de PUBLIC).
-- ============================================================================

begin;

drop function if exists public.get_top_products_today(bigint, int);
drop function if exists public.get_top_products_today(bigint, int, timestamptz);

create function public.get_top_products_today_qr(
  p_qr_token text,
  p_limit    int default 3
) returns jsonb
  language plpgsql
  stable
  security definer
  set search_path = public
as $$
declare
  v_restaurant_id bigint;
  v_day_start     timestamptz;
  v_result        jsonb;
begin
  select restaurant_id into v_restaurant_id
  from public.resolve_qr_token(p_qr_token);

  if v_restaurant_id is null then
    raise exception 'QR no válido';
  end if;

  -- Inicio del día en la zona horaria del negocio (Chile), calculado en el
  -- servidor. El cliente ya no controla la fecha.
  v_day_start := date_trunc('day', now() at time zone 'America/Santiago')
                 at time zone 'America/Santiago';

  select coalesce(jsonb_agg(row), '[]'::jsonb)
  into v_result
  from (
    select
      p.id            as id,
      p.product_name  as product_name,
      p.product_image as product_image,
      oi.variant_id   as variant_id,
      coalesce(pv.variant_name, oi.variant_name)   as variant_name,
      coalesce(pv.variant_price, oi.product_price) as unit_price,
      sum(oi.product_quantity)::int                as units_sold
    from public.order_items oi
    join public.orders   o  on o.id = oi.order_id
    join public.products p  on p.id = oi.product_id
    left join public.product_variants pv on pv.id = oi.variant_id
    where o.restaurant_id = v_restaurant_id
      and o.status_id = 4
      and o.created_at >= v_day_start
      and p.status_id = 1
    group by
      p.id, p.product_name, p.product_image,
      oi.variant_id, pv.variant_name, oi.variant_name,
      pv.variant_price, oi.product_price
    order by sum(oi.product_quantity) desc, p.product_name asc
    limit greatest(least(p_limit, 10), 1)
  ) row;

  return v_result;
end;
$$;

alter function public.get_top_products_today_qr(text, int) owner to postgres;
revoke all on function public.get_top_products_today_qr(text, int) from public;
grant execute on function public.get_top_products_today_qr(text, int) to anon, authenticated, service_role;

commit;
