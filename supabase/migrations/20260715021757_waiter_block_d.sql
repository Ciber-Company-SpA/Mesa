-- Bloque D (portal mesero). Todo aditivo, con guards por restaurante; no toca
-- el trigger de signup ni los flujos existentes.

-- D3: propina y quién cobró (columnas aditivas en orders)
alter table public.orders add column if not exists tip_amount integer not null default 0;
alter table public.orders add column if not exists paid_by bigint references public.users(id);

-- D2: turnos de caja
create table if not exists public.cash_shifts (
  id             bigint generated always as identity primary key,
  restaurant_id  bigint not null references public.restaurants(id) on delete cascade,
  opened_by      bigint references public.users(id),
  opened_at      timestamptz not null default now(),
  closed_at      timestamptz,
  opening_amount integer not null default 0,
  closing_amount integer,
  notes          text
);
alter table public.cash_shifts enable row level security;
revoke all on table public.cash_shifts from anon, authenticated;
create index if not exists idx_cash_shifts_open on public.cash_shifts(restaurant_id) where closed_at is null;

-- Helper: id del usuario staff actual
create or replace function public._current_staff_id()
returns bigint language sql stable security definer set search_path = public as $$
  select id from public.users where auth_user_id = auth.uid() limit 1;
$$;
revoke all on function public._current_staff_id() from public, anon, authenticated;

-- Abrir turno (staff del restaurante; falla si ya hay uno abierto)
create or replace function public.open_cash_shift(p_opening integer)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_rid bigint; v_id bigint;
begin
  v_rid := public.current_user_restaurant_id();
  if v_rid is null then raise exception 'No autorizado'; end if;
  if exists (select 1 from public.cash_shifts where restaurant_id = v_rid and closed_at is null) then
    raise exception 'Ya hay un turno de caja abierto';
  end if;
  insert into public.cash_shifts (restaurant_id, opened_by, opening_amount)
  values (v_rid, public._current_staff_id(), coalesce(p_opening, 0))
  returning id into v_id;
  return v_id;
end;
$$;

-- Turno actual + resumen de ventas desde su apertura
create or replace function public.get_current_cash_shift()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_rid bigint; v_shift public.cash_shifts; v jsonb;
begin
  v_rid := public.current_user_restaurant_id();
  if v_rid is null then raise exception 'No autorizado'; end if;
  select * into v_shift from public.cash_shifts where restaurant_id = v_rid and closed_at is null order by opened_at desc limit 1;
  if v_shift.id is null then return null; end if;
  select jsonb_build_object(
    'id', v_shift.id,
    'opened_at', v_shift.opened_at,
    'opening_amount', v_shift.opening_amount,
    'sales', (select coalesce(sum(total),0) from public.orders where restaurant_id = v_rid and status_id = 4 and created_at >= v_shift.opened_at),
    'tips', (select coalesce(sum(tip_amount),0) from public.orders where restaurant_id = v_rid and status_id = 4 and created_at >= v_shift.opened_at),
    'orders', (select count(*) from public.orders where restaurant_id = v_rid and status_id = 4 and created_at >= v_shift.opened_at)
  ) into v;
  return v;
end;
$$;

-- Cerrar turno abierto
create or replace function public.close_cash_shift(p_closing integer, p_notes text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_rid bigint; v_id bigint; v_opened timestamptz; v_expected integer;
begin
  v_rid := public.current_user_restaurant_id();
  if v_rid is null then raise exception 'No autorizado'; end if;
  select id, opened_at into v_id, v_opened from public.cash_shifts where restaurant_id = v_rid and closed_at is null order by opened_at desc limit 1;
  if v_id is null then raise exception 'No hay turno abierto'; end if;
  select coalesce(sum(total),0) into v_expected from public.orders where restaurant_id = v_rid and status_id = 4 and created_at >= v_opened;
  update public.cash_shifts set closed_at = now(), closing_amount = p_closing, notes = p_notes where id = v_id;
  return jsonb_build_object('id', v_id, 'expected', v_expected, 'closing', p_closing);
end;
$$;

-- D4: transferir una mesa a otro mesero del mismo restaurante
create or replace function public.reassign_table(p_table_id bigint, p_new_waiter_id bigint)
returns void language plpgsql security definer set search_path = public as $$
declare v_rid bigint; v_table_rid bigint;
begin
  v_rid := public.current_user_restaurant_id();
  if v_rid is null then raise exception 'No autorizado'; end if;
  select restaurant_id into v_table_rid from public.tables where id = p_table_id;
  if v_table_rid is null or v_table_rid <> v_rid then raise exception 'Mesa no encontrada'; end if;
  -- el nuevo responsable debe ser staff del mismo restaurante (o null para liberar)
  if p_new_waiter_id is not null and not exists (
    select 1 from public.users u where u.id = p_new_waiter_id and u.restaurant_id = v_rid
  ) then
    raise exception 'Mesero inválido';
  end if;
  update public.tables set current_waiter_id = p_new_waiter_id where id = p_table_id;
end;
$$;

-- D1: fijar el rol de un miembro del staff (mesero/cocina/caja). No admin.
create or replace function public.admin_set_staff_role(p_user_id bigint, p_role_id integer)
returns void language plpgsql security definer set search_path = public as $$
declare v_rid bigint;
begin
  if not public.current_user_is_admin() then raise exception 'No autorizado'; end if;
  if p_role_id not in (1, 3, 4) then raise exception 'Rol inválido'; end if;
  v_rid := public.current_user_restaurant_id();
  update public.users set role_id = p_role_id
    where id = p_user_id and restaurant_id = v_rid and role_id in (1, 3, 4);
end;
$$;

do $$
declare fn text;
begin
  for fn in
    select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in
      ('open_cash_shift','get_current_cash_shift','close_cash_shift','reassign_table','admin_set_staff_role')
  loop
    execute format('revoke all on function %s from public, anon', fn);
    execute format('grant execute on function %s to authenticated, service_role', fn);
  end loop;
end $$;
