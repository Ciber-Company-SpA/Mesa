-- ============================================================================
-- Aplicación masiva de recetas (para "generar recetas con IA para todos").
--
-- p_entries: jsonb array de:
--   { "product_id": bigint, "items": [ { "ingredient_id": bigint|null,
--      "name": text, "unit": 'unidad'|'g'|'ml', "cantidad": numeric } ] }
--
-- Por cada item: si trae ingredient_id (de tu inventario) se usa; si no, se
-- busca por nombre y, si no existe, se crea en inventario a stock 0. La creación
-- es find-or-create dentro de la misma transacción, así un insumo compartido
-- (ej. "Pan") se crea UNA sola vez aunque aparezca en muchos productos.
--
-- La receta resultante se aplica a cada variante del producto (o a nivel
-- producto si no tiene variantes), reemplazando cualquier receta previa.
--
-- Devuelve { productsProcessed, ingredientsCreated, recipesSaved }.
-- ============================================================================

begin;

create or replace function public.apply_recipes_bulk(p_entries jsonb)
returns jsonb
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_rest        bigint;
  v_entry       jsonb;
  v_product_id  bigint;
  v_prod_rest   bigint;
  v_item        jsonb;
  v_ing_id      bigint;
  v_name        text;
  v_unit        text;
  v_cantidad    numeric;
  v_resolved    jsonb;
  v_seen        bigint[];
  v_has_var     boolean;
  v_variant_id  bigint;
  v_products    int := 0;
  v_ing_created int := 0;
  v_recipes     int := 0;
begin
  if not public.current_user_is_admin() then
    raise exception 'no autorizado';
  end if;
  v_rest := public.current_user_restaurant_id();
  if v_rest is null then
    raise exception 'usuario sin restaurante';
  end if;
  if p_entries is null or jsonb_typeof(p_entries) <> 'array' then
    raise exception 'entries inválido';
  end if;
  if jsonb_array_length(p_entries) > 500 then
    raise exception 'demasiados productos (máx 500)';
  end if;

  for v_entry in select * from jsonb_array_elements(p_entries)
  loop
    v_product_id := (v_entry->>'product_id')::bigint;

    select restaurant_id into v_prod_rest from public.products where id = v_product_id;
    if v_prod_rest is null or v_prod_rest <> v_rest then
      continue; -- producto ajeno o inexistente: saltar
    end if;

    v_resolved := '[]'::jsonb;
    v_seen := array[]::bigint[];

    for v_item in select * from jsonb_array_elements(coalesce(v_entry->'items', '[]'::jsonb))
    loop
      v_ing_id   := nullif(v_item->>'ingredient_id', '')::bigint;
      v_name     := trim(coalesce(v_item->>'name', ''));
      v_unit     := v_item->>'unit';
      v_cantidad := coalesce((v_item->>'cantidad')::numeric, 0);

      if v_cantidad <= 0 then
        continue;
      end if;

      -- Validar insumo existente (pertenencia); si no es válido, intentar por nombre.
      if v_ing_id is not null then
        perform 1 from public.ingredients where id = v_ing_id and restaurant_id = v_rest;
        if not found then
          v_ing_id := null;
        end if;
      end if;

      if v_ing_id is null then
        if v_name = '' or v_unit not in ('unidad', 'g', 'ml') then
          continue;
        end if;
        select id into v_ing_id
        from public.ingredients
        where restaurant_id = v_rest and lower(trim(name)) = lower(v_name)
        limit 1;

        if v_ing_id is null then
          insert into public.ingredients (restaurant_id, name, unit, stock_actual, stock_minimo)
          values (v_rest, v_name, v_unit, 0, 0)
          returning id into v_ing_id;
          v_ing_created := v_ing_created + 1;
        end if;
      end if;

      -- Evitar insumo repetido dentro de la misma receta.
      if v_ing_id = any(v_seen) then
        continue;
      end if;
      v_seen := array_append(v_seen, v_ing_id);
      v_resolved := v_resolved || jsonb_build_object('ingredient_id', v_ing_id, 'cantidad', v_cantidad);
    end loop;

    select exists(select 1 from public.product_variants where product_id = v_product_id) into v_has_var;

    if v_has_var then
      for v_variant_id in select id from public.product_variants where product_id = v_product_id
      loop
        delete from public.product_recipes where variant_id = v_variant_id;
        insert into public.product_recipes (restaurant_id, product_id, variant_id, ingredient_id, cantidad)
        select v_rest, null, v_variant_id, (it->>'ingredient_id')::bigint, (it->>'cantidad')::numeric
        from jsonb_array_elements(v_resolved) it;
      end loop;
    else
      delete from public.product_recipes where product_id = v_product_id;
      insert into public.product_recipes (restaurant_id, product_id, variant_id, ingredient_id, cantidad)
      select v_rest, v_product_id, null, (it->>'ingredient_id')::bigint, (it->>'cantidad')::numeric
      from jsonb_array_elements(v_resolved) it;
    end if;

    v_products := v_products + 1;
    v_recipes := v_recipes + 1;
  end loop;

  return jsonb_build_object(
    'productsProcessed', v_products,
    'ingredientsCreated', v_ing_created,
    'recipesSaved', v_recipes
  );
end;
$$;

alter function public.apply_recipes_bulk(jsonb) owner to postgres;
revoke all on function public.apply_recipes_bulk(jsonb) from public;
grant execute on function public.apply_recipes_bulk(jsonb) to authenticated, service_role;

commit;
