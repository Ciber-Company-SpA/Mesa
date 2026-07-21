-- ============================================================================
-- PROMOCIONES "ARMA TU PROMO" — menú y pedido (parte 2/2 de 20260720290000).
--   * get_public_menu: expone 'kind' y, para build, los 'groups' (la UI arma el
--     selector cruzando group.category_id con los products del menú). El filtro
--     de disponibilidad ahora depende del tipo: fixed = todos sus componentes
--     disponibles; build = cada grupo con al menos min_select disponibles.
--   * create_public_order_qr: rama build dentro de la rama promoción (valida las
--     elecciones, precio FIJO del combo, detalle de lo elegido en notes y
--     descuento de stock de cada producto elegido). Misma firma (4 args).
-- ============================================================================

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
        'kind',        pr.kind,
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
        ),
        'groups', (
          select coalesce(jsonb_agg(jsonb_build_object(
            'id',          g.id,
            'name',        g.name,
            'category_id', g.category_id,
            'min_select',  g.min_select,
            'max_select',  g.max_select
          ) order by g.sort_order, g.id), '[]'::jsonb)
          from public.promotion_groups g
          where g.promotion_id = pr.id
        )
      ) order by pr.sort_order, pr.id), '[]'::jsonb)
      from public.promotions pr
      where pr.restaurant_id = v_table.restaurant_id
        and pr.active
        and (
          -- Fixed: tiene componentes y todos disponibles.
          (pr.kind = 'fixed'
            and exists (select 1 from public.promotion_items pi where pi.promotion_id = pr.id)
            and not exists (
              select 1 from public.promotion_items pi
              join public.products p on p.id = pi.product_id
              where pi.promotion_id = pr.id and p.status_id <> 1
            ))
          -- Build: tiene grupos y cada grupo tiene al menos min_select disponibles.
          or (pr.kind = 'build'
            and exists (select 1 from public.promotion_groups g where g.promotion_id = pr.id)
            and not exists (
              select 1 from public.promotion_groups g
              where g.promotion_id = pr.id
                and (
                  select count(*) from public.products p
                  where p.category_id = g.category_id
                    and p.restaurant_id = pr.restaurant_id
                    and p.status_id = 1
                ) < g.min_select
            ))
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
-- create_public_order_qr: rama build dentro de la rama promoción. Recrea el
-- cuerpo vigente (20260720260001, con cupón) agregando el manejo de combos
-- build. Misma firma (4 args), no se dropea.
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
      select pr.name, pr.promo_price, pr.kind into v_promo_name, v_promo_price, v_promo_kind
      from public.promotions pr
      where pr.id = v_promotion_id and pr.restaurant_id = v_restaurant_id and pr.active;
      if v_promo_name is null then
        raise exception 'La promoción ya no está disponible';
      end if;

      v_detail := '';

      if v_promo_kind = 'build' then
        -- Combo armado por el comensal: los componentes son sus elecciones.
        perform public._validate_build_selections(v_promotion_id, v_restaurant_id, v_item->'selections');

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
