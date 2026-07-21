-- ============================================================================
-- "ARMA TU PROMO" con % DE DESCUENTO — pedido (parte 3/3).
--   * create_public_order_qr: la rama build valida las elecciones y RECALCULA
--     el precio del combo en la base (fuente de verdad, nunca el cliente),
--     dejando el desglose del descuento en notes. Misma firma (4 args).
-- ============================================================================

-- elecciones (fuente de verdad) y deja el desglose del descuento en notes.
-- Misma firma (4 args).
-- ----------------------------------------------------------------------------
create or replace function public.create_public_order_qr(
  p_qr_token    text,
  p_items       jsonb,
  p_diner_token text default null,
  p_coupon_code text default null
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
  v_promo_kind      text;
  v_promo_pct       int;
  v_price_info      jsonb;
  v_detail          text;
  v_comp            record;
  v_coupon          record;
  v_base            numeric := 0;
  v_discount        numeric := 0;
  v_now             timestamp;
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

    -- ===== RAMA PROMOCIÓN =====
    if v_promotion_id is not null then
      select pr.name, pr.promo_price, pr.kind, pr.discount_pct
        into v_promo_name, v_promo_price, v_promo_kind, v_promo_pct
      from public.promotions pr
      where pr.id = v_promotion_id and pr.restaurant_id = v_restaurant_id and pr.active;
      if v_promo_name is null then
        raise exception 'La promoción ya no está disponible';
      end if;

      v_detail := '';

      if v_promo_kind = 'build' then
        if v_promo_pct is null then
          raise exception 'La promoción "%" ya no está disponible', v_promo_name;
        end if;
        -- Combo armado por el comensal: valida y recalcula el precio en la base.
        perform public._validate_build_selections(v_promotion_id, v_restaurant_id, v_item->'selections');
        v_price_info  := public._build_promo_price(v_promotion_id, v_item->'selections');
        v_promo_price := (v_price_info->>'total')::int;

        for v_comp in
          select (sel.val->>'product_id')::bigint as product_id,
                 nullif(sel.val->>'variant_id', '')::bigint as variant_id,
                 1 as comp_qty,
                 p.product_name, p.status_id, pv.variant_name
          from jsonb_array_elements(v_item->'selections') as sel(val)
          join public.products p on p.id = (sel.val->>'product_id')::bigint
          left join public.product_variants pv on pv.id = nullif(sel.val->>'variant_id', '')::bigint
          order by (sel.val->>'group_id')::bigint
        loop
          if v_comp.status_id <> 1 then
            raise exception 'La promoción "%" no está disponible', v_promo_name;
          end if;

          v_detail := v_detail
            || case when v_detail = '' then '' else ', ' end
            || (v_comp.comp_qty * v_qty)::text || 'x ' || v_comp.product_name
            || coalesce(' (' || v_comp.variant_name || ')', '');

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

        -- Deja constancia del descuento aplicado en el detalle de cocina/boleta.
        v_detail := v_detail || format(' — %s%% OFF (antes $%s)',
          v_promo_pct, (v_price_info->>'subtotal'));
      else
        -- Combo fijo: componentes desde promotion_items.
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
      end if;

      insert into public.order_items
        (order_id, product_id, product_quantity, product_name, product_price,
         notes, variant_id, variant_name, promotion_id)
      values
        (v_order_id, null, v_qty, v_promo_name, v_promo_price,
         nullif(left('Incluye: ' || v_detail, 250), ''), null, null, v_promotion_id);

      v_total := v_total + (v_promo_price * v_qty);
      continue;
    end if;

    -- ===== RAMA PRODUCTO =====
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

  -- ===== CUPÓN (opcional) — se aplica sobre el alcance, sin tocar promos =====
  if p_coupon_code is not null and length(trim(p_coupon_code)) > 0 then
    v_now := now() at time zone 'America/Santiago';

    select * into v_coupon
    from public.discount_codes d
    where d.restaurant_id = v_restaurant_id
      and lower(d.code) = lower(trim(p_coupon_code))
      and d.active
      and (d.valid_from is null or v_now::date >= d.valid_from)
      and (d.valid_to   is null or v_now::date <= d.valid_to)
      and (d.days_of_week is null or array_length(d.days_of_week, 1) is null
           or extract(dow from v_now)::int = any(d.days_of_week))
      and (
        d.time_from is null or d.time_to is null
        or (d.time_from <= d.time_to and v_now::time between d.time_from and d.time_to)
        or (d.time_from >  d.time_to and (v_now::time >= d.time_from or v_now::time <= d.time_to))
      )
      and (d.usage_limit is null or d.used_count < d.usage_limit);

    if found then
      if v_coupon.scope = 'category' then
        select coalesce(sum(oi.product_price * oi.product_quantity), 0) into v_base
        from public.order_items oi
        join public.products p on p.id = oi.product_id
        where oi.order_id = v_order_id and oi.promotion_id is null
          and p.category_id = v_coupon.scope_category_id;
      elsif v_coupon.scope = 'product' then
        select coalesce(sum(oi.product_price * oi.product_quantity), 0) into v_base
        from public.order_items oi
        where oi.order_id = v_order_id and oi.promotion_id is null
          and oi.product_id = v_coupon.scope_product_id;
      else
        select coalesce(sum(oi.product_price * oi.product_quantity), 0) into v_base
        from public.order_items oi
        where oi.order_id = v_order_id and oi.promotion_id is null;
      end if;

      if v_coupon.min_order_amount is null or v_total >= v_coupon.min_order_amount then
        if v_coupon.discount_type = 'percent' then
          v_discount := round(v_base * v_coupon.discount_value / 100.0);
        else
          v_discount := least(v_coupon.discount_value, v_base);
        end if;
        v_discount := greatest(0, least(v_discount, v_total));

        if v_discount > 0 then
          update public.discount_codes set used_count = used_count + 1 where id = v_coupon.id;
          update public.orders
            set discount_code = v_coupon.code, discount_code_id = v_coupon.id
            where id = v_order_id;
        end if;
      end if;
    end if;
  end if;

  update public.orders
    set total = round(v_total - v_discount)::int,
        discount_amount = round(v_discount)::int
    where id = v_order_id;

  select s.status_name into v_status_name
  from public.order_status s
  where s.id = v_initial_status;

  return jsonb_build_object(
    'id',              v_order_id,
    'status_id',       v_initial_status,
    'status_name',     v_status_name,
    'created_at',      v_created_at,
    'table_id',        v_table_id,
    'restaurant_id',   v_restaurant_id,
    'total',           round(v_total - v_discount)::int,
    'discount_amount', round(v_discount)::int,
    'diner_slot',      v_diner_slot,
    'diner_label',     v_diner_label
  );
end;
$$;

alter function public.create_public_order_qr(text, jsonb, text, text) owner to postgres;
revoke all on function public.create_public_order_qr(text, jsonb, text, text) from public;
grant execute on function public.create_public_order_qr(text, jsonb, text, text) to anon, authenticated, service_role;
