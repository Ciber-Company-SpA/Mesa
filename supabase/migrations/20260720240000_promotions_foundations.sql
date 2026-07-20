-- ============================================================================
-- PROMOCIONES (combos a precio fijo) — cimiento de datos + RPCs de admin.
-- El cliente arma una promo eligiendo productos de su carta y fija un precio;
-- el % de descuento se calcula al vuelo (precio original de carta vs promo).
-- Multi-tenant por restaurant_id. Tablas deny-all: todo acceso pasa por RPCs
-- SECURITY DEFINER con guard (patrón del proyecto). El menú del comensal las
-- expondrá vía get_public_menu (paso 3). El pedido de la promo (carrito/orden)
-- se implementa en una migración posterior.
-- ============================================================================

create table if not exists public.promotions (
  id            bigint generated always as identity primary key,
  restaurant_id bigint  not null references public.restaurants(id) on delete cascade,
  name          text    not null,
  description   text,
  promo_price   integer not null check (promo_price >= 0),
  image_url     text,
  active        boolean not null default true,
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_promotions_restaurant on public.promotions (restaurant_id);

create table if not exists public.promotion_items (
  id           bigint generated always as identity primary key,
  promotion_id bigint  not null references public.promotions(id) on delete cascade,
  product_id   bigint  not null references public.products(id) on delete cascade,
  variant_id   bigint  references public.product_variants(id) on delete cascade,
  quantity     integer not null default 1 check (quantity >= 1)
);
create index if not exists idx_promotion_items_promotion on public.promotion_items (promotion_id);

alter table public.promotions      enable row level security;
alter table public.promotion_items enable row level security;
revoke all on public.promotions      from anon, authenticated;
revoke all on public.promotion_items from anon, authenticated;

-- ----------------------------------------------------------------------------
-- ADMIN: listado con items resueltos + total original (para calcular el % en
-- el front). Scope al restaurante del admin.
-- ----------------------------------------------------------------------------
create or replace function public.promo_list()
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare v_rid bigint; v_result jsonb;
begin
  if not public.current_user_is_admin() then raise exception 'No autorizado'; end if;
  v_rid := public.current_user_restaurant_id();
  if v_rid is null then raise exception 'Sin restaurante asociado'; end if;

  select coalesce(jsonb_agg(promo order by (promo->>'sort_order')::int, (promo->>'id')::bigint), '[]'::jsonb)
  into v_result
  from (
    select jsonb_build_object(
      'id',          pr.id,
      'name',        pr.name,
      'description', pr.description,
      'promo_price', pr.promo_price,
      'image_url',   pr.image_url,
      'active',      pr.active,
      'sort_order',  pr.sort_order,
      'items', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'product_id',   pi.product_id,
          'variant_id',   pi.variant_id,
          'quantity',     pi.quantity,
          'product_name', p.product_name,
          'variant_name', pv.variant_name,
          'unit_price',   coalesce(pv.variant_price, p.product_price),
          'available',    (p.status_id = 1)
        ) order by pi.id), '[]'::jsonb)
        from public.promotion_items pi
        join public.products p on p.id = pi.product_id
        left join public.product_variants pv on pv.id = pi.variant_id
        where pi.promotion_id = pr.id
      ),
      'original_total', (
        select coalesce(sum(coalesce(pv.variant_price, p.product_price) * pi.quantity), 0)
        from public.promotion_items pi
        join public.products p on p.id = pi.product_id
        left join public.product_variants pv on pv.id = pi.variant_id
        where pi.promotion_id = pr.id
      )
    ) as promo
    from public.promotions pr
    where pr.restaurant_id = v_rid
  ) s;

  return v_result;
end;
$$;

-- ----------------------------------------------------------------------------
-- ADMIN: crear/editar (upsert). p_id null = crear. Reemplaza los items.
-- Valida que cada producto/variante pertenezca al restaurante del admin.
-- ----------------------------------------------------------------------------
create or replace function public.promo_save(
  p_id          bigint,
  p_name        text,
  p_description text,
  p_promo_price integer,
  p_image_url   text,
  p_active      boolean,
  p_items       jsonb
) returns bigint
language plpgsql security definer set search_path = public
as $$
declare
  v_rid      bigint;
  v_promo_id bigint;
  v_item     jsonb;
  v_pid      bigint;
  v_vid      bigint;
  v_qty      int;
