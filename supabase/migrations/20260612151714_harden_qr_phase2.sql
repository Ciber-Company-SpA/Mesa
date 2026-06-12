-- ============================================================================
-- FASE 2: Cierre de la frontera QR / RPC pública  (CRÍTICOS #1, #2 y #5)
--
-- Qué resuelve:
--   #1  anon ya NO puede enumerar tables ni table_qr_codes. El menú y la
--       resolución del QR pasan por RPC SECURITY DEFINER que reciben el TOKEN.
--   #2  Las RPC del comensal anónimo dejan de aceptar table_id (ID interno
--       enumerable) y exigen el qr_token de 32 chars como credencial de
--       capacidad. La mesa se resuelve DENTRO de la función a partir del token.
--   #5  Se revocan los DEFAULT PRIVILEGES que concedían ALL a anon/authenticated
--       sobre cualquier objeto futuro del schema public.
--
-- Principio de diseño:
--   - Solo las RPC del COMENSAL ANÓNIMO migran a p_qr_token.
--   - Las RPC de STAFF (pay_diner_orders, markTableOrdersAsPaid, etc.) NO cambian:
--     su credencial es la sesión authenticated (auth.uid()), no el table_id.
--   - El directorio público /restaurants/[slug] se mantiene: NO se revoca SELECT
--     sobre restaurants / products / categories (es público a propósito).
--
-- Estrategia de despliegue (sin ventana de ruptura):
--   1. Se crean las RPC nuevas con firma (p_qr_token, ...).
--   2. A las RPC viejas (p_table_id, ...) se les RETIRA el EXECUTE de anon en
--      esta misma migración  ->  el agujero se cierra al aplicar el SQL.
--   3. El DROP de las RPC viejas queda comentado al final: ejecutarlo en una
--      migración posterior, una vez verificado el frontend nuevo en producción.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 0) Helper interno: resolver un qr_token a su mesa.
--    SECURITY DEFINER: lee tables/table_qr_codes saltándose RLS, pero solo
--    devuelve la fila si el token existe y el QR está activo.
--    No se concede EXECUTE a anon directamente: lo usan las otras funciones.
-- ----------------------------------------------------------------------------
create or replace function public.resolve_qr_token(p_qr_token text)
returns table (
  table_id          bigint,
  table_number      int,
  restaurant_id     bigint,
  current_waiter_id bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select t.id, t.table_number, t.restaurant_id, t.current_waiter_id
  from public.table_qr_codes q
  join public.tables t on t.qr_code_id = q.id
  where q.qr_code = p_qr_token
    and q.qr_active = true;
$$;

alter function public.resolve_qr_token(text) owner to postgres;
revoke all on function public.resolve_qr_token(text) from public;
-- EXECUTE solo para los roles que ejecutan las RPC públicas (a través de ellas).
grant execute on function public.resolve_qr_token(text) to anon, authenticated, service_role;


-- ----------------------------------------------------------------------------
-- 1) get_public_menu(p_qr_token): reemplaza los SELECT directos de getMenuData.
--    Devuelve un único jsonb con restaurante + categorías + productos + datos
--    de la mesa. Solo expone columnas necesarias para el menú del comensal.
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
    'tableNumber', v_table.table_number
  ) into v_result;

  return v_result;
end;
$$;

alter function public.get_public_menu(text) owner to postgres;
revoke all on function public.get_public_menu(text) from public;
grant execute on function public.get_public_menu(text) to anon, authenticated, service_role;


-- ----------------------------------------------------------------------------
-- 2) claim_diner_slot por TOKEN: nueva firma (p_qr_token, p_diner_token).
--    Resuelve la mesa internamente. Misma lógica idempotente que la original.
-- ----------------------------------------------------------------------------
create or replace function public.claim_diner_slot_qr(
  p_qr_token    text,
  p_diner_token text
) returns jsonb
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_table_id bigint;
  v_slot     int;
begin
  if p_diner_token is null or length(p_diner_token) < 8 or length(p_diner_token) > 128 then
    raise exception 'Token de comensal inválido';
  end if;

  select table_id into v_table_id from public.resolve_qr_token(p_qr_token);
  if v_table_id is null then
    raise exception 'Mesa no encontrada o sin QR activo';
  end if;

  -- Si ya existe, devolver su slot.
  select diner_slot into v_slot
  from public.table_diners
  where table_id = v_table_id and diner_token = p_diner_token;

  if v_slot is not null then
    return jsonb_build_object('slot', v_slot, 'label', 'Comensal ' || v_slot);
  end if;

  -- Asignar siguiente slot libre, con reintento ante carrera.
  for i in 1..10 loop
    select coalesce(max(diner_slot), 0) + 1 into v_slot
    from public.table_diners
    where table_id = v_table_id;

    begin
      insert into public.table_diners (table_id, diner_slot, diner_token)
      values (v_table_id, v_slot, p_diner_token);
      return jsonb_build_object('slot', v_slot, 'label', 'Comensal ' || v_slot);
    exception when unique_violation then
      continue;
    end;
  end loop;

  raise exception 'No se pudo asignar slot de comensal';
end;
$$;

alter function public.claim_diner_slot_qr(text, text) owner to postgres;
revoke all on function public.claim_diner_slot_qr(text, text) from public;
grant execute on function public.claim_diner_slot_qr(text, text) to anon, authenticated, service_role;


