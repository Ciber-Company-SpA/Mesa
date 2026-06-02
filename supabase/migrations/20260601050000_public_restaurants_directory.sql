-- 1. Agrega campo ciudad/región a restaurants para mostrarlo en el directorio público.
-- 2. RPC public `list_public_restaurants` que devuelve solo los locales que terminaron
--    onboarding (restaurant_name != 'Restaurante sin nombre'), con counts de productos
--    y categorías. Pensado para la home pública.

begin;

alter table public.restaurants
  add column if not exists restaurant_city text null;

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
      (select count(*)::int from public.products p where p.restaurant_id = r.id) as product_count,
      (select count(*)::int from public.categories c where c.restaurant_id = r.id) as category_count
    from public.restaurants r
    where r.restaurant_name is not null
      and r.restaurant_name <> 'Restaurante sin nombre'
  ) t;

  return v_result;
end;
$$;

revoke all on function public.list_public_restaurants() from public;
grant execute on function public.list_public_restaurants() to anon, authenticated;

commit;
