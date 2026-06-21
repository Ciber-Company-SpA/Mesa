-- ============================================================================
-- Importación masiva de insumos desde CSV.
--
-- p_items: jsonb array de { name, unit('unidad'|'g'|'ml'), stockInicial, stockMinimo }
-- (la UI ya convierte kg/L a g/ml antes de enviar).
--
-- Comportamiento (acordado): por cada fila, si el insumo ya existe (mismo nombre,
-- case-insensitive) se ACTUALIZA: se fija el mínimo y se SUMA el stock como
-- movimiento de reposición. Si no existe, se CREA (con su stock inicial). Las
-- filas con unidad distinta a la del insumo existente se omiten y se reportan.
--
-- Devuelve { created, updated, skipped: [{name, reason}] }.
-- ============================================================================

begin;

create or replace function public.import_ingredients_bulk(p_items jsonb)
returns jsonb
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_rest    bigint;
  v_user    bigint;
  v_item    jsonb;
  v_name    text;
  v_unit    text;
  v_stock   numeric;
  v_min     numeric;
  v_ex_id   bigint;
  v_ex_unit text;
  v_id      bigint;
  v_created int := 0;
  v_updated int := 0;
  v_skipped jsonb := '[]'::jsonb;
begin
  if not public.current_user_is_admin() then
    raise exception 'no autorizado';
  end if;

  v_rest := public.current_user_restaurant_id();
  if v_rest is null then
    raise exception 'usuario sin restaurante';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'items inválido';
  end if;
  if jsonb_array_length(p_items) > 1000 then
    raise exception 'demasiadas filas (máx 1000)';
  end if;

  select id into v_user from public.users where auth_user_id = auth.uid() limit 1;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_name  := trim(coalesce(v_item->>'name', ''));
    v_unit  := v_item->>'unit';
    v_stock := coalesce((v_item->>'stockInicial')::numeric, 0);
    v_min   := coalesce((v_item->>'stockMinimo')::numeric, 0);

    if v_name = '' or v_unit not in ('unidad', 'g', 'ml') or v_stock < 0 or v_min < 0 then
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

      update public.ingredients set stock_minimo = v_min where id = v_ex_id;

      if v_stock > 0 then
        insert into public.stock_movements (restaurant_id, ingredient_id, delta, motivo, user_id, nota)
        values (v_rest, v_ex_id, v_stock, 'reposicion', v_user, 'Importación CSV');
      end if;

      v_updated := v_updated + 1;
    else
      insert into public.ingredients (restaurant_id, name, unit, stock_actual, stock_minimo)
      values (v_rest, v_name, v_unit, 0, v_min)
      returning id into v_id;

      if v_stock > 0 then
        insert into public.stock_movements (restaurant_id, ingredient_id, delta, motivo, user_id, nota)
        values (v_rest, v_id, v_stock, 'inicial', v_user, 'Importación CSV');
      end if;

      v_created := v_created + 1;
    end if;
  end loop;

  return jsonb_build_object('created', v_created, 'updated', v_updated, 'skipped', v_skipped);
end;
$$;

alter function public.import_ingredients_bulk(jsonb) owner to postgres;
revoke all on function public.import_ingredients_bulk(jsonb) from public;
grant execute on function public.import_ingredients_bulk(jsonb) to authenticated, service_role;

commit;
