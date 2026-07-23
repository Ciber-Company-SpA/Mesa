-- COBRO POR EL STAFF (admin + mesero) con registro de método y boleta.
--
--  · payments.method gana 'card' (tarjeta presencial, POS físico): hasta ahora
--    el cobro del mesero era un UPDATE status_id=4 sin registrar nada.
--  · staff_register_payment: única puerta del cobro presencial. Crea la fila
--    en payments (cash/card, status 'paid'), asienta los pedidos (status 4 +
--    payment_id + paid_by), registra la propina con la convención de reportes
--    (una vez, en la última orden) y libera la mesa espejando
--    payment_apply_gateway_result.
--  · staff_gateway_provider: la UI de cobro pregunta si hay pasarela conectada
--    (para ofrecer "cobrar con QR de pago").
--  · get_my_payment / list_my_payments_today / get_payment_receipt: lectura
--    para el staff (polling del cobro por pasarela, panel de pagos del día con
--    su boleta, y la boleta imprimible).
--  · dte_record_document pasa de admin-only a staff (mesero cobra → emite
--    boleta). Cocina (chef) queda fuera.
--  · Caja por método: get_current_cash_shift/close_cash_shift desglosan
--    efectivo / tarjeta / online. El efectivo esperado = apertura + cobros
--    cash (payments) + cobros legacy (orders pagadas sin payment_id, el
--    camino viejo). Tarjeta y online no son plata del cajón.

-- 1) Método 'card' (tarjeta presencial).
alter table public.payments drop constraint if exists payments_method_check;
alter table public.payments
  add constraint payments_method_check check (method in ('online', 'cash', 'card'));

-- Helper interno: staff que puede cobrar (mesero o admin del restaurante).
create or replace function public._charge_current_staff()
returns table(user_id bigint, restaurant_id bigint)
language sql
stable security definer
set search_path to 'public'
as $$
  select u.id, u.restaurant_id
  from public.users u
  where u.auth_user_id = auth.uid() and u.role_id in (1, 2)
  limit 1;
$$;
revoke all on function public._charge_current_staff() from public, anon, authenticated;

-- 2) Cobro presencial (efectivo o tarjeta física).
create or replace function public.staff_register_payment(
  p_table_id bigint,
  p_method text,
  p_tip integer default 0,
  p_diner_slot integer default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  s record;
  v_table record;
  v_ids bigint[];
  v_amount integer;
  v_max_id bigint;
  v_tip integer;
  v_pid bigint;
  v_remaining int;
  v_released boolean := false;
begin
  select * into s from public._charge_current_staff();
  if s.user_id is null then raise exception 'No autorizado'; end if;
  if p_method not in ('cash', 'card') then raise exception 'Método de pago inválido'; end if;

  v_tip := greatest(0, coalesce(p_tip, 0));
  if v_tip > 1000000 then raise exception 'Propina fuera de rango'; end if;

  select id, restaurant_id, table_number into v_table
  from public.tables where id = p_table_id;
  if v_table.id is null or v_table.restaurant_id <> s.restaurant_id then
    raise exception 'Mesa no encontrada';
  end if;

  -- Pedidos activos (de la mesa o de un comensal), con lock anti doble-cobro:
  -- dos cobros simultáneos de la misma cuenta serializan aquí y el segundo
  -- se encuentra sin pedidos activos.
  select array_agg(o.id), coalesce(sum(o.total), 0), max(o.id)
    into v_ids, v_amount, v_max_id
  from (
    select id, total from public.orders
    where table_id = p_table_id
      and status_id in (1, 2, 3)
      and (p_diner_slot is null or diner_slot = p_diner_slot)
    for update
  ) o;

  if v_ids is null then raise exception 'La mesa no tiene pedidos activos'; end if;
  if v_amount <= 0 then raise exception 'La cuenta está en $0'; end if;

  insert into public.payments
    (restaurant_id, table_id, order_ids, provider, method, amount, tip, currency, status, paid_at)
  values
    (s.restaurant_id, p_table_id, v_ids, null, p_method, v_amount, v_tip, 'CLP', 'paid', now())
  returning id into v_pid;

  update public.orders
    set status_id = 4, payment_id = v_pid, paid_by = s.user_id
  where id = any(v_ids);

  -- Propina: una sola vez, en la última orden (convención de los reportes).
  if v_tip > 0 then
    update public.orders set tip_amount = v_tip where id = v_max_id;
  end if;

  select count(*) into v_remaining
  from public.orders where table_id = p_table_id and status_id in (1, 2, 3);
  if v_remaining = 0 then
    delete from public.table_diners where table_id = p_table_id;
    update public.tables set current_waiter_id = null where id = p_table_id;
    v_released := true;
  end if;

  return jsonb_build_object(
    'payment_id', v_pid,
    'amount', v_amount,
    'tip', v_tip,
    'paid_ids', to_jsonb(v_ids),
    'table_released', v_released,
    'table_number', v_table.table_number
  );
end;
$$;

-- 3) ¿El restaurante del staff tiene pasarela conectada? → proveedor o null.
create or replace function public.staff_gateway_provider()
returns text
language sql
stable security definer
set search_path to 'public'
as $$
  select a.provider
  from public.restaurant_payment_account a
  join public.users u on u.restaurant_id = a.restaurant_id
  where u.auth_user_id = auth.uid() and a.status = 'connected'
  limit 1;
