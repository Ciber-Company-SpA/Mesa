-- Soporte de "división de cuenta por comensal" para cada mesa.
--
-- Tabla auxiliar `table_diners`: lleva el registro de comensales activos en una
-- mesa (Comensal 1, 2, 3...). Cada dispositivo del menú público se identifica
-- con un token aleatorio guardado en localStorage; el RPC `claim_diner_slot`
-- es idempotente: si el token ya existe devuelve su slot, si no asigna el
-- próximo slot libre para esa mesa.
--
-- Las columnas `orders.diner_slot` y `orders.diner_label` se denormalizan en
-- la orden (igual que `variant_name`) para que el historial conserve a qué
-- comensal corresponde aunque después se haga reset.
--
-- Cuando se cobran TODOS los pedidos activos de una mesa, los registros de
-- table_diners se borran -- así la próxima ronda de clientes vuelve a empezar
-- en "Comensal 1".

-- 1) Tabla auxiliar
CREATE TABLE IF NOT EXISTS public.table_diners (
  id           bigserial PRIMARY KEY,
  table_id     bigint NOT NULL REFERENCES public.tables(id) ON DELETE CASCADE,
  diner_slot   int    NOT NULL CHECK (diner_slot >= 1 AND diner_slot <= 99),
  diner_token  text   NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT table_diners_token_unique UNIQUE (table_id, diner_token),
  CONSTRAINT table_diners_slot_unique  UNIQUE (table_id, diner_slot)
);

CREATE INDEX IF NOT EXISTS table_diners_table_idx
  ON public.table_diners (table_id);

-- 2) Columnas denormalizadas en orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS diner_slot  int,
  ADD COLUMN IF NOT EXISTS diner_label text;

-- 3) RPC: claim_diner_slot
-- Idempotente: si el token ya existe para la mesa, devuelve su slot.
-- Si no existe, asigna el siguiente slot libre.
CREATE OR REPLACE FUNCTION public.claim_diner_slot(
  p_table_id bigint,
  p_token    text
) RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_slot int;
BEGIN
  IF p_table_id IS NULL OR p_table_id <= 0 THEN
    RAISE EXCEPTION 'Mesa inválida';
  END IF;
  IF p_token IS NULL OR length(p_token) < 8 OR length(p_token) > 128 THEN
    RAISE EXCEPTION 'Token inválido';
  END IF;

  -- Validar que la mesa exista y tenga QR activo (mismo guard que create_public_order)
  PERFORM 1
  FROM public.tables t
  JOIN public.table_qr_codes q ON q.id = t.qr_code_id
  WHERE t.id = p_table_id AND q.qr_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Mesa no encontrada o sin QR activo';
  END IF;

  -- Si ya existe, devolver su slot
  SELECT diner_slot INTO v_slot
  FROM public.table_diners
  WHERE table_id = p_table_id AND diner_token = p_token;

  IF v_slot IS NOT NULL THEN
    RETURN jsonb_build_object('slot', v_slot, 'label', 'Comensal ' || v_slot);
  END IF;

  -- Asignar siguiente slot libre. Reintento ante race condition con
  -- otro dispositivo escaneando al mismo tiempo.
  FOR i IN 1..10 LOOP
    SELECT COALESCE(MAX(diner_slot), 0) + 1 INTO v_slot
    FROM public.table_diners
    WHERE table_id = p_table_id;

    BEGIN
      INSERT INTO public.table_diners (table_id, diner_slot, diner_token)
      VALUES (p_table_id, v_slot, p_token);
      RETURN jsonb_build_object('slot', v_slot, 'label', 'Comensal ' || v_slot);
    EXCEPTION WHEN unique_violation THEN
      -- Otro dispositivo reclamó ese slot. Reintentar.
      CONTINUE;
    END;
  END LOOP;

  RAISE EXCEPTION 'No se pudo asignar slot de comensal';
END;
$$;

