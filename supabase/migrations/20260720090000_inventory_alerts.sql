-- ============================================================================
-- ALERTAS DE INVENTARIO (stock bajo / sin stock) — lado ADMIN
--
-- Objetivo:
--   Exponer al panel del restaurante los insumos que necesitan atención, en
--   dos niveles:
--     - 'sin_stock' : stock_actual <= 0  (agotado)
--     - 'bajo'      : 0 < stock_actual <= stock_minimo  (bajo el mínimo)
--   Una sola RPC alimenta las 3 superficies del admin (sección de inventario,
--   card del dashboard, badge/campana del sidebar).
--
-- Privacidad del comensal (INTOCABLE):
--   Esta RPC es SECURITY DEFINER con guard de admin y SIN grant a anon. El menú
--   público (get_public_menu) NO cambia: al comensal solo le llega el flag
--   booleano stock_out, jamás cantidades, nombres de insumos ni estas alertas.
--
-- Además:
--   - Fix del endpoint de API api_inventory_set_stock: ahora escribe por el
--     libro mayor (stock_movements) en vez de fijar stock_actual directo, de
--     modo que el trigger mantenga el saldo y recalcule stock_out (si no, poner
--     stock 0 por API dejaba el producto "disponible" en el menú del comensal).
--   - Habilita realtime en ingredients para que las alertas se actualicen en
--     vivo (respeta RLS: cada admin solo ve su restaurante).
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1) RPC de alertas para el admin del propio restaurante.
-- ----------------------------------------------------------------------------
create or replace function public.get_inventory_alerts()
  returns jsonb
  language plpgsql
  stable
  security definer
  set search_path = public
as $$
declare
  v_rid    bigint;
  v_result jsonb;
begin
  if not public.current_user_is_admin() then
    raise exception 'no autorizado';
  end if;

  v_rid := public.current_user_restaurant_id();
  if v_rid is null then
    raise exception 'usuario sin restaurante';
  end if;

  with alerts as (
    select
      i.id,
      i.name,
      i.unit,
      i.stock_actual,
      i.stock_minimo,
      case when i.stock_actual <= 0 then 'sin_stock' else 'bajo' end as level
    from public.ingredients i
    where i.restaurant_id = v_rid
      and (i.stock_actual <= 0 or i.stock_actual <= i.stock_minimo)
  )
  select jsonb_build_object(
    'out_count', count(*) filter (where level = 'sin_stock'),
    'low_count', count(*) filter (where level = 'bajo'),
    'items', coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id',           id,
          'name',         name,
          'unit',         unit,
          'stock_actual', stock_actual,
          'stock_minimo', stock_minimo,
          'level',        level
        )
        -- agotados primero, luego los más bajos, luego alfabético
        order by (level = 'bajo'), stock_actual asc, name asc
      ),
      '[]'::jsonb
    )
  )
  into v_result
  from alerts;

  return v_result;
end;
$$;

alter function public.get_inventory_alerts() owner to postgres;
revoke all on function public.get_inventory_alerts() from public, anon;
grant execute on function public.get_inventory_alerts() to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 2) Fix: api_inventory_set_stock escribe por el libro mayor.
--    (Antes hacía UPDATE directo de stock_actual, salteándose el trigger que
--    recalcula stock_out → el menú del comensal podía quedar desincronizado.)
--    Firma y grants idénticos; solo cambia el cuerpo.
-- ----------------------------------------------------------------------------
create or replace function public.api_inventory_set_stock(p_token text, p_ingredient_id bigint, p_stock numeric)
  returns jsonb
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_rid    bigint;
  v_actual numeric;
  v_delta  numeric;
begin
  v_rid := public._api_key_restaurant(p_token);

  if p_stock is null or p_stock < 0 then
    raise exception 'stock inválido';
  end if;

  select stock_actual into v_actual
  from public.ingredients
  where id = p_ingredient_id and restaurant_id = v_rid
  for update;

  if v_actual is null then
    raise exception 'Insumo no encontrado';
  end if;

  v_delta := p_stock - v_actual;
  if v_delta <> 0 then
    -- El trigger mesa_apply_stock_movement mantiene stock_actual y recalcula stock_out.
    insert into public.stock_movements (restaurant_id, ingredient_id, delta, motivo, nota)
    values (v_rid, p_ingredient_id, v_delta, 'ajuste', 'API: fijar stock');
  end if;

  return jsonb_build_object('ingredient_id', p_ingredient_id, 'stock_actual', p_stock);
end;
$$;

alter function public.api_inventory_set_stock(text, bigint, numeric) owner to postgres;
revoke all on function public.api_inventory_set_stock(text, bigint, numeric) from public;
grant execute on function public.api_inventory_set_stock(text, bigint, numeric) to anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 3) Realtime en ingredients (para el badge/campana en vivo). RLS sigue
--    aplicando: cada cliente autenticado solo recibe cambios de su restaurante.
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'ingredients'
  ) then
    alter publication supabase_realtime add table public.ingredients;
  end if;
end $$;

commit;
