-- ============================================================================
-- Importación de insumos: ahora también lee el PRECIO de cada fila.
--
-- p_items: { name, unit, stockInicial, stockMinimo, precio } (precio = costo por
-- unidad base; la UI lo convierte desde la medida del CSV).
--
--   catalogo: fija el precio (si viene > 0).
--   compra:   ACTUALIZA el precio del insumo existente (la última compra manda,
--             porque los precios varían) + suma stock, sin tocar el mínimo.
--
-- Si la fila no trae precio (0), no se pisa el precio existente.
-- Recrea import_ingredients_bulk (misma firma).
-- ============================================================================

begin;

create or replace function public.import_ingredients_bulk(
  p_items jsonb,
  p_mode  text default 'catalogo'
)
returns jsonb
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_rest      bigint;
  v_user      bigint;
  v_item      jsonb;
  v_name      text;
  v_unit      text;
  v_stock     numeric;
  v_min       numeric;
  v_precio    numeric;
  v_ex_id     bigint;
  v_ex_unit   text;
  v_id        bigint;
  v_is_compra boolean;
  v_nota      text;
  v_created   int := 0;
  v_updated   int := 0;
  v_skipped   jsonb := '[]'::jsonb;
begin
  if not public.current_user_is_admin() then
    raise exception 'no autorizado';
  end if;

  v_rest := public.current_user_restaurant_id();
  if v_rest is null then
    raise exception 'usuario sin restaurante';
  end if;

  if p_mode not in ('catalogo', 'compra') then
    raise exception 'modo inválido';
  end if;
  v_is_compra := (p_mode = 'compra');
  v_nota := case when v_is_compra then 'Compra (CSV)' else 'Importación CSV' end;

  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'items inválido';
  end if;
  if jsonb_array_length(p_items) > 1000 then
    raise exception 'demasiadas filas (máx 1000)';
  end if;

  select id into v_user from public.users where auth_user_id = auth.uid() limit 1;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_name   := trim(coalesce(v_item->>'name', ''));
    v_unit   := v_item->>'unit';
    v_stock  := coalesce((v_item->>'stockInicial')::numeric, 0);
    v_min    := coalesce((v_item->>'stockMinimo')::numeric, 0);
    v_precio := coalesce((v_item->>'precio')::numeric, 0);

    if v_name = '' or v_unit not in ('unidad', 'g', 'ml') or v_stock < 0 or v_min < 0 or v_precio < 0 then
      v_skipped := v_skipped || jsonb_build_object('name', v_name, 'reason', 'datos inválidos');
      continue;
    end if;

    select id, unit into v_ex_id, v_ex_unit
    from public.ingredients
    where restaurant_id = v_rest
      and lower(trim(name)) = lower(v_name)
    limit 1;

    if v_ex_id is not null then
      if v_ex_unit <> v_unit then
        v_skipped := v_skipped || jsonb_build_object('name', v_name, 'reason', 'unidad distinta a la del insumo existente');
        continue;
      end if;

      -- compra: no toca el mínimo. Precio: se actualiza si viene > 0 (en ambos modos).
      update public.ingredients
      set stock_minimo = case when v_is_compra then stock_minimo else v_min end,
          precio       = case when v_precio > 0 then v_precio else precio end
      where id = v_ex_id;

      if v_stock > 0 then
        insert into public.stock_movements (restaurant_id, ingredient_id, delta, motivo, user_id, nota)
        values (v_rest, v_ex_id, v_stock, 'reposicion', v_user, v_nota);
      end if;

      v_updated := v_updated + 1;
    else
      insert into public.ingredients (restaurant_id, name, unit, stock_actual, stock_minimo, precio)
      values (v_rest, v_name, v_unit, 0, case when v_is_compra then 0 else v_min end, greatest(v_precio, 0))
      returning id into v_id;

      if v_stock > 0 then
        insert into public.stock_movements (restaurant_id, ingredient_id, delta, motivo, user_id, nota)
        values (
          v_rest, v_id, v_stock,
          case when v_is_compra then 'reposicion' else 'inicial' end,
          v_user, v_nota
        );
      end if;

      v_created := v_created + 1;
    end if;
  end loop;

  return jsonb_build_object('created', v_created, 'updated', v_updated, 'skipped', v_skipped);
end;
$$;

alter function public.import_ingredients_bulk(jsonb, text) owner to postgres;
revoke all on function public.import_ingredients_bulk(jsonb, text) from public;
grant execute on function public.import_ingredients_bulk(jsonb, text) to authenticated, service_role;

commit;