$$;

-- 4) Un pago del restaurante (polling del cobro por pasarela + boleta).
create or replace function public.get_my_payment(p_payment_id bigint)
returns jsonb
language plpgsql
stable security definer
set search_path to 'public'
as $$
declare s record; v jsonb;
begin
  select * into s from public._support_current_staff();
  if s.user_id is null then raise exception 'No autorizado'; end if;

  select jsonb_build_object(
    'id', p.id,
    'status', p.status,
    'method', p.method,
    'provider', p.provider,
    'amount', p.amount,
    'tip', p.tip,
    'table_number', t.table_number,
    'paid_at', p.paid_at,
    'boleta', (
      select jsonb_build_object('id', d.id, 'folio', d.folio, 'sii_status', d.sii_status)
      from public.tax_documents d
      where d.payment_id = p.id and d.doc_type in (39, 41) and not coalesce(d.voided, false)
      order by d.id desc limit 1
    )
  ) into v
  from public.payments p
  left join public.tables t on t.id = p.table_id
  where p.id = p_payment_id and p.restaurant_id = s.restaurant_id;

  return v; -- null si no existe o es de otro restaurante
end;
$$;

-- 5) Todos los pagos de HOY (hora de Chile) con método y boleta.
create or replace function public.list_my_payments_today()
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
    'method', p.method,
    'provider', p.provider,
    'created_at', p.created_at,
    'paid_at', p.paid_at,
    'boleta', (
      select jsonb_build_object('id', d.id, 'folio', d.folio, 'sii_status', d.sii_status)
      from public.tax_documents d
      where d.payment_id = p.id and d.doc_type in (39, 41) and not coalesce(d.voided, false)
      order by d.id desc limit 1
    )
  ) order by p.created_at desc), '[]'::jsonb) into v
  from public.payments p
  left join public.tables t on t.id = p.table_id
  where p.restaurant_id = s.restaurant_id
    and p.created_at >= ((now() at time zone 'America/Santiago')::date)::timestamp at time zone 'America/Santiago';

  return v;
end;
$$;

-- 6) Boleta de un pago + datos del emisor (vista imprimible del staff).
create or replace function public.get_payment_receipt(p_payment_id bigint)
returns jsonb
language plpgsql
stable security definer
set search_path to 'public'
as $$
declare s record; v jsonb;
begin
  select * into s from public._support_current_staff();
  if s.user_id is null then raise exception 'No autorizado'; end if;

  select jsonb_build_object(
    'doc', to_jsonb(d),
    'emisor', (
      select jsonb_build_object(
        'rut', tp.rut,
        'razon_social', tp.razon_social,
        'giro', tp.giro,
        'direccion', tp.direccion,
        'comuna', tp.comuna,
        'actividad_economica', tp.actividad_economica,
        'logo_url', tp.logo_url
      )
      from public.restaurant_tax_profile tp
      where tp.restaurant_id = s.restaurant_id
    )
  ) into v
  from public.tax_documents d
  join public.payments p on p.id = d.payment_id
  where d.payment_id = p_payment_id
    and p.restaurant_id = s.restaurant_id
    and d.doc_type in (39, 41)
    and not coalesce(d.voided, false)
  order by d.id desc limit 1;

  return v; -- null si el pago no tiene boleta
end;
$$;

do $$
declare fn text;
begin
  for fn in
    select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in
      ('staff_register_payment', 'staff_gateway_provider', 'get_my_payment',
       'list_my_payments_today', 'get_payment_receipt')
  loop
    execute format('revoke all on function %s from public, anon', fn);
    execute format('grant execute on function %s to authenticated, service_role', fn);
  end loop;
end $$;

