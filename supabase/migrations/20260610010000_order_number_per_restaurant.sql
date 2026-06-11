-- Numeración correlativa de pedidos POR RESTAURANTE.
--
-- `orders.id` es global (compartido entre todos los restaurantes), así que en
-- el panel cada local veía números como "Pedido #847". Con esta migración cada
-- restaurante tiene su propio correlativo: Pedido #1, #2, #3...
--
--   * `orders.order_number`: correlativo dentro del restaurante.
--   * Backfill: se numeran los pedidos existentes por orden de creación.
--   * Trigger BEFORE INSERT: asigna max+1 del restaurante. Usa un advisory
--     lock transaccional por restaurante para que dos pedidos simultáneos del
--     mismo local no obtengan el mismo número.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS order_number bigint;

COMMENT ON COLUMN public.orders.order_number IS
  'Correlativo del pedido dentro del restaurante (1, 2, 3...). Asignado por trigger.';

-- Backfill de pedidos existentes, numerados por fecha de creación (y por id
-- como desempate, para pedidos creados en el mismo instante).
UPDATE public.orders o
SET order_number = numbered.rn
FROM (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY restaurant_id
           ORDER BY created_at, id
         ) AS rn
  FROM public.orders
  WHERE restaurant_id IS NOT NULL
) numbered
WHERE o.id = numbered.id
  AND o.order_number IS NULL;

-- Unicidad por restaurante (los NULL no chocan entre sí).
CREATE UNIQUE INDEX IF NOT EXISTS orders_restaurant_order_number_key
  ON public.orders (restaurant_id, order_number);

-- SECURITY DEFINER: el MAX debe calcularse sobre TODOS los pedidos del
-- restaurante, sin que el RLS del usuario que inserta (cliente anónimo en la
-- mesa) limite las filas visibles.
CREATE OR REPLACE FUNCTION public.assign_order_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.order_number IS NOT NULL OR NEW.restaurant_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Serializa la asignación dentro del mismo restaurante hasta el commit.
  PERFORM pg_advisory_xact_lock(hashtext('order_number_' || NEW.restaurant_id::text));

  SELECT COALESCE(MAX(order_number), 0) + 1
  INTO NEW.order_number
  FROM public.orders
  WHERE restaurant_id = NEW.restaurant_id;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.assign_order_number() FROM PUBLIC;

DROP TRIGGER IF EXISTS orders_assign_order_number ON public.orders;
CREATE TRIGGER orders_assign_order_number
  BEFORE INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_order_number();
