-- Portal de plataforma — Segunda iteración de B: multi-sucursal (B7) y
-- onboarding / gerente de cuenta (B11). Mismo patrón de seguridad:
-- SECURITY DEFINER + guard is_platform_owner(), grants solo authenticated,
-- auditoría en escrituras.

-- ---------- Onboarding: checklist por restaurante ----------
create table if not exists public.onboarding_tasks (
  id            bigint generated always as identity primary key,
  restaurant_id bigint not null references public.restaurants(id) on delete cascade,
  step_key      text not null,
  label         text not null,
  sort_order    integer not null default 0,
  done          boolean not null default false,
  done_at       timestamptz,
  unique (restaurant_id, step_key)
);
alter table public.onboarding_tasks enable row level security;
revoke all on table public.onboarding_tasks from anon, authenticated;

-- Consolidado por organización (sucursales + métricas del grupo)
create or replace function public.platform_organization_detail(p_org_id bigint)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare v jsonb;
begin
  if not public.is_platform_owner() then raise exception 'No autorizado'; end if;

  select jsonb_build_object(
    'organization', (
      select to_jsonb(x) from (
        select id, name, notes, created_at from public.organizations where id = p_org_id
      ) x
    ),
    'branches', (
      select coalesce(jsonb_agg(b order by b.restaurant_name), '[]'::jsonb) from (
        select
          r.id as restaurant_id,
          r.restaurant_name::text as restaurant_name,
          coalesce(ra.account_status,'active') as account_status,
          ra.plan_id,
          (select count(*) from public.tables t where t.restaurant_id = r.id) as tables_count,
          (select count(*) from public.orders o where o.restaurant_id = r.id) as orders_total,
          (select coalesce(sum(o.total),0) from public.orders o where o.restaurant_id = r.id and o.status_id = 4) as revenue_total
        from public.restaurant_accounts ra
        join public.restaurants r on r.id = ra.restaurant_id
        where ra.organization_id = p_org_id
      ) b
    ),
    'totals', (
      select jsonb_build_object(
        'branches', count(*),
        'tables',   coalesce(sum((select count(*) from public.tables t where t.restaurant_id = r.id)),0),
        'orders',   coalesce(sum((select count(*) from public.orders o where o.restaurant_id = r.id)),0),
        'revenue',  coalesce(sum((select coalesce(sum(o.total),0) from public.orders o where o.restaurant_id = r.id and o.status_id = 4)),0)
      )
      from public.restaurant_accounts ra
      join public.restaurants r on r.id = ra.restaurant_id
      where ra.organization_id = p_org_id
    )
  ) into v;

  if v->'organization' is null then raise exception 'Organización no encontrada'; end if;
  return v;
end;
$$;

-- Datos de cuenta de un restaurante (para el panel de gestión del detalle)
create or replace function public.platform_account_get(p_restaurant_id bigint)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare v jsonb;
begin
  if not public.is_platform_owner() then raise exception 'No autorizado'; end if;
  select jsonb_build_object(
    'restaurant_id', r.id,
    'restaurant_name', r.restaurant_name,
    'plan_id', ra.plan_id,
    'plan_name', pl.name,
    'max_tables', pl.max_tables,
    'account_status', coalesce(ra.account_status,'active'),
    'trial_ends_at', ra.trial_ends_at,
    'account_manager', ra.account_manager,
    'organization_id', ra.organization_id,
    'organization_name', o.name,
    'notes', ra.notes,
    'tables_count', (select count(*) from public.tables t where t.restaurant_id = r.id)
  ) into v
  from public.restaurants r
  left join public.restaurant_accounts ra on ra.restaurant_id = r.id
  left join public.plans pl on pl.id = ra.plan_id
  left join public.organizations o on o.id = ra.organization_id
  where r.id = p_restaurant_id;
  return v;
end;
$$;

-- Onboarding: obtener checklist (crea los pasos estándar si faltan)
create or replace function public.platform_onboarding_get(p_restaurant_id bigint)
returns table(step_key text, label text, sort_order integer, done boolean, done_at timestamptz)
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_platform_owner() then raise exception 'No autorizado'; end if;

  insert into public.onboarding_tasks (restaurant_id, step_key, label, sort_order)
  select p_restaurant_id, s.k, s.l, s.o
  from (values
    ('contract_signed','Contrato firmado',1),
    ('menu_loaded','Menú cargado',2),
    ('qr_generated','QR de mesas generados',3),
    ('staff_created','Equipo (meseros) creado',4),
    ('training_done','Capacitación al equipo',5),
    ('go_live','Operando en vivo',6)
  ) as s(k,l,o)
  on conflict (restaurant_id, step_key) do nothing;

  return query
  select t.step_key, t.label, t.sort_order, t.done, t.done_at
  from public.onboarding_tasks t
  where t.restaurant_id = p_restaurant_id
  order by t.sort_order;
end;
$$;

-- Onboarding: marcar/desmarcar un paso
create or replace function public.platform_onboarding_toggle(p_restaurant_id bigint, p_step_key text, p_done boolean)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_platform_owner() then raise exception 'No autorizado'; end if;
  update public.onboarding_tasks
    set done = p_done, done_at = case when p_done then now() else null end
    where restaurant_id = p_restaurant_id and step_key = p_step_key;
  perform public._platform_audit('onboarding_toggle', 'restaurant', p_restaurant_id::text,
    jsonb_build_object('step', p_step_key, 'done', p_done));
end;
$$;

-- ---------- Grants: authenticated/service_role, revoca public/anon ----------
do $$
declare fn text;
begin
  for fn in
    select p.oid::regprocedure::text
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'platform_organization_detail','platform_account_get',
        'platform_onboarding_get','platform_onboarding_toggle'
      )
  loop
    execute format('revoke all on function %s from public, anon', fn);
    execute format('grant execute on function %s to authenticated, service_role', fn);
  end loop;
end $$;
