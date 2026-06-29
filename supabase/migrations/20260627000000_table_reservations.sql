-- ============================================================================
-- RESERVACIONES DE MESAS — Fase 1
--
-- Construye los cimientos del sistema de reservas:
--   1. Config en `restaurants`: tipo de contacto (none/whatsapp), número de
--      WhatsApp y duración por defecto de la reserva (minutos).
--   2. Tabla `table_reservations`: una reserva = mesa + ventana [starts_at, ends_at).
--      Constraint EXCLUDE (btree_gist) impide solapar reservas ACTIVAS en la
--      misma mesa.
--   3. Helper `is_table_reserved_now(table_id)` reusable en todas las RPC.
--   4. RPC `create_reservation(...)`: la usa el staff en Fase 1 y la reutilizará
--      el webhook de WhatsApp en Fase 2 (source='whatsapp').
--   5. Bloqueo QR: se inyecta el check en `create_public_order_qr` y
--      `cart_add_item_qr`, y `get_public_menu` expone la reserva activa para el
--      banner del menú del cliente.
--
-- Patrón de RLS/RPC calcado de 20260611000000_service_calls.sql.
-- Las tres funciones públicas se re-declaran con su cuerpo VIGENTE más reciente
-- (create_public_order_qr: 20260621170000; cart_add_item_qr/get_*: ver abajo)
-- agregando únicamente el check de reserva.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1) Config de reservas en `restaurants`.
-- ----------------------------------------------------------------------------
alter table public.restaurants
  add column if not exists reservation_contact_type text not null default 'none',
  add column if not exists reservation_whatsapp text,
  add column if not exists reservation_duration_minutes int not null default 120;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'restaurants_reservation_contact_type_check'
  ) then
    alter table public.restaurants
      add constraint restaurants_reservation_contact_type_check
      check (reservation_contact_type in ('none', 'whatsapp'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'restaurants_reservation_duration_check'
  ) then
    alter table public.restaurants
      add constraint restaurants_reservation_duration_check
      check (reservation_duration_minutes between 15 and 720);
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- 2) Tabla de reservas.
-- ----------------------------------------------------------------------------
create extension if not exists btree_gist;

create table if not exists public.table_reservations (
  id             bigint generated always as identity primary key,
  table_id       bigint not null references public.tables(id) on delete cascade,
  restaurant_id  bigint not null references public.restaurants(id) on delete cascade,
  customer_name  text   not null,
  customer_phone text,
  party_size     int,
  starts_at      timestamptz not null,
  ends_at        timestamptz not null,
  status         text   not null default 'active' check (status in ('active', 'cancelled', 'completed')),
  source         text   not null default 'manual' check (source in ('manual', 'whatsapp')),
  notes          text,
  created_at     timestamptz not null default now(),
  created_by     bigint references public.users(id) on delete set null,
  constraint table_reservations_window_check check (ends_at > starts_at),
  -- Sin solapamiento entre reservas ACTIVAS de la misma mesa. tstzrange usa
  -- bounds [) por defecto: dos reservas contiguas (una termina justo cuando
  -- empieza la otra) NO se consideran solapadas.
  constraint table_reservations_no_overlap
    exclude using gist (
      table_id with =,
      tstzrange(starts_at, ends_at) with &&
    ) where (status = 'active')
);

comment on table public.table_reservations is
  'Reservas de mesa. Insert solo vía RPC create_reservation. Bloquea pedidos del QR durante [starts_at, ends_at).';

-- Realtime necesita la fila completa en los eventos.
alter table public.table_reservations replica identity full;

create index if not exists table_reservations_active_window_idx
  on public.table_reservations (table_id, starts_at, ends_at)
  where status = 'active';

create index if not exists table_reservations_restaurant_idx
  on public.table_reservations (restaurant_id, starts_at);

