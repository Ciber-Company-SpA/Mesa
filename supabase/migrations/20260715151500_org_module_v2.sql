-- Módulo Organizaciones v2: la organización pasa de ser una etiqueta a la
-- cuenta comercial consolidada del grupo (sucursales, contratos, cobranza,
-- soporte y desempeño). Todas las funciones: guard is_platform_owner,
-- SECURITY DEFINER con search_path fijo y sin acceso anon.

-- 1) Cartera de organizaciones: KPIs globales + fila enriquecida por grupo.
create or replace function public.platform_organizations_overview()
returns jsonb
language plpgsql
stable security definer
set search_path to 'public'
as $$
declare v jsonb;
begin
  if not public.is_platform_owner() then raise exception 'No autorizado'; end if;

  with org_stats as (
    select
      o.id, o.name, o.notes, o.created_at,
      count(ra.restaurant_id) as branches,
      count(*) filter (where ra.account_status = 'active')    as st_active,
      count(*) filter (where ra.account_status = 'trial')     as st_trial,
      count(*) filter (where ra.account_status = 'past_due')  as st_past_due,
      count(*) filter (where ra.account_status = 'suspended') as st_suspended,
      count(*) filter (where ra.account_status = 'cancelled') as st_cancelled,
      coalesce(sum((select count(*) from public.tables t where t.restaurant_id = ra.restaurant_id)), 0) as tables,
      coalesce(sum((
        select coalesce(sum(o2.total), 0) from public.orders o2
        where o2.restaurant_id = ra.restaurant_id
          and o2.status_id = 4
          and o2.created_at >= now() - interval '30 days'
      )), 0) as revenue_30d
    from public.organizations o
    left join public.restaurant_accounts ra on ra.organization_id = o.id
    group by o.id
  ),
  org_contracts as (
    select ra.organization_id as org_id,
      count(*) filter (where sc.status = 'active') as active_contracts,
      coalesce(sum(sc.support_monthly_amount) filter (where sc.status = 'active' and sc.has_support), 0) as mrr
    from public.service_contracts sc
    join public.restaurant_accounts ra on ra.restaurant_id = sc.restaurant_id
    where ra.organization_id is not null
    group by ra.organization_id
  ),
  org_billing as (
    select ra.organization_id as org_id,
      coalesce(sum(cb.amount) filter (
        where cb.status = 'overdue' or (cb.status = 'pending' and cb.due_date < current_date)
      ), 0) as overdue_amount,
      coalesce(sum(cb.amount) filter (
        where cb.status = 'pending' and (cb.due_date is null or cb.due_date >= current_date)
      ), 0) as pending_amount
    from public.contract_billing cb
    join public.service_contracts sc on sc.id = cb.contract_id
    join public.restaurant_accounts ra on ra.restaurant_id = sc.restaurant_id
    where ra.organization_id is not null
    group by ra.organization_id
  ),
  org_tickets as (
    select ra.organization_id as org_id,
      count(*) filter (where st.status in ('open','in_progress')) as open_tickets,
      count(*) filter (where st.status in ('open','in_progress') and st.priority = 'urgent') as urgent_tickets
    from public.support_tickets st
    join public.restaurant_accounts ra on ra.restaurant_id = st.restaurant_id
    where ra.organization_id is not null
    group by ra.organization_id
  ),
  rows_ as (
    select
      s.id, s.name, s.notes, s.created_at, s.branches,
      s.st_active, s.st_trial, s.st_past_due, s.st_suspended, s.st_cancelled,
      s.tables, s.revenue_30d,
      coalesce(c.active_contracts, 0) as active_contracts,
      coalesce(c.mrr, 0)              as mrr,
      coalesce(b.overdue_amount, 0)   as overdue_amount,
      coalesce(b.pending_amount, 0)   as pending_amount,
      coalesce(t.open_tickets, 0)     as open_tickets,
      coalesce(t.urgent_tickets, 0)   as urgent_tickets
    from org_stats s
    left join org_contracts c on c.org_id = s.id
    left join org_billing  b on b.org_id = s.id
    left join org_tickets  t on t.org_id = s.id
  )
  select jsonb_build_object(
    'kpis', (
      select jsonb_build_object(
        'organizations',  count(*),
        'branches',       coalesce(sum(branches), 0),
        'tables',         coalesce(sum(tables), 0),
        'mrr',            coalesce(sum(mrr), 0),
        'overdue_amount', coalesce(sum(overdue_amount), 0),
        'pending_amount', coalesce(sum(pending_amount), 0),
        'open_tickets',   coalesce(sum(open_tickets), 0),
        'revenue_30d',    coalesce(sum(revenue_30d), 0)
      ) from rows_
    ),
    'organizations', (
      select coalesce(jsonb_agg(to_jsonb(r) order by r.name), '[]'::jsonb) from rows_ r
    )
  ) into v;

  return v;
