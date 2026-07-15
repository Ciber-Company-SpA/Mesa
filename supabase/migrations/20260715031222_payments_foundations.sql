-- Pagos y facturación — Fase 1 (cimientos). Modelo de datos aditivo, con RLS
-- por restaurante. NO activa cobros ni emisión de documentos: solo el esquema
-- y la gestión del perfil tributario / estado de conexión. Las integraciones
-- (pasarela con split, DTE al SII) llegan en fases posteriores, cuando existan
-- proveedor + credenciales + certificación + visto bueno legal.

-- Identidad tributaria del restaurante (emisor del DTE)
create table if not exists public.restaurant_tax_profile (
  restaurant_id       bigint primary key references public.restaurants(id) on delete cascade,
  rut                 text,
  razon_social        text,
  giro                text,
  direccion           text,
  comuna              text,
  actividad_economica text,
  regimen_iva         text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- Cuenta de pasarela conectada (dinero directo al restaurante, Opción A)
create table if not exists public.restaurant_payment_account (
  id                  bigint generated always as identity primary key,
  restaurant_id       bigint not null references public.restaurants(id) on delete cascade,
  provider            text,                         -- 'mercadopago' | 'transbank' | ...
  provider_account_id text,
  oauth_token_enc     text,                         -- se cifrará (Vault) al conectar; vacío en F1
  status              text not null default 'disconnected'
                        check (status in ('disconnected','connected','error')),
  connected_at        timestamptz,
  unique (restaurant_id, provider)
);

-- Cobros del comensal (en línea o efectivo)
create table if not exists public.payments (
  id                  bigint generated always as identity primary key,
  restaurant_id       bigint not null references public.restaurants(id) on delete cascade,
  table_id            bigint references public.tables(id) on delete set null,
  order_ids           bigint[] not null default '{}',
  provider            text,
  provider_payment_id text,
  method              text not null default 'online' check (method in ('online','cash')),
  amount              integer not null default 0,
  tip                 integer not null default 0,
  commission          integer not null default 0,   -- application_fee de MESA
  currency            text not null default 'CLP',
  status              text not null default 'pending'
                        check (status in ('pending','authorized','paid','failed','refunded')),
  payer_email         text,
  created_at          timestamptz not null default now(),
  paid_at             timestamptz
);
create index if not exists idx_payments_restaurant on public.payments(restaurant_id);

-- Documentos tributarios (boleta 39 / factura 33 / nota de crédito 61)
create table if not exists public.tax_documents (
  id             bigint generated always as identity primary key,
  payment_id     bigint references public.payments(id) on delete set null,
  restaurant_id  bigint not null references public.restaurants(id) on delete cascade,
  doc_type       integer not null default 39,       -- 39 boleta, 33 factura, 61 NC
  folio          bigint,
  net            integer,
  iva            integer,
  total          integer,
  receptor_rut   text,
  receptor_razon text,
  receptor_giro  text,
  receptor_dir   text,
  sii_status     text not null default 'pending'
                   check (sii_status in ('pending','accepted','rejected')),
  track_id       text,
  pdf_url        text,
  xml_url        text,
  emitted_at     timestamptz,
  created_at     timestamptz not null default now()
);
create index if not exists idx_tax_documents_restaurant on public.tax_documents(restaurant_id);

-- Bitácora de webhooks (idempotencia + auditoría) de pasarela y proveedor DTE
create table if not exists public.payment_events (
  id          bigint generated always as identity primary key,
  source      text not null,                        -- 'gateway' | 'dte'
  external_id text,
  payload     jsonb,
  received_at timestamptz not null default now(),
  processed   boolean not null default false,
  unique (source, external_id)
);

-- Enlace pedido → cobro
alter table public.orders add column if not exists payment_id bigint references public.payments(id);

-- RLS deny-all: acceso solo vía funciones SECURITY DEFINER con guard
do $$
declare t text;
begin
  foreach t in array array[
    'restaurant_tax_profile','restaurant_payment_account','payments','tax_documents','payment_events'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from anon, authenticated', t);
  end loop;
end $$;

-- ===== Funciones Fase 1 (perfil tributario + estado de cuenta) =====

create or replace function public.get_my_tax_profile()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_rid bigint; v jsonb;
begin
  if not public.current_user_is_admin() then raise exception 'No autorizado'; end if;
  v_rid := public.current_user_restaurant_id();
  select to_jsonb(p) into v from public.restaurant_tax_profile p where p.restaurant_id = v_rid;
  return coalesce(v, jsonb_build_object('restaurant_id', v_rid));
end;
$$;

create or replace function public.upsert_my_tax_profile(
  p_rut text, p_razon text, p_giro text, p_direccion text, p_comuna text,
  p_actividad text, p_regimen text
) returns void language plpgsql security definer set search_path = public as $$
declare v_rid bigint;
begin
  if not public.current_user_is_admin() then raise exception 'No autorizado'; end if;
  v_rid := public.current_user_restaurant_id();
  insert into public.restaurant_tax_profile
    (restaurant_id, rut, razon_social, giro, direccion, comuna, actividad_economica, regimen_iva, updated_at)
  values (v_rid, p_rut, p_razon, p_giro, p_direccion, p_comuna, p_actividad, p_regimen, now())
  on conflict (restaurant_id) do update set
    rut = excluded.rut, razon_social = excluded.razon_social, giro = excluded.giro,
    direccion = excluded.direccion, comuna = excluded.comuna,
    actividad_economica = excluded.actividad_economica, regimen_iva = excluded.regimen_iva,
    updated_at = now();
end;
$$;

create or replace function public.get_my_payment_account()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_rid bigint; v jsonb;
begin
  if not public.current_user_is_admin() then raise exception 'No autorizado'; end if;
  v_rid := public.current_user_restaurant_id();
  select jsonb_build_object('provider', a.provider, 'status', coalesce(a.status,'disconnected'), 'connected_at', a.connected_at)
    into v from public.restaurant_payment_account a where a.restaurant_id = v_rid limit 1;
  return coalesce(v, jsonb_build_object('status','disconnected'));
end;
$$;

do $$
declare fn text;
begin
  for fn in
    select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in ('get_my_tax_profile','upsert_my_tax_profile','get_my_payment_account')
  loop
    execute format('revoke all on function %s from public, anon', fn);
    execute format('grant execute on function %s to authenticated, service_role', fn);
  end loop;
end $$;
