-- Auditoría jul 2026, punto 4: reducir la superficie EXECUTE de funciones
-- SECURITY DEFINER. Ninguna era explotable (todas validan token QR o auth.uid()),
-- pero los grants a anon/PUBLIC sobran — defensa en profundidad.
--
-- Se usa un DO block con regprocedure para no depender de firmas exactas
-- y cubrir posibles sobrecargas. Varias funciones tienen grant a PUBLIC,
-- por lo que revocar solo anon/authenticated no bastaría.

do $$
declare
  fn regprocedure;
begin
  -- Grupo A: funciones trigger (Postgres no permite invocarlas directamente;
  -- los triggers siguen corriendo como owner) y helpers internos que solo
  -- invocan otras funciones SECURITY DEFINER o triggers. Nadie necesita
  -- EXECUTE vía API.
  for fn in
    select p.oid::regprocedure
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        -- triggers
        'assign_order_number',
        'cleanup_diners_on_payment',
        'handle_new_user',
        'handle_user_deletion',
        'mesa_apply_stock_movement',
        'mesa_recipe_changed',
        'notify_new_order_push',
        'notify_service_call_push',
        -- helpers internos sin call sites en el frontend
        'cart_resolve_price',
        'cart_validate_table',
        'is_table_active',
        'mesa_recompute_availability_for_ingredient',
        'mesa_recompute_target_availability'
      )
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', fn);
  end loop;

  -- Grupo B: funciones que exigen sesión (validan auth.uid()/rol internamente).
  -- Se quita anon y PUBLIC; se garantiza authenticated y service_role explícitos
  -- porque algunas solo tenían EXECUTE vía PUBLIC.
  for fn in
    select p.oid::regprocedure
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'assign_waiter',
        'complete_restaurant_setup',
        'create_owned_restaurant',
        'delete_waiter_as_admin',
        'list_my_restaurants',
        'list_waiters_for_admin',
        'pay_diner_orders',
        'register_device_token',
        'set_active_restaurant',
        'update_own_user_name'
      )
  loop
    execute format('revoke execute on function %s from public, anon', fn);
    execute format('grant execute on function %s to authenticated, service_role', fn);
  end loop;
end $$;
