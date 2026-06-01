-- RPC para que el cliente público (anon) pueda ver los pedidos de SU mesa
-- desde el menú. No abrimos SELECT genérico en orders/order_items porque
-- expondría pedidos de otras mesas/restaurantes.

begin;

create or replace function public.get_orders_for_table(p_table_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_result jsonb;
begin
  select coalesce(jsonb_agg(t order by t.created_at desc), '[]'::jsonb)
  into v_result
  from (
    select
      o.id,
      o.total,
      o.status_id,
      o.created_at,
      o.ready_at,
      jsonb_build_object('status_name', s.status_name) as order_status,
      (
        select coalesce(jsonb_agg(jsonb_build_object(
          'id', oi.id,
          'product_name', oi.product_name,
          'variant_name', oi.variant_name,
          'product_price', oi.product_price,
          'product_quantity', oi.product_quantity,
          'notes', oi.notes
        )), '[]'::jsonb)
        from public.order_items oi
        where oi.order_id = o.id
      ) as order_items
    from public.orders o
    left join public.order_status s on s.id = o.status_id
    where o.table_id = p_table_id
  ) t;

  return v_result;
end;
$$;

revoke all on function public.get_orders_for_table(bigint) from public;
grant execute on function public.get_orders_for_table(bigint) to anon, authenticated;

commit;
