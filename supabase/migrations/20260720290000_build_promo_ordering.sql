-- ============================================================================
-- PROMOCIONES "ARMA TU PROMO" — carrito del comensal (parte 1/2).
--   * table_cart_items.promo_selections: qué eligió el comensal por grupo.
--   * _validate_build_selections: valida selecciones vs grupos (min/max, que el
--     producto sea de la categoría del grupo, del restaurante y disponible).
--   * cart_add_promo_qr: acepta selecciones; build NO se deduplica (cada armado
--     difiere), fixed conserva su dedup por promotion_id.
--   * get_cart_qr: devuelve las selecciones crudas + etiquetas resueltas.
-- El menú y la creación del pedido van en 20260720290001 (parte 2/2).
-- ============================================================================

-- 1) Selecciones del comensal en la línea de carrito de una promo build.
alter table public.table_cart_items
  add column if not exists promo_selections jsonb;

-- ----------------------------------------------------------------------------
-- 2) Helper: valida las selecciones de una promo build. Lo usan tanto el
--    carrito como la creación del pedido. Cada selección = {group_id, product_id,
--    variant_id?}. Exige: el producto es de la categoría del grupo, del
--    restaurante y está disponible; la variante (si viene) es del producto; y
--    cada grupo cumple su min/max. Se invoca solo desde funciones DEFINER que ya
--    resolvieron el restaurante, por eso no lleva grant a anon.
-- ----------------------------------------------------------------------------
create or replace function public._validate_build_selections(
  p_promotion_id  bigint,
  p_restaurant_id bigint,
  p_selections    jsonb
) returns void
language plpgsql stable security definer set search_path = public
as $$
declare
  v_grp   record;
  v_sel   jsonb;
  v_count int;
  v_pid   bigint;
  v_vid   bigint;
  v_gid   bigint;
begin
  if p_selections is null or jsonb_typeof(p_selections) <> 'array' then
    raise exception 'Faltan las elecciones del combo';
  end if;
  if jsonb_array_length(p_selections) > 50 then
    raise exception 'Demasiadas elecciones en el combo';
  end if;

  -- Cada selección apunta a un grupo de ESTA promo y a un producto válido de la
  -- categoría de ese grupo (disponible + del restaurante).
  for v_sel in select * from jsonb_array_elements(p_selections)
  loop
    v_gid := (v_sel->>'group_id')::bigint;
    v_pid := (v_sel->>'product_id')::bigint;
    v_vid := nullif(v_sel->>'variant_id', '')::bigint;

    perform 1
    from public.promotion_groups g
    join public.products p on p.category_id = g.category_id
    where g.id = v_gid
      and g.promotion_id = p_promotion_id
      and p.id = v_pid
      and p.restaurant_id = p_restaurant_id
      and p.status_id = 1;
    if not found then
      raise exception 'Una elección del combo no es válida o no está disponible';
    end if;

    if v_vid is not null then
      perform 1 from public.product_variants where id = v_vid and product_id = v_pid;
      if not found then raise exception 'Una variante elegida no corresponde al producto'; end if;
    end if;
  end loop;

  -- Cada grupo debe cumplir su min/max de selecciones.
  for v_grp in
    select g.id, g.name, g.min_select, g.max_select
    from public.promotion_groups g
    where g.promotion_id = p_promotion_id
  loop
    select count(*) into v_count
    from jsonb_array_elements(p_selections) s
    where (s->>'group_id')::bigint = v_grp.id;

    if v_count < v_grp.min_select or v_count > v_grp.max_select then
      if v_grp.min_select = v_grp.max_select then
        raise exception 'En "%": elegí % opción(es)', v_grp.name, v_grp.min_select;
      else
        raise exception 'En "%": elegí entre % y % opciones', v_grp.name, v_grp.min_select, v_grp.max_select;
      end if;
    end if;
  end loop;
end;
$$;

revoke all on function public._validate_build_selections(bigint, bigint, jsonb) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 3) cart_add_promo_qr: agrega una promo al carrito. Cambia la firma (agrega
--    p_selections), así que primero se elimina la versión de 4 args.
-- ----------------------------------------------------------------------------
drop function if exists public.cart_add_promo_qr(text, bigint, integer, text);

create or replace function public.cart_add_promo_qr(
  p_qr_token     text,
  p_promotion_id bigint,
  p_quantity     integer,
  p_added_by     text,
  p_selections   jsonb default null
) returns void
  language plpgsql security definer set search_path = public
as $$
declare
  v_table_id      bigint;
  v_restaurant_id bigint;
  v_qty           int;
  v_price         int;
  v_kind          text;
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

  select pr.promo_price, pr.kind into v_price, v_kind
  from public.promotions pr
  where pr.id = p_promotion_id and pr.restaurant_id = v_restaurant_id and pr.active;
  if v_price is null then
    raise exception 'La promoción no está disponible';
  end if;

  if v_kind = 'build' then
    -- Valida las elecciones contra los grupos. Build NO se deduplica (cada
    -- armado difiere): siempre una línea nueva con sus selecciones.
    perform public._validate_build_selections(p_promotion_id, v_restaurant_id, p_selections);

    insert into public.table_cart_items
      (restaurant_id, table_id, product_id, variant_id, promotion_id, unit_price, quantity, added_by, promo_selections)
    values
      (v_restaurant_id, v_table_id, null, null, p_promotion_id, v_price, v_qty,
       nullif(left(coalesce(p_added_by, ''), 100), ''), p_selections);
    return;
  end if;

  -- Fixed: comportamiento original (todos los componentes disponibles + dedup).
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
  where table_id = v_table_id and promotion_id = p_promotion_id and promo_selections is null
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

alter function public.cart_add_promo_qr(text, bigint, integer, text, jsonb) owner to postgres;
revoke all on function public.cart_add_promo_qr(text, bigint, integer, text, jsonb) from public;
grant execute on function public.cart_add_promo_qr(text, bigint, integer, text, jsonb) to anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 4) get_cart_qr: devuelve promo_selections (crudo, para reenviar al pedido) y
--    'selection_labels' resueltas (para mostrar en el carrito). Recrea la
--    función (cuerpo de 20260720250000 + esos campos en las líneas de promo).
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
    'promo_selections', c.promo_selections,
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
      else jsonb_build_object(
        'name',      pr.name,
        'image_url', pr.image_url,
        'kind',      pr.kind,
        'selection_labels', case when c.promo_selections is null then null else (
          select coalesce(jsonb_agg(
            coalesce(sp.product_name, 'Producto')
            || coalesce(' (' || spv.variant_name || ')', '')
            order by ord
          ), '[]'::jsonb)
          from jsonb_array_elements(c.promo_selections) with ordinality as sel(val, ord)
          left join public.products sp on sp.id = (sel.val->>'product_id')::bigint
          left join public.product_variants spv on spv.id = nullif(sel.val->>'variant_id', '')::bigint
        ) end
      ) end
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
