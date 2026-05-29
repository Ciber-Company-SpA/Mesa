-- Devuelve las órdenes ACTIVAS de la mesa cuyo qr_code coincide.
-- Seguridad: el cliente debe conocer el qr_code (no enumerable).
-- Reemplaza el SELECT directo a orders por parte del cliente anónimo.
create or replace function public.get_orders_by_qr(p_qr_code text)
returns table (
  id bigint,
  total integer,
  status_id integer,
  created_at timestamp with time zone,
  ready_at timestamp with time zone,
  status_name text,
  items jsonb
)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_table_id bigint;
begin
  -- Resolver la mesa desde el qr_code (debe existir y estar activo)
  select t.id into v_table_id
  from tables t
  join table_qr_codes q on q.id = t.qr_code_id
  where q.qr_code = p_qr_code
    and q.qr_active = true;

  if v_table_id is null then
    raise exception 'QR no válido';
  end if;

  return query
  select
    o.id,
    o.total,
    o.status_id,
    o.created_at,
    o.ready_at,
    os.status_name,
    coalesce(
      (select jsonb_agg(jsonb_build_object(
        'id', oi.id,
        'product_name', oi.product_name,
        'product_price', oi.product_price,
        'product_quantity', oi.product_quantity,
        'notes', oi.notes
      ))
      from order_items oi where oi.order_id = o.id),
      '[]'::jsonb
    ) as items
  from orders o
  left join order_status os on os.id = o.status_id
  where o.table_id = v_table_id
  order by o.created_at desc;
end $$;

-- El cliente anónimo puede llamar esta función (la seguridad está adentro)
grant execute on function public.get_orders_by_qr(text) to anon, authenticated;