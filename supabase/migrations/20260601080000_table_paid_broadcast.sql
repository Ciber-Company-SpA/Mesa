-- Rollback del intento de broadcast desde SQL: la función realtime.send no
-- existe en todas las versiones de Supabase Realtime y, si no existe, el
-- trigger lanza error y revierte el UPDATE del cobro entero. Volvemos a la
-- versión segura del trigger (solo limpieza de diners) y dejamos que el
-- polling del cliente -- ya acortado a 3 s -- detecte la mesa vacía.

CREATE OR REPLACE FUNCTION public.cleanup_diners_on_payment()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  IF NEW.status_id = 4 AND (OLD.status_id IS DISTINCT FROM 4) AND NEW.table_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.orders
      WHERE table_id = NEW.table_id
        AND status_id IN (1, 2, 3)
    ) THEN
      DELETE FROM public.table_diners WHERE table_id = NEW.table_id;
      -- Vaciar el carrito compartido de la mesa: si quedan items sin enviar
      -- de los comensales que se fueron, el próximo cliente que escanee no
      -- debería verlos.
      DELETE FROM public.table_cart_items WHERE table_id = NEW.table_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