begin
  if not public.current_user_is_admin() then raise exception 'No autorizado'; end if;
  v_rid := public.current_user_restaurant_id();
  if v_rid is null then raise exception 'Sin restaurante asociado'; end if;

  if p_name is null or length(trim(p_name)) = 0 then raise exception 'El nombre es obligatorio'; end if;
  if p_promo_price is null or p_promo_price < 0 then raise exception 'Precio de promoción inválido'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) < 1 then
    raise exception 'La promoción debe incluir al menos un producto';
  end if;
  if jsonb_array_length(p_items) > 30 then raise exception 'La promoción no puede tener más de 30 productos'; end if;

  if p_id is null then
    insert into public.promotions (restaurant_id, name, description, promo_price, image_url, active)
    values (v_rid, trim(p_name), nullif(trim(coalesce(p_description,'')),''), p_promo_price,
            nullif(trim(coalesce(p_image_url,'')),''), coalesce(p_active, true))
    returning id into v_promo_id;
  else
    update public.promotions
      set name        = trim(p_name),
          description = nullif(trim(coalesce(p_description,'')),''),
          promo_price = p_promo_price,
          image_url   = nullif(trim(coalesce(p_image_url,'')),''),
          active      = coalesce(p_active, true),
          updated_at  = now()
      where id = p_id and restaurant_id = v_rid
      returning id into v_promo_id;
    if v_promo_id is null then raise exception 'Promoción no encontrada'; end if;
    delete from public.promotion_items where promotion_id = v_promo_id;
  end if;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_pid := (v_item->>'product_id')::bigint;
    v_vid := nullif(v_item->>'variant_id','')::bigint;
    v_qty := coalesce((v_item->>'quantity')::int, 1);
    if v_qty < 1 or v_qty > 50 then raise exception 'Cantidad inválida en un producto (1-50)'; end if;

    perform 1 from public.products where id = v_pid and restaurant_id = v_rid;
    if not found then raise exception 'Un producto seleccionado no pertenece a tu restaurante'; end if;

    if v_vid is not null then
      perform 1 from public.product_variants where id = v_vid and product_id = v_pid;
      if not found then raise exception 'Una variante no corresponde a su producto'; end if;
    end if;

    insert into public.promotion_items (promotion_id, product_id, variant_id, quantity)
    values (v_promo_id, v_pid, v_vid, v_qty);
  end loop;

  return v_promo_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- ADMIN: activar/desactivar y borrar.
-- ----------------------------------------------------------------------------
create or replace function public.promo_set_active(p_id bigint, p_active boolean)
returns void language plpgsql security definer set search_path = public
as $$
declare v_rid bigint;
begin
  if not public.current_user_is_admin() then raise exception 'No autorizado'; end if;
  v_rid := public.current_user_restaurant_id();
  update public.promotions set active = p_active, updated_at = now()
    where id = p_id and restaurant_id = v_rid;
  if not found then raise exception 'Promoción no encontrada'; end if;
end;
$$;

create or replace function public.promo_delete(p_id bigint)
returns void language plpgsql security definer set search_path = public
as $$
declare v_rid bigint;
begin
  if not public.current_user_is_admin() then raise exception 'No autorizado'; end if;
  v_rid := public.current_user_restaurant_id();
  delete from public.promotions where id = p_id and restaurant_id = v_rid;
  if not found then raise exception 'Promoción no encontrada'; end if;
end;
$$;

-- Lockdown de grants: solo staff autenticado (el guard interno exige admin).
revoke all on function public.promo_list()                                   from public, anon;
revoke all on function public.promo_save(bigint,text,text,integer,text,boolean,jsonb) from public, anon;
revoke all on function public.promo_set_active(bigint, boolean)              from public, anon;
revoke all on function public.promo_delete(bigint)                           from public, anon;
grant execute on function public.promo_list()                                   to authenticated, service_role;
grant execute on function public.promo_save(bigint,text,text,integer,text,boolean,jsonb) to authenticated, service_role;
grant execute on function public.promo_set_active(bigint, boolean)              to authenticated, service_role;
grant execute on function public.promo_delete(bigint)                           to authenticated, service_role;
