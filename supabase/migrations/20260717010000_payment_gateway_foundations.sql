-- Capa de abstracción de pasarelas de pago (Flow, Mercado Pago, Transbank, …).
-- La lógica vive en la app (src/lib/payments, adaptadores intercambiables); acá
-- están la persistencia y la conexión de la cuenta. Las credenciales del
-- proveedor (API keys / secretos) se guardan CIFRADAS en Supabase Vault; la
-- tabla solo guarda metadatos + el id del secreto. Todo por RPCs con guard.

-- Referencia al secreto de credenciales en Vault (además del oauth_token_enc legado).
alter table public.restaurant_payment_account
  add column if not exists credentials_secret_id uuid,
  add column if not exists updated_at timestamptz not null default now();

-- Modelo: UNA cuenta de cobro por restaurante (se cambia de proveedor conectando
-- otro). La F1 dejó unique(restaurant_id, provider) — lo reemplazamos por
-- unique(restaurant_id) para poder hacer upsert por restaurante. Si hubiera más
-- de una fila por restaurante (no debería en F1), conservamos la más reciente.
do $$
declare c text;
begin
  delete from public.restaurant_payment_account a
    using public.restaurant_payment_account b
    where a.restaurant_id = b.restaurant_id and a.id < b.id;

  for c in
    select conname from pg_constraint
    where conrelid = 'public.restaurant_payment_account'::regclass and contype = 'u'
  loop
    execute format('alter table public.restaurant_payment_account drop constraint %I', c);
  end loop;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.restaurant_payment_account'::regclass
      and contype = 'u' and conname = 'restaurant_payment_account_restaurant_id_key'
  ) then
    alter table public.restaurant_payment_account
      add constraint restaurant_payment_account_restaurant_id_key unique (restaurant_id);
  end if;
end $$;

