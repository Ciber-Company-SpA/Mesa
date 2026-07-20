-- ============================================================================
-- PROMOCIONES paso 3 (backend del pedido): mostrar las promos en el menú del
-- comensal y permitir pedirlas como COMBO DE 1 LÍNEA.
--   * table_cart_items admite líneas de promo (product_id XOR promotion_id).
--   * cart_add_promo_qr agrega una promo al carrito compartido.
--   * get_cart_qr devuelve el nombre/imagen de la promo en esas líneas.
--   * get_public_menu expone las promos activas y disponibles.
--   * create_public_order_qr registra la promo como 1 order_item (precio de
--     promo, detalle en notes) y descuenta el stock de CADA componente.
-- ============================================================================

-- 1) Esquema: líneas de promo en el carrito y trazabilidad en el pedido.
alter table public.table_cart_items add column if not exists promotion_id bigint
  references public.promotions(id) on delete cascade;
alter table public.table_cart_items alter column product_id drop not null;

alter table public.table_cart_items drop constraint if exists table_cart_items_kind_check;
alter table public.table_cart_items add constraint table_cart_items_kind_check
  check ((product_id is not null)::int + (promotion_id is not null)::int = 1);

create index if not exists idx_table_cart_items_promotion on public.table_cart_items (promotion_id);

alter table public.order_items add column if not exists promotion_id bigint
  references public.promotions(id) on delete set null;

-- ----------------------------------------------------------------------------
-- 2) cart_add_promo_qr: agrega una promoción al carrito de la mesa (una línea).
-- ----------------------------------------------------------------------------
create or replace function public.cart_add_promo_qr(
  p_qr_token     text,
  p_promotion_id bigint,
  p_quantity     integer,
  p_added_by     text
) returns void
  language plpgsql security definer set search_path = public
as $$
declare
  v_table_id      bigint;
  v_restaurant_id bigint;
  v_qty           int;
  v_price         int;
  v_unavailable   int;
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

  select pr.promo_price into v_price
  from public.promotions pr
  where pr.id = p_promotion_id and pr.restaurant_id = v_restaurant_id and pr.active;
  if v_price is null then
    raise exception 'La promoción no está disponible';
  end if;

  -- Debe tener al menos un producto y todos disponibles.
  select count(*) into v_unavailable
  from public.promotion_items pi
  join public.products p on p.id = pi.product_id
  where pi.promotion_id = p_promotion_id and p.status_id <> 1;
  if v_unavailable > 0 then
    raise exception 'La promoción no está disponible';
  end if;
  if not exists (select 1 from public.promotion_items pi where pi.promotion_id = p_promotion_id) then
    raise exception 'La promoción no está disponible';
  end if;

  select id into v_existing_id
  from public.table_cart_items
  where table_id = v_table_id and promotion_id = p_promotion_id
  limit 1;

  if v_existing_id is not null then
    update public.table_cart_items set quantity = quantity + v_qty where id = v_existing_id;
  else
    insert into public.table_cart_items
      (restaurant_id, table_id, product_id, variant_id, promotion_id, unit_price, quantity, added_by)
    values
      (v_restaurant_id, v_table_id, null, null, p_promotion_id, v_price, v_qty,
       nullif(left(coalesce(p_added_by, ''), 100), ''));
  end if;
end;
$$;

alter function public.cart_add_promo_qr(text, bigint, integer, text) owner to postgres;
revoke all on function public.cart_add_promo_qr(text, bigint, integer, text) from public;
grant execute on function public.cart_add_promo_qr(text, bigint, integer, text) to anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 3) get_cart_qr: agrega promotion_id y datos de la promo a las líneas.
--    Cuerpo idéntico al vigente (20260613120000) + join a promotions.
-- ----------------------------------------------------------------------------
create or replace function public.get_cart_qr(p_qr_token text)
returns jsonb
language plpgsql stable security definer set search_path = public
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
    'promotion_id', c.promotion_id,
    'quantity',   c.quantity,
    'unit_price', c.unit_price,
    'notes',      c.notes,
    'added_by',   c.added_by,
    'created_at', c.created_at,
    'products',   case when c.product_id is null then null
      else jsonb_build_object('product_name', p.product_name, 'product_image', p.product_image) end,
    'product_variants', case
      when c.variant_id is null then null
      else jsonb_build_object('variant_name', pv.variant_name, 'variant_image', pv.variant_image)
    end,
    'promotion',  case when c.promotion_id is null then null
      else jsonb_build_object('name', pr.name, 'image_url', pr.image_url) end
  ) order by c.created_at asc), '[]'::jsonb)
  into v_result
  from public.table_cart_items c
  left join public.products p on p.id = c.product_id
  left join public.product_variants pv on pv.id = c.variant_id
  left join public.promotions pr on pr.id = c.promotion_id
  where c.table_id = v_table_id;

  return v_result;
