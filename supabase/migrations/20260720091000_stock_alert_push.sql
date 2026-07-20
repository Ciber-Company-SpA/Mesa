-- ============================================================================
-- PUSH DE ALERTA DE STOCK AL ADMIN (B1)
--
-- Dispara una notificación push cuando un insumo CRUZA a un nivel de alerta:
--   ok        -> bajo        (0 < stock <= minimo)
--   ok        -> sin_stock   (stock <= 0)
--   bajo      -> sin_stock   (empeora)
-- NO dispara si el nivel no cambia (evita spam en cada venta) ni al reponer
-- (sin_stock/bajo -> ok). El destinatario lo resuelve la edge function
-- (admins del restaurante); acá solo pasamos el ingredient_id.
--
-- Patrón idéntico a notify_new_order_push: lee supabase_url + service_role_key
-- de Supabase Vault y hace net.http_post a la edge function. Es INOFENSIVO
-- mientras no haya tokens de admin registrados (la función responde skip 200)
-- y mientras los secretos del vault no estén cargados (RAISE WARNING, sin push).
-- Nunca rompe la venta: EXCEPTION WHEN OTHERS -> WARNING + RETURN NEW.
-- ============================================================================

create or replace function public.notify_stock_alert_push()
  returns trigger
  language plpgsql
  security definer
  set search_path = public, vault
as $$
declare
  v_url          text;
  v_service_role text;
  v_old_level    text;
  v_new_level    text;
begin
  -- Nivel antes y después del movimiento de stock.
  v_old_level := case
    when old.stock_actual <= 0             then 'sin_stock'
    when old.stock_actual <= old.stock_minimo then 'bajo'
    else 'ok'
  end;
  v_new_level := case
    when new.stock_actual <= 0             then 'sin_stock'
    when new.stock_actual <= new.stock_minimo then 'bajo'
    else 'ok'
  end;

  -- Solo notificar cuando cruza HACIA un nivel de alerta distinto al anterior.
  if v_new_level = 'ok' or v_new_level = v_old_level then
    return new;
  end if;

  select decrypted_secret into v_url
  from vault.decrypted_secrets
  where name = 'supabase_url';

  select decrypted_secret into v_service_role
  from vault.decrypted_secrets
  where name = 'service_role_key';

  if v_url is null or v_service_role is null then
    raise warning 'notify_stock_alert_push: secretos no configurados en vault';
    return new;
  end if;

  perform net.http_post(
    url     := v_url || '/functions/v1/send-stock-alert-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_service_role
    ),
    body    := jsonb_build_object('ingredient_id', new.id)
  );

  return new;
exception when others then
  raise warning 'notify_stock_alert_push: %', sqlerrm;
  return new;
end;
$$;

alter function public.notify_stock_alert_push() owner to postgres;

drop trigger if exists trg_stock_alert_push on public.ingredients;
create trigger trg_stock_alert_push
  after update of stock_actual on public.ingredients
  for each row
  when (old.stock_actual is distinct from new.stock_actual)
  execute function public.notify_stock_alert_push();
