-- ============================================================================
-- PROMOCIONES "ARMA TU PROMO" (build-your-own) — cimiento de datos + admin.
-- Además del combo FIJO existente (kind='fixed'), una promo puede ser 'build':
-- el comensal arma su combo eligiendo, por cada GRUPO, entre min..max productos
-- de una CATEGORÍA de su carta. Precio FIJO del combo (promo_price), sin
-- sobreprecio por opción. Las opciones de un grupo = todos los productos
-- disponibles de esa categoría (se auto-sincroniza con la carta).
-- Multi-tenant por restaurant_id. Tablas deny-all: acceso vía RPC con guard.
-- El pedido de la promo build se implementa en la migración siguiente.
-- ============================================================================

-- 1) Tipo de promoción.
alter table public.promotions
  add column if not exists kind text not null default 'fixed';
alter table public.promotions
  drop constraint if exists promotions_kind_check;
alter table public.promotions
  add constraint promotions_kind_check check (kind in ('fixed', 'build'));

-- 2) Grupos de elección (solo para kind='build'). Cada grupo ancla a una
--    categoría de la carta del restaurante.
create table if not exists public.promotion_groups (
  id            bigint generated always as identity primary key,
  promotion_id  bigint  not null references public.promotions(id) on delete cascade,
  name          text    not null,
  category_id   bigint  not null references public.categories(id) on delete cascade,
  min_select    integer not null default 1 check (min_select >= 0),
  max_select    integer not null default 1 check (max_select >= 1),
  sort_order    integer not null default 0,
  constraint promotion_groups_minmax check (max_select >= min_select)
);
create index if not exists idx_promotion_groups_promotion on public.promotion_groups (promotion_id);

alter table public.promotion_groups enable row level security;
revoke all on public.promotion_groups from anon, authenticated;

-- ----------------------------------------------------------------------------
-- 3) promo_list (admin): agrega 'kind' y, para build, los grupos (con nombre de
--    categoría y cuántos productos disponibles tiene). Recrea la función.
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
      'kind',        pr.kind,
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
      ),
      'groups', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'id',            g.id,
          'name',          g.name,
          'category_id',   g.category_id,
          'category_name', c.category_name,
          'min_select',    g.min_select,
          'max_select',    g.max_select,
          'sort_order',    g.sort_order,
          'available_count', (
            select count(*) from public.products p
            where p.category_id = g.category_id
              and p.restaurant_id = v_rid
              and p.status_id = 1
          )
        ) order by g.sort_order, g.id), '[]'::jsonb)
        from public.promotion_groups g
        join public.categories c on c.id = g.category_id
        where g.promotion_id = pr.id
      )
    ) as promo
    from public.promotions pr
    where pr.restaurant_id = v_rid
  ) s;

  return v_result;
end;
$$;

-- ----------------------------------------------------------------------------
-- 4) promo_save (admin): upsert. Cambia la firma (agrega p_kind y p_groups), así
--    que primero se elimina la versión de 7 args. Para kind='fixed' persiste
--    promotion_items (comportamiento original); para 'build' persiste
--    promotion_groups. Siempre limpia el conjunto que no aplica.
-- ----------------------------------------------------------------------------
drop function if exists public.promo_save(bigint, text, text, integer, text, boolean, jsonb);

create or replace function public.promo_save(
  p_id          bigint,
  p_name        text,
  p_description text,
  p_promo_price integer,
  p_image_url   text,
  p_active      boolean,
  p_items       jsonb,
  p_kind        text,
  p_groups      jsonb
) returns bigint
language plpgsql security definer set search_path = public
as $$
declare
  v_rid      bigint;
  v_promo_id bigint;
  v_item     jsonb;
  v_grp      jsonb;
  v_pid      bigint;
  v_vid      bigint;
  v_qty      int;
  v_kind     text;
  v_cat      bigint;
  v_min      int;
  v_max      int;
