-- Cuando se cobra completamente una mesa, emitimos un broadcast de Supabase
-- Realtime para que los dispositivos del menú público redirijan al instante
-- a /gracias sin tener que esperar al polling de useTableOrders.
--
-- Topic: 'table:<id>'   Evento: 'table_paid'   private = false (anon escucha)

CREATE OR REPLACE FUNCTION public.cleanup_diners_on_payment()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_remaining int;
BEGIN
  IF NEW.status_id = 4 AND (OLD.status_id IS DISTINCT FROM 4) AND NEW.table_id IS NOT NULL THEN
    SELECT COUNT(*) INTO v_remaining
    FROM public.orders
    WHERE table_id = NEW.table_id
      AND status_id IN (1, 2, 3);

    IF v_remaining = 0 THEN
      DELETE FROM public.table_diners WHERE table_id = NEW.table_id;

      -- Broadcast a los dispositivos suscritos al topic de la mesa.
      PERFORM realtime.send(
        jsonb_build_object('table_id', NEW.table_id),
        'table_paid',
        'table:' || NEW.table_id::text,
        false
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
