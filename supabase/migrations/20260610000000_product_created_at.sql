-- `created_at` en products para que la etiqueta "Nuevo" del menú sea real:
-- un producto se considera nuevo si lleva menos de 7 días creado.
--
-- Backfill: los productos existentes se retro-datan (now() - 30 días) para
-- que no aparezcan todos como "Nuevo" durante la primera semana tras aplicar
-- la migración. Solo los productos creados de aquí en adelante llevan now().

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

COMMENT ON COLUMN public.products.created_at IS
  'Fecha de creación del producto. El menú muestra "Nuevo" si tiene menos de 7 días.';

-- Retro-datar lo que existía antes de esta migración (ADD COLUMN deja
-- todas las filas existentes con el default now()).
UPDATE public.products
SET created_at = now() - interval '30 days';