-- ----------------------------------------------------------------------------
-- 3) RLS: el staff lee/actualiza las reservas de su restaurante. El insert solo
--    pasa por la RPC (SECURITY DEFINER, corre como owner → bypassea RLS).
-- ----------------------------------------------------------------------------
alter table public.table_reservations enable row level security;

create policy "staff reads own restaurant reservations"
  on public.table_reservations for select to authenticated
  using (restaurant_id = public.current_user_restaurant_id());

create policy "staff updates own restaurant reservations"
  on public.table_reservations for update to authenticated
  using (restaurant_id = public.current_user_restaurant_id())
  with check (restaurant_id = public.current_user_restaurant_id());

create policy "no direct insert reservations"
  on public.table_reservations for insert to authenticated, anon
  with check (false);

-- Publicar en Realtime (idempotente).
do $$
begin
  alter publication supabase_realtime add table public.table_reservations;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

-- ----------------------------------------------------------------------------
-- 4) Helper de bloqueo: ¿la mesa está reservada AHORA?
-- ----------------------------------------------------------------------------
create or replace function public.is_table_reserved_now(p_table_id bigint)
returns boolean
  language sql
  stable
  security definer
  set search_path = public
as $$
  select exists (
    select 1
    from public.table_reservations
    where table_id = p_table_id
      and status = 'active'
      and now() >= starts_at
      and now() <  ends_at
  );
$$;

alter function public.is_table_reserved_now(bigint) owner to postgres;
revoke all on function public.is_table_reserved_now(bigint) from public;
grant execute on function public.is_table_reserved_now(bigint) to authenticated, service_role;

-- Check EN VIVO por token de QR, para el banner del menú del cliente (anon).
-- get_public_menu está cacheado 5 min, así que el menú usa esta RPC sin caché
-- como fuente de verdad del bloqueo visual.
create or replace function public.check_table_reservation(p_qr_token text)
returns jsonb
  language plpgsql
  stable
  security definer
  set search_path = public
as $$
declare
  v_table_id bigint;
  v_ends_at  timestamptz;
begin
  select table_id into v_table_id from public.resolve_qr_token(p_qr_token);
  if v_table_id is null then
    return jsonb_build_object('reserved', false, 'ends_at', null);
  end if;

  select ends_at into v_ends_at
  from public.table_reservations
  where table_id = v_table_id
    and status = 'active'
    and now() >= starts_at
    and now() <  ends_at
  order by starts_at
  limit 1;

  return jsonb_build_object('reserved', v_ends_at is not null, 'ends_at', v_ends_at);
end;
$$;

alter function public.check_table_reservation(text) owner to postgres;
revoke all on function public.check_table_reservation(text) from public;
grant execute on function public.check_table_reservation(text) to anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 5) RPC create_reservation: crea la reserva calculando ends_at desde la
--    duración (la pasada o el default del restaurante). Reusable por el bot de
--    WhatsApp en Fase 2 (source='whatsapp').
-- ----------------------------------------------------------------------------
create or replace function public.create_reservation(
  p_table_id         bigint,
  p_customer_name    text,
  p_starts_at        timestamptz,
  p_duration_minutes int  default null,
  p_customer_phone   text default null,
  p_party_size       int  default null,
  p_source           text default 'manual',
  p_notes            text default null
) returns jsonb
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_rest       bigint;
  v_table_rest bigint;
  v_user       bigint;
  v_duration   int;
  v_ends_at    timestamptz;
  v_name       text;
  v_id         bigint;
