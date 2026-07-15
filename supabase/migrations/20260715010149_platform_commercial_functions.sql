-- Portal de plataforma — Funciones de negocio (Fase B-II).
-- Todas SECURITY DEFINER con guard is_platform_owner() en la primera línea,
-- EXECUTE solo para authenticated/service_role. Las de escritura registran
-- en platform_audit_log vía el helper interno _platform_audit.

-- ---------- Helper interno de auditoría (no expuesto) ----------
create or replace function public._platform_audit(
  p_action text, p_target_type text, p_target_id text, p_detail jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
begin
  select email into v_email from auth.users where id = auth.uid();
  insert into public.platform_audit_log (actor_email, action, target_type, target_id, detail)
  values (v_email, p_action, p_target_type, p_target_id, p_detail);
end;
$$;
revoke all on function public._platform_audit(text, text, text, jsonb) from public, anon, authenticated;

-- ============ LECTURA ============

-- Planes (catálogo)
create or replace function public.platform_plans()
returns setof public.plans
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.is_platform_owner() then raise exception 'No autorizado'; end if;
  return query select * from public.plans order by sort_order;
end;
$$;

-- Panorama de cuentas/clientes
create or replace function public.platform_accounts_overview()
returns table(
  restaurant_id     bigint,
  restaurant_name   text,
  city              text,
  plan_id           text,
  plan_name         text,
  max_tables        integer,
  account_status    text,
  trial_ends_at     date,
  account_manager   text,
  organization_id   bigint,
  organization_name text,
  tables_count      bigint,
  has_active_contract boolean,
  created_at        timestamptz
)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.is_platform_owner() then raise exception 'No autorizado'; end if;
  return query
  select
    r.id, r.restaurant_name::text, r.restaurant_city,
    ra.plan_id, pl.name, pl.max_tables,
    coalesce(ra.account_status, 'active'), ra.trial_ends_at, ra.account_manager,
    ra.organization_id, o.name,
    (select count(*) from public.tables t where t.restaurant_id = r.id),
    exists(select 1 from public.service_contracts sc where sc.restaurant_id = r.id and sc.status = 'active'),
    r.created_at::timestamptz
  from public.restaurants r
  left join public.restaurant_accounts ra on ra.restaurant_id = r.id
  left join public.plans pl on pl.id = ra.plan_id
  left join public.organizations o on o.id = ra.organization_id
  order by r.restaurant_name;
end;
$$;

-- Contratos (todos, con restaurante y plan)
create or replace function public.platform_contracts_list()
returns table(
  id bigint, restaurant_id bigint, restaurant_name text,
  plan_id text, plan_name text, one_time_amount integer,
  support_monthly_amount integer, has_support boolean,
  starts_on date, ends_on date, status text, signed_at date, notes text
)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.is_platform_owner() then raise exception 'No autorizado'; end if;
  return query
  select sc.id, sc.restaurant_id, r.restaurant_name::text, sc.plan_id, pl.name,
    sc.one_time_amount, sc.support_monthly_amount, sc.has_support,
    sc.starts_on, sc.ends_on, sc.status, sc.signed_at, sc.notes
  from public.service_contracts sc
  join public.restaurants r on r.id = sc.restaurant_id
  left join public.plans pl on pl.id = sc.plan_id
  order by sc.created_at desc;
end;
$$;

-- Cobranza (períodos con restaurante)
create or replace function public.platform_billing_overview()
returns table(
  id bigint, contract_id bigint, restaurant_name text,
  period_start date, period_end date, amount integer,
  status text, due_date date, paid_at date, invoice_number text
)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.is_platform_owner() then raise exception 'No autorizado'; end if;
  return query
  select cb.id, cb.contract_id, r.restaurant_name::text,
    cb.period_start, cb.period_end, cb.amount, cb.status, cb.due_date, cb.paid_at, cb.invoice_number
  from public.contract_billing cb
  join public.service_contracts sc on sc.id = cb.contract_id
  join public.restaurants r on r.id = sc.restaurant_id
  order by cb.due_date desc nulls last, cb.period_start desc;
end;
$$;

-- Leads
create or replace function public.platform_leads_list()
returns setof public.leads
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.is_platform_owner() then raise exception 'No autorizado'; end if;
  return query select * from public.leads order by created_at desc;
end;
$$;

-- Tickets
create or replace function public.platform_tickets_list()
returns table(
  id bigint, restaurant_id bigint, restaurant_name text,
  subject text, description text, priority text, status text,
  sla_due_at timestamptz, assigned_to text, created_at timestamptz, resolved_at timestamptz
)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.is_platform_owner() then raise exception 'No autorizado'; end if;
  return query
  select t.id, t.restaurant_id, r.restaurant_name::text, t.subject, t.description,
    t.priority, t.status, t.sla_due_at, t.assigned_to, t.created_at, t.resolved_at
  from public.support_tickets t
  left join public.restaurants r on r.id = t.restaurant_id
  order by
    case t.status when 'open' then 0 when 'in_progress' then 1 else 2 end,
    case t.priority when 'urgent' then 0 when 'high' then 1 when 'medium' then 2 else 3 end,
    t.created_at desc;
end;
$$;

-- Organizaciones (grupos con conteo de sucursales)
create or replace function public.platform_organizations_list()
returns table(id bigint, name text, notes text, branches bigint, created_at timestamptz)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.is_platform_owner() then raise exception 'No autorizado'; end if;
  return query
  select o.id, o.name, o.notes,
    (select count(*) from public.restaurant_accounts ra where ra.organization_id = o.id),
    o.created_at
  from public.organizations o order by o.name;
end;
$$;

-- Operadores de plataforma (allowlist)
create or replace function public.platform_operators_list()
returns setof public.platform_admins
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.is_platform_owner() then raise exception 'No autorizado'; end if;
  return query select * from public.platform_admins order by created_at;
end;
$$;

-- Bitácora de auditoría
create or replace function public.platform_audit_recent(p_limit integer default 50)
returns setof public.platform_audit_log
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.is_platform_owner() then raise exception 'No autorizado'; end if;
  return query select * from public.platform_audit_log
    order by created_at desc limit greatest(least(p_limit, 200), 1);
end;
$$;

-- ============ ESCRITURA (con auditoría) ============

-- Actualizar cuenta (plan, estado, prueba, gerente, grupo)
create or replace function public.platform_update_account(
  p_restaurant_id bigint, p_plan_id text, p_status text,
  p_trial_ends_at date, p_account_manager text, p_organization_id bigint, p_notes text
) returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_platform_owner() then raise exception 'No autorizado'; end if;
  insert into public.restaurant_accounts
    (restaurant_id, plan_id, account_status, trial_ends_at, account_manager, organization_id, notes, updated_at)
  values
    (p_restaurant_id, p_plan_id, coalesce(p_status, 'trial'), p_trial_ends_at, p_account_manager, p_organization_id, p_notes, now())
  on conflict (restaurant_id) do update set
    plan_id = excluded.plan_id, account_status = excluded.account_status,
    trial_ends_at = excluded.trial_ends_at, account_manager = excluded.account_manager,
    organization_id = excluded.organization_id, notes = excluded.notes, updated_at = now();
  perform public._platform_audit('update_account', 'restaurant', p_restaurant_id::text,
    jsonb_build_object('plan', p_plan_id, 'status', p_status));
end;
$$;

-- Cambiar estado de cuenta (suspender / reactivar / etc.)
create or replace function public.platform_set_account_status(p_restaurant_id bigint, p_status text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_platform_owner() then raise exception 'No autorizado'; end if;
  if p_status not in ('trial','active','past_due','suspended','cancelled') then
    raise exception 'Estado inválido';
  end if;
  insert into public.restaurant_accounts (restaurant_id, account_status, updated_at)
  values (p_restaurant_id, p_status, now())
  on conflict (restaurant_id) do update set account_status = excluded.account_status, updated_at = now();
  perform public._platform_audit('set_account_status', 'restaurant', p_restaurant_id::text,
    jsonb_build_object('status', p_status));
end;
$$;

-- Crear contrato
create or replace function public.platform_create_contract(
  p_restaurant_id bigint, p_plan_id text, p_one_time integer, p_support_monthly integer,
  p_has_support boolean, p_starts_on date, p_signed_at date, p_notes text
) returns bigint
language plpgsql security definer set search_path = public
as $$
declare v_id bigint;
begin
  if not public.is_platform_owner() then raise exception 'No autorizado'; end if;
  insert into public.service_contracts
    (restaurant_id, plan_id, one_time_amount, support_monthly_amount, has_support, starts_on, signed_at, notes)
  values
    (p_restaurant_id, p_plan_id, p_one_time, p_support_monthly, coalesce(p_has_support,false),
     coalesce(p_starts_on, current_date), p_signed_at, p_notes)
  returning id into v_id;
  perform public._platform_audit('create_contract', 'contract', v_id::text,
    jsonb_build_object('restaurant_id', p_restaurant_id, 'plan', p_plan_id));
  return v_id;
end;
$$;

-- Cambiar estado de contrato
create or replace function public.platform_set_contract_status(p_id bigint, p_status text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_platform_owner() then raise exception 'No autorizado'; end if;
  if p_status not in ('active','suspended','terminated') then raise exception 'Estado inválido'; end if;
  update public.service_contracts set status = p_status where id = p_id;
  perform public._platform_audit('set_contract_status', 'contract', p_id::text,
    jsonb_build_object('status', p_status));
end;
$$;

-- Agregar período de cobranza
create or replace function public.platform_add_billing_period(
  p_contract_id bigint, p_period_start date, p_period_end date,
  p_amount integer, p_due_date date, p_invoice_number text
) returns bigint
language plpgsql security definer set search_path = public
as $$
declare v_id bigint;
begin
  if not public.is_platform_owner() then raise exception 'No autorizado'; end if;
  insert into public.contract_billing (contract_id, period_start, period_end, amount, due_date, invoice_number)
  values (p_contract_id, p_period_start, p_period_end, p_amount, p_due_date, p_invoice_number)
  returning id into v_id;
  perform public._platform_audit('add_billing_period', 'billing', v_id::text,
    jsonb_build_object('contract_id', p_contract_id, 'amount', p_amount));
  return v_id;
end;
$$;

-- Marcar estado de cobranza (pagado / vencido / condonado)
create or replace function public.platform_set_billing_status(p_id bigint, p_status text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_platform_owner() then raise exception 'No autorizado'; end if;
  if p_status not in ('pending','paid','overdue','waived') then raise exception 'Estado inválido'; end if;
  update public.contract_billing
    set status = p_status,
        paid_at = case when p_status = 'paid' then current_date else null end
    where id = p_id;
  perform public._platform_audit('set_billing_status', 'billing', p_id::text,
    jsonb_build_object('status', p_status));
end;
$$;

-- Crear lead (carga manual)
create or replace function public.platform_create_lead(
  p_name text, p_business_name text, p_email text, p_phone text,
  p_business_type text, p_city text, p_message text, p_plan_interest text
) returns bigint
language plpgsql security definer set search_path = public
as $$
declare v_id bigint;
begin
  if not public.is_platform_owner() then raise exception 'No autorizado'; end if;
  insert into public.leads (name, business_name, email, phone, business_type, city, message, plan_interest)
  values (p_name, p_business_name, p_email, p_phone, p_business_type, p_city, p_message, p_plan_interest)
  returning id into v_id;
  perform public._platform_audit('create_lead', 'lead', v_id::text, jsonb_build_object('name', p_name));
  return v_id;
end;
$$;

-- Cambiar estado de lead
create or replace function public.platform_set_lead_status(p_id bigint, p_status text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_platform_owner() then raise exception 'No autorizado'; end if;
  if p_status not in ('new','contacted','qualified','won','lost') then raise exception 'Estado inválido'; end if;
  update public.leads
    set status = p_status,
        contacted_at = case when p_status <> 'new' and contacted_at is null then now() else contacted_at end
    where id = p_id;
  perform public._platform_audit('set_lead_status', 'lead', p_id::text, jsonb_build_object('status', p_status));
end;
$$;

-- Crear ticket de soporte
create or replace function public.platform_create_ticket(
  p_restaurant_id bigint, p_subject text, p_description text,
  p_priority text, p_sla_due_at timestamptz, p_assigned_to text
) returns bigint
language plpgsql security definer set search_path = public
as $$
declare v_id bigint;
begin
  if not public.is_platform_owner() then raise exception 'No autorizado'; end if;
  insert into public.support_tickets (restaurant_id, subject, description, priority, sla_due_at, assigned_to)
  values (p_restaurant_id, p_subject, p_description, coalesce(p_priority,'medium'), p_sla_due_at, p_assigned_to)
  returning id into v_id;
  perform public._platform_audit('create_ticket', 'ticket', v_id::text, jsonb_build_object('subject', p_subject));
  return v_id;
end;
$$;

-- Cambiar estado de ticket
create or replace function public.platform_set_ticket_status(p_id bigint, p_status text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_platform_owner() then raise exception 'No autorizado'; end if;
  if p_status not in ('open','in_progress','resolved','closed') then raise exception 'Estado inválido'; end if;
  update public.support_tickets
    set status = p_status,
        resolved_at = case when p_status in ('resolved','closed') then now() else null end
    where id = p_id;
  perform public._platform_audit('set_ticket_status', 'ticket', p_id::text, jsonb_build_object('status', p_status));
end;
$$;

-- Crear organización (grupo/cadena)
create or replace function public.platform_create_organization(p_name text, p_notes text)
returns bigint
language plpgsql security definer set search_path = public
as $$
declare v_id bigint;
begin
  if not public.is_platform_owner() then raise exception 'No autorizado'; end if;
  insert into public.organizations (name, notes) values (p_name, p_notes) returning id into v_id;
  perform public._platform_audit('create_organization', 'organization', v_id::text, jsonb_build_object('name', p_name));
  return v_id;
end;
$$;

-- Agregar operador de plataforma (allowlist)
create or replace function public.platform_add_operator(p_email text, p_note text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_platform_owner() then raise exception 'No autorizado'; end if;
  insert into public.platform_admins (email, note) values (lower(p_email), p_note)
  on conflict (email) do update set note = excluded.note;
  perform public._platform_audit('add_operator', 'operator', lower(p_email), '{}'::jsonb);
end;
$$;

-- Quitar operador de plataforma (no puede quitarse a sí mismo)
create or replace function public.platform_remove_operator(p_email text)
returns void
language plpgsql security definer set search_path = public
as $$
declare v_self text;
begin
  if not public.is_platform_owner() then raise exception 'No autorizado'; end if;
  select email into v_self from auth.users where id = auth.uid();
  if lower(p_email) = lower(coalesce(v_self, '')) then
    raise exception 'No puedes quitarte a ti mismo';
  end if;
  delete from public.platform_admins where email = lower(p_email);
  perform public._platform_audit('remove_operator', 'operator', lower(p_email), '{}'::jsonb);
end;
$$;

-- ---------- Grants: lectura y escritura solo para authenticated/service_role ----------
do $$
declare fn text;
begin
  for fn in
    select p.oid::regprocedure::text
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname like 'platform\_%'
      and p.proname not in (
        'platform_metrics','platform_list_restaurants','platform_restaurant_detail',
        'platform_sales_timeseries','platform_top_products','platform_recent_activity'
      )
  loop
    execute format('revoke all on function %s from public, anon', fn);
    execute format('grant execute on function %s to authenticated, service_role', fn);
  end loop;
end $$;
