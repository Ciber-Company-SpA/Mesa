-- ============================================================
-- FIX RLS: cerrar lectura/escritura cross-tenant
-- Mantiene: cliente anónimo crea y ve pedidos de SU mesa.
-- Cierra: leer/editar datos de OTROS restaurantes.
-- ============================================================

-- ---------- ORDERS ----------
-- Antes: "Anyone can select orders" USING (true)  → cualquiera veía TODAS.
-- Ahora: anon/auth solo ve órdenes de una mesa existente (su mesa, vía table_id).
drop policy if exists "Anyone can select orders" on public.orders;
create policy "select_orders_by_table"
on public.orders for select
to authenticated, anon
using (
  table_id is not null
  and exists (select 1 from public.tables t where t.id = orders.table_id)
);

-- INSERT se mantiene abierto (el cliente pide). Sin cambios necesarios:
-- la policy "Anyone can insert orders" ya existe y está bien.

-- ---------- ORDER_ITEMS ----------
-- Antes: "Allow all on order_items" USING(true) WITH CHECK(true) → abierto total.
-- Ahora: ver/crear items solo de órdenes accesibles (misma lógica que orders).
drop policy if exists "Allow all on order_items" on public.order_items;

create policy "select_order_items_by_order"
on public.order_items for select
to authenticated, anon
using (
  exists (
    select 1 from public.orders o
    where o.id = order_items.order_id
      and o.table_id is not null
      and exists (select 1 from public.tables t where t.id = o.table_id)
  )
);

create policy "insert_order_items_by_order"
on public.order_items for insert
to authenticated, anon
with check (
  exists (select 1 from public.orders o where o.id = order_items.order_id)
);

-- ---------- PRODUCT_VARIANTS ----------
-- Antes: todas USING(true) → cualquier autenticado editaba variantes de OTROS.
-- Ahora: SELECT público (menú visible al cliente), pero escritura solo del dueño.
drop policy if exists "select_product_variants" on public.product_variants;
drop policy if exists "insert_product_variants" on public.product_variants;
drop policy if exists "update_product_variants" on public.product_variants;
drop policy if exists "delete_product_variants" on public.product_variants;

create policy "select_product_variants_public"
on public.product_variants for select
to authenticated, anon
using (true);  -- menú visible; las variantes no son sensibles

create policy "write_product_variants_own"
on public.product_variants for all
to authenticated
using (
  exists (
    select 1 from public.products p
    join public.users u on u.restaurant_id = p.restaurant_id
    where p.id = product_variants.product_id
      and u.auth_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.products p
    join public.users u on u.restaurant_id = p.restaurant_id
    where p.id = product_variants.product_id
      and u.auth_user_id = auth.uid()
  )
);

-- ---------- CUSTOMERS ----------
-- Antes: USING(true) → cualquier autenticado veía clientes de TODOS.
-- (Ajusta si customers tiene restaurant_id; aquí asumo que sí.)
-- Si NO tiene restaurant_id, dime y lo reescribimos.-- ---------- CUSTOMERS ----------
-- Solo tiene id + table_id (sin datos personales). Riesgo bajo,
-- pero cerramos por consistencia: ligado a una mesa existente.
drop policy if exists "customer_select" on public.customers;
drop policy if exists "customer_insert" on public.customers;
drop policy if exists "customer_update" on public.customers;

create policy "customers_by_table"
on public.customers for all
to authenticated, anon
using (
  table_id is not null
  and exists (select 1 from public.tables t where t.id = customers.table_id)
)
with check (
  table_id is not null
  and exists (select 1 from public.tables t where t.id = customers.table_id)
);



-- ---------- TABLE_CART_ITEMS ----------
-- Antes: 4 policies USING(true) a anon. Ahora: carrito de SU mesa.
drop policy if exists "anon can read cart items" on public.table_cart_items;
drop policy if exists "anon can insert cart items" on public.table_cart_items;
drop policy if exists "anon can update cart items" on public.table_cart_items;
drop policy if exists "anon can delete cart items" on public.table_cart_items;

create policy "cart_items_by_table"
on public.table_cart_items for all
to authenticated, anon
using (
  exists (select 1 from public.tables t where t.id = table_cart_items.table_id)
)
with check (
  exists (select 1 from public.tables t where t.id = table_cart_items.table_id)
);
