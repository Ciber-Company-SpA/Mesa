-- Endurecer creación de usuarios (fix escalada de privilegios)
-- handle_new_user ya no confía en role_id/restaurant_id del metadata.

begin;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  new_restaurant_id bigint;
  v_wants_waiter boolean;
begin
  v_wants_waiter := (new.raw_user_meta_data ? 'restaurant_id')
                    and (new.raw_user_meta_data->>'restaurant_id') is not null;

  if v_wants_waiter then
    -- NO confiar en el restaurant_id del metadata. Mesero PENDIENTE sin restaurante.
    insert into public.users (auth_user_id, user_name, user_email, role_id, restaurant_id)
    values (
      new.id,
      coalesce(new.raw_user_meta_data->>'admin_name', 'Mesero'),
      new.email,
      1,
      null
    );
  else
    -- Registro público de admin: SIEMPRE crea restaurante nuevo + role 2.
    insert into public.restaurants (restaurant_name, restaurant_logo)
    values (
      coalesce(new.raw_user_meta_data->>'restaurant_name', 'Restaurante sin nombre'),
      null
    )
    returning id into new_restaurant_id;

    insert into public.users (auth_user_id, user_name, user_email, role_id, restaurant_id)
    values (
      new.id,
      coalesce(new.raw_user_meta_data->>'admin_name', 'Nuevo Usuario'),
      new.email,
      2,
      new_restaurant_id
    );
  end if;

  return new;
end;
$$;

create or replace function public.assign_waiter(
  p_waiter_email text,
  p_restaurant_id bigint
)
returns bigint
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_admin_restaurant_id bigint;
  v_waiter_user_id bigint;
begin
  select u.restaurant_id into v_admin_restaurant_id
  from public.users u
  where u.auth_user_id = auth.uid()
    and u.role_id = 2;

  if v_admin_restaurant_id is null then
    raise exception 'No autorizado';
  end if;
  if v_admin_restaurant_id <> p_restaurant_id then
    raise exception 'No tienes permiso sobre este restaurante';
  end if;

  select u.id into v_waiter_user_id
  from public.users u
  where u.user_email = p_waiter_email
    and u.role_id = 1
    and u.restaurant_id is null
  order by u.id desc
  limit 1;

  if v_waiter_user_id is null then
    raise exception 'Mesero pendiente no encontrado';
  end if;

  update public.users
  set restaurant_id = p_restaurant_id
  where id = v_waiter_user_id;

  return v_waiter_user_id;
end;
$$;

revoke all on function public.assign_waiter(text, bigint) from public;
grant execute on function public.assign_waiter(text, bigint) to authenticated;

commit;