-- ============================================================================
-- FASE 3: Rate limit dentro de PostgreSQL para las RPC públicas (CRÍTICO #3)
--
-- Problema que resuelve:
--   El rate limit de Upstash vive solo en la Server Action y "falla abierto":
--   si Upstash cae, los pedidos pasan igual. Además, un atacante puede llamar
--   create_public_order_qr / request_bill_qr DIRECTO contra Supabase, saltándose
--   Next.js y Redis por completo.
--
-- Solución:
--   Rate limit en la propia base de datos, dentro de las RPC. Aplica SIEMPRE,
--   venga la llamada de Next.js, de Upstash, o directa contra el endpoint REST.
--
-- Diseño:
--   - Ventana FIJA (fixed window): más simple y barata que sliding window.
--     Para anti-abuso es suficiente; el rate limit "fino" sigue siendo Upstash.
--   - Clave por TABLE_ID (no por token): estable aunque se rote el token.
--   - Límite un poco más holgado que Upstash (15/60s vs 10/60s) para que esta
--     capa solo actúe como red de seguridad, no como fuente de falsos positivos.
--   - Limpieza oportunista: cada ~1% de llamadas se purgan filas expiradas,
--     evitando acumulación sin necesidad de pg_cron.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1) Tabla de contadores. Una fila por (bucket_key, ventana actual).
-- ----------------------------------------------------------------------------
create table if not exists public.rpc_rate_limit (
  bucket_key   text        primary key,
  window_start timestamptz not null default now(),
  hits         int         not null default 0
);

-- Nadie accede directo: solo las RPC SECURITY DEFINER la tocan.
alter table public.rpc_rate_limit enable row level security;
-- (sin policies = sin acceso directo para anon/authenticated)

-- Índice para la limpieza por ventana.
create index if not exists rpc_rate_limit_window_idx
  on public.rpc_rate_limit (window_start);


-- ----------------------------------------------------------------------------
-- 2) Helper: consume un "hit" del bucket y lanza si se excede el límite.
--    Ventana fija de p_window_seconds; máximo p_max_hits por ventana.
-- ----------------------------------------------------------------------------
create or replace function public.rate_limit_check(
  p_bucket_key     text,
  p_max_hits       int,
  p_window_seconds int
) returns void
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_now        timestamptz := now();
  v_window     timestamptz;
  v_hits       int;
begin
  -- Limpieza oportunista (~1% de las llamadas) de filas de ventanas viejas.
  if random() < 0.01 then
    delete from public.rpc_rate_limit
    where window_start < v_now - make_interval(secs => p_window_seconds);
  end if;

  -- Upsert atómico del contador de la ventana actual.
  insert into public.rpc_rate_limit (bucket_key, window_start, hits)
  values (p_bucket_key, v_now, 1)
  on conflict (bucket_key) do update
    set
      -- Si la ventana venció, se reinicia; si no, se incrementa.
      window_start = case
        when public.rpc_rate_limit.window_start < v_now - make_interval(secs => p_window_seconds)
          then v_now
        else public.rpc_rate_limit.window_start
      end,
      hits = case
        when public.rpc_rate_limit.window_start < v_now - make_interval(secs => p_window_seconds)
          then 1
        else public.rpc_rate_limit.hits + 1
      end
  returning hits into v_hits;

  if v_hits > p_max_hits then
    raise exception 'rate_limit_exceeded'
      using hint = 'Demasiadas solicitudes. Esperá un momento e intentá de nuevo.';
  end if;
end;
$$;

alter function public.rate_limit_check(text, int, int) owner to postgres;
revoke all on function public.rate_limit_check(text, int, int) from public;
-- No se concede EXECUTE a anon: solo lo invocan las RPC públicas internamente.


-- ----------------------------------------------------------------------------
-- 3) Inyectar el rate limit en create_public_order_qr.
--    Se recrea la función idéntica a la de fase 2, añadiendo la llamada a
--    rate_limit_check justo después de resolver la mesa.
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

  -- RATE LIMIT (BD): máx 15 pedidos por 60s por mesa. Red de seguridad que
  -- aplica aunque Upstash esté caído o se llame la RPC directo.
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
-- 4) Inyectar el rate limit en request_bill_qr.
--    Ya tiene "una sola llamada pendiente por mesa", pero sin esto se puede
--    spamear el ciclo crear/atender. Límite más estricto: 5 por 60s por mesa.
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

  -- RATE LIMIT (BD): máx 5 llamadas de cuenta por 60s por mesa.
  perform public.rate_limit_check('bill:' || v_table_id, 5, 60);

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

commit;