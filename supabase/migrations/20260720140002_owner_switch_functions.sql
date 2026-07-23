-- Rescatada del historial remoto (aplicada vía MCP el 20-jul como 20260720080345).
-- Funciones del cimiento "1 usuario → N restaurantes" que faltaban en prod
-- (la columna owner_user_id ya existía; las funciones no).

create or replace function public.list_my_restaurants()
  returns table (id bigint, restaurant_name text, restaurant_logo text, menu_template text, is_active boolean)
  language sql stable security definer set search_path = public
as $$
  with me as (
    select u.id as user_id, u.restaurant_id as active_id
    from public.users u where u.auth_user_id = auth.uid() limit 1
  )
  select r.id, r.restaurant_name, r.restaurant_logo, r.menu_template, (r.id = me.active_id) as is_active
  from public.restaurants r, me
  where r.owner_user_id = me.user_id or r.id = me.active_id
  order by r.restaurant_name asc;
$$;
alter function public.list_my_restaurants() owner to postgres;
revoke all on function public.list_my_restaurants() from public, anon;
grant execute on function public.list_my_restaurants() to authenticated, service_role;

create or replace function public.set_active_restaurant(p_restaurant_id bigint)
  returns void language plpgsql security definer set search_path = public
as $$
declare v_user_id bigint; v_owns boolean;
begin
  select id into v_user_id from public.users where auth_user_id = auth.uid();
  if v_user_id is null then raise exception 'No autorizado'; end if;
  select exists (select 1 from public.restaurants where id = p_restaurant_id and owner_user_id = v_user_id) into v_owns;
  if not v_owns then raise exception 'No sos dueño de ese restaurante'; end if;
  update public.users set restaurant_id = p_restaurant_id where id = v_user_id;
end;
$$;
alter function public.set_active_restaurant(bigint) owner to postgres;
revoke all on function public.set_active_restaurant(bigint) from public, anon;
grant execute on function public.set_active_restaurant(bigint) to authenticated, service_role;

create or replace function public.create_owned_restaurant(p_name text)
  returns bigint language plpgsql security definer set search_path = public
as $$
declare v_user_id bigint; v_role_id int; v_restaurant_id bigint; v_name text;
begin
  v_name := nullif(btrim(coalesce(p_name, '')), '');
  if v_name is null or length(v_name) > 80 then raise exception 'Nombre inválido'; end if;
  select id, role_id into v_user_id, v_role_id from public.users where auth_user_id = auth.uid();
  if v_user_id is null or v_role_id <> 2 then raise exception 'Solo administradores pueden crear restaurantes'; end if;
  insert into public.restaurants (restaurant_name, owner_user_id) values (v_name, v_user_id) returning id into v_restaurant_id;
  return v_restaurant_id;
end;
$$;
alter function public.create_owned_restaurant(text) owner to postgres;
revoke all on function public.create_owned_restaurant(text) from public, anon;
grant execute on function public.create_owned_restaurant(text) to authenticated, service_role;
