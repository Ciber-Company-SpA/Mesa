-- ============================================================================
-- STOCK / INVENTARIO POR RECETAS (BOM)
--
-- Objetivo:
--   Control de stock real para MESA. Se cuenta a nivel de INSUMO (ingredients),
--   y cada producto/variante define una RECETA (product_recipes) que consume
--   esos insumos por unidad vendida. Al crear un pedido, create_public_order_qr
--   descuenta el stock de forma atómica y BLOQUEA la venta si no alcanza.
--
-- Decisiones (acordadas con el usuario):
--   - Inventario por ingredientes/recetas (no solo producto terminado).
--   - Stock a nivel VARIANTE cuando el producto tiene variantes; si no, a nivel
--     PRODUCTO. La receta cuelga de variant_id o de product_id (exactamente uno).
--   - Bloqueo DURO al llegar a 0: la RPC rechaza la línea nombrando el insumo.
--   - Unidades base: 'unidad', 'g' (peso) y 'ml' (volumen). kg/L se convierten
--     a g/ml en la capa de UI antes de guardar.
--   - Opt-in: un producto SIN receta no descuenta nada (se vende libre).
--
-- Fuente de verdad:
--   stock_movements es el libro mayor. ingredients.stock_actual es un saldo
--   mantenido por trigger. products/product_variants.stock_out es un flag
--   denormalizado para que el menú QR (realtime) muestre "agotado" al instante.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1) INSUMOS
-- ----------------------------------------------------------------------------
create table if not exists public.ingredients (
  id            bigint generated always as identity primary key,
  restaurant_id bigint  not null references public.restaurants(id) on delete cascade,
  name          text    not null,
  unit          text    not null check (unit in ('unidad', 'g', 'ml')),
  stock_actual  numeric not null default 0,
  stock_minimo  numeric not null default 0 check (stock_minimo >= 0),
  created_at    timestamptz not null default now()
);

create index if not exists ingredients_restaurant_idx
  on public.ingredients (restaurant_id);

alter table public.ingredients owner to postgres;

-- ----------------------------------------------------------------------------
-- 2) RECETAS (BOM): liga PRODUCTO o VARIANTE -> INSUMO con cantidad por unidad
-- ----------------------------------------------------------------------------
create table if not exists public.product_recipes (
  id            bigint generated always as identity primary key,
  restaurant_id bigint  not null references public.restaurants(id) on delete cascade,
  product_id    bigint  references public.products(id)         on delete cascade,
  variant_id    bigint  references public.product_variants(id) on delete cascade,
  ingredient_id bigint  not null references public.ingredients(id) on delete cascade,
  cantidad      numeric not null check (cantidad > 0),
  created_at    timestamptz not null default now(),
  -- exactamente uno de product_id / variant_id (nivel producto XOR variante)
  constraint product_recipes_target_chk check (
    (product_id is not null)::int + (variant_id is not null)::int = 1
  ),
  -- un insumo no se repite dentro de la misma receta (los NULL no chocan entre sí)
  constraint product_recipes_unique_product unique (product_id, ingredient_id),
  constraint product_recipes_unique_variant unique (variant_id, ingredient_id)
);

create index if not exists product_recipes_ingredient_idx on public.product_recipes (ingredient_id);
create index if not exists product_recipes_product_idx    on public.product_recipes (product_id);
create index if not exists product_recipes_variant_idx    on public.product_recipes (variant_id);

alter table public.product_recipes owner to postgres;

-- ----------------------------------------------------------------------------
-- 3) MOVIMIENTOS DE STOCK (libro mayor)
-- ----------------------------------------------------------------------------
create table if not exists public.stock_movements (
  id            bigint generated always as identity primary key,
  restaurant_id bigint  not null references public.restaurants(id) on delete cascade,
  ingredient_id bigint  not null references public.ingredients(id) on delete cascade,
  delta         numeric not null,           -- negativo = consumo, positivo = ingreso
  motivo        text    not null check (motivo in ('inicial','venta','reposicion','ajuste','conteo','merma')),
  order_id      bigint  references public.orders(id) on delete set null,
  user_id       bigint  references public.users(id)  on delete set null,
  nota          text,
  created_at    timestamptz not null default now()
);

create index if not exists stock_movements_ingredient_idx on public.stock_movements (ingredient_id, created_at desc);
create index if not exists stock_movements_restaurant_idx  on public.stock_movements (restaurant_id, created_at desc);
create index if not exists stock_movements_order_idx       on public.stock_movements (order_id);

alter table public.stock_movements owner to postgres;