ALTER FUNCTION public.claim_diner_slot(bigint, text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.claim_diner_slot(bigint, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_diner_slot(bigint, text) TO anon;
GRANT EXECUTE ON FUNCTION public.claim_diner_slot(bigint, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_diner_slot(bigint, text) TO service_role;

-- 4) Reemplazar create_public_order para aceptar p_diner_token (opcional).
CREATE OR REPLACE FUNCTION public.create_public_order(
  p_table_id    bigint,
  p_items       jsonb,
  p_diner_token text DEFAULT NULL
) RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
declare
  v_restaurant_id   bigint;
  v_order_id        bigint;
  v_initial_status  int;
  v_order_dest      text;
  v_item            jsonb;
  v_product_id      bigint;
  v_variant_id      bigint;
  v_qty             int;
  v_notes           text;
  v_unit_price      numeric;
  v_product_name    text;
  v_variant_name    text;
  v_product_status  int;
  v_total           numeric := 0;
  v_item_count      int;
  v_created_at      timestamptz;
  v_status_name     text;
  v_diner_slot      int;
  v_diner_label     text;
  v_diner_payload   jsonb;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'items inválido';
  end if;

  v_item_count := jsonb_array_length(p_items);
  if v_item_count < 1 or v_item_count > 30 then
    raise exception 'El pedido debe tener entre 1 y 30 líneas';
  end if;

  select t.restaurant_id
    into v_restaurant_id
  from public.tables t
  join public.table_qr_codes q on q.id = t.qr_code_id
  where t.id = p_table_id
    and q.qr_active = true;

  if v_restaurant_id is null then
    raise exception 'Mesa no encontrada o sin QR activo';
  end if;

  -- Si vino token de comensal, reclamamos su slot (idempotente).
  if p_diner_token is not null and length(p_diner_token) >= 8 then
    v_diner_payload := public.claim_diner_slot(p_table_id, p_diner_token);
    v_diner_slot    := (v_diner_payload->>'slot')::int;
    v_diner_label   := v_diner_payload->>'label';
  end if;

  select r.order_destination
    into v_order_dest
  from public.restaurants r
  where r.id = v_restaurant_id;

  v_initial_status := case when v_order_dest = 'kitchen' then 2 else 1 end;

  insert into public.orders
    (table_id, restaurant_id, total, status_id, created_at, diner_slot, diner_label)
  values
    (p_table_id, v_restaurant_id, 0, v_initial_status, now(), v_diner_slot, v_diner_label)
  returning id, created_at into v_order_id, v_created_at;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_product_id := (v_item->>'product_id')::bigint;
    v_variant_id := nullif(v_item->>'variant_id', '')::bigint;
    v_qty        := coalesce((v_item->>'quantity')::int, 0);
    v_notes      := left(coalesce(v_item->>'notes', ''), 250);

    if v_qty < 1 or v_qty > 20 then
      raise exception 'Cantidad inválida (1-20) para product_id %', v_product_id;
    end if;

    select p.product_name, p.product_price, p.status_id
      into v_product_name, v_unit_price, v_product_status
    from public.products p
    where p.id = v_product_id
      and p.restaurant_id = v_restaurant_id;

    if v_product_name is null then
      raise exception 'Producto % no pertenece al restaurante de la mesa', v_product_id;
    end if;

    if v_product_status <> 1 then
      raise exception 'El producto "%" no está disponible', v_product_name;
    end if;

    v_variant_name := null;

    if v_variant_id is not null then
      select pv.variant_price, pv.variant_name
        into v_unit_price, v_variant_name
      from public.product_variants pv
      where pv.id = v_variant_id
        and pv.product_id = v_product_id;

      if v_variant_name is null then
        raise exception 'La variante % no pertenece al producto %', v_variant_id, v_product_id;
      end if;
    end if;

    insert into public.order_items
      (order_id, product_id, product_quantity, product_name, product_price,
       notes, variant_id, variant_name)
    values
      (v_order_id, v_product_id, v_qty, v_product_name, v_unit_price,
       nullif(v_notes, ''), v_variant_id, v_variant_name);

    v_total := v_total + (v_unit_price * v_qty);
  end loop;

  update public.orders set total = round(v_total)::int where id = v_order_id;

  select s.status_name into v_status_name
  from public.order_status s
  where s.id = v_initial_status;

  return jsonb_build_object(
    'id',            v_order_id,
    'status_id',     v_initial_status,
    'status_name',   v_status_name,
    'created_at',    v_created_at,
    'table_id',      p_table_id,
    'restaurant_id', v_restaurant_id,
    'total',         round(v_total)::int,
    'diner_slot',    v_diner_slot,
    'diner_label',   v_diner_label
  );
end;
$$;

ALTER FUNCTION public.create_public_order(bigint, jsonb, text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.create_public_order(bigint, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_public_order(bigint, jsonb, text) TO anon;
GRANT EXECUTE ON FUNCTION public.create_public_order(bigint, jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_public_order(bigint, jsonb, text) TO service_role;

-- 5) RPC: pay_diner_orders
-- Marca como pagados los pedidos activos de un comensal de la mesa.
-- Si después del pago no quedan pedidos activos en la mesa, limpia table_diners
-- y libera al mesero (current_waiter_id = null).
CREATE OR REPLACE FUNCTION public.pay_diner_orders(
  p_table_id   bigint,
  p_diner_slot int
) RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_restaurant_id   bigint;
  v_paid_ids        bigint[];
  v_remaining_count int;
  v_diners_cleared  boolean := false;
  v_table_released  boolean := false;
BEGIN
  IF p_table_id IS NULL OR p_diner_slot IS NULL THEN
    RAISE EXCEPTION 'Parámetros inválidos';
  END IF;

  -- Solo personal del restaurante puede cobrar.
  SELECT restaurant_id INTO v_restaurant_id
  FROM public.tables WHERE id = p_table_id;

  IF v_restaurant_id IS NULL THEN
    RAISE EXCEPTION 'Mesa no encontrada';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE auth_user_id = auth.uid()
      AND restaurant_id = v_restaurant_id
  ) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  WITH updated AS (
    UPDATE public.orders
      SET status_id = 4
    WHERE table_id = p_table_id
      AND diner_slot = p_diner_slot
      AND status_id IN (1, 2, 3)
    RETURNING id
  )
  SELECT COALESCE(array_agg(id), ARRAY[]::bigint[]) INTO v_paid_ids FROM updated;

  -- ¿Quedan pedidos activos en la mesa?
  SELECT COUNT(*) INTO v_remaining_count
  FROM public.orders
  WHERE table_id = p_table_id
    AND status_id IN (1, 2, 3);

  IF v_remaining_count = 0 THEN
    DELETE FROM public.table_diners WHERE table_id = p_table_id;
    v_diners_cleared := true;

    UPDATE public.tables SET current_waiter_id = NULL WHERE id = p_table_id;
    v_table_released := true;
  END IF;

  RETURN jsonb_build_object(
    'paid_ids',       to_jsonb(v_paid_ids),
    'diners_cleared', v_diners_cleared,
    'table_released', v_table_released
  );
END;
$$;

ALTER FUNCTION public.pay_diner_orders(bigint, int) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.pay_diner_orders(bigint, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pay_diner_orders(bigint, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pay_diner_orders(bigint, int) TO service_role;

-- 6) Asegurar que markTableOrdersAsPaid (cobrar mesa entera) también limpie diners.
-- Trigger: cuando una orden pasa a pagada (4), si la mesa ya no tiene activas, borra diners.
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
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS cleanup_diners_on_payment_trg ON public.orders;
CREATE TRIGGER cleanup_diners_on_payment_trg
  AFTER UPDATE OF status_id ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.cleanup_diners_on_payment();

-- 7) RLS en table_diners: nadie escribe directo, solo vía RPCs SECURITY DEFINER.
ALTER TABLE public.table_diners ENABLE ROW LEVEL SECURITY;
-- Sin policies = ningún rol puede leer/escribir directamente. Las RPCs bypassean por SECURITY DEFINER.

GRANT SELECT ON public.table_diners TO authenticated;
-- Policy de lectura: staff del mismo restaurante puede ver los diners activos.
DROP POLICY IF EXISTS table_diners_staff_read ON public.table_diners;
CREATE POLICY table_diners_staff_read ON public.table_diners
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tables t
      JOIN public.users u ON u.restaurant_id = t.restaurant_id
      WHERE t.id = table_diners.table_id
        AND u.auth_user_id = auth.uid()
    )
  );
