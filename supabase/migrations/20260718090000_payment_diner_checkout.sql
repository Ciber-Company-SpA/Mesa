-- Cobro en línea del comensal — circuito completo.
--
--  · qr_payment_available: el menú QR pregunta si el restaurante tiene
--    pasarela conectada. Devuelve el nombre del proveedor o null (nada más:
--    el comensal necesita saberlo para, p. ej., pedir email cuando es Flow).
--  · payment_gateway_context: las edge functions (service_role) obtienen el
--    proveedor + credenciales DESCIFRADAS desde Vault. El esquema vault no
--    está expuesto por la API REST, por eso esta RPC. Solo service_role.
--  · payment_apply_gateway_result: única puerta por la que el retorno y el
--    webhook asientan el resultado de la pasarela. Actualiza payments y, en
--    la PRIMERA transición a pagado, asienta los pedidos espejando
--    pay_diner_orders (status_id 4 + payment_id, limpieza de table_diners y
--    liberación del mesero si no quedan pedidos activos). Un pago 'paid'
--    nunca se degrada (solo puede pasar a refunded).

-- Búsquedas del webhook por token/id del proveedor.
create index if not exists idx_payments_provider_ref
  on public.payments(provider, provider_payment_id)
  where provider_payment_id is not null;

-- 1) ¿La mesa puede pagar en línea? → proveedor conectado o null.
create or replace function public.qr_payment_available(p_qr_token text)
returns text
language sql
stable security definer
set search_path to 'public'
as $$
  select a.provider
  from public.resolve_qr_token(p_qr_token) t
  join public.restaurant_payment_account a on a.restaurant_id = t.restaurant_id
  where a.status = 'connected'
  limit 1;
$$;

revoke all on function public.qr_payment_available(text) from public;
grant execute on function public.qr_payment_available(text) to anon, authenticated, service_role;

-- 2) Contexto de pasarela para las edge functions (credenciales descifradas).
create or replace function public.payment_gateway_context(p_restaurant_id bigint)
returns jsonb
language plpgsql
stable security definer
set search_path to 'public'
as $$
declare v jsonb;
begin
  select jsonb_build_object(
    'provider', a.provider,
    'status', a.status,
    'credentials', case
      when a.credentials_secret_id is not null then
        (select s.decrypted_secret from vault.decrypted_secrets s where s.id = a.credentials_secret_id)
      else null
    end
  ) into v
  from public.restaurant_payment_account a
  where a.restaurant_id = p_restaurant_id;

  return v; -- null si el restaurante no tiene cuenta configurada
end;
$$;

revoke all on function public.payment_gateway_context(bigint) from public, anon, authenticated;
grant execute on function public.payment_gateway_context(bigint) to service_role;

-- 3) Asentar el resultado que informó la pasarela.
create or replace function public.payment_apply_gateway_result(
  p_payment_id bigint,
  p_status text,
  p_provider_payment_id text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_pay record;
  v_status text;
  v_settled boolean := false;
  v_remaining int;
begin
  -- Estados del dominio de adaptadores → estados del check de payments.
  v_status := case p_status
    when 'paid' then 'paid'
    when 'pending' then 'pending'
    when 'authorized' then 'authorized'
    when 'failed' then 'failed'
    when 'cancelled' then 'failed'
    when 'refunded' then 'refunded'
    else null
  end;
  if v_status is null then
    raise exception 'Estado % no soportado', p_status;
  end if;

  select * into v_pay from public.payments where id = p_payment_id for update;
  if not found then
    raise exception 'Pago no encontrado';
  end if;

  -- Un pago pagado no se degrada.
  if v_pay.status = 'paid' and v_status not in ('paid', 'refunded') then
    return jsonb_build_object('status', v_pay.status, 'settled', false, 'ignored', true);
  end if;

  update public.payments set
    status = v_status,
    provider_payment_id = coalesce(nullif(trim(coalesce(p_provider_payment_id, '')), ''), provider_payment_id),
    paid_at = case when v_status = 'paid' and paid_at is null then now() else paid_at end
  where id = p_payment_id;

  -- Asentar pedidos SOLO en la primera transición a pagado.
  if v_status = 'paid' and v_pay.status is distinct from 'paid' then
    update public.orders
      set status_id = 4, payment_id = p_payment_id
    where id = any(v_pay.order_ids)
      and status_id in (1, 2, 3);

    if v_pay.table_id is not null then
      select count(*) into v_remaining
      from public.orders
      where table_id = v_pay.table_id and status_id in (1, 2, 3);

      if v_remaining = 0 then
        delete from public.table_diners where table_id = v_pay.table_id;
        update public.tables set current_waiter_id = null where id = v_pay.table_id;
      end if;
    end if;
    v_settled := true;
  end if;

  return jsonb_build_object('status', v_status, 'settled', v_settled);
end;
$$;

revoke all on function public.payment_apply_gateway_result(bigint, text, text) from public, anon, authenticated;
grant execute on function public.payment_apply_gateway_result(bigint, text, text) to service_role;
