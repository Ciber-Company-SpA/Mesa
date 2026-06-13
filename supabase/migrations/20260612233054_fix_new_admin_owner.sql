-- ============================================================================
-- FIX: owner_user_id en el registro de admins nuevos  (IMPORTANTE 🟠 #1)
--
-- Problema:
--   handle_new_user crea el restaurante SIN owner_user_id. Ese campo solo se
--   llenó con el backfill único de 20260607000000_restaurant_owner.sql. Todo
--   admin registrado DESPUÉS de esa migración tiene su restaurante con
--   owner_user_id = NULL.
--
-- Consecuencia:
--   set_active_restaurant exige owner_user_id = usuario. Un admin nuevo que
--   cree un segundo restaurante y luego intente VOLVER al original queda
--   bloqueado: "No sos dueño de ese restaurante" (el original tiene owner NULL).
--
-- Solución (dos partes):
--   1. Reescribir handle_new_user para que, tras crear restaurante + usuario,
--      haga un UPDATE que asigne owner_user_id = id del usuario recién creado.
--      Todo en la misma transacción del trigger (resuelve el huevo-y-gallina:
--      el restaurante se crea antes que el usuario, pero el owner se setea al
--      final, cuando ya existe el users.id).
--   2. Re-backfill idempotente: repara cualquier restaurante con owner NULL
--      que tenga un admin asociado (los registrados entre el backfill y este fix).
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1) handle_new_user: setear owner_user_id al crear el restaurante del admin.
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  new_restaurant_id bigint;
  new_user_id       bigint;
  v_wants_waiter    boolean;
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
    )
    returning id into new_user_id;

    -- Asignar al admin como DUEÑO de su restaurante inicial.
    -- (no se podía antes del insert del usuario: owner_user_id necesita users.id)
    update public.restaurants
    set owner_user_id = new_user_id
    where id = new_restaurant_id;
  end if;

  return new;
end;
$$;


-- ----------------------------------------------------------------------------
-- 2) Re-backfill idempotente: reparar restaurantes con owner_user_id NULL.
--    Asigna como dueño al primer admin (role_id = 2) asociado al restaurante.
--    Seguro de re-ejecutar: solo toca filas donde owner_user_id IS NULL.
-- ----------------------------------------------------------------------------
update public.restaurants r
set owner_user_id = sub.user_id
from (
  select distinct on (u.restaurant_id)
    u.restaurant_id,
    u.id as user_id
  from public.users u
  where u.restaurant_id is not null
    and u.role_id = 2
  order by u.restaurant_id, u.id asc
) sub
where r.id = sub.restaurant_id
  and r.owner_user_id is null;

commit;