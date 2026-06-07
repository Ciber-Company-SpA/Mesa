-- El trigger anterior usaba ALTER DATABASE SET app.* lo cual requiere
-- privilegios superuser que Supabase no otorga. Migramos a Supabase Vault:
-- los secrets `supabase_url` y `service_role_key` se cargan vía
-- `vault.create_secret(...)` y el trigger los lee de `vault.decrypted_secrets`.

CREATE OR REPLACE FUNCTION public.notify_new_order_push()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, vault
AS $$
DECLARE
  v_url          text;
  v_service_role text;
BEGIN
  IF NEW.status_id NOT IN (1, 2) THEN
    RETURN NEW;
  END IF;

  SELECT decrypted_secret INTO v_url
  FROM vault.decrypted_secrets
  WHERE name = 'supabase_url';

  SELECT decrypted_secret INTO v_service_role
  FROM vault.decrypted_secrets
  WHERE name = 'service_role_key';

  IF v_url IS NULL OR v_service_role IS NULL THEN
    RAISE WARNING 'notify_new_order_push: secretos no configurados en vault';
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
  RAISE WARNING 'notify_new_order_push: %', SQLERRM;
  RETURN NEW;
END;
$$;
