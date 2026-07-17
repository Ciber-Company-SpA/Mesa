-- Red de seguridad de pagos en línea + visibilidad para el staff.
--
--  · pg_cron (cada 10 min) llama a la edge function payment-reconcile, que
--    re-consulta a la pasarela los pagos online colgados (pending viejos o
--    candados 'authorized' huérfanos) y asienta el resultado real. Cubre el
--    caso "el comensal pagó y cerró el navegador" en Transbank (sin webhook)
--    y es respaldo para Flow/MP.
--  · list_my_online_payments: el staff (caja) ve los pagos en línea de HOY
--    de su restaurante. Ese dinero va a la cuenta de la pasarela del
--    restaurante, NO al efectivo de caja — por eso va aparte del turno.

create extension if not exists pg_cron;

-- 1) Pagos en línea de hoy (hora de Chile) del restaurante del staff.
create or replace function public.list_my_online_payments()
returns jsonb
language plpgsql
stable security definer
set search_path to 'public'
as $$
declare s record; v jsonb;
begin
  select * into s from public._support_current_staff();
  if s.user_id is null then raise exception 'No autorizado'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id,
    'table_number', t.table_number,
    'amount', p.amount,
    'tip', p.tip,
    'status', p.status,
    'provider', p.provider,
    'created_at', p.created_at,
    'paid_at', p.paid_at
  ) order by p.created_at desc), '[]'::jsonb) into v
  from public.payments p
  left join public.tables t on t.id = p.table_id
  where p.restaurant_id = s.restaurant_id
    and p.method = 'online'
    and p.created_at >= ((now() at time zone 'America/Santiago')::date)::timestamp at time zone 'America/Santiago';

  return v;
end;
$$;

revoke all on function public.list_my_online_payments() from public, anon;
grant execute on function public.list_my_online_payments() to authenticated, service_role;

-- 2) Job de reconciliación cada 10 minutos (idempotente: re-agenda si existe).
do $$
begin
  if exists (select 1 from cron.job where jobname = 'payment-reconcile') then
    perform cron.unschedule('payment-reconcile');
  end if;
  perform cron.schedule(
    'payment-reconcile',
    '*/10 * * * *',
    $cmd$
    select net.http_post(
      url := 'https://khdrxwufrnpjyzzspviu.supabase.co/functions/v1/payment-reconcile',
      headers := '{"content-type": "application/json"}'::jsonb,
      body := '{}'::jsonb,
      timeout_milliseconds := 30000
    );
    $cmd$
  );
end $$;