begin
  if not public.current_user_is_admin() then raise exception 'No autorizado'; end if;
  v_rid := public.current_user_restaurant_id();
  if v_rid is null then raise exception 'Sin restaurante asociado'; end if;

  v_kind := coalesce(nullif(trim(p_kind), ''), 'fixed');
  if v_kind not in ('fixed', 'build') then raise exception 'Tipo de promoción inválido'; end if;

  if p_name is null or length(trim(p_name)) = 0 then raise exception 'El nombre es obligatorio'; end if;
  if p_promo_price is null or p_promo_price < 0 then raise exception 'Precio de promoción inválido'; end if;

  if v_kind = 'fixed' then
    if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) < 1 then
      raise exception 'La promoción debe incluir al menos un producto';
    end if;
    if jsonb_array_length(p_items) > 30 then raise exception 'La promoción no puede tener más de 30 productos'; end if;
  else
    if p_groups is null or jsonb_typeof(p_groups) <> 'array' or jsonb_array_length(p_groups) < 1 then
      raise exception 'Un combo "arma tu promo" necesita al menos un grupo de elección';
    end if;
    if jsonb_array_length(p_groups) > 15 then raise exception 'Demasiados grupos (máximo 15)'; end if;
  end if;

  if p_id is null then
    insert into public.promotions (restaurant_id, name, description, promo_price, image_url, active, kind)
    values (v_rid, trim(p_name), nullif(trim(coalesce(p_description, '')), ''), p_promo_price,
            nullif(trim(coalesce(p_image_url, '')), ''), coalesce(p_active, true), v_kind)
    returning id into v_promo_id;
  else
    update public.promotions
      set name        = trim(p_name),
          description = nullif(trim(coalesce(p_description, '')), ''),
          promo_price = p_promo_price,
          image_url   = nullif(trim(coalesce(p_image_url, '')), ''),
          active      = coalesce(p_active, true),
          kind        = v_kind,
          updated_at  = now()
      where id = p_id and restaurant_id = v_rid
      returning id into v_promo_id;
    if v_promo_id is null then raise exception 'Promoción no encontrada'; end if;
  end if;

  -- Reemplazar componentes de AMBOS tipos (limpia el que no aplica al cambiar de tipo).
  delete from public.promotion_items  where promotion_id = v_promo_id;
  delete from public.promotion_groups where promotion_id = v_promo_id;

  if v_kind = 'fixed' then
    for v_item in select * from jsonb_array_elements(p_items)
    loop
      v_pid := (v_item->>'product_id')::bigint;
      v_vid := nullif(v_item->>'variant_id', '')::bigint;
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
  else
    for v_grp in select * from jsonb_array_elements(p_groups)
    loop
      v_cat := (v_grp->>'category_id')::bigint;
      v_min := coalesce((v_grp->>'min_select')::int, 1);
      v_max := coalesce((v_grp->>'max_select')::int, 1);
      if v_min < 0 or v_max < 1 or v_max < v_min or v_max > 20 then
        raise exception 'Rango de selección inválido en un grupo (revisá mín/máx)';
      end if;

      perform 1 from public.categories where id = v_cat and restaurant_id = v_rid;
      if not found then raise exception 'Una categoría del combo no pertenece a tu restaurante'; end if;

      -- Si no le pusieron nombre al grupo, usar el de la categoría.
      insert into public.promotion_groups (promotion_id, name, category_id, min_select, max_select, sort_order)
      select v_promo_id,
             coalesce(nullif(trim(coalesce(v_grp->>'name', '')), ''), c.category_name),
             v_cat, v_min, v_max, coalesce((v_grp->>'sort_order')::int, 0)
      from public.categories c
      where c.id = v_cat;
    end loop;
  end if;

  return v_promo_id;
end;
$$;

-- Lockdown de grants: solo staff autenticado (el guard interno exige admin).
revoke all on function public.promo_list()                                                     from public, anon;
revoke all on function public.promo_save(bigint, text, text, integer, text, boolean, jsonb, text, jsonb) from public, anon;
grant execute on function public.promo_list()                                                     to authenticated, service_role;
grant execute on function public.promo_save(bigint, text, text, integer, text, boolean, jsonb, text, jsonb) to authenticated, service_role;
