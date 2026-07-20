-- Registra los módulos "Promociones" y "Descuentos" en platform_modules para
-- que el operador los pueda encender/apagar por cliente desde el portal.
-- sort 35/36: entre "Productos" (30) e "Inventario" (40), como subsecciones.

insert into public.platform_modules (area, key, label, description, locked, sort_order) values
  ('admin','promociones','Promociones','Combos de productos a precio especial', false, 35),
  ('admin','descuentos','Descuentos','Cupones de descuento con reglas (día, horario, alcance)', false, 36)
on conflict (area, key) do nothing;
