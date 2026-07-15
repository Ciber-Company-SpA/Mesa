-- C1/C2: permitir que el panel del restaurante lea su propio plan, límites y
-- flags de features. SECURITY DEFINER (restaurant_accounts tiene RLS deny-all).
-- Un restaurante sin plan asignado obtiene acceso completo (grandfather) para
-- no romper la operación actual; sólo Plan 15 recorta features.
create or replace function public.get_my_restaurant_plan()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_rid bigint;
  v jsonb;
begin
  v_rid := public.current_user_restaurant_id();
  if v_rid is null then
    return null;
  end if;

  select jsonb_build_object(
    'restaurant_id', v_rid,
    'plan_id', ra.plan_id,
    'plan_name', pl.name,
    'max_tables', pl.max_tables,
    'one_time_price', pl.one_time_price,
    'support_monthly_price', pl.support_monthly_price,
    'account_status', coalesce(ra.account_status, 'active'),
    'trial_ends_at', ra.trial_ends_at,
    'tables_count', (select count(*) from public.tables t where t.restaurant_id = v_rid),
    'has_reports_advanced', (ra.plan_id is distinct from 'plan15'),
    'has_full_waiter_mgmt', (ra.plan_id is distinct from 'plan15'),
    'has_multi_branch', (ra.plan_id = 'custom')
  ) into v
  from public.restaurant_accounts ra
  left join public.plans pl on pl.id = ra.plan_id
  where ra.restaurant_id = v_rid;

  return coalesce(v, jsonb_build_object(
    'restaurant_id', v_rid,
    'plan_id', null,
    'account_status', 'active',
    'has_reports_advanced', true,
    'has_full_waiter_mgmt', true,
    'has_multi_branch', false,
    'tables_count', (select count(*) from public.tables t where t.restaurant_id = v_rid)
  ));
end;
$$;

revoke all on function public.get_my_restaurant_plan() from public, anon;
grant execute on function public.get_my_restaurant_plan() to authenticated, service_role;
