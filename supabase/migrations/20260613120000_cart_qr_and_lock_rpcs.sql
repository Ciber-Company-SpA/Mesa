-- ============================================================================
-- FASE 4: cerrar la frontera del CARRITO y endurecer RPC públicas.
--
-- CRÍTICO #1: el carrito (table_cart_items) estaba expuesto: anon podía leer
--   (policy + SELECT directo) y manipular (cart_*_table_id) cualquier mesa
--   activa con un table_id inventado. Solución: revocar todo acceso directo y
--   las RPC por table_id, y reemplazarlas por RPC que reciben el qr_token (la
--   credencial de capacidad). Cada operación por fila valida que la fila
--   pertenezca a la mesa resuelta por el token.
--
-- CRÍTICO #2: las RPC viejas por table_id seguían abiertas a 'authenticated'
--   (cualquiera puede registrarse). Se revocan también a authenticated.
--
-- CRÍTICO #3: get_orders_for_table_qr devolvía TODO el historial (incl. pedidos
--   pagados de clientes anteriores). Se filtra a estados activos (1,2,3).
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- CRÍTICO #1 — RPC de carrito por QR (SECURITY DEFINER). Resuelven la mesa por
-- el token y replican la lógica de las RPC por table_id.
-- ----------------------------------------------------------------------------

-- Lectura del carrito.
create or replace function public.get_cart_qr(p_qr_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_table_id bigint;
  v_result   jsonb;
begin
  select table_id into v_table_id from public.resolve_qr_token(p_qr_token);
  if v_table_id is null then
    raise exception 'Mesa no encontrada o sin QR activo';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',         c.id,
    'product_id', c.product_id,
    'variant_id', c.variant_id,
    'quantity',   c.quantity,
    'unit_price', c.unit_price,
    'notes',      c.notes,
    'added_by',   c.added_by,
    'created_at', c.created_at,
    'products',   jsonb_build_object('product_name', p.product_name, 'product_image', p.product_image),
    'product_variants', case
      when c.variant_id is null then null
      else jsonb_build_object('variant_name', pv.variant_name, 'variant_image', pv.variant_image)
    end
  ) order by c.created_at asc), '[]'::jsonb)
  into v_result
  from public.table_cart_items c
  left join public.products p on p.id = c.product_id
  left join public.product_variants pv on pv.id = c.variant_id
  where c.table_id = v_table_id;

  return v_result;
end;
$$;

-- Agregar ítem.
create or replace function public.cart_add_item_qr(
  p_qr_token   text,
  p_product_id bigint,
  p_variant_id bigint,
  p_quantity   integer,
  p_notes      text,
  p_added_by   text
) returns void
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_table_id      bigint;
  v_restaurant_id bigint;
  v_price         int;
  v_qty           int;
  v_notes         text;
  v_existing_id   uuid;
begin
  select table_id, restaurant_id into v_table_id, v_restaurant_id
  from public.resolve_qr_token(p_qr_token);
  if v_table_id is null then
    raise exception 'Mesa no encontrada o sin QR activo';
  end if;

  v_qty := coalesce(p_quantity, 1);
  if v_qty < 1 or v_qty > 20 then
    raise exception 'Cantidad inválida (1-20)';
  end if;

  v_notes := nullif(left(coalesce(p_notes, ''), 250), '');

  v_price := public.cart_resolve_price(v_restaurant_id, p_product_id, p_variant_id);
  if v_price is null then
    raise exception 'Producto o variante no pertenece al restaurante de la mesa';
  end if;

  select id into v_existing_id
  from public.table_cart_items
  where table_id = v_table_id
    and product_id = p_product_id
    and variant_id is not distinct from p_variant_id
    and notes is not distinct from v_notes
  limit 1;

  if v_existing_id is not null then
    update public.table_cart_items
    set quantity = quantity + v_qty
    where id = v_existing_id;
  else
    insert into public.table_cart_items
      (restaurant_id, table_id, product_id, variant_id, unit_price, quantity, notes, added_by)
    values
      (v_restaurant_id, v_table_id, p_product_id, p_variant_id, v_price, v_qty, v_notes,
       nullif(left(coalesce(p_added_by, ''), 100), ''));
  end if;
end;
$$;

-- Actualizar cantidad (valida que la fila sea de la mesa del token).
create or replace function public.cart_update_quantity_qr(
  p_qr_token text,
  p_row_id   uuid,
  p_quantity integer
) returns void
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_table_id     bigint;
  v_row_table_id bigint;
