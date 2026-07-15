-- Fix: el EXECUTE de estas funciones venía de PUBLIC, no de anon directo; hay
-- que revocar de PUBLIC para que anon deje de heredarlo.
do $$
declare fn regprocedure;
begin
  for fn in
    select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in ('get_order_stats_today','get_sales_report')
  loop
    execute format('revoke execute on function %s from public, anon', fn);
    execute format('grant execute on function %s to authenticated, service_role', fn);
  end loop;
  for fn in
    select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in ('set_order_ready_at','touch_table_cart_items')
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', fn);
  end loop;
end $$;
