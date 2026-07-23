-- Rescatada del historial remoto (aplicada vía MCP el 20-jul como 20260720080118).
-- platform_organization_detail_v2 con max_branches en el detalle de la organización.

create or replace function public.platform_organization_detail_v2(p_org_id bigint)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare v jsonb;
begin
  if not public.is_platform_owner() then raise exception 'No autorizado'; end if;
  select jsonb_build_object(
    'organization', (
      select to_jsonb(x) from (
        select id, name, notes, legal_name, rut, contact_name, contact_email,
               contact_phone, address, city, max_branches, created_at
        from public.organizations where id = p_org_id
      ) x
    ),
    'branches', (
      select coalesce(jsonb_agg(b order by b.restaurant_name), '[]'::jsonb) from (
        select r.id as restaurant_id, r.restaurant_name::text as restaurant_name,
          coalesce(ra.account_status, 'active') as account_status, ra.plan_id, p.name as plan_name,
          p.max_tables as plan_max_tables, ra.trial_ends_at, ra.account_manager,
          (select count(*) from public.tables t where t.restaurant_id = r.id) as tables_count,
          (select count(*) from public.orders o where o.restaurant_id = r.id) as orders_total,
          (select coalesce(sum(o.total), 0) from public.orders o where o.restaurant_id = r.id and o.status_id = 4) as revenue_total,
          (select coalesce(sum(o.total), 0) from public.orders o where o.restaurant_id = r.id and o.status_id = 4 and o.created_at >= now() - interval '30 days') as revenue_30d,
          (select count(*) from public.onboarding_tasks ot where ot.restaurant_id = r.id and ot.done) as onboarding_done,
          (select count(*) from public.onboarding_tasks ot where ot.restaurant_id = r.id) as onboarding_total,
          (select count(*) from public.support_tickets st where st.restaurant_id = r.id and st.status in ('open','in_progress')) as open_tickets,
          exists(select 1 from public.service_contracts sc where sc.restaurant_id = r.id and sc.status = 'active') as has_active_contract
        from public.restaurant_accounts ra
        join public.restaurants r on r.id = ra.restaurant_id
        left join public.plans p on p.id = ra.plan_id
        where ra.organization_id = p_org_id
      ) b
    ),
    'contracts', (
      select coalesce(jsonb_agg(c order by c.created_at desc), '[]'::jsonb) from (
        select sc.id, sc.restaurant_id, r.restaurant_name::text as restaurant_name, sc.plan_id, sc.status,
               sc.one_time_amount, sc.support_monthly_amount, sc.has_support, sc.starts_on, sc.ends_on, sc.signed_at, sc.created_at
        from public.service_contracts sc
        join public.restaurant_accounts ra on ra.restaurant_id = sc.restaurant_id
        join public.restaurants r on r.id = sc.restaurant_id
        where ra.organization_id = p_org_id
      ) c
    ),
    'billing', (
      select coalesce(jsonb_agg(bi order by bi.due_date asc nulls last), '[]'::jsonb) from (
        select cb.id, cb.contract_id, r.restaurant_name::text as restaurant_name, cb.period_start, cb.period_end,
               cb.amount, cb.status, cb.due_date, cb.invoice_number
        from public.contract_billing cb
        join public.service_contracts sc on sc.id = cb.contract_id
        join public.restaurant_accounts ra on ra.restaurant_id = sc.restaurant_id
        join public.restaurants r on r.id = sc.restaurant_id
        where ra.organization_id = p_org_id and cb.status in ('pending','overdue') limit 25
      ) bi
    ),
    'tickets', (
      select coalesce(jsonb_agg(tk order by tk.created_at desc), '[]'::jsonb) from (
        select st.id, r.restaurant_name::text as restaurant_name, st.subject, st.priority, st.status, st.sla_due_at, st.created_at
        from public.support_tickets st
        join public.restaurant_accounts ra on ra.restaurant_id = st.restaurant_id
        join public.restaurants r on r.id = st.restaurant_id
        where ra.organization_id = p_org_id and st.status in ('open','in_progress') limit 25
      ) tk
    ),
    'timeseries', (
      select coalesce(jsonb_agg(ts order by ts.day), '[]'::jsonb) from (
        select d.day, count(o.id) as orders, coalesce(sum(o.total) filter (where o.status_id = 4), 0) as revenue
        from (select generate_series((date_trunc('day', now()) - interval '29 days')::date, date_trunc('day', now())::date, interval '1 day')::date as day) d
        left join public.orders o on o.created_at::date = d.day
          and o.restaurant_id in (select ra.restaurant_id from public.restaurant_accounts ra where ra.organization_id = p_org_id)
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
end; $$;

revoke all on function public.platform_organization_detail_v2(bigint) from public, anon;
grant execute on function public.platform_organization_detail_v2(bigint) to authenticated, service_role;
