-- A-1 (defensa en profundidad): cerrar por código el registro público que
-- creaba restaurante + admin. Antes, cualquier auth.signUp sin restaurant_id
-- caía en la rama "else" y se convertía en admin dueño de un restaurante nuevo.
-- Ahora esa rama exige una MARCA que solo el service_role puede poner
-- (app_metadata.provisioned_by_platform), imposible de setear desde un signUp
-- del cliente. Cualquier registro que no sea (a) un mesero pendiente legítimo
-- o (b) un aprovisionamiento de plataforma se RECHAZA, revirtiendo el alta del
-- usuario en auth. Esto cierra el hueco aunque el toggle de "Allow new users to
-- sign up" quede encendido.
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
  v_provisioned     boolean;
begin
  v_wants_waiter := (new.raw_user_meta_data ? 'restaurant_id')
                    and (new.raw_user_meta_data->>'restaurant_id') is not null;

  -- Marca puesta por provision-restaurant vía Admin API (service_role). El
  -- cliente no puede setear raw_app_meta_data en un signUp.
  v_provisioned := coalesce((new.raw_app_meta_data->>'provisioned_by_platform')::boolean, false);

  if v_wants_waiter then
    -- Mesero PENDIENTE sin restaurante. Queda inerte hasta que un admin lo
    -- ligue con assign_waiter (que valida que el caller sea admin del local).
    insert into public.users (auth_user_id, user_name, user_email, role_id, restaurant_id, must_change_password)
    values (
      new.id,
      coalesce(new.raw_user_meta_data->>'admin_name', 'Mesero'),
      new.email,
      1,
      null,
      true
    );
  elsif v_provisioned then
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
  else
    -- Registro no autorizado: ni mesero pendiente ni aprovisionamiento de
    -- plataforma. Se rechaza y se revierte el alta en auth.users.
    raise exception 'Registro no permitido';
  end if;

  return new;
end;
$function$;
