-- ============================================================================
-- get_public_menu: incluir stock_out en cada producto y variante.
--
-- stock_out es el flag automático de disponibilidad por receta (lo mantiene el
-- trigger de stock_movements). El menú QR lo usa para mostrar "Agotado" cuando
-- un insumo de la receta se acabó, además del toggle manual status_id.
-- Idéntica a la versión anterior, solo sumando stock_out en producto y variante.
-- ============================================================================

begin;

create or replace function public.get_public_menu(p_qr_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
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
        'stock_out',      p.stock_out,
        'category_id',    p.category_id,
        'image_recortada', p.image_recortada,
        'created_at',     p.created_at,
        'categories',     jsonb_build_object('category_name', pc.category_name),
        'product_variants', (
          select coalesce(jsonb_agg(jsonb_build_object(
            'id',            pv.id,
            'variant_name',  pv.variant_name,
            'variant_price', pv.variant_price,
            'variant_image', pv.variant_image,
            'stock_out',     pv.stock_out
          ) order by pv.id), '[]'::jsonb)
          from public.product_variants pv
          where pv.product_id = p.id
        )
      ) order by p.id), '[]'::jsonb)
      from public.products p
      left join public.categories pc on pc.id = p.category_id
      where p.restaurant_id = v_table.restaurant_id
    ),
    'tableId',     v_table.table_id,
    'tableNumber', v_table.table_number
  ) into v_result;

  return v_result;
end;
$$;

alter function public.get_public_menu(text) owner to postgres;
revoke all on function public.get_public_menu(text) from public;
grant execute on function public.get_public_menu(text) to anon, authenticated, service_role;

commit;
