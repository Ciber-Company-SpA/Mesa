-- Endurecimiento a partir de la auditoría de seguridad (hallazgos medios/bajos).
--
-- M-1: las policies anon de products/product_variants eran USING(true), lo que
-- permitía a cualquier anónimo enumerar por la API REST TODAS las cartas de
-- TODOS los restaurantes, incluidos productos no disponibles (borradores /
-- deshabilitados) con sus precios. Se acota a productos DISPONIBLES
-- (status_id = 1). El flujo del comensal sigue intacto: la carta se sirve por
-- get_public_menu (SECURITY DEFINER, no afectada) y las lecturas directas del
-- cliente (useCartSync / product-status) solo necesitan ver lo disponible;
-- un ítem que pasa a agotado simplemente deja de aparecer y se trata como no
-- disponible, que es el comportamiento deseado.
alter policy products_select_anon on public.products
  using (status_id = 1);

alter policy product_variants_select_anon on public.product_variants
  using (product_id in (select id from public.products where status_id = 1));

-- LOW (defensa en profundidad): estas tablas tenían grants amplios a anon
-- (hasta INSERT/UPDATE/DELETE/TRUNCATE) que hoy son inertes porque no existe
-- policy anon (deny-all) o el INSERT está bloqueado con WITH CHECK false. El
-- acceso legítimo del comensal ocurre por RPCs SECURITY DEFINER, que no
-- necesitan grants de tabla para anon. Se revoca todo el acceso directo de anon
-- para no depender únicamente de RLS.
revoke all on public.device_tokens from anon;
revoke all on public.roles from anon;
revoke all on public.service_calls from anon;
revoke all on public.table_diners from anon;
