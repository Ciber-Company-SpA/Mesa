-- ============================================================================
-- Aislamiento multi-tenant (continuación de H-01): cerrar el resto de tablas
-- con SELECT permisivo USING(true) para 'authenticated'.
--
-- Contexto de cada tabla (auditado contra el frontend):
--   * restaurants  → NINGÚN flujo anon la lee directo (menú y directorio público
--                    usan get_public_menu / get_restaurant_by_slug, SECURITY
--                    DEFINER). Se revoca SELECT a anon y se acota authenticated
--                    al propio restaurante. Cierra fuga de columnas de config
--                    (printer_bluetooth_name, delivery_*) entre tenants.
--   * customers    → sin grant anon; solo authenticated. Columnas: id, table_id.
--                    Se acota vía join a tables → restaurant_id del usuario.
--   * products / categories / product_variants → el detalle deep-link del
--                    cliente (/[id]/menu/[productId]) las lee como anon (cliente
--                    sin sesión), así que anon MANTIENE lectura pública (son datos
--                    de menú). Se agrega además una policy acotada para
--                    authenticated, que cierra el vector reportado (enumeración
--                    cross-tenant con token authenticated por la API REST).
--
-- Nota: para cerrar también la lectura anon cross-tenant de products/categories/
-- product_variants haría falta migrar el detalle deep-link a una RPC por
-- qr_token (como get_public_menu) y revocar anon. Queda como follow-up.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- restaurants: solo el propio restaurante, solo authenticated. anon fuera.
-- ----------------------------------------------------------------------------
alter table public.restaurants enable row level security;
revoke select on public.restaurants from anon;

drop policy if exists restaurants_select on public.restaurants;
create policy restaurants_select on public.restaurants
  for select
  to authenticated
  using (id = current_user_restaurant_id());

-- ----------------------------------------------------------------------------
-- customers: solo filas de mesas del propio restaurante (authenticated).
-- ----------------------------------------------------------------------------
alter table public.customers enable row level security;

drop policy if exists customer_select on public.customers;
create policy customer_select on public.customers
  for select
  to authenticated
  using (
    table_id in (
      select t.id
      from public.tables t
      where t.restaurant_id = current_user_restaurant_id()
    )
  );

-- ----------------------------------------------------------------------------
-- products: anon lee público (detalle deep-link); authenticated solo su tenant.
-- ----------------------------------------------------------------------------
alter table public.products enable row level security;

drop policy if exists products_select on public.products;
create policy products_select_anon on public.products
  for select
  to anon
  using (true);
create policy products_select_auth on public.products
  for select
  to authenticated
  using (restaurant_id = current_user_restaurant_id());

-- ----------------------------------------------------------------------------
-- categories: idem products.
-- ----------------------------------------------------------------------------
alter table public.categories enable row level security;

drop policy if exists categories_select on public.categories;
create policy categories_select_anon on public.categories
  for select
  to anon
  using (true);
create policy categories_select_auth on public.categories
  for select
  to authenticated
  using (restaurant_id = current_user_restaurant_id());

-- ----------------------------------------------------------------------------
-- product_variants: anon público; authenticated acotado vía join a products.
-- (La policy vieja era TO public con USING(true).)
-- ----------------------------------------------------------------------------
alter table public.product_variants enable row level security;

drop policy if exists select_product_variants on public.product_variants;
create policy product_variants_select_anon on public.product_variants
  for select
  to anon
  using (true);
create policy product_variants_select_auth on public.product_variants
  for select
  to authenticated
  using (
    product_id in (
      select p.id
      from public.products p
      where p.restaurant_id = current_user_restaurant_id()
    )
  );

commit;
