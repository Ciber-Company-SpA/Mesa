-- ============================================================================
-- CONTROL DE DISPONIBILIDAD POR STOCK — CONFIGURABLE
--
-- Hoy el stock oculta/bloquea un producto de forma automática y rígida: si
-- CUALQUIER insumo de su receta no alcanza, el producto aparece "no disponible"
-- y no se puede pedir. Se vuelve configurable desde el panel del cliente en dos
-- niveles que se complementan:
--
--   NIVEL 1 (global, restaurants.stock_menu_mode):
--     - 'block' : comportamiento actual (el stock oculta/bloquea).
--     - 'info'  : el stock NUNCA oculta ni bloquea; solo alimenta las alertas
--                 internas de inventario.
--
--   NIVEL 2 (por línea de receta, product_recipes.bloquea):
--     - true  : insumo CRÍTICO (su falta oculta/bloquea el producto).
--     - false : insumo OPCIONAL (se descuenta pero su falta NO bloquea).
--
--   Interacción: en modo 'block', solo los insumos críticos ocultan/bloquean.
--   En modo 'info', nada oculta/bloquea (el nivel 2 es irrelevante).
--
-- El comensal, cuando el stock NO bloquea, ve el producto normal (sin señales).
-- El stock se descuenta SIEMPRE (aunque quede negativo) para que el inventario
-- y las alertas reflejen el consumo real.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1) Columnas de configuración.
-- ----------------------------------------------------------------------------
alter table public.restaurants
  add column if not exists stock_menu_mode text not null default 'block';
alter table public.restaurants
  drop constraint if exists restaurants_stock_menu_mode_chk;
alter table public.restaurants
  add constraint restaurants_stock_menu_mode_chk check (stock_menu_mode in ('block', 'info'));

alter table public.product_recipes
  add column if not exists bloquea boolean not null default true;

-- ----------------------------------------------------------------------------
-- 2) Recalcular disponibilidad respetando el modo del restaurante y solo los
--    insumos críticos (bloquea = true).
-- ----------------------------------------------------------------------------
create or replace function public.mesa_recompute_target_availability(
  p_product_id bigint,
  p_variant_id bigint
) returns void
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_short boolean;
  v_mode  text;
begin
  -- Modo de control de stock del restaurante dueño del destino.
  if p_variant_id is not null then
    select r.stock_menu_mode into v_mode
    from public.product_variants pv
    join public.products p    on p.id = pv.product_id
    join public.restaurants r on r.id = p.restaurant_id
    where pv.id = p_variant_id;
  elsif p_product_id is not null then
    select r.stock_menu_mode into v_mode
    from public.products p
    join public.restaurants r on r.id = p.restaurant_id
    where p.id = p_product_id;
  end if;

  if coalesce(v_mode, 'block') = 'info' then
    -- El stock no controla la disponibilidad: nunca se marca agotado por stock.
    v_short := false;

  elsif p_variant_id is not null then
    select exists (
      select 1
      from public.product_recipes r
      join public.ingredients i on i.id = r.ingredient_id
      where r.variant_id = p_variant_id
        and r.bloquea
        and i.stock_actual < r.cantidad
    ) into v_short;

  elsif p_product_id is not null then
    select exists (
      select 1
      from public.product_recipes r
      join public.ingredients i on i.id = r.ingredient_id
      where r.product_id = p_product_id
        and r.bloquea
        and i.stock_actual < r.cantidad
    ) into v_short;
  end if;

  if p_variant_id is not null then
    update public.product_variants
      set stock_out = coalesce(v_short, false)
      where id = p_variant_id
        and stock_out is distinct from coalesce(v_short, false);
  elsif p_product_id is not null then
    update public.products
      set stock_out = coalesce(v_short, false)
      where id = p_product_id
        and stock_out is distinct from coalesce(v_short, false);
  end if;
end;
$$;

alter function public.mesa_recompute_target_availability(bigint, bigint) owner to postgres;

-- ----------------------------------------------------------------------------
-- 3) set_product_recipe: persistir el flag `bloquea` por línea.
--    Cuerpo idéntico al original, agregando la columna bloquea en el insert.
-- ----------------------------------------------------------------------------
create or replace function public.set_product_recipe(
  p_product_id bigint,
  p_variant_id bigint,
  p_items      jsonb
) returns void
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_rest        bigint;
  v_target_rest bigint;
  v_item        jsonb;
  v_ing_id      bigint;
  v_cantidad    numeric;
  v_bloquea     boolean;
  v_ing_rest    bigint;
