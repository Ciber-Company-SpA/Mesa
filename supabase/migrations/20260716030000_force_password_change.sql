-- A-2: forzar el cambio de la contraseña temporal en el primer ingreso, de
-- forma robusta. El flag deja de vivir en user_metadata (auto-escribible por el
-- propio usuario con auth.updateUser) y pasa a una columna de public.users que
-- el usuario NO puede modificar: la tabla solo tiene policy de SELECT del propio
-- perfil, sin policy de UPDATE, así que RLS bloquea cualquier escritura del
-- cliente. El flag solo se limpia desde la edge function change-my-password
-- (service_role), y únicamente al fijar una contraseña nueva.

alter table public.users
  add column if not exists must_change_password boolean not null default false;

-- El trigger de alta marca la cuenta como "debe cambiar contraseña": tanto el
-- admin aprovisionado (rama else) como el mesero pendiente (rama if) nacen con
-- una contraseña temporal/comunicada, así que ambos deben rotarla.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  new_restaurant_id bigint;
  new_user_id       bigint;
  v_wants_waiter    boolean;
begin
  v_wants_waiter := (new.raw_user_meta_data ? 'restaurant_id')
                    and (new.raw_user_meta_data->>'restaurant_id') is not null;

  if v_wants_waiter then
    -- NO confiar en el restaurant_id del metadata. Mesero PENDIENTE sin restaurante.
    insert into public.users (auth_user_id, user_name, user_email, role_id, restaurant_id, must_change_password)
    values (
      new.id,
      coalesce(new.raw_user_meta_data->>'admin_name', 'Mesero'),
      new.email,
      1,
      null,
      true
    );
  else
    insert into public.restaurants (restaurant_name, restaurant_logo)
    values (
      coalesce(new.raw_user_meta_data->>'restaurant_name', 'Restaurante sin nombre'),
      null
    )
    returning id into new_restaurant_id;

    insert into public.users (auth_user_id, user_name, user_email, role_id, restaurant_id, must_change_password)
    values (
      new.id,
      coalesce(new.raw_user_meta_data->>'admin_name', 'Nuevo Usuario'),
      new.email,
      2,
      new_restaurant_id,
      true
    )
    returning id into new_user_id;

    update public.restaurants
    set owner_user_id = new_user_id
    where id = new_restaurant_id;
  end if;

  return new;
end;
$function$;

-- Lectura del flag del propio usuario (para el cliente y el proxy). DEFINER
-- para no depender de que el JWT ya esté propagado a PostgREST.
create or replace function public.get_my_must_change_password()
returns boolean
language sql
stable security definer
set search_path to 'public'
as $function$
  select coalesce(
    (select must_change_password from public.users where auth_user_id = auth.uid() limit 1),
    false
  );
$function$;

revoke all on function public.get_my_must_change_password() from public, anon;
grant execute on function public.get_my_must_change_password() to authenticated, service_role;
