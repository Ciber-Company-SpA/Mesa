-- Ficha comercial de la organización: la cuenta B2B del grupo deja de ser
-- solo nombre+notas. Los datos se ingresan desde el portal del operador y el
-- panel admin del cliente los lee en vivo (misma base, cero duplicación),
-- igual que ocurre con las mesas.

alter table public.organizations
  add column if not exists legal_name    text,
  add column if not exists rut           text,
  add column if not exists contact_name  text,
  add column if not exists contact_email text,
  add column if not exists contact_phone text,
  add column if not exists address       text,
  add column if not exists city          text;

-- Alta con ficha completa. Se reemplaza la firma (text,text) por una con
-- defaults para que las llamadas antiguas (solo nombre+notas) sigan resolviendo.
drop function if exists public.platform_create_organization(text, text);

create or replace function public.platform_create_organization(
  p_name text,
  p_notes text default null,
  p_legal_name text default null,
  p_rut text default null,
  p_contact_name text default null,
  p_contact_email text default null,
  p_contact_phone text default null,
  p_address text default null,
  p_city text default null
)
returns bigint
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_id bigint;
begin
  if not public.is_platform_owner() then raise exception 'No autorizado'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'El nombre es obligatorio'; end if;

  insert into public.organizations
    (name, notes, legal_name, rut, contact_name, contact_email, contact_phone, address, city)
  values
    (trim(p_name), nullif(trim(coalesce(p_notes,'')), ''),
     nullif(trim(coalesce(p_legal_name,'')), ''), nullif(trim(coalesce(p_rut,'')), ''),
     nullif(trim(coalesce(p_contact_name,'')), ''), nullif(trim(coalesce(p_contact_email,'')), ''),
     nullif(trim(coalesce(p_contact_phone,'')), ''), nullif(trim(coalesce(p_address,'')), ''),
     nullif(trim(coalesce(p_city,'')), ''))
  returning id into v_id;

  perform public._platform_audit('create_organization', 'organization', v_id::text,
    jsonb_build_object('name', trim(p_name), 'rut', p_rut));
  return v_id;
end;
$$;

-- Edición con ficha completa (reemplaza la versión nombre+notas).
drop function if exists public.platform_update_organization(bigint, text, text);

