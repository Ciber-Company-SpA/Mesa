-- "Pedir la cuenta" desde la mesa.
--
-- Flujo:
--   1. El cliente (anónimo) llama a la RPC `request_bill(p_table_id, p_diner_token)`.
--      La RPC valida mesa + QR activo (mismo patrón que create_public_order) e
--      inserta una fila en `service_calls`. Solo puede haber UNA llamada
--      pendiente por mesa: si ya existe, devuelve already_pending.
--   2. La app del mesero está suscrita por Realtime a `service_calls` de su
--      restaurante → suena la alerta y muestra el aviso.
--   3. Un trigger AFTER INSERT invoca la Edge Function `send-service-call-push`
--      (mismo mecanismo que notify_new_order_push) para el push FCM al
--      teléfono del mesero asignado a la mesa.
--   4. El mesero la marca como atendida (UPDATE con RLS de staff).

CREATE TABLE IF NOT EXISTS public.service_calls (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  table_id      bigint NOT NULL REFERENCES public.tables(id) ON DELETE CASCADE,
  restaurant_id bigint NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  call_type     text   NOT NULL DEFAULT 'bill' CHECK (call_type IN ('bill')),
  status        text   NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'attended')),
  diner_label   text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  attended_at   timestamptz,
  attended_by   bigint REFERENCES public.users(id) ON DELETE SET NULL
);

COMMENT ON TABLE public.service_calls IS
  'Llamadas de servicio desde la mesa (pedir la cuenta). Insert solo vía RPC request_bill.';

-- Realtime necesita la fila completa en los eventos.
ALTER TABLE public.service_calls REPLICA IDENTITY FULL;

-- Una sola llamada pendiente por mesa y tipo (anti-spam + idempotencia).
CREATE UNIQUE INDEX IF NOT EXISTS service_calls_one_pending_per_table
  ON public.service_calls (table_id, call_type)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS service_calls_restaurant_pending_idx
  ON public.service_calls (restaurant_id)
  WHERE status = 'pending';

ALTER TABLE public.service_calls ENABLE ROW LEVEL SECURITY;

-- Staff del restaurante lee y atiende las llamadas. Nadie inserta directo:
-- el cliente anónimo pasa por la RPC (SECURITY DEFINER).
CREATE POLICY "staff reads own restaurant service calls"
  ON public.service_calls FOR SELECT TO authenticated
  USING (restaurant_id = public.current_user_restaurant_id());

CREATE POLICY "staff updates own restaurant service calls"
  ON public.service_calls FOR UPDATE TO authenticated
  USING (restaurant_id = public.current_user_restaurant_id())
  WITH CHECK (restaurant_id = public.current_user_restaurant_id());

CREATE POLICY "no direct insert service calls"
  ON public.service_calls FOR INSERT TO authenticated, anon
  WITH CHECK (false);

-- Publicar en Realtime (idempotente: ignora si ya está en la publicación).
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.service_calls;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;

-- ============================================================================
-- RPC pública: el cliente de la mesa pide la cuenta.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.request_bill(
  p_table_id    bigint,
  p_diner_token text DEFAULT NULL
) RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
declare
  v_restaurant_id bigint;
  v_call_id       bigint;
  v_diner_label   text;
  v_diner_payload jsonb;
begin
  -- Mesa válida con QR activo (mismo guard que create_public_order).
  select t.restaurant_id
    into v_restaurant_id
  from public.tables t
  join public.table_qr_codes q on q.id = t.qr_code_id
  where t.id = p_table_id
    and q.qr_active = true;

  if v_restaurant_id is null then
    raise exception 'Mesa no encontrada o sin QR activo';
  end if;

  -- Identificar al comensal que pide (best-effort, solo para el mensaje).
  if p_diner_token is not null and length(p_diner_token) >= 8 then
    begin
      v_diner_payload := public.claim_diner_slot(p_table_id, p_diner_token);
      v_diner_label   := v_diner_payload->>'label';
    exception when others then
      v_diner_label := null;
    end;
  end if;

  insert into public.service_calls (table_id, restaurant_id, call_type, diner_label)
  values (p_table_id, v_restaurant_id, 'bill', v_diner_label)
  on conflict (table_id, call_type) where status = 'pending'
  do nothing
  returning id into v_call_id;

  if v_call_id is null then
    return jsonb_build_object('status', 'already_pending');
  end if;

  return jsonb_build_object('status', 'created', 'id', v_call_id);
end;
$$;

GRANT EXECUTE ON FUNCTION public.request_bill(bigint, text) TO anon, authenticated;

-- ============================================================================
-- Trigger: push FCM al mesero asignado vía Edge Function (patrón idéntico a
-- notify_new_order_push: pg_net + secrets en Vault, nunca rompe el INSERT).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.notify_service_call_push()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, vault
AS $$
DECLARE
  v_url          text;
  v_service_role text;
BEGIN
  SELECT decrypted_secret INTO v_url
  FROM vault.decrypted_secrets
  WHERE name = 'supabase_url';

  SELECT decrypted_secret INTO v_service_role
  FROM vault.decrypted_secrets
  WHERE name = 'service_role_key';

  IF v_url IS NULL OR v_service_role IS NULL THEN
    RAISE WARNING 'notify_service_call_push: secretos no configurados en vault';
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url     := v_url || '/functions/v1/send-service-call-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_service_role
    ),
    body    := jsonb_build_object('service_call_id', NEW.id)
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notify_service_call_push: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_service_call_push_trg ON public.service_calls;
CREATE TRIGGER notify_service_call_push_trg
  AFTER INSERT ON public.service_calls
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_service_call_push();