-- ----------------------------------------------------------------------------
-- 4) Flag denormalizado de disponibilidad por stock (para realtime del menú).
--    Convive con status_id (toggle manual). El menú está "agotado" si
--    status_id <> 1 (manual) O stock_out = true (automático por receta).
-- ----------------------------------------------------------------------------
alter table public.products         add column if not exists stock_out boolean not null default false;
alter table public.product_variants add column if not exists stock_out boolean not null default false;

-- ----------------------------------------------------------------------------
-- 5) Recalcular disponibilidad de un destino (producto o variante).
--    "Agotado" = existe al menos un insumo de su receta con stock < cantidad
--    necesaria para 1 unidad. Sin receta => disponible (no se rastrea).
-- ----------------------------------------------------------------------------
create or replace function public.mesa_recompute_target_availability(
  p_product_id bigint,
  p_variant_id bigint
) returns void
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_short boolean;
begin
  if p_variant_id is not null then
    select exists (
      select 1
      from public.product_recipes r
      join public.ingredients i on i.id = r.ingredient_id
      where r.variant_id = p_variant_id
        and i.stock_actual < r.cantidad
    ) into v_short;

    update public.product_variants
      set stock_out = coalesce(v_short, false)
      where id = p_variant_id
        and stock_out is distinct from coalesce(v_short, false);

  elsif p_product_id is not null then
    select exists (
      select 1
      from public.product_recipes r
      join public.ingredients i on i.id = r.ingredient_id
      where r.product_id = p_product_id
        and i.stock_actual < r.cantidad
    ) into v_short;

    update public.products
      set stock_out = coalesce(v_short, false)
      where id = p_product_id
        and stock_out is distinct from coalesce(v_short, false);
  end if;
end;
$$;

alter function public.mesa_recompute_target_availability(bigint, bigint) owner to postgres;

-- Recalcular todos los destinos que usan un insumo dado.
create or replace function public.mesa_recompute_availability_for_ingredient(
  p_ingredient_id bigint
) returns void
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  r record;
begin
  for r in
    select distinct product_id, variant_id
    from public.product_recipes
    where ingredient_id = p_ingredient_id
  loop
    perform public.mesa_recompute_target_availability(r.product_id, r.variant_id);
  end loop;
end;
$$;

alter function public.mesa_recompute_availability_for_ingredient(bigint) owner to postgres;

-- ----------------------------------------------------------------------------
-- 6) Trigger: mantener ingredients.stock_actual desde el libro mayor y
--    recalcular disponibilidad de los productos afectados.
-- ----------------------------------------------------------------------------
create or replace function public.mesa_apply_stock_movement()
  returns trigger
  language plpgsql
  security definer
  set search_path = public
as $$
begin
  update public.ingredients
    set stock_actual = stock_actual + new.delta
    where id = new.ingredient_id;

  perform public.mesa_recompute_availability_for_ingredient(new.ingredient_id);
  return new;
end;
$$;

alter function public.mesa_apply_stock_movement() owner to postgres;

drop trigger if exists trg_apply_stock_movement on public.stock_movements;
create trigger trg_apply_stock_movement
  after insert on public.stock_movements
  for each row execute function public.mesa_apply_stock_movement();

-- Trigger: al crear/editar/borrar una receta, recalcular el destino afectado.
create or replace function public.mesa_recipe_changed()
  returns trigger
  language plpgsql
  security definer
  set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.mesa_recompute_target_availability(old.product_id, old.variant_id);
    return old;
  end if;
  perform public.mesa_recompute_target_availability(new.product_id, new.variant_id);
  return new;
end;
$$;

alter function public.mesa_recipe_changed() owner to postgres;

drop trigger if exists trg_recipe_changed on public.product_recipes;
create trigger trg_recipe_changed
  after insert or update or delete on public.product_recipes
  for each row execute function public.mesa_recipe_changed();

-- ----------------------------------------------------------------------------
-- 7) RLS: aislamiento por restaurante. Lectura para staff del local; escritura
--    de insumos/recetas solo admin. Los movimientos se escriben por RPC
--    (SECURITY DEFINER), nunca directo.
-- ----------------------------------------------------------------------------
alter table public.ingredients      enable row level security;
alter table public.product_recipes  enable row level security;
alter table public.stock_movements  enable row level security;

-- INGREDIENTS
create policy "staff reads own ingredients" on public.ingredients
  for select to authenticated
  using (restaurant_id = public.current_user_restaurant_id());

create policy "admin inserts own ingredients" on public.ingredients
  for insert to authenticated
  with check (restaurant_id = public.current_user_restaurant_id() and public.current_user_is_admin());

create policy "admin updates own ingredients" on public.ingredients
  for update to authenticated
  using (restaurant_id = public.current_user_restaurant_id() and public.current_user_is_admin())
  with check (restaurant_id = public.current_user_restaurant_id() and public.current_user_is_admin());

