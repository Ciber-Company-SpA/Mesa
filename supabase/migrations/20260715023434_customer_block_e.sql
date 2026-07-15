-- Bloque E (comensal). Aditivo sobre el flujo QR público, con el mismo
-- patrón de secreto (token QR) y rate limit. No rompe request_bill_qr (queda
-- para compatibilidad); el frontend pasa a usar request_service_call_qr.

-- E2/E3: tipo de llamado ampliado + propina sugerida del comensal
alter table public.service_calls drop constraint if exists service_calls_call_type_check;
alter table public.service_calls add constraint service_calls_call_type_check
  check (call_type in ('bill', 'waiter'));
alter table public.service_calls add column if not exists tip integer not null default 0;

-- RPC genérica de llamado de servicio (cuenta o mesero) + propina sugerida
create or replace function public.request_service_call_qr(
  p_qr_token text,
  p_diner_token text default null,
  p_call_type text default 'bill',
  p_tip integer default 0
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_table_id bigint; v_restaurant_id bigint; v_call_id bigint;
  v_diner_label text; v_diner_payload jsonb; v_tip integer;
begin
  if p_call_type not in ('bill', 'waiter') then
    raise exception 'Tipo de llamado inválido';
  end if;

  select table_id, restaurant_id into v_table_id, v_restaurant_id
  from public.resolve_qr_token(p_qr_token);
  if v_table_id is null then
    raise exception 'Mesa no encontrada o sin QR activo';
  end if;

  -- Rate limit por tipo: máx 5 por 60s por mesa.
  perform public.rate_limit_check('call:' || p_call_type || ':' || v_table_id, 5, 60);

  if p_diner_token is not null and length(p_diner_token) >= 8 then
    begin
      v_diner_payload := public.claim_diner_slot_qr(p_qr_token, p_diner_token);
      v_diner_label   := v_diner_payload->>'label';
    exception when others then
      v_diner_label := null;
    end;
  end if;

  v_tip := case when p_call_type = 'bill' and coalesce(p_tip, 0) > 0 then p_tip else 0 end;

  insert into public.service_calls (table_id, restaurant_id, call_type, diner_label, tip)
  values (v_table_id, v_restaurant_id, p_call_type, v_diner_label, v_tip)
  on conflict (table_id, call_type) where status = 'pending'
  do nothing
  returning id into v_call_id;

  if v_call_id is null then
    return jsonb_build_object('status', 'already_pending');
  end if;
  return jsonb_build_object('status', 'created', 'id', v_call_id);
end;
$$;

revoke all on function public.request_service_call_qr(text, text, text, integer) from public;
grant execute on function public.request_service_call_qr(text, text, text, integer) to anon, authenticated, service_role;

-- E4: incluir diner_slot / diner_label en los pedidos de la mesa para que el
-- comensal pueda ver el desglose por comensal (aditivo).
create or replace function public.get_orders_for_table_qr(p_qr_token text)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_table_id bigint;
  v_result   jsonb;
begin
  select table_id into v_table_id from public.resolve_qr_token(p_qr_token);
  if v_table_id is null then
    raise exception 'Mesa no encontrada o sin QR activo';
  end if;

  select coalesce(jsonb_agg(t order by t.created_at desc), '[]'::jsonb)
  into v_result
  from (
    select
      o.id,
      o.total,
      o.status_id,
      o.created_at,
      o.ready_at,
      o.diner_slot,
      o.diner_label,
      jsonb_build_object('status_name', s.status_name) as order_status,
      (
        select coalesce(jsonb_agg(jsonb_build_object(
          'id', oi.id,
          'product_name', oi.product_name,
          'variant_name', oi.variant_name,
          'product_price', oi.product_price,
          'product_quantity', oi.product_quantity,
          'notes', oi.notes
        )), '[]'::jsonb)
        from public.order_items oi
        where oi.order_id = o.id
      ) as order_items
    from public.orders o
    left join public.order_status s on s.id = o.status_id
    where o.table_id = v_table_id
      and o.status_id in (1, 2, 3)
  ) t;

  return v_result;
end;
$$;

revoke all on function public.get_orders_for_table_qr(text) from public;
grant execute on function public.get_orders_for_table_qr(text) to anon, authenticated, service_role;
