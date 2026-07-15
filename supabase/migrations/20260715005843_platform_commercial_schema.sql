-- Portal de plataforma — Modelo de datos comercial (Fase B-I).
-- Soporta el negocio real de Mesa: planes por tramo de mesas, contratos de
-- servicio B2B (pago único + soporte mensual como complemento), prueba
-- gratis, estados de cuenta, grupos multi-sucursal, leads/demos, tickets de
-- soporte y bitácora de auditoría.
--
-- Seguridad: todas las tablas con RLS deny-all; el acceso ocurre solo vía
-- funciones SECURITY DEFINER con guard is_platform_owner() (Fase B-II).
-- Además se revoca cualquier grant a anon/authenticated por defensa en
-- profundidad. Ninguna tabla toca el modelo de tenants existente salvo por
-- FKs de solo referencia hacia restaurants.

-- ---------- Catálogo de planes ----------
create table if not exists public.plans (
  id                    text primary key,           -- 'plan15','plan50','plan100','custom'
  name                  text not null,
  min_tables            integer,
  max_tables            integer,                     -- null = ilimitado
  one_time_price        integer,                     -- CLP, null = a medida
  support_monthly_price integer,                     -- CLP, null = a medida
  sort_order            integer not null default 0
);

-- ---------- Grupos / cadenas (multi-sucursal, plan Personalizado) ----------
create table if not exists public.organizations (
  id         bigint generated always as identity primary key,
  name       text not null,
  notes      text,
  created_at timestamptz not null default now()
);

-- ---------- Estado comercial de cada restaurante (1:1 con restaurants) ----------
create table if not exists public.restaurant_accounts (
  restaurant_id   bigint primary key references public.restaurants(id) on delete cascade,
  organization_id bigint references public.organizations(id) on delete set null,
  plan_id         text references public.plans(id),
  account_status  text not null default 'trial'
                    check (account_status in ('trial','active','past_due','suspended','cancelled')),
  trial_ends_at   date,
  account_manager text,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ---------- Contratos de servicio ----------
create table if not exists public.service_contracts (
  id                     bigint generated always as identity primary key,
  restaurant_id          bigint not null references public.restaurants(id) on delete cascade,
  plan_id                text references public.plans(id),
  one_time_amount        integer,
  support_monthly_amount integer,
  has_support            boolean not null default false,
  starts_on              date not null,
  ends_on                date,
  status                 text not null default 'active'
                           check (status in ('active','suspended','terminated')),
  signed_at              date,
  notes                  text,
  created_at             timestamptz not null default now()
);
create index if not exists idx_service_contracts_restaurant on public.service_contracts(restaurant_id);

-- ---------- Cobranza del soporte mensual (seguimiento manual, B2B) ----------
create table if not exists public.contract_billing (
  id             bigint generated always as identity primary key,
  contract_id    bigint not null references public.service_contracts(id) on delete cascade,
  period_start   date not null,
  period_end     date not null,
  amount         integer not null,
  status         text not null default 'pending'
                   check (status in ('pending','paid','overdue','waived')),
  due_date       date,
  paid_at        date,
  invoice_number text,
  created_at     timestamptz not null default now()
);
create index if not exists idx_contract_billing_contract on public.contract_billing(contract_id);

-- ---------- Leads / solicitudes de demo ----------
create table if not exists public.leads (
  id            bigint generated always as identity primary key,
  name          text not null,
  business_name text,
  email         text,
  phone         text,
  business_type text,
  city          text,
  message       text,
  plan_interest text,
  status        text not null default 'new'
                  check (status in ('new','contacted','qualified','won','lost')),
  created_at    timestamptz not null default now(),
  contacted_at  timestamptz
);

-- ---------- Tickets de soporte (Tier 3 / SLA) ----------
create table if not exists public.support_tickets (
  id            bigint generated always as identity primary key,
  restaurant_id bigint references public.restaurants(id) on delete set null,
  subject       text not null,
  description   text,
  priority      text not null default 'medium'
                  check (priority in ('low','medium','high','urgent')),
  status        text not null default 'open'
                  check (status in ('open','in_progress','resolved','closed')),
  sla_due_at    timestamptz,
  assigned_to   text,
  created_at    timestamptz not null default now(),
  resolved_at   timestamptz
);
create index if not exists idx_support_tickets_status on public.support_tickets(status);

-- ---------- Bitácora de auditoría del portal ----------
create table if not exists public.platform_audit_log (
  id          bigint generated always as identity primary key,
  actor_email text,
  action      text not null,
  target_type text,
  target_id   text,
  detail      jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists idx_platform_audit_created on public.platform_audit_log(created_at desc);

-- ---------- RLS deny-all + revoca grants ----------
do $$
declare t text;
begin
  foreach t in array array[
    'plans','organizations','restaurant_accounts','service_contracts',
    'contract_billing','leads','support_tickets','platform_audit_log'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from anon, authenticated', t);
  end loop;
end $$;

-- ---------- Seed: catálogo de planes (precios de lanzamiento de la web) ----------
insert into public.plans (id, name, min_tables, max_tables, one_time_price, support_monthly_price, sort_order) values
  ('plan15',  'Plan 15',        1,   15,  1250000, 150000, 1),
  ('plan50',  'Plan 50',        16,  50,  3000000, 300000, 2),
  ('plan100', 'Plan 100',       50,  100, 5000000, 450000, 3),
  ('custom',  'Personalizado',  100, null, null,   null,   4)
on conflict (id) do update set
  name = excluded.name,
  min_tables = excluded.min_tables,
  max_tables = excluded.max_tables,
  one_time_price = excluded.one_time_price,
  support_monthly_price = excluded.support_monthly_price,
  sort_order = excluded.sort_order;

-- ---------- Seed: estado de cuenta para los restaurantes ya existentes ----------
-- Ya están operando => 'active'. El operador les asignará plan luego.
insert into public.restaurant_accounts (restaurant_id, account_status)
select id, 'active' from public.restaurants
on conflict (restaurant_id) do nothing;
