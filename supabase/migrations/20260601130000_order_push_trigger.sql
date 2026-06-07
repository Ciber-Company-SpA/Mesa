-- Trigger AFTER INSERT en orders que invoca la Edge Function
-- `send-order-push` para enviarle un push al mesero asignado.
--
-- Usa la extensión pg_net para hacer la llamada HTTP de forma asincrónica
-- (no bloquea la transacción del INSERT).

-- 1) Habilitar pg_net (idempotente). En Supabase ya viene precargado en
--    el schema `net`, así que solo aseguramos que esté.
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2) Guardamos el URL base del proyecto y el service_role key en
--    `app.settings.*`. Pero como Supabase no permite escribir current_setting
--    desde una migración común, la práctica es:
--      * hardcodear el host en cada trigger, o
--      * usar `current_setting('supabase.*')` que Supabase inyecta.
--    Optamos por hardcodear via variables que la migración resuelve.
--
-- Para que el trigger funcione necesitas:
--   1. supabase functions deploy send-order-push
--   2. supabase secrets set FCM_SERVICE_ACCOUNT="$(Get-Content ./fcm-key.json -Raw)"
--   3. Actualizar las dos constantes de abajo (project ref + anon key) si tu
--      proyecto está en otra región/instancia. Para evitar tener que hardcodear
--      acá, podés cambiarlo después con un ALTER FUNCTION.

CREATE OR REPLACE FUNCTION public.notify_new_order_push()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_url          text;
  v_service_role text;
BEGIN
  -- Sólo notificamos al CREAR un pedido (status nuevo o preparando).
  -- Los UPDATE (cambio de status) no disparan push.
  IF NEW.status_id NOT IN (1, 2) THEN
    RETURN NEW;
  END IF;

  -- Leemos url y service_role de configuración custom. Tenés que correr UNA VEZ:
  --   ALTER DATABASE postgres SET app.supabase_url = 'https://<ref>.supabase.co';
  --   ALTER DATABASE postgres SET app.service_role_key = '<service_role_key>';
  v_url := current_setting('app.supabase_url', true);
  v_service_role := current_setting('app.service_role_key', true);

  IF v_url IS NULL OR v_service_role IS NULL THEN
    -- Sin config no hacemos nada (no rompemos el INSERT).
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url     := v_url || '/functions/v1/send-order-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_service_role
    ),
    body    := jsonb_build_object('order_id', NEW.id)
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Nunca dejamos que un fallo en push reviente el INSERT del pedido.
  RAISE WARNING 'notify_new_order_push: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_new_order_push_trg ON public.orders;
CREATE TRIGGER notify_new_order_push_trg
  AFTER INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_order_push();