create policy "admin deletes own ingredients" on public.ingredients
  for delete to authenticated
  using (restaurant_id = public.current_user_restaurant_id() and public.current_user_is_admin());

-- PRODUCT_RECIPES
create policy "staff reads own recipes" on public.product_recipes
  for select to authenticated
  using (restaurant_id = public.current_user_restaurant_id());

create policy "admin inserts own recipes" on public.product_recipes
  for insert to authenticated
  with check (restaurant_id = public.current_user_restaurant_id() and public.current_user_is_admin());

create policy "admin updates own recipes" on public.product_recipes
  for update to authenticated
  using (restaurant_id = public.current_user_restaurant_id() and public.current_user_is_admin())
  with check (restaurant_id = public.current_user_restaurant_id() and public.current_user_is_admin());

create policy "admin deletes own recipes" on public.product_recipes
  for delete to authenticated
  using (restaurant_id = public.current_user_restaurant_id() and public.current_user_is_admin());

-- STOCK_MOVEMENTS: solo lectura para staff; sin policy de escritura directa.
create policy "staff reads own movements" on public.stock_movements
  for select to authenticated
  using (restaurant_id = public.current_user_restaurant_id());

-- Grants (RLS sigue filtrando filas).
grant select, insert, update, delete on table public.ingredients     to authenticated, service_role;
grant select, insert, update, delete on table public.product_recipes to authenticated, service_role;
grant select                          on table public.stock_movements to authenticated;
grant all                             on table public.stock_movements to service_role;

-- ----------------------------------------------------------------------------
-- 8) RPCs de administración del inventario (admin del propio restaurante).
--    Todas escriben el libro mayor; el trigger mantiene el saldo.
-- ----------------------------------------------------------------------------