-- Conectar / actualizar la cuenta de cobro del restaurante.
create or replace function public.payment_connect_account(
  p_provider    text,
  p_account_id  text,
  p_credentials text
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_rid bigint; v_ex record; v_sec uuid; v_sfx text;
begin
  if not public.current_user_is_admin() then raise exception 'No autorizado'; end if;
  if coalesce(trim(p_provider), '') = '' then raise exception 'Falta el proveedor'; end if;
  v_rid := public.current_user_restaurant_id();
  v_sfx := v_rid::text || '_' || floor(extract(epoch from clock_timestamp()) * 1000)::bigint::text;

  select * into v_ex from public.restaurant_payment_account where restaurant_id = v_rid;
  if found and v_ex.credentials_secret_id is not null then
    delete from vault.secrets where id = v_ex.credentials_secret_id;
  end if;

  if coalesce(trim(p_credentials), '') <> '' then
    v_sec := vault.create_secret(p_credentials, 'pay_cred_' || v_sfx, 'Credenciales pasarela de pago');
  end if;

  insert into public.restaurant_payment_account
    (restaurant_id, provider, provider_account_id, credentials_secret_id, status, connected_at, updated_at)
  values (v_rid, trim(p_provider), nullif(trim(coalesce(p_account_id, '')), ''), v_sec, 'connected', now(), now())
  on conflict (restaurant_id) do update set
    provider = excluded.provider,
    provider_account_id = excluded.provider_account_id,
    credentials_secret_id = excluded.credentials_secret_id,
    status = 'connected',
    connected_at = now(),
    updated_at = now();
end;
$$;

create or replace function public.payment_disconnect_account()
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_rid bigint; v_ex record;
begin
  if not public.current_user_is_admin() then raise exception 'No autorizado'; end if;
  v_rid := public.current_user_restaurant_id();
  select * into v_ex from public.restaurant_payment_account where restaurant_id = v_rid;
  if not found then return; end if;
  if v_ex.credentials_secret_id is not null then
    delete from vault.secrets where id = v_ex.credentials_secret_id;
  end if;
  update public.restaurant_payment_account
    set status = 'disconnected', credentials_secret_id = null, updated_at = now()
    where restaurant_id = v_rid;
end;
$$;

-- Estado de la cuenta (metadatos, nunca el secreto).
create or replace function public.get_my_payment_account()
returns jsonb
language plpgsql
stable security definer
set search_path to 'public'
as $$
declare v_rid bigint; v jsonb;
begin
  if not public.current_user_is_admin() then raise exception 'No autorizado'; end if;
  v_rid := public.current_user_restaurant_id();
  select jsonb_build_object(
    'provider', a.provider,
    'provider_account_id', a.provider_account_id,
    'status', coalesce(a.status, 'disconnected'),
    'has_credentials', a.credentials_secret_id is not null,
    'connected_at', a.connected_at
  ) into v
  from public.restaurant_payment_account a where a.restaurant_id = v_rid limit 1;
  return coalesce(v, jsonb_build_object('status', 'disconnected', 'has_credentials', false));
end;
$$;

-- Registrar un pago (lo llama el flujo de cobro con el contexto del staff).
create or replace function public.payment_record(
  p_table_id     bigint,
  p_order_ids    bigint[],
  p_provider     text,
  p_amount       integer,
  p_tip          integer,
  p_currency     text,
  p_provider_payment_id text,
  p_status       text
)
returns bigint
language plpgsql
security definer
set search_path to 'public'
as $$
declare s record; v_id bigint;
begin
  select * into s from public._support_current_staff();
  if s.user_id is null then raise exception 'No autorizado'; end if;

  insert into public.payments
    (restaurant_id, table_id, order_ids, provider, provider_payment_id, amount, tip, currency, status, created_at)
  values (
    s.restaurant_id, p_table_id, coalesce(p_order_ids, '{}'), nullif(trim(coalesce(p_provider,'')),''),
    nullif(trim(coalesce(p_provider_payment_id,'')),''), p_amount, coalesce(p_tip,0),
    coalesce(nullif(trim(coalesce(p_currency,'')),''),'CLP'),
    coalesce(nullif(trim(coalesce(p_status,'')),''),'pending'), now()
  )
  returning id into v_id;
  return v_id;
end;
$$;

-- Actualizar el estado de un pago (lo usa el webhook/worker, service_role).
create or replace function public.payment_update_status(
  p_id bigint, p_status text, p_provider_payment_id text
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  update public.payments set
    status = coalesce(nullif(trim(coalesce(p_status,'')),''), status),
    provider_payment_id = coalesce(nullif(trim(coalesce(p_provider_payment_id,'')),''), provider_payment_id),
    paid_at = case when p_status = 'paid' and paid_at is null then now() else paid_at end
  where id = p_id;
  if not found then raise exception 'Pago no encontrado'; end if;
end;
$$;

-- Registrar un evento de webhook crudo (para trazabilidad/idempotencia).
create or replace function public.payment_record_event(
  p_source text, p_external_id text, p_payload jsonb
)
returns bigint
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_id bigint;
begin
  -- source es NOT NULL; idempotencia por unique(source, external_id) cuando el
  -- proveedor manda un id externo (reintentos de webhook no duplican).
  insert into public.payment_events (source, external_id, payload, received_at, processed)
  values (
    coalesce(nullif(trim(coalesce(p_source,'')),''), 'unknown'),
    nullif(trim(coalesce(p_external_id,'')),''),
    p_payload, now(), false
  )
  on conflict (source, external_id) do update set payload = excluded.payload, received_at = now()
  returning id into v_id;
  return v_id;
end;
$$;

-- Lockdown. connect/disconnect/get: admin. record/record_event/update: solo
-- service_role (el webhook y el flujo de cobro corren server-side).
revoke all on function public.payment_connect_account(text, text, text) from public, anon;
revoke all on function public.payment_disconnect_account() from public, anon;
revoke all on function public.get_my_payment_account() from public, anon;
revoke all on function public.payment_record(bigint, bigint[], text, integer, integer, text, text, text) from public, anon;
revoke all on function public.payment_update_status(bigint, text, text) from public, anon, authenticated;
revoke all on function public.payment_record_event(text, text, jsonb) from public, anon, authenticated;

grant execute on function public.payment_connect_account(text, text, text) to authenticated, service_role;
grant execute on function public.payment_disconnect_account() to authenticated, service_role;
grant execute on function public.get_my_payment_account() to authenticated, service_role;
grant execute on function public.payment_record(bigint, bigint[], text, integer, integer, text, text, text) to authenticated, service_role;
grant execute on function public.payment_update_status(bigint, text, text) to service_role;
grant execute on function public.payment_record_event(text, text, jsonb) to service_role;