-- 7) dte_record_document: de admin-only a staff que cobra (mesero o admin).
--    El resto de la función queda idéntico (misma firma → replace directo).
create or replace function public.dte_record_document(
  p_doc_type       integer,
  p_net            integer,
  p_iva            integer,
  p_total          integer,
  p_receptor_rut   text,
  p_receptor_razon text,
  p_receptor_giro  text,
  p_receptor_dir   text,
  p_sii_status     text,
  p_folio          bigint,
  p_track_id       text,
  p_pdf_url        text,
  p_xml_url        text,
  p_payment_id     bigint
)
returns bigint
language plpgsql
security definer
set search_path to 'public'
as $$
declare s record; v_id bigint;
begin
  select * into s from public._charge_current_staff();
  if s.user_id is null then raise exception 'No autorizado'; end if;
  if s.restaurant_id is null then raise exception 'Sin restaurante asociado'; end if;
  if p_doc_type not in (33, 34, 39, 41, 56, 61) then raise exception 'Tipo de documento inválido'; end if;

  insert into public.tax_documents
    (payment_id, restaurant_id, doc_type, folio, net, iva, total,
     receptor_rut, receptor_razon, receptor_giro, receptor_dir,
     sii_status, track_id, pdf_url, xml_url, emitted_at)
  values (
    p_payment_id, s.restaurant_id, p_doc_type, p_folio, p_net, p_iva, p_total,
    nullif(trim(coalesce(p_receptor_rut, '')), ''),
    nullif(trim(coalesce(p_receptor_razon, '')), ''),
    nullif(trim(coalesce(p_receptor_giro, '')), ''),
    nullif(trim(coalesce(p_receptor_dir, '')), ''),
    coalesce(nullif(trim(coalesce(p_sii_status, '')), ''), 'pending'),
    p_track_id, p_pdf_url, p_xml_url,
    case when p_sii_status = 'accepted' then now() else null end
  )
  returning id into v_id;

  return v_id;
end;
$$;

-- 8) Caja por método. El resumen y el cierre desglosan efectivo / tarjeta /
--    online. Legacy: órdenes pagadas SIN payment_id (camino viejo, sin fila
--    en payments) cuentan como efectivo para no perderlas del arqueo.
create or replace function public.get_current_cash_shift()
returns jsonb
language plpgsql
stable security definer
set search_path to 'public'
as $$
declare
  v_rid bigint;
  v_shift public.cash_shifts;
  v_cash integer; v_card integer; v_online integer; v_legacy integer;
begin
  v_rid := public.current_user_restaurant_id();
  if v_rid is null then raise exception 'No autorizado'; end if;
  select * into v_shift from public.cash_shifts
  where restaurant_id = v_rid and closed_at is null
  order by opened_at desc limit 1;
  if v_shift.id is null then return null; end if;

  select
    coalesce(sum(amount + tip) filter (where method = 'cash'), 0),
    coalesce(sum(amount + tip) filter (where method = 'card'), 0),
    coalesce(sum(amount + tip) filter (where method = 'online'), 0)
    into v_cash, v_card, v_online
  from public.payments
  where restaurant_id = v_rid and status = 'paid' and paid_at >= v_shift.opened_at;

  select coalesce(sum(total + tip_amount), 0) into v_legacy
  from public.orders
  where restaurant_id = v_rid and status_id = 4 and payment_id is null
    and created_at >= v_shift.opened_at;

  return jsonb_build_object(
    'id', v_shift.id,
    'opened_at', v_shift.opened_at,
    'opening_amount', v_shift.opening_amount,
    'sales', (select coalesce(sum(total), 0) from public.orders where restaurant_id = v_rid and status_id = 4 and created_at >= v_shift.opened_at),
    'tips', (select coalesce(sum(tip_amount), 0) from public.orders where restaurant_id = v_rid and status_id = 4 and created_at >= v_shift.opened_at),
    'orders', (select count(*) from public.orders where restaurant_id = v_rid and status_id = 4 and created_at >= v_shift.opened_at),
    'sales_cash', v_cash + v_legacy,
    'sales_card', v_card,
    'sales_online', v_online,
    'expected_cash', v_shift.opening_amount + v_cash + v_legacy
  );
end;
$$;

create or replace function public.close_cash_shift(p_closing integer, p_notes text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_rid bigint; v_id bigint; v_opened timestamptz; v_opening integer;
  v_cash integer; v_card integer; v_online integer; v_legacy integer;
begin
  v_rid := public.current_user_restaurant_id();
  if v_rid is null then raise exception 'No autorizado'; end if;
  select id, opened_at, opening_amount into v_id, v_opened, v_opening
  from public.cash_shifts
  where restaurant_id = v_rid and closed_at is null
  order by opened_at desc limit 1;
  if v_id is null then raise exception 'No hay turno abierto'; end if;

  select
    coalesce(sum(amount + tip) filter (where method = 'cash'), 0),
    coalesce(sum(amount + tip) filter (where method = 'card'), 0),
    coalesce(sum(amount + tip) filter (where method = 'online'), 0)
    into v_cash, v_card, v_online
  from public.payments
  where restaurant_id = v_rid and status = 'paid' and paid_at >= v_opened;

  select coalesce(sum(total + tip_amount), 0) into v_legacy
  from public.orders
  where restaurant_id = v_rid and status_id = 4 and payment_id is null
    and created_at >= v_opened;

  update public.cash_shifts
    set closed_at = now(), closing_amount = p_closing, notes = p_notes
  where id = v_id;

  -- expected = efectivo que debería haber en el cajón (apertura + cobros cash).
  return jsonb_build_object(
    'id', v_id,
    'expected', v_opening + v_cash + v_legacy,
    'closing', p_closing,
    'cash_sales', v_cash + v_legacy,
    'card_sales', v_card,
    'online_sales', v_online
  );
end;
$$;
