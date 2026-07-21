-- ============================================================================
-- Módulo "Asistente IA" del panel admin (botón flotante, sin ruta propia).
-- Registrado en platform_modules para que el operador pueda apagarlo por
-- restaurante-plataforma desde /plataforma del portal. El widget lo consulta
-- vía get_visible_modules (fail-open). No lleva entrada en
-- ADMIN_MODULE_BY_ROUTE porque no tiene página que gatear.
-- ============================================================================

insert into public.platform_modules (area, key, label, description, enabled, locked, sort_order)
values (
  'admin',
  'asistente',
  'Asistente IA',
  'Asistente virtual que ejecuta tareas (categorías, productos, cupones, promos) y da recomendaciones con los datos del negocio',
  true,
  false,
  175
)
on conflict (area, key) do nothing;