end;
$$;

alter function public.get_cart_qr(text) owner to postgres;
revoke all on function public.get_cart_qr(text) from public;
grant execute on function public.get_cart_qr(text) to anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 4) get_public_menu: agrega la clave 'promotions' (activas, con todos los
--    productos disponibles). Cuerpo idéntico al vigente (20260627000000) + esa
--    clave.
-- ----------------------------------------------------------------------------
create or replace function public.get_public_menu(p_qr_token text)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_table   record;
  v_result  jsonb;
begin
  select * into v_table from public.resolve_qr_token(p_qr_token);

  if v_table.table_id is null then
    raise exception 'QR no válido';
  end if;

  select jsonb_build_object(
    'restaurant', (
      select jsonb_build_object(
        'id',              r.id,
        'restaurant_name', r.restaurant_name,
        'restaurant_logo', r.restaurant_logo,
        'menu_template',   r.menu_template
      )
      from public.restaurants r
      where r.id = v_table.restaurant_id
    ),
    'categories', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id',            c.id,
        'category_name', c.category_name
      ) order by c.id), '[]'::jsonb)
      from public.categories c
      where c.restaurant_id = v_table.restaurant_id
    ),
    'products', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id',             p.id,
        'product_name',   p.product_name,
        'product_price',  p.product_price,
        'product_image',  p.product_image,
        'product_description', p.product_description,
        'status_id',      p.status_id,
        'category_id',    p.category_id,
        'categories',     jsonb_build_object('category_name', pc.category_name),
        'product_variants', (
          select coalesce(jsonb_agg(jsonb_build_object(
            'id',            pv.id,
            'variant_name',  pv.variant_name,
            'variant_price', pv.variant_price
          ) order by pv.id), '[]'::jsonb)
          from public.product_variants pv
          where pv.product_id = p.id
        )
      ) order by p.id), '[]'::jsonb)
      from public.products p
      left join public.categories pc on pc.id = p.category_id
      where p.restaurant_id = v_table.restaurant_id
    ),
    'promotions', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id',          pr.id,
        'name',        pr.name,
        'description', pr.description,
        'promo_price', pr.promo_price,
        'image_url',   pr.image_url,
        'original_total', (
          select coalesce(sum(coalesce(pv.variant_price, p.product_price) * pi.quantity), 0)
          from public.promotion_items pi
          join public.products p on p.id = pi.product_id
          left join public.product_variants pv on pv.id = pi.variant_id
          where pi.promotion_id = pr.id
        ),
        'items', (
          select coalesce(jsonb_agg(jsonb_build_object(
            'product_name', p.product_name,
            'variant_name', pv.variant_name,
            'quantity',     pi.quantity
          ) order by pi.id), '[]'::jsonb)
          from public.promotion_items pi
          join public.products p on p.id = pi.product_id
          left join public.product_variants pv on pv.id = pi.variant_id
          where pi.promotion_id = pr.id
        )
      ) order by pr.sort_order, pr.id), '[]'::jsonb)
      from public.promotions pr
      where pr.restaurant_id = v_table.restaurant_id
        and pr.active
        and exists (select 1 from public.promotion_items pi where pi.promotion_id = pr.id)
        and not exists (
          select 1 from public.promotion_items pi
          join public.products p on p.id = pi.product_id
          where pi.promotion_id = pr.id and p.status_id <> 1
        )
    ),
    'tableId',     v_table.table_id,
    'tableNumber', v_table.table_number,
    'reservation', (
      select jsonb_build_object('ends_at', tr.ends_at)
      from public.table_reservations tr
      where tr.table_id = v_table.table_id
        and tr.status = 'active'
        and now() >= tr.starts_at
        and now() <  tr.ends_at
      order by tr.starts_at
      limit 1
    )
  ) into v_result;

  return v_result;