begin
  select table_id into v_table_id from public.resolve_qr_token(p_qr_token);
  if v_table_id is null then
    raise exception 'Mesa no encontrada o sin QR activo';
  end if;

  if p_quantity < 1 or p_quantity > 20 then
    raise exception 'Cantidad inválida (1-20)';
  end if;

  select table_id into v_row_table_id from public.table_cart_items where id = p_row_id;
  if v_row_table_id is null or v_row_table_id <> v_table_id then
    raise exception 'El ítem no pertenece a esta mesa';
  end if;

  update public.table_cart_items set quantity = p_quantity where id = p_row_id;
end;
$$;

-- Eliminar ítem (valida que la fila sea de la mesa del token).
create or replace function public.cart_remove_item_qr(
  p_qr_token text,
  p_row_id   uuid
) returns void
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_table_id     bigint;
  v_row_table_id bigint;
begin
  select table_id into v_table_id from public.resolve_qr_token(p_qr_token);
  if v_table_id is null then
    raise exception 'Mesa no encontrada o sin QR activo';
  end if;

  select table_id into v_row_table_id from public.table_cart_items where id = p_row_id;
  if v_row_table_id is null then
    return; -- ya no existe
  end if;
  if v_row_table_id <> v_table_id then
    raise exception 'El ítem no pertenece a esta mesa';
  end if;

  delete from public.table_cart_items where id = p_row_id;
end;
$$;

-- Vaciar el carrito de la mesa.
create or replace function public.cart_clear_qr(p_qr_token text)
returns void
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_table_id bigint;
begin
  select table_id into v_table_id from public.resolve_qr_token(p_qr_token);
  if v_table_id is null then
    raise exception 'Mesa no encontrada o sin QR activo';
  end if;

  delete from public.table_cart_items where table_id = v_table_id;
end;
$$;

-- Permisos de las RPC nuevas.
do $$
declare fn text;
begin
  foreach fn in array array[
    'public.get_cart_qr(text)',
    'public.cart_add_item_qr(text, bigint, bigint, integer, text, text)',
    'public.cart_update_quantity_qr(text, uuid, integer)',
    'public.cart_remove_item_qr(text, uuid)',
    'public.cart_clear_qr(text)'
  ] loop
    execute format('alter function %s owner to postgres', fn);
    execute format('revoke all on function %s from public', fn);
    execute format('grant execute on function %s to anon, authenticated, service_role', fn);
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- CRÍTICO #1 (cierre) — quitar el acceso DIRECTO al carrito y las RPC viejas.
-- ----------------------------------------------------------------------------
revoke select on public.table_cart_items from anon;
revoke select on public.table_cart_items from authenticated;

-- La policy de lectura directa ya no aplica (no hay SELECT directo): se elimina.
drop policy if exists "cart read for active table" on public.table_cart_items;

revoke execute on function public.cart_add_item(bigint, bigint, bigint, integer, text, text) from anon, authenticated;
revoke execute on function public.cart_update_quantity(uuid, integer) from anon, authenticated;
revoke execute on function public.cart_remove_item(uuid) from anon, authenticated;
revoke execute on function public.cart_clear(bigint) from anon, authenticated;

-- ----------------------------------------------------------------------------
-- CRÍTICO #2 — revocar las RPC públicas viejas (por table_id) también a
-- authenticated. El staff usa la sesión, no estas RPC.
-- ----------------------------------------------------------------------------
revoke execute on function public.claim_diner_slot(bigint, text)            from authenticated;
revoke execute on function public.get_orders_for_table(bigint)              from authenticated;
revoke execute on function public.create_public_order(bigint, jsonb, text)  from authenticated;
revoke execute on function public.request_bill(bigint, text)                from authenticated;

-- ----------------------------------------------------------------------------
-- CRÍTICO #3 — get_orders_for_table_qr solo devuelve pedidos ACTIVOS (1,2,3),
-- nunca el historial pagado de clientes anteriores.
-- ----------------------------------------------------------------------------
create or replace function public.get_orders_for_table_qr(p_qr_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_table_id bigint;
  v_result   jsonb;
begin
  select table_id into v_table_id from public.resolve_qr_token(p_qr_token);
  if v_table_id is null then
    raise exception 'Mesa no encontrada o sin QR activo';
  end if;

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
    where o.table_id = v_table_id
      and o.status_id in (1, 2, 3)  -- solo pedidos activos; nunca pagados (4)
  ) t;

  return v_result;
end;
$$;

alter function public.get_orders_for_table_qr(text) owner to postgres;
revoke all on function public.get_orders_for_table_qr(text) from public;
grant execute on function public.get_orders_for_table_qr(text) to anon, authenticated, service_role;

commit;