begin
  v_rest := public.current_user_restaurant_id();
  if v_rest is null then
    raise exception 'Usuario sin restaurante';
  end if;

  -- La mesa debe pertenecer al restaurante del usuario.
  select restaurant_id into v_table_rest from public.tables where id = p_table_id;
  if v_table_rest is null or v_table_rest <> v_rest then
    raise exception 'La mesa no pertenece a tu restaurante';
  end if;

  v_name := trim(coalesce(p_customer_name, ''));
  if v_name = '' then
    raise exception 'El nombre de la reserva es obligatorio';
  end if;

  if p_starts_at is null then
    raise exception 'La fecha y hora de inicio es obligatoria';
  end if;

  if coalesce(p_source, 'manual') not in ('manual', 'whatsapp') then
    raise exception 'Origen de reserva inválido';
  end if;

  -- Duración: la explícita o el default del restaurante.
  select coalesce(p_duration_minutes, reservation_duration_minutes, 120)
    into v_duration
  from public.restaurants
  where id = v_rest;

  if v_duration < 15 or v_duration > 720 then
    raise exception 'La duración debe estar entre 15 y 720 minutos';
  end if;

  v_ends_at := p_starts_at + make_interval(mins => v_duration);

  select id into v_user from public.users where auth_user_id = auth.uid() limit 1;

  begin
    insert into public.table_reservations
      (table_id, restaurant_id, customer_name, customer_phone, party_size,
       starts_at, ends_at, source, notes, created_by)
    values
      (p_table_id, v_rest, v_name,
       nullif(trim(coalesce(p_customer_phone, '')), ''),
       p_party_size, p_starts_at, v_ends_at, coalesce(p_source, 'manual'),
       nullif(trim(coalesce(p_notes, '')), ''), v_user)
    returning id into v_id;
  exception
    when exclusion_violation then
      raise exception 'Ya hay una reserva activa que se cruza con ese horario en esta mesa';
  end;

  return jsonb_build_object(
    'id',        v_id,
    'table_id',  p_table_id,
    'starts_at', p_starts_at,
    'ends_at',   v_ends_at
  );
end;
$$;