-- Crea un insumo y su stock inicial (movimiento 'inicial') de forma atómica.
create or replace function public.create_ingredient(
  p_name         text,
  p_unit         text,
  p_stock_inicial numeric default 0,
  p_stock_minimo  numeric default 0
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
  if coalesce(p_stock_inicial, 0) < 0 or coalesce(p_stock_minimo, 0) < 0 then
    raise exception 'el stock no puede ser negativo';
  end if;

  insert into public.ingredients (restaurant_id, name, unit, stock_actual, stock_minimo)
  values (v_rest, trim(p_name), p_unit, 0, coalesce(p_stock_minimo, 0))
  returning * into v_row;

  if coalesce(p_stock_inicial, 0) > 0 then
    select id into v_user from public.users where auth_user_id = auth.uid() limit 1;
    insert into public.stock_movements (restaurant_id, ingredient_id, delta, motivo, user_id, nota)
    values (v_rest, v_row.id, p_stock_inicial, 'inicial', v_user, 'Stock inicial');
    -- refrescar el saldo recién aplicado por el trigger
    select * into v_row from public.ingredients where id = v_row.id;
  end if;

  return v_row;
end;
$$;

alter function public.create_ingredient(text, text, numeric, numeric) owner to postgres;
revoke all on function public.create_ingredient(text, text, numeric, numeric) from public;
grant execute on function public.create_ingredient(text, text, numeric, numeric) to authenticated, service_role;

-- Reposición: suma stock (motivo 'reposicion').
create or replace function public.restock_ingredient(
  p_ingredient_id bigint,
  p_cantidad      numeric,
  p_nota          text default null
) returns void
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_rest bigint;
  v_user bigint;
begin
  if not public.current_user_is_admin() then
    raise exception 'no autorizado';
  end if;
  if coalesce(p_cantidad, 0) <= 0 then
    raise exception 'la cantidad a reponer debe ser mayor a 0';
  end if;

  select restaurant_id into v_rest from public.ingredients where id = p_ingredient_id;
  if v_rest is null or v_rest <> public.current_user_restaurant_id() then
    raise exception 'el insumo no pertenece a tu restaurante';
  end if;

  select id into v_user from public.users where auth_user_id = auth.uid() limit 1;
  insert into public.stock_movements (restaurant_id, ingredient_id, delta, motivo, user_id, nota)
  values (v_rest, p_ingredient_id, p_cantidad, 'reposicion', v_user, p_nota);
end;
$$;

alter function public.restock_ingredient(bigint, numeric, text) owner to postgres;
revoke all on function public.restock_ingredient(bigint, numeric, text) from public;
grant execute on function public.restock_ingredient(bigint, numeric, text) to authenticated, service_role;

-- Ajuste/conteo/merma: fija el stock a un valor absoluto, registrando el delta.
create or replace function public.set_ingredient_stock(
  p_ingredient_id bigint,
  p_nuevo_stock   numeric,
  p_motivo        text default 'ajuste',
  p_nota          text default null
) returns void
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_rest    bigint;
  v_user    bigint;
  v_actual  numeric;
  v_delta   numeric;
begin
  if not public.current_user_is_admin() then
    raise exception 'no autorizado';
  end if;
  if p_motivo not in ('ajuste', 'conteo', 'merma') then
    raise exception 'motivo inválido';
  end if;
  if coalesce(p_nuevo_stock, -1) < 0 then
    raise exception 'el stock no puede ser negativo';
  end if;

  select restaurant_id, stock_actual into v_rest, v_actual
  from public.ingredients
  where id = p_ingredient_id
  for update;

  if v_rest is null or v_rest <> public.current_user_restaurant_id() then
    raise exception 'el insumo no pertenece a tu restaurante';
  end if;

  v_delta := p_nuevo_stock - v_actual;
  if v_delta = 0 then
    return;  -- nada que registrar
  end if;

  select id into v_user from public.users where auth_user_id = auth.uid() limit 1;
  insert into public.stock_movements (restaurant_id, ingredient_id, delta, motivo, user_id, nota)
  values (v_rest, p_ingredient_id, v_delta, p_motivo, v_user, p_nota);
end;
$$;

alter function public.set_ingredient_stock(bigint, numeric, text, text) owner to postgres;
revoke all on function public.set_ingredient_stock(bigint, numeric, text, text) from public;
grant execute on function public.set_ingredient_stock(bigint, numeric, text, text) to authenticated, service_role;

-- Reemplaza atómicamente la receta de un destino (producto XOR variante).
-- p_items: jsonb array de { "ingredient_id": bigint, "cantidad": numeric }.
create or replace function public.set_product_recipe(
  p_product_id bigint,
  p_variant_id bigint,
  p_items      jsonb
) returns void
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_rest        bigint;
  v_target_rest bigint;
  v_item        jsonb;
  v_ing_id      bigint;
  v_cantidad    numeric;
  v_ing_rest    bigint;
begin
  if not public.current_user_is_admin() then
    raise exception 'no autorizado';
  end if;

  v_rest := public.current_user_restaurant_id();
  if v_rest is null then
    raise exception 'usuario sin restaurante';
  end if;

  -- exactamente uno de product_id / variant_id
  if (p_product_id is not null)::int + (p_variant_id is not null)::int <> 1 then
    raise exception 'debe indicar producto o variante (exactamente uno)';
  end if;

  -- validar pertenencia del destino al restaurante del admin
  if p_variant_id is not null then
    select p.restaurant_id into v_target_rest
    from public.product_variants pv
    join public.products p on p.id = pv.product_id
    where pv.id = p_variant_id;
  else
    select p.restaurant_id into v_target_rest
    from public.products p
    where p.id = p_product_id;
  end if;

  if v_target_rest is null or v_target_rest <> v_rest then
    raise exception 'el producto/variante no pertenece a tu restaurante';
  end if;

  if p_items is not null and jsonb_typeof(p_items) <> 'array' then
    raise exception 'items inválido';
  end if;

  -- reemplazo total: borrar receta previa del destino
  if p_variant_id is not null then
    delete from public.product_recipes where variant_id = p_variant_id;
  else
    delete from public.product_recipes where product_id = p_product_id;
  end if;

  -- insertar las nuevas líneas (validando cada insumo)
  if p_items is not null then
    for v_item in select * from jsonb_array_elements(p_items)
    loop
      v_ing_id   := (v_item->>'ingredient_id')::bigint;
      v_cantidad := (v_item->>'cantidad')::numeric;

      if v_ing_id is null or coalesce(v_cantidad, 0) <= 0 then
        raise exception 'línea de receta inválida';
      end if;

      select restaurant_id into v_ing_rest from public.ingredients where id = v_ing_id;
      if v_ing_rest is null or v_ing_rest <> v_rest then
        raise exception 'insumo % no pertenece a tu restaurante', v_ing_id;
      end if;

      insert into public.product_recipes
        (restaurant_id, product_id, variant_id, ingredient_id, cantidad)
      values
        (v_rest, p_product_id, p_variant_id, v_ing_id, v_cantidad);
    end loop;
  end if;

  -- recomputar disponibilidad del destino tras el reemplazo
  perform public.mesa_recompute_target_availability(p_product_id, p_variant_id);
end;
$$;

alter function public.set_product_recipe(bigint, bigint, jsonb) owner to postgres;
revoke all on function public.set_product_recipe(bigint, bigint, jsonb) from public;
grant execute on function public.set_product_recipe(bigint, bigint, jsonb) to authenticated, service_role;

commit;
