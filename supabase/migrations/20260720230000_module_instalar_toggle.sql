-- Registra el módulo "Instalar app" (/admin/instalar) en platform_modules para
-- que el operador lo pueda encender/apagar por cliente desde el portal.
-- enabled=true por defecto (visible), locked=false (se puede ocultar).
-- sort_order 165: entre "Soporte" (160) y "Sucursales" (170).

insert into public.platform_modules (area, key, label, description, locked, sort_order) values
  ('admin','instalar','Instalar app','Instalación de la app del restaurante y de meseros (PWA)', false, 165)
on conflict (area, key) do nothing;