create or replace function public.platform_update_organization(
  p_id bigint,
  p_name text,
  p_notes text default null,
  p_legal_name text default null,
  p_rut text default null,
  p_contact_name text default null,
  p_contact_email text default null,
  p_contact_phone text default null,
  p_address text default null,
  p_city text default null
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not public.is_platform_owner() then raise exception 'No autorizado'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'El nombre es obligatorio'; end if;

  update public.organizations set
    name          = trim(p_name),
    notes         = nullif(trim(coalesce(p_notes,'')), ''),
    legal_name    = nullif(trim(coalesce(p_legal_name,'')), ''),
    rut           = nullif(trim(coalesce(p_rut,'')), ''),
    contact_name  = nullif(trim(coalesce(p_contact_name,'')), ''),
    contact_email = nullif(trim(coalesce(p_contact_email,'')), ''),
    contact_phone = nullif(trim(coalesce(p_contact_phone,'')), ''),
    address       = nullif(trim(coalesce(p_address,'')), ''),
    city          = nullif(trim(coalesce(p_city,'')), '')
  where id = p_id;
  if not found then raise exception 'Organización no encontrada'; end if;

  perform public._platform_audit('update_organization', 'organization', p_id::text,
    jsonb_build_object('name', trim(p_name), 'rut', p_rut));
end;
$$;

-- El detalle v2 devuelve la ficha completa en 'organization'.
create or replace function public.platform_organization_detail_v2(p_org_id bigint)
returns jsonb
language plpgsql
stable security definer
set search_path to 'public'
as $$
declare v jsonb;
begin
  if not public.is_platform_owner() then raise exception 'No autorizado'; end if;

  select jsonb_build_object(
    'organization', (
      select to_jsonb(x) from (
        select id, name, notes, legal_name, rut, contact_name, contact_email,
               contact_phone, address, city, created_at
        from public.organizations where id = p_org_id
      ) x
    ),
    'branches', (
      select coalesce(jsonb_agg(b order by b.restaurant_name), '[]'::jsonb) from (
        select
          r.id as restaurant_id,
          r.restaurant_name::text as restaurant_name,
          coalesce(ra.account_status, 'active') as account_status,
          ra.plan_id,
          p.name as plan_name,
          p.max_tables as plan_max_tables,
          ra.trial_ends_at,
          ra.account_manager,
          (select count(*) from public.tables t where t.restaurant_id = r.id) as tables_count,
          (select count(*) from public.orders o where o.restaurant_id = r.id) as orders_total,
          (select coalesce(sum(o.total), 0) from public.orders o
            where o.restaurant_id = r.id and o.status_id = 4) as revenue_total,
          (select coalesce(sum(o.total), 0) from public.orders o
            where o.restaurant_id = r.id and o.status_id = 4
              and o.created_at >= now() - interval '30 days') as revenue_30d,
          (select count(*) from public.onboarding_tasks ot
            where ot.restaurant_id = r.id and ot.done) as onboarding_done,
          (select count(*) from public.onboarding_tasks ot
            where ot.restaurant_id = r.id) as onboarding_total,
          (select count(*) from public.support_tickets st
            where st.restaurant_id = r.id and st.status in ('open','in_progress')) as open_tickets,
          exists(select 1 from public.service_contracts sc
            where sc.restaurant_id = r.id and sc.status = 'active') as has_active_contract
        from public.restaurant_accounts ra
        join public.restaurants r on r.id = ra.restaurant_id
        left join public.plans p on p.id = ra.plan_id
        where ra.organization_id = p_org_id
      ) b
    ),
    'contracts', (
      select coalesce(jsonb_agg(c order by c.created_at desc), '[]'::jsonb) from (
        select sc.id, sc.restaurant_id, r.restaurant_name::text as restaurant_name,
               sc.plan_id, sc.status, sc.one_time_amount, sc.support_monthly_amount,
               sc.has_support, sc.starts_on, sc.ends_on, sc.signed_at, sc.created_at
        from public.service_contracts sc
        join public.restaurant_accounts ra on ra.restaurant_id = sc.restaurant_id
        join public.restaurants r on r.id = sc.restaurant_id
        where ra.organization_id = p_org_id
      ) c
    ),
    'billing', (
      select coalesce(jsonb_agg(bi order by bi.due_date asc nulls last), '[]'::jsonb) from (
        select cb.id, cb.contract_id, r.restaurant_name::text as restaurant_name,
               cb.period_start, cb.period_end, cb.amount, cb.status, cb.due_date, cb.invoice_number
        from public.contract_billing cb
        join public.service_contracts sc on sc.id = cb.contract_id
        join public.restaurant_accounts ra on ra.restaurant_id = sc.restaurant_id
        join public.restaurants r on r.id = sc.restaurant_id
        where ra.organization_id = p_org_id
          and cb.status in ('pending','overdue')
        limit 25
      ) bi
    ),
    'tickets', (
      select coalesce(jsonb_agg(tk order by tk.created_at desc), '[]'::jsonb) from (
        select st.id, r.restaurant_name::text as restaurant_name, st.subject,
               st.priority, st.status, st.sla_due_at, st.created_at
        from public.support_tickets st
        join public.restaurant_accounts ra on ra.restaurant_id = st.restaurant_id
        join public.restaurants r on r.id = st.restaurant_id
        where ra.organization_id = p_org_id
          and st.status in ('open','in_progress')
        limit 25
      ) tk
    ),
    'timeseries', (
      select coalesce(jsonb_agg(ts order by ts.day), '[]'::jsonb) from (
        select d.day,
               count(o.id) as orders,
               coalesce(sum(o.total) filter (where o.status_id = 4), 0) as revenue
        from (
          select generate_series(
            (date_trunc('day', now()) - interval '29 days')::date,
            date_trunc('day', now())::date,
            interval '1 day'
          )::date as day
        ) d
        left join public.orders o
          on o.created_at::date = d.day
         and o.restaurant_id in (
           select ra.restaurant_id from public.restaurant_accounts ra
           where ra.organization_id = p_org_id
         )
        group by d.day
      ) ts
    ),
    'unassigned', (
      select coalesce(jsonb_agg(u order by u.restaurant_name), '[]'::jsonb) from (
        select r.id, r.restaurant_name::text as restaurant_name
        from public.restaurants r
        left join public.restaurant_accounts ra on ra.restaurant_id = r.id
        where ra.organization_id is null
      ) u
    )
  ) into v;

  if v->'organization' is null then raise exception 'Organización no encontrada'; end if;
  return v;
end;
$$;

-- Ficha del grupo para el panel admin del CLIENTE (app Mesa). Solo admins;
-- devuelve la organización de su restaurante, o null si no pertenece a una.
create or replace function public.get_my_organization()
returns jsonb
language plpgsql
stable security definer
set search_path to 'public'
as $$
declare v_rid bigint; v_org bigint;
begin
  if not public.current_user_is_admin() then raise exception 'No autorizado'; end if;
  v_rid := public.current_user_restaurant_id();
  select organization_id into v_org from public.restaurant_accounts where restaurant_id = v_rid;
  if v_org is null then return null; end if;

  return (
    select to_jsonb(x) from (
      select o.name, o.legal_name, o.rut, o.contact_name, o.contact_email,
             o.contact_phone, o.address, o.city,
             (select count(*) from public.restaurant_accounts ra
               where ra.organization_id = o.id) as branches_count
      from public.organizations o where o.id = v_org
    ) x
  );
end;
$$;

-- Lockdown de las firmas nuevas.
revoke all on function public.platform_create_organization(text, text, text, text, text, text, text, text, text) from public, anon;
revoke all on function public.platform_update_organization(bigint, text, text, text, text, text, text, text, text, text) from public, anon;
revoke all on function public.get_my_organization() from public, anon;

grant execute on function public.platform_create_organization(text, text, text, text, text, text, text, text, text) to authenticated, service_role;
grant execute on function public.platform_update_organization(bigint, text, text, text, text, text, text, text, text, text) to authenticated, service_role;
grant execute on function public.get_my_organization() to authenticated, service_role;