end;
$$;

alter function public.get_public_menu(text) owner to postgres;
revoke all on function public.get_public_menu(text) from public;
grant execute on function public.get_public_menu(text) to anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 5) create_public_order_qr: soporta líneas de promo (promotion_id en el item).
--    Cuerpo idéntico al vigente (20260720120000) + rama de promo al inicio del
--    loop. La promo se registra como 1 order_item a precio de promo y descuenta
--    el stock de cada componente (misma regla de bloqueo que un producto).
-- ----------------------------------------------------------------------------
create or replace function public.create_public_order_qr(
  p_qr_token    text,
  p_items       jsonb,
  p_diner_token text default null
) returns jsonb
  language plpgsql security definer set search_path = public
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
  v_promotion_id    bigint;
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
  v_promo_name      text;
  v_promo_price     int;
  v_detail          text;
  v_comp            record;
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
    v_promotion_id := nullif(v_item->>'promotion_id', '')::bigint;
    v_qty          := coalesce((v_item->>'quantity')::int, 0);

    if v_qty < 1 or v_qty > 20 then
      raise exception 'Cantidad inválida (1-20)';
    end if;

    -- ===== RAMA PROMOCIÓN (combo de 1 línea) =====
    if v_promotion_id is not null then
      select pr.name, pr.promo_price into v_promo_name, v_promo_price
      from public.promotions pr
      where pr.id = v_promotion_id and pr.restaurant_id = v_restaurant_id and pr.active;
      if v_promo_name is null then
        raise exception 'La promoción ya no está disponible';
      end if;

      v_detail := '';
      for v_comp in
        select pi.product_id, pi.variant_id, pi.quantity as comp_qty,
               p.product_name, p.status_id, pv.variant_name
        from public.promotion_items pi
        join public.products p on p.id = pi.product_id
        left join public.product_variants pv on pv.id = pi.variant_id
        where pi.promotion_id = v_promotion_id
        order by pi.id
      loop
        if v_comp.status_id <> 1 then
          raise exception 'La promoción "%" no está disponible', v_promo_name;
        end if;

        v_detail := v_detail
          || case when v_detail = '' then '' else ', ' end
          || (v_comp.comp_qty * v_qty)::text || 'x ' || v_comp.product_name
          || coalesce(' (' || v_comp.variant_name || ')', '');

        -- Descuento de stock de cada componente (misma regla que un producto).
        for v_recipe in
          select r.ingredient_id, r.cantidad, r.bloquea, i.stock_actual
          from public.product_recipes r
          join public.ingredients i on i.id = r.ingredient_id
          where (v_comp.variant_id is not null and r.variant_id = v_comp.variant_id)
             or (v_comp.variant_id is null     and r.product_id = v_comp.product_id)
          for update of i
        loop
          v_needed := v_recipe.cantidad * v_comp.comp_qty * v_qty;
          if v_stock_mode = 'block' and v_recipe.bloquea and v_recipe.stock_actual < v_needed then
            raise exception 'La promoción "%" ya no está disponible', v_promo_name;
          end if;
          insert into public.stock_movements
            (restaurant_id, ingredient_id, delta, motivo, order_id)
          values
            (v_restaurant_id, v_recipe.ingredient_id, -v_needed, 'venta', v_order_id);
        end loop;
      end loop;

      insert into public.order_items
        (order_id, product_id, product_quantity, product_name, product_price,
         notes, variant_id, variant_name, promotion_id)
      values
        (v_order_id, null, v_qty, v_promo_name, v_promo_price,
         nullif(left('Incluye: ' || v_detail, 250), ''), null, null, v_promotion_id);

      v_total := v_total + (v_promo_price * v_qty);
      continue;
    end if;

    -- ===== RAMA PRODUCTO (comportamiento original) =====
    v_product_id := (v_item->>'product_id')::bigint;
    v_variant_id := nullif(v_item->>'variant_id', '')::bigint;
    v_notes      := left(coalesce(v_item->>'notes', ''), 250);

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
