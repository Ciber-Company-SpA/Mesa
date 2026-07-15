-- platform_provision_tables: crea N mesas numeradas con su código QR para un
-- restaurante. Solo un operador de plataforma puede invocarla (guard
-- is_platform_owner). La numeración continúa desde la mayor existente. La usa
-- la Edge Function provision-restaurant durante el alta de un cliente.
create or replace function public.platform_provision_tables(p_restaurant_id bigint, p_count integer)
returns integer language plpgsql security definer set search_path = public
as $$
declare
  i int;
  v_qr_id bigint;
  v_token text;
  v_start int;
  v_created int := 0;
begin
  if not public.is_platform_owner() then
    raise exception 'No autorizado';
  end if;
  if p_count is null or p_count < 1 or p_count > 200 then
    raise exception 'Cantidad de mesas inválida (1-200)';
  end if;
  if not exists (select 1 from public.restaurants where id = p_restaurant_id) then
    raise exception 'Restaurante no encontrado';
  end if;

  select coalesce(max(table_number), 0) into v_start
  from public.tables where restaurant_id = p_restaurant_id;

  for i in 1..p_count loop
    v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
    insert into public.table_qr_codes (qr_code, qr_active) values (v_token, true) returning id into v_qr_id;
    insert into public.tables (table_number, restaurant_id, qr_code_id) values (v_start + i, p_restaurant_id, v_qr_id);
    v_created := v_created + 1;
  end loop;

  perform public._platform_audit('provision_tables', 'restaurant', p_restaurant_id::text,
    jsonb_build_object('count', v_created, 'from_number', v_start));
  return v_created;
end;
$$;

revoke all on function public.platform_provision_tables(bigint, integer) from public, anon;
grant execute on function public.platform_provision_tables(bigint, integer) to authenticated, service_role;