begin
  if not public.current_user_is_admin() then
    raise exception 'no autorizado';
  end if;

  v_rest := public.current_user_restaurant_id();
  if v_rest is null then
    raise exception 'usuario sin restaurante';
  end if;

  if (p_product_id is not null)::int + (p_variant_id is not null)::int <> 1 then
    raise exception 'debe indicar producto o variante (exactamente uno)';
  end if;

  if p_variant_id is not null then
    select p.restaurant_id into v_target_rest
    from public.product_variants pv
    join public.products p on p.id = pv.product_id
    where pv.id = p_variant_id;
  else
    select p.restaurant_id into v_target_rest
    from public.products p
    where p.id = p_product_id;
  end if;

  if v_target_rest is null or v_target_rest <> v_rest then
    raise exception 'el producto/variante no pertenece a tu restaurante';
  end if;

  if p_items is not null and jsonb_typeof(p_items) <> 'array' then
    raise exception 'items inválido';
  end if;

  if p_variant_id is not null then
    delete from public.product_recipes where variant_id = p_variant_id;
  else
    delete from public.product_recipes where product_id = p_product_id;
  end if;

  if p_items is not null then
    for v_item in select * from jsonb_array_elements(p_items)
    loop
      v_ing_id   := (v_item->>'ingredient_id')::bigint;
      v_cantidad := (v_item->>'cantidad')::numeric;
      v_bloquea  := coalesce((v_item->>'bloquea')::boolean, true);

      if v_ing_id is null or coalesce(v_cantidad, 0) <= 0 then
        raise exception 'línea de receta inválida';
      end if;

      select restaurant_id into v_ing_rest from public.ingredients where id = v_ing_id;
      if v_ing_rest is null or v_ing_rest <> v_rest then
        raise exception 'insumo % no pertenece a tu restaurante', v_ing_id;
      end if;

      insert into public.product_recipes
        (restaurant_id, product_id, variant_id, ingredient_id, cantidad, bloquea)
      values
        (v_rest, p_product_id, p_variant_id, v_ing_id, v_cantidad, v_bloquea);
    end loop;
  end if;

  perform public.mesa_recompute_target_availability(p_product_id, p_variant_id);
end;
$$;

alter function public.set_product_recipe(bigint, bigint, jsonb) owner to postgres;