end;
$$;

-- 2) Detalle v2: cuenta consolidada del grupo.
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
        select id, name, notes, created_at from public.organizations where id = p_org_id
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

-- 3) Editar organización (nombre/notas) con auditoría.
create or replace function public.platform_update_organization(p_id bigint, p_name text, p_notes text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not public.is_platform_owner() then raise exception 'No autorizado'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'El nombre es obligatorio'; end if;

  update public.organizations set name = trim(p_name), notes = nullif(trim(coalesce(p_notes,'')), '')
  where id = p_id;
  if not found then raise exception 'Organización no encontrada'; end if;

  perform public._platform_audit(
    'update_organization', 'organization', p_id::text,
    jsonb_build_object('name', trim(p_name))
  );
end;
$$;

-- 4) Eliminar organización (solo si no tiene sucursales) con auditoría.
create or replace function public.platform_delete_organization(p_id bigint)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_name text;
begin
  if not public.is_platform_owner() then raise exception 'No autorizado'; end if;

  if exists (select 1 from public.restaurant_accounts ra where ra.organization_id = p_id) then
    raise exception 'La organización tiene sucursales asignadas; quitalas antes de eliminarla';
  end if;

  delete from public.organizations where id = p_id returning name into v_name;
  if v_name is null then raise exception 'Organización no encontrada'; end if;

  perform public._platform_audit(
    'delete_organization', 'organization', p_id::text,
    jsonb_build_object('name', v_name)
  );
end;
$$;

-- 5) Asignar/quitar un restaurante existente a un grupo, sin tocar plan/estado.
create or replace function public.platform_assign_restaurant_org(p_restaurant_id bigint, p_org_id bigint)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not public.is_platform_owner() then raise exception 'No autorizado'; end if;

  if not exists (select 1 from public.restaurants r where r.id = p_restaurant_id) then
    raise exception 'Restaurante no encontrado';
  end if;
  if p_org_id is not null and not exists (select 1 from public.organizations o where o.id = p_org_id) then
    raise exception 'Organización no encontrada';
  end if;

  insert into public.restaurant_accounts (restaurant_id, organization_id)
  values (p_restaurant_id, p_org_id)
  on conflict (restaurant_id)
  do update set organization_id = excluded.organization_id, updated_at = now();

  perform public._platform_audit(
    'assign_organization', 'restaurant', p_restaurant_id::text,
    jsonb_build_object('organization_id', p_org_id)
  );
end;
$$;

-- Lockdown: nada de anon/PUBLIC; solo operadores autenticados (guard interno).
revoke all on function public.platform_organizations_overview() from public, anon;
revoke all on function public.platform_organization_detail_v2(bigint) from public, anon;
revoke all on function public.platform_update_organization(bigint, text, text) from public, anon;
revoke all on function public.platform_delete_organization(bigint) from public, anon;
revoke all on function public.platform_assign_restaurant_org(bigint, bigint) from public, anon;

grant execute on function public.platform_organizations_overview() to authenticated, service_role;
grant execute on function public.platform_organization_detail_v2(bigint) to authenticated, service_role;
grant execute on function public.platform_update_organization(bigint, text, text) to authenticated, service_role;
grant execute on function public.platform_delete_organization(bigint) to authenticated, service_role;
grant execute on function public.platform_assign_restaurant_org(bigint, bigint) to authenticated, service_role;