-- ----------------------------------------------------------------------------
-- 3) get_orders_for_table por TOKEN: nueva firma (p_qr_token).
--    Devuelve solo los pedidos de la mesa resuelta por el token.
-- ----------------------------------------------------------------------------
create or replace function public.get_orders_for_table_qr(p_qr_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_table_id bigint;
  v_result   jsonb;
begin
  select table_id into v_table_id from public.resolve_qr_token(p_qr_token);
  if v_table_id is null then
    raise exception 'Mesa no encontrada o sin QR activo';
  end if;

  select coalesce(jsonb_agg(t order by t.created_at desc), '[]'::jsonb)
  into v_result
  from (
    select
      o.id,
      o.total,
      o.status_id,
      o.created_at,
      o.ready_at,
      jsonb_build_object('status_name', s.status_name) as order_status,
      (
        select coalesce(jsonb_agg(jsonb_build_object(
          'id', oi.id,
          'product_name', oi.product_name,
          'variant_name', oi.variant_name,
          'product_price', oi.product_price,
          'product_quantity', oi.product_quantity,
          'notes', oi.notes
        )), '[]'::jsonb)
        from public.order_items oi
        where oi.order_id = o.id
      ) as order_items
    from public.orders o
    left join public.order_status s on s.id = o.status_id
    where o.table_id = v_table_id
  ) t;

  return v_result;
end;
$$;

alter function public.get_orders_for_table_qr(text) owner to postgres;
revoke all on function public.get_orders_for_table_qr(text) from public;
grant execute on function public.get_orders_for_table_qr(text) to anon, authenticated, service_role;


-- ----------------------------------------------------------------------------
-- 4) create_public_order por TOKEN: nueva firma (p_qr_token, p_items, p_diner_token).
--    Resuelve mesa + restaurante por el token. Mantiene el MISMO retorno jsonb.
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

  -- Si vino token de comensal, reclamamos su slot (idempotente) vía la RPC nueva.
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
-- 5) request_bill por TOKEN: nueva firma (p_qr_token, p_diner_token).
-- ----------------------------------------------------------------------------
create or replace function public.request_bill_qr(
  p_qr_token    text,
  p_diner_token text default null
) returns jsonb
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_table_id      bigint;
  v_restaurant_id bigint;
  v_call_id       bigint;
  v_diner_label   text;
  v_diner_payload jsonb;
begin
  select table_id, restaurant_id into v_table_id, v_restaurant_id
  from public.resolve_qr_token(p_qr_token);

  if v_table_id is null then
    raise exception 'Mesa no encontrada o sin QR activo';
  end if;

  if p_diner_token is not null and length(p_diner_token) >= 8 then
    begin
      v_diner_payload := public.claim_diner_slot_qr(p_qr_token, p_diner_token);
      v_diner_label   := v_diner_payload->>'label';
    exception when others then
      v_diner_label := null;
    end;
  end if;

  insert into public.service_calls (table_id, restaurant_id, call_type, diner_label)
  values (v_table_id, v_restaurant_id, 'bill', v_diner_label)
  on conflict (table_id, call_type) where status = 'pending'
  do nothing
  returning id into v_call_id;

  if v_call_id is null then
    return jsonb_build_object('status', 'already_pending');
  end if;

  return jsonb_build_object('status', 'created', 'id', v_call_id);
end;
$$;

alter function public.request_bill_qr(text, text) owner to postgres;
revoke all on function public.request_bill_qr(text, text) from public;
grant execute on function public.request_bill_qr(text, text) to anon, authenticated, service_role;


-- ============================================================================
-- 6) CIERRE DEL AGUJERO  (CRÍTICO #1 y #2)
-- ============================================================================

-- 6a) anon ya NO puede leer mesas ni tokens directamente.
--     El menú y la resolución del QR pasan por las RPC de arriba.
revoke select on public.tables          from anon;
revoke select on public.table_qr_codes  from anon;

-- 6b) Retirar EXECUTE de anon sobre las RPC VIEJAS (por p_table_id).
--     Así, aunque sigan existiendo, anon no puede invocarlas con un ID inventado.
--     (authenticated/service_role las conservan por compatibilidad temporal;
--      el frontend nuevo deja de usarlas.)
revoke execute on function public.claim_diner_slot(bigint, text)            from anon;
revoke execute on function public.get_orders_for_table(bigint)              from anon;
revoke execute on function public.create_public_order(bigint, jsonb, text)  from anon;
revoke execute on function public.request_bill(bigint, text)                from anon;


-- ============================================================================
-- 7) CRÍTICO #5: DEFAULT PRIVILEGES inseguros.
--    Revoca el ALL automático a anon/authenticated sobre objetos futuros.
--    A partir de aquí, cada migración concede permisos explícitamente.
-- ============================================================================
alter default privileges for role postgres in schema public
  revoke all on tables    from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on functions from anon, authenticated;

commit;


-- ============================================================================
-- 8) CLEANUP DIFERIDO  (ejecutar en una migración POSTERIOR, tras verificar
--    en producción que el frontend nuevo —que usa *_qr— funciona).
--    NO descomentar en este archivo.
-- ============================================================================
-- begin;
--   drop function if exists public.claim_diner_slot(bigint, text);
--   drop function if exists public.get_orders_for_table(bigint);
--   drop function if exists public.create_public_order(bigint, jsonb, text);
--   drop function if exists public.request_bill(bigint, text);
-- commit;