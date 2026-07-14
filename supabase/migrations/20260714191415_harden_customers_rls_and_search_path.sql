-- Corrige hallazgos de los security advisors (jul 2026):
--  1) rls_policy_always_true: customers.customer_insert / customer_update usaban
--     WITH CHECK (true), permitiendo a cualquier usuario autenticado insertar o
--     modificar filas de otros restaurantes. Se replica el aislamiento por tenant
--     que ya usa customer_select.
--  2) function_search_path_mutable: 5 funciones sin search_path fijo.

-- 1) customers: aislamiento por tenant en INSERT y UPDATE
drop policy if exists customer_insert on public.customers;
create policy customer_insert on public.customers
  for insert to authenticated
  with check (
    table_id in (
      select t.id
      from public.tables t
      where t.restaurant_id = public.current_user_restaurant_id()
    )
  );

drop policy if exists customer_update on public.customers;
create policy customer_update on public.customers
  for update to authenticated
  using (
    table_id in (
      select t.id
      from public.tables t
      where t.restaurant_id = public.current_user_restaurant_id()
    )
  )
  with check (
    table_id in (
      select t.id
      from public.tables t
      where t.restaurant_id = public.current_user_restaurant_id()
    )
  );

-- 2) fijar search_path (pg_temp explícito al final evita shadowing por tablas temporales)
alter function public.is_reserved_slug(p_slug text)
  set search_path = public, pg_temp;

alter function public.get_order_stats_today(restaurant_id_param bigint)
  set search_path = public, pg_temp;

alter function public.touch_table_cart_items()
  set search_path = public, pg_temp;

alter function public.set_order_ready_at()
  set search_path = public, pg_temp;

alter function public.get_sales_report(
    p_restaurant_id bigint,
    p_from timestamptz,
    p_to timestamptz,
    p_granularity text
  )
  set search_path = public, pg_temp;
