-- Fix: el alta de clientes fallaba con "Registro no permitido".
-- Causa: el candado A-1 hacía que handle_new_user exigiera la marca
-- app_metadata.provisioned_by_platform, pero Supabase/GoTrue aplica app_metadata
-- DESPUÉS de insertar el usuario, así que el trigger no la ve durante
-- admin.createUser y rechazaba el alta legítima.
--
-- Solución robusta: el trigger ya NO crea el restaurante+admin ni lanza
-- excepción. La creación del admin se hace explícita vía platform_provision_admin
-- (guard is_platform_owner), llamada por la edge function provision-restaurant.
-- Un signup público (si el toggle se reactivara) queda sin fila en public.users
-- => sin acceso al panel. A-1 sigue cerrado por código.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_wants_waiter boolean;
begin
  v_wants_waiter := (new.raw_user_meta_data ? 'restaurant_id')
                    and (new.raw_user_meta_data->>'restaurant_id') is not null;

  if v_wants_waiter then
    -- Mesero PENDIENTE sin restaurante (lo liga assign_waiter, que valida al admin).
    insert into public.users (auth_user_id, user_name, user_email, role_id, restaurant_id, must_change_password)
    values (
      new.id,
      coalesce(new.raw_user_meta_data->>'admin_name', 'Mesero'),
      new.email,
      1,
      null,
      true
    );
  end if;

  -- Cualquier otro registro (incluidos los admins) NO crea nada acá: el alta de
  -- administrador la realiza platform_provision_admin desde el aprovisionamiento.
  return new;
end;
$function$;

-- Alta explícita del restaurante + admin dueño. Guard is_platform_owner (la
-- llama el operador vía provision-restaurant). Idempotente: si el usuario ya
-- tiene restaurante, lo devuelve.
create or replace function public.platform_provision_admin(
  p_auth_user_id  uuid,
  p_email         text,
  p_name          text,
  p_restaurant_name text
)
returns bigint
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_rid bigint; v_uid bigint;
begin
  if not public.is_platform_owner() then raise exception 'No autorizado'; end if;

  select restaurant_id into v_rid from public.users where auth_user_id = p_auth_user_id;
  if v_rid is not null then return v_rid; end if;

  insert into public.restaurants (restaurant_name, restaurant_logo)
  values (coalesce(nullif(trim(coalesce(p_restaurant_name, '')), ''), 'Restaurante sin nombre'), null)
  returning id into v_rid;

  insert into public.users (auth_user_id, user_name, user_email, role_id, restaurant_id, must_change_password)
  values (
    p_auth_user_id,
    coalesce(nullif(trim(coalesce(p_name, '')), ''), 'Administrador'),
    p_email,
    2,
    v_rid,
    true
  )
  returning id into v_uid;

  update public.restaurants set owner_user_id = v_uid where id = v_rid;
  return v_rid;
end;
$$;

revoke all on function public.platform_provision_admin(uuid, text, text, text) from public, anon;
grant execute on function public.platform_provision_admin(uuid, text, text, text) to authenticated, service_role;