-- ----------------------------------------------------------------------------
-- 4) create_public_order_qr: descuenta SIEMPRE; bloquea solo si el restaurante
--    controla el stock (modo 'block') y el insumo es crítico (bloquea = true).
--    Cuerpo idéntico a 20260627000000, con esos dos cambios.
-- ----------------------------------------------------------------------------
create or replace function public.create_public_order_qr(
  p_qr_token    text,
  p_items       jsonb,
  p_diner_token text default null
) returns jsonb
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_table_id        bigint;
  v_restaurant_id   bigint;
  v_order_id        bigint;
  v_initial_status  int;
  v_order_dest      text;
  v_stock_mode      text;
  v_item            jsonb;
  v_product_id      bigint;
  v_variant_id      bigint;
  v_qty             int;
  v_notes           text;
  v_unit_price      numeric;
  v_product_name    text;
  v_variant_name    text;
  v_product_status  int;
  v_total           numeric := 0;
  v_item_count      int;
  v_created_at      timestamptz;
  v_status_name     text;
  v_diner_slot      int;
  v_diner_label     text;
  v_diner_payload   jsonb;
  v_recipe          record;
  v_needed          numeric;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'items inválido';
  end if;

  v_item_count := jsonb_array_length(p_items);
  if v_item_count < 1 or v_item_count > 30 then
    raise exception 'El pedido debe tener entre 1 y 30 líneas';
  end if;

  select table_id, restaurant_id into v_table_id, v_restaurant_id
  from public.resolve_qr_token(p_qr_token);

  if v_table_id is null then
    raise exception 'Mesa no encontrada o sin QR activo';
  end if;

  if public.is_table_reserved_now(v_table_id) then
    raise exception 'Esta mesa está reservada en este horario';
  end if;

  perform public.rate_limit_check('order:' || v_table_id, 15, 60);

  if p_diner_token is not null and length(p_diner_token) >= 8 then
    v_diner_payload := public.claim_diner_slot_qr(p_qr_token, p_diner_token);
    v_diner_slot    := (v_diner_payload->>'slot')::int;
    v_diner_label   := v_diner_payload->>'label';
  end if;

  select r.order_destination, r.stock_menu_mode
    into v_order_dest, v_stock_mode
  from public.restaurants r
  where r.id = v_restaurant_id;

  v_initial_status := case when v_order_dest = 'kitchen' then 2 else 1 end;

  insert into public.orders
    (table_id, restaurant_id, total, status_id, created_at, diner_slot, diner_label)
  values
    (v_table_id, v_restaurant_id, 0, v_initial_status, now(), v_diner_slot, v_diner_label)
  returning id, created_at into v_order_id, v_created_at;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_product_id := (v_item->>'product_id')::bigint;
    v_variant_id := nullif(v_item->>'variant_id', '')::bigint;
    v_qty        := coalesce((v_item->>'quantity')::int, 0);
    v_notes      := left(coalesce(v_item->>'notes', ''), 250);

    if v_qty < 1 or v_qty > 20 then
      raise exception 'Cantidad inválida (1-20) para product_id %', v_product_id;
    end if;

    select p.product_name, p.product_price, p.status_id
      into v_product_name, v_unit_price, v_product_status
    from public.products p
    where p.id = v_product_id
      and p.restaurant_id = v_restaurant_id;

    if v_product_name is null then
      raise exception 'Producto % no pertenece al restaurante de la mesa', v_product_id;
    end if;

    if v_product_status <> 1 then
      raise exception 'El producto "%" no está disponible', v_product_name;
    end if;

    v_variant_name := null;

    if v_variant_id is not null then
      select pv.variant_price, pv.variant_name
        into v_unit_price, v_variant_name
      from public.product_variants pv
      where pv.id = v_variant_id
        and pv.product_id = v_product_id;

      if v_variant_name is null then
        raise exception 'La variante % no pertenece al producto %', v_variant_id, v_product_id;
      end if;
    end if;

    -- DESCUENTO DE STOCK POR RECETA.
    -- Se descuenta siempre (alimenta inventario/alertas, incluso a negativo).
    -- Se BLOQUEA la venta solo si el restaurante controla el stock (modo 'block')
    -- Y el insumo es crítico (bloquea = true) y no alcanza. Mensaje genérico.
    for v_recipe in
      select r.ingredient_id, r.cantidad, r.bloquea, i.stock_actual
      from public.product_recipes r
      join public.ingredients i on i.id = r.ingredient_id
      where (v_variant_id is not null and r.variant_id = v_variant_id)
         or (v_variant_id is null     and r.product_id = v_product_id)
      for update of i
    loop
      v_needed := v_recipe.cantidad * v_qty;

      if v_stock_mode = 'block' and v_recipe.bloquea and v_recipe.stock_actual < v_needed then
        raise exception 'El producto "%" ya no está disponible',
          coalesce(v_variant_name, v_product_name);
      end if;

      insert into public.stock_movements
        (restaurant_id, ingredient_id, delta, motivo, order_id)
      values
        (v_restaurant_id, v_recipe.ingredient_id, -v_needed, 'venta', v_order_id);
    end loop;

    insert into public.order_items
      (order_id, product_id, product_quantity, product_name, product_price,
       notes, variant_id, variant_name)
    values
      (v_order_id, v_product_id, v_qty, v_product_name, v_unit_price,
       nullif(v_notes, ''), v_variant_id, v_variant_name);

    v_total := v_total + (v_unit_price * v_qty);
  end loop;

  update public.orders set total = round(v_total)::int where id = v_order_id;

  select s.status_name into v_status_name
  from public.order_status s
  where s.id = v_initial_status;

  return jsonb_build_object(
    'id',            v_order_id,
    'status_id',     v_initial_status,
    'status_name',   v_status_name,
    'created_at',    v_created_at,
    'table_id',      v_table_id,
    'restaurant_id', v_restaurant_id,
    'total',         round(v_total)::int,
    'diner_slot',    v_diner_slot,
    'diner_label',   v_diner_label
  );
end;
$$;

alter function public.create_public_order_qr(text, jsonb, text) owner to postgres;
revoke all on function public.create_public_order_qr(text, jsonb, text) from public;
grant execute on function public.create_public_order_qr(text, jsonb, text) to anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 5) Cambiar el modo global (admin). Al cambiarlo, recalcula la disponibilidad
--    de todos los destinos con receta para que el menú refleje el modo al
--    instante (p.ej. pasar a 'info' des-oculta lo que estaba agotado por stock).
-- ----------------------------------------------------------------------------
create or replace function public.set_stock_menu_mode(p_mode text)
  returns void
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_rid bigint;
  r     record;
begin
  if not public.current_user_is_admin() then
    raise exception 'no autorizado';
  end if;
  if p_mode not in ('block', 'info') then
    raise exception 'modo inválido';
  end if;

  v_rid := public.current_user_restaurant_id();
  if v_rid is null then
    raise exception 'usuario sin restaurante';
  end if;

  update public.restaurants set stock_menu_mode = p_mode where id = v_rid;

  for r in
    select distinct product_id, variant_id
    from public.product_recipes
    where restaurant_id = v_rid
  loop
    perform public.mesa_recompute_target_availability(r.product_id, r.variant_id);
  end loop;
end;
$$;

alter function public.set_stock_menu_mode(text) owner to postgres;
revoke all on function public.set_stock_menu_mode(text) from public, anon;
grant execute on function public.set_stock_menu_mode(text) to authenticated, service_role;

commit;