alter function public.create_reservation(bigint, text, timestamptz, int, text, int, text, text) owner to postgres;
revoke all on function public.create_reservation(bigint, text, timestamptz, int, text, int, text, text) from public;
grant execute on function public.create_reservation(bigint, text, timestamptz, int, text, int, text, text) to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 6) get_public_menu: re-declaración con la clave 'reservation' (reserva activa
--    de la mesa, o null). Cuerpo idéntico a 20260612151714_harden_qr_phase2.sql.
-- ----------------------------------------------------------------------------
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
        'category_id',    p.category_id,
        'categories',     jsonb_build_object('category_name', pc.category_name),
        'product_variants', (
          select coalesce(jsonb_agg(jsonb_build_object(
            'id',            pv.id,
            'variant_name',  pv.variant_name,
            'variant_price', pv.variant_price
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
    'tableNumber', v_table.table_number,
    'reservation', (
      select jsonb_build_object('ends_at', tr.ends_at)
      from public.table_reservations tr
      where tr.table_id = v_table.table_id
        and tr.status = 'active'
        and now() >= tr.starts_at
        and now() <  tr.ends_at
      order by tr.starts_at
      limit 1
    )
  ) into v_result;

  return v_result;
end;
$$;

alter function public.get_public_menu(text) owner to postgres;
revoke all on function public.get_public_menu(text) from public;
grant execute on function public.get_public_menu(text) to anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 7) create_public_order_qr: re-declaración con el check de reserva. Cuerpo
--    idéntico a 20260621170000_generic_stock_error.sql, agregando el bloqueo
--    justo después de resolver la mesa (antes del rate limit).
-- ----------------------------------------------------------------------------
create or replace function public.create_public_order_qr(
  p_qr_token    text,
  p_items       jsonb,
  p_diner_token text default null
) returns jsonb
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_table_id        bigint;
  v_restaurant_id   bigint;
  v_order_id        bigint;
  v_initial_status  int;
  v_order_dest      text;
  v_item            jsonb;
  v_product_id      bigint;
  v_variant_id      bigint;
  v_qty             int;
  v_notes           text;
  v_unit_price      numeric;
  v_product_name    text;
  v_variant_name    text;
  v_product_status  int;
  v_total           numeric := 0;
  v_item_count      int;
  v_created_at      timestamptz;
  v_status_name     text;
  v_diner_slot      int;
  v_diner_label     text;
  v_diner_payload   jsonb;
  v_recipe          record;
  v_needed          numeric;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'items inválido';
  end if;

  v_item_count := jsonb_array_length(p_items);
  if v_item_count < 1 or v_item_count > 30 then
    raise exception 'El pedido debe tener entre 1 y 30 líneas';
  end if;

  select table_id, restaurant_id into v_table_id, v_restaurant_id
  from public.resolve_qr_token(p_qr_token);

  if v_table_id is null then
    raise exception 'Mesa no encontrada o sin QR activo';
  end if;

  -- BLOQUEO POR RESERVA: durante la ventana, nadie más puede pedir en esta mesa.
  if public.is_table_reserved_now(v_table_id) then
    raise exception 'Esta mesa está reservada en este horario';
  end if;

  perform public.rate_limit_check('order:' || v_table_id, 15, 60);

  if p_diner_token is not null and length(p_diner_token) >= 8 then
    v_diner_payload := public.claim_diner_slot_qr(p_qr_token, p_diner_token);
    v_diner_slot    := (v_diner_payload->>'slot')::int;
    v_diner_label   := v_diner_payload->>'label';
  end if;

  select r.order_destination into v_order_dest
  from public.restaurants r
  where r.id = v_restaurant_id;

  v_initial_status := case when v_order_dest = 'kitchen' then 2 else 1 end;

  insert into public.orders
    (table_id, restaurant_id, total, status_id, created_at, diner_slot, diner_label)
  values
    (v_table_id, v_restaurant_id, 0, v_initial_status, now(), v_diner_slot, v_diner_label)
  returning id, created_at into v_order_id, v_created_at;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_product_id := (v_item->>'product_id')::bigint;
    v_variant_id := nullif(v_item->>'variant_id', '')::bigint;
    v_qty        := coalesce((v_item->>'quantity')::int, 0);
    v_notes      := left(coalesce(v_item->>'notes', ''), 250);

    if v_qty < 1 or v_qty > 20 then
      raise exception 'Cantidad inválida (1-20) para product_id %', v_product_id;
    end if;

    select p.product_name, p.product_price, p.status_id
      into v_product_name, v_unit_price, v_product_status
    from public.products p
    where p.id = v_product_id
      and p.restaurant_id = v_restaurant_id;

    if v_product_name is null then
      raise exception 'Producto % no pertenece al restaurante de la mesa', v_product_id;
    end if;

    if v_product_status <> 1 then
      raise exception 'El producto "%" no está disponible', v_product_name;
    end if;

    v_variant_name := null;

    if v_variant_id is not null then
      select pv.variant_price, pv.variant_name
        into v_unit_price, v_variant_name
      from public.product_variants pv
      where pv.id = v_variant_id
        and pv.product_id = v_product_id;

      if v_variant_name is null then
        raise exception 'La variante % no pertenece al producto %', v_variant_id, v_product_id;
      end if;
    end if;

    -- DESCUENTO DE STOCK POR RECETA (bloqueo duro). Mensaje genérico al cliente:
    -- no se revela qué insumo faltó.
    for v_recipe in
      select r.ingredient_id, r.cantidad, i.stock_actual
      from public.product_recipes r
      join public.ingredients i on i.id = r.ingredient_id
      where (v_variant_id is not null and r.variant_id = v_variant_id)
         or (v_variant_id is null     and r.product_id = v_product_id)
      for update of i
    loop
      v_needed := v_recipe.cantidad * v_qty;
      if v_recipe.stock_actual < v_needed then
        raise exception 'El producto "%" ya no está disponible',
          coalesce(v_variant_name, v_product_name);
      end if;

      insert into public.stock_movements
        (restaurant_id, ingredient_id, delta, motivo, order_id)
      values
        (v_restaurant_id, v_recipe.ingredient_id, -v_needed, 'venta', v_order_id);
    end loop;

    insert into public.order_items
      (order_id, product_id, product_quantity, product_name, product_price,
       notes, variant_id, variant_name)
    values
      (v_order_id, v_product_id, v_qty, v_product_name, v_unit_price,
       nullif(v_notes, ''), v_variant_id, v_variant_name);

    v_total := v_total + (v_unit_price * v_qty);
  end loop;

  update public.orders set total = round(v_total)::int where id = v_order_id;

  select s.status_name into v_status_name
  from public.order_status s
  where s.id = v_initial_status;

  return jsonb_build_object(
    'id',            v_order_id,
    'status_id',     v_initial_status,
    'status_name',   v_status_name,
    'created_at',    v_created_at,
    'table_id',      v_table_id,
    'restaurant_id', v_restaurant_id,
    'total',         round(v_total)::int,
    'diner_slot',    v_diner_slot,
    'diner_label',   v_diner_label
  );
end;
$$;

alter function public.create_public_order_qr(text, jsonb, text) owner to postgres;
revoke all on function public.create_public_order_qr(text, jsonb, text) from public;
grant execute on function public.create_public_order_qr(text, jsonb, text) to anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 8) cart_add_item_qr: re-declaración con el check de reserva. Cuerpo idéntico a
--    20260613120000_cart_qr_and_lock_rpcs.sql, agregando el bloqueo tras
--    resolver la mesa.
-- ----------------------------------------------------------------------------
create or replace function public.cart_add_item_qr(
  p_qr_token   text,
  p_product_id bigint,
  p_variant_id bigint,
  p_quantity   integer,
  p_notes      text,
  p_added_by   text
) returns void
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_table_id      bigint;
  v_restaurant_id bigint;
  v_price         int;
  v_qty           int;
  v_notes         text;
  v_existing_id   uuid;
begin
  select table_id, restaurant_id into v_table_id, v_restaurant_id
  from public.resolve_qr_token(p_qr_token);
  if v_table_id is null then
    raise exception 'Mesa no encontrada o sin QR activo';
  end if;

  -- BLOQUEO POR RESERVA: no se puede armar carrito en una mesa reservada.
  if public.is_table_reserved_now(v_table_id) then
    raise exception 'Esta mesa está reservada en este horario';
  end if;

  v_qty := coalesce(p_quantity, 1);
  if v_qty < 1 or v_qty > 20 then
    raise exception 'Cantidad inválida (1-20)';
  end if;

  v_notes := nullif(left(coalesce(p_notes, ''), 250), '');

  v_price := public.cart_resolve_price(v_restaurant_id, p_product_id, p_variant_id);
  if v_price is null then
    raise exception 'Producto o variante no pertenece al restaurante de la mesa';
  end if;

  select id into v_existing_id
  from public.table_cart_items
  where table_id = v_table_id
    and product_id = p_product_id
    and variant_id is not distinct from p_variant_id
    and notes is not distinct from v_notes
  limit 1;

  if v_existing_id is not null then
    update public.table_cart_items
    set quantity = quantity + v_qty
    where id = v_existing_id;
  else
    insert into public.table_cart_items
      (restaurant_id, table_id, product_id, variant_id, unit_price, quantity, notes, added_by)
    values
      (v_restaurant_id, v_table_id, p_product_id, p_variant_id, v_price, v_qty, v_notes,
       nullif(left(coalesce(p_added_by, ''), 100), ''));
  end if;
end;
$$;

alter function public.cart_add_item_qr(text, bigint, bigint, integer, text, text) owner to postgres;
revoke all on function public.cart_add_item_qr(text, bigint, bigint, integer, text, text) from public;
grant execute on function public.cart_add_item_qr(text, bigint, bigint, integer, text, text) to anon, authenticated, service_role;

commit;
