-- C3: API de inventario. Autenticación por API key (patrón secreto, como el
-- QR): las funciones api_* son SECURITY DEFINER, validan el hash del token y
-- operan acotadas al restaurante dueño de la key. Sin service-role en el
-- código. Hash SHA-256 nativo de Postgres (sha256(), core).

create table if not exists public.api_keys (
  id           bigint generated always as identity primary key,
  restaurant_id bigint not null references public.restaurants(id) on delete cascade,
  name         text,
  key_prefix   text not null,
  key_hash     text not null unique,
  created_at   timestamptz not null default now(),
  last_used_at timestamptz,
  revoked      boolean not null default false
);
alter table public.api_keys enable row level security;
revoke all on table public.api_keys from anon, authenticated;

-- Crear API key (admin): genera el token, guarda solo su hash, lo devuelve UNA vez
create or replace function public.create_api_key(p_name text)
returns text
language plpgsql security definer set search_path = public
as $$
declare v_rid bigint; v_token text;
begin
  if not public.current_user_is_admin() then raise exception 'No autorizado'; end if;
  v_rid := public.current_user_restaurant_id();
  v_token := 'mesa_' || replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  insert into public.api_keys (restaurant_id, name, key_prefix, key_hash)
  values (v_rid, p_name, left(v_token, 13), encode(sha256(convert_to(v_token, 'UTF8')), 'hex'));
  return v_token;
end;
$$;

create or replace function public.list_api_keys()
returns table(id bigint, name text, key_prefix text, created_at timestamptz, last_used_at timestamptz, revoked boolean)
language plpgsql stable security definer set search_path = public
as $$
declare v_rid bigint;
begin
  if not public.current_user_is_admin() then raise exception 'No autorizado'; end if;
  v_rid := public.current_user_restaurant_id();
  return query select k.id, k.name, k.key_prefix, k.created_at, k.last_used_at, k.revoked
    from public.api_keys k where k.restaurant_id = v_rid order by k.created_at desc;
end;
$$;

create or replace function public.revoke_api_key(p_id bigint)
returns void
language plpgsql security definer set search_path = public
as $$
declare v_rid bigint;
begin
  if not public.current_user_is_admin() then raise exception 'No autorizado'; end if;
  v_rid := public.current_user_restaurant_id();
  update public.api_keys set revoked = true where id = p_id and restaurant_id = v_rid;
end;
$$;

-- Resuelve el token → restaurant_id (o excepción). Actualiza last_used.
create or replace function public._api_key_restaurant(p_token text)
returns bigint
language plpgsql security definer set search_path = public
as $$
declare v_rid bigint; v_hash text;
begin
  v_hash := encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex');
  select restaurant_id into v_rid from public.api_keys where key_hash = v_hash and not revoked;
  if v_rid is null then raise exception 'API key inválida'; end if;
  update public.api_keys set last_used_at = now() where key_hash = v_hash;
  return v_rid;
end;
$$;

-- Endpoint de datos: listar inventario del restaurante dueño de la key
create or replace function public.api_inventory_list(p_token text)
returns table(ingredient_id bigint, name text, unit text, stock_actual numeric, stock_minimo numeric, precio numeric)
language plpgsql security definer set search_path = public
as $$
declare v_rid bigint;
begin
  v_rid := public._api_key_restaurant(p_token);
  return query
  select i.id, i.name, i.unit, i.stock_actual::numeric, i.stock_minimo::numeric, i.precio::numeric
  from public.ingredients i where i.restaurant_id = v_rid order by i.name;
end;
$$;

-- Endpoint de escritura: fijar el stock de un insumo del restaurante de la key
create or replace function public.api_inventory_set_stock(p_token text, p_ingredient_id bigint, p_stock numeric)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare v_rid bigint; v_ok boolean;
begin
  v_rid := public._api_key_restaurant(p_token);
  update public.ingredients set stock_actual = p_stock
    where id = p_ingredient_id and restaurant_id = v_rid;
  get diagnostics v_ok = row_count;
  if not v_ok then raise exception 'Insumo no encontrado'; end if;
  return jsonb_build_object('ingredient_id', p_ingredient_id, 'stock_actual', p_stock);
end;
$$;

-- Grants: gestión solo authenticated; endpoints de datos también anon (los
-- llama el route handler con el cliente anon, la seguridad la da el token).
revoke all on function public.create_api_key(text) from public, anon;
revoke all on function public.list_api_keys() from public, anon;
revoke all on function public.revoke_api_key(bigint) from public, anon;
grant execute on function public.create_api_key(text) to authenticated, service_role;
grant execute on function public.list_api_keys() to authenticated, service_role;
grant execute on function public.revoke_api_key(bigint) to authenticated, service_role;
revoke all on function public._api_key_restaurant(text) from public, anon, authenticated;
revoke all on function public.api_inventory_list(text) from public;
revoke all on function public.api_inventory_set_stock(text, bigint, numeric) from public;
grant execute on function public.api_inventory_list(text) to anon, authenticated, service_role;
grant execute on function public.api_inventory_set_stock(text, bigint, numeric) to anon, authenticated, service_role;
