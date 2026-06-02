-- Delivery: toggle + slug único para la URL pública del local.
-- Solo aparecen en el directorio si delivery_enabled = true Y tienen slug seteado.

begin;

alter table public.restaurants
  add column if not exists delivery_enabled boolean not null default false;

alter table public.restaurants
  add column if not exists delivery_slug text null;

-- Unicidad case-insensitive del slug (los slugs son lowercase por convención).
create unique index if not exists restaurants_delivery_slug_unique
  on public.restaurants (lower(delivery_slug))
  where delivery_slug is not null;

-- Slugs reservados que chocan con rutas de la app.
create or replace function public.is_reserved_slug(p_slug text)
returns boolean
language sql
immutable
as $$
  select lower(p_slug) = any(array[
    'admin', 'api', 'forgot-password', 'login', 'r', 'register',
    'reset-password', 'restaurant', 'screen', 'sumate', 'waiter',
    'monitoring', 'icons', 'public', 'static', '_next'
  ]);
$$;

-- Format check: lowercase, alfanumérico + guiones, no empieza ni termina con guión,
-- entre 3 y 60 caracteres.
alter table public.restaurants
  drop constraint if exists restaurants_delivery_slug_format;

alter table public.restaurants
  add constraint restaurants_delivery_slug_format
  check (
    delivery_slug is null
    or (
      length(delivery_slug) between 3 and 60
      and delivery_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
      and not public.is_reserved_slug(delivery_slug)
    )
  );

-- Actualizar RPC del directorio: solo locales con delivery activado + slug.
create or replace function public.list_public_restaurants()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_result jsonb;
begin
  select coalesce(jsonb_agg(t order by t.restaurant_name), '[]'::jsonb)
  into v_result
  from (
    select
      r.id,
      r.restaurant_name,
      r.restaurant_logo,
      r.menu_template,
      r.restaurant_city,
      r.delivery_slug,
      (select count(*)::int from public.products p where p.restaurant_id = r.id) as product_count,
      (select count(*)::int from public.categories c where c.restaurant_id = r.id) as category_count
    from public.restaurants r
    where r.restaurant_name is not null
      and r.restaurant_name <> 'Restaurante sin nombre'
      and r.delivery_enabled = true
      and r.delivery_slug is not null
  ) t;

  return v_result;
end;
$$;

-- Nueva RPC para resolver un restaurante por slug (lo usa /[slug]).
create or replace function public.get_restaurant_by_slug(p_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_restaurant_id bigint;
  v_result jsonb;
begin
  select id into v_restaurant_id
  from public.restaurants
  where lower(delivery_slug) = lower(p_slug)
    and delivery_enabled = true
  limit 1;

  if v_restaurant_id is null then
    return null;
  end if;

  select jsonb_build_object(
    'restaurant', (
      select jsonb_build_object(
        'id', r.id,
        'restaurant_name', r.restaurant_name,
        'restaurant_logo', r.restaurant_logo,
        'restaurant_city', r.restaurant_city,
        'menu_template', r.menu_template,
        'delivery_slug', r.delivery_slug
      )
      from public.restaurants r where r.id = v_restaurant_id
    ),
    'categories', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', c.id, 'category_name', c.category_name
      ) order by c.category_name), '[]'::jsonb)
      from public.categories c where c.restaurant_id = v_restaurant_id
    ),
    'products', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', p.id,
        'product_name', p.product_name,
        'product_description', p.product_description,
        'product_price', p.product_price,
        'product_image', p.product_image,
        'category_id', p.category_id,
        'status_id', p.status_id,
        'category_name', (select cc.category_name from public.categories cc where cc.id = p.category_id),
        'variants', (
          select coalesce(jsonb_agg(jsonb_build_object(
            'id', v.id,
            'variant_name', v.variant_name,
            'variant_price', v.variant_price,
            'variant_image', v.variant_image
          ) order by v.id), '[]'::jsonb)
          from public.product_variants v where v.product_id = p.id
        )
      ) order by p.id), '[]'::jsonb)
      from public.products p
      where p.restaurant_id = v_restaurant_id
        and p.status_id = 1
    )
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.get_restaurant_by_slug(text) from public;
grant execute on function public.get_restaurant_by_slug(text) to anon, authenticated;

commit;
