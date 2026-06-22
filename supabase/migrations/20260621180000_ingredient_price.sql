-- ============================================================================
-- Precio (costo) por insumo.
--
-- ingredients.precio = costo por UNIDAD BASE (por g, por ml o por unidad). La UI
-- recibe/ muestra el precio por medida natural (ej: $/kg, $/L) y convierte.
-- Recrea create_ingredient para aceptar p_precio.
-- ============================================================================

begin;

alter table public.ingredients
  add column if not exists precio numeric not null default 0 check (precio >= 0);

drop function if exists public.create_ingredient(text, text, numeric, numeric);

create or replace function public.create_ingredient(
  p_name          text,
  p_unit          text,
  p_stock_inicial numeric default 0,
  p_stock_minimo  numeric default 0,
  p_precio        numeric default 0
) returns public.ingredients
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_rest bigint;
  v_user bigint;
  v_row  public.ingredients;
begin
  if not public.current_user_is_admin() then
    raise exception 'no autorizado';
  end if;

  v_rest := public.current_user_restaurant_id();
  if v_rest is null then
    raise exception 'usuario sin restaurante';
  end if;

  if coalesce(trim(p_name), '') = '' then
    raise exception 'el nombre del insumo es obligatorio';
  end if;
  if p_unit not in ('unidad', 'g', 'ml') then
    raise exception 'unidad inválida';
  end if;
  if coalesce(p_stock_inicial, 0) < 0 or coalesce(p_stock_minimo, 0) < 0 or coalesce(p_precio, 0) < 0 then
    raise exception 'valores negativos no permitidos';
  end if;

  insert into public.ingredients (restaurant_id, name, unit, stock_actual, stock_minimo, precio)
  values (v_rest, trim(p_name), p_unit, 0, coalesce(p_stock_minimo, 0), coalesce(p_precio, 0))
  returning * into v_row;

  if coalesce(p_stock_inicial, 0) > 0 then
    select id into v_user from public.users where auth_user_id = auth.uid() limit 1;
    insert into public.stock_movements (restaurant_id, ingredient_id, delta, motivo, user_id, nota)
    values (v_rest, v_row.id, p_stock_inicial, 'inicial', v_user, 'Stock inicial');
    select * into v_row from public.ingredients where id = v_row.id;
  end if;

  return v_row;
end;
$$;

alter function public.create_ingredient(text, text, numeric, numeric, numeric) owner to postgres;
revoke all on function public.create_ingredient(text, text, numeric, numeric, numeric) from public;
grant execute on function public.create_ingredient(text, text, numeric, numeric, numeric) to authenticated, service_role;

commit;
