-- Readiness go-live: endurecimiento de grants por defensa en profundidad.
-- Las funciones de reporte del panel son SECURITY INVOKER (la RLS ya las
-- protege), pero no hay razón para que anon pueda invocarlas: se usan solo
-- desde el panel autenticado. Los triggers no se invocan directamente.
do $$
declare fn regprocedure;
begin
  for fn in
    select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in ('get_order_stats_today','get_sales_report')
  loop
    execute format('revoke execute on function %s from anon', fn);
    execute format('grant execute on function %s to authenticated, service_role', fn);
  end loop;
  for fn in
    select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in ('set_order_ready_at','touch_table_cart_items')
  loop
    execute format('revoke execute on function %s from anon, authenticated', fn);
  end loop;
end $$;
