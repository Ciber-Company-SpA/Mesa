-- Auditoría jul 2026, hallazgos de diseño:
--  1) assign_waiter permitía a un admin de CUALQUIER restaurante reclamar un
--     mesero pendiente conociendo su email. Ahora el reclamo solo procede si
--     el restaurant_id del metadata de signup (que createWaiter fija
--     servidor-side con el restaurante del admin creador) coincide con el
--     restaurante del admin que reclama. Un signup forjado con metadata
--     arbitrario sigue sin poder autoasignarse: necesita la sesión de un
--     admin de ese restaurante.
--  2) Faltaba rate limit en las mutaciones de carrito y en la creación de
--     slots de comensal: cualquiera con un QR válido podía inflar
--     table_cart_items / table_diners sin tope. Se reutiliza el mecanismo
--     rate_limit_check existente (mismo de create_public_order_qr).

-- 1) assign_waiter: ligar el reclamo al restaurante del signup
create or replace function public.assign_waiter(p_waiter_email text, p_restaurant_id bigint)
returns bigint
language plpgsql
security definer
set search_path = public
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

  -- Solo meseros pendientes cuyo signup fue emitido PARA este restaurante.
  select u.id into v_waiter_user_id
  from public.users u
  join auth.users au on au.id = u.auth_user_id
  where u.user_email = p_waiter_email
    and u.role_id = 1
    and u.restaurant_id is null
    and (au.raw_user_meta_data->>'restaurant_id') = p_restaurant_id::text
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

-- 2a) cart_add_item_qr: rate limit por mesa (bucket compartido de carrito)
create or replace function public.cart_add_item_qr(
  p_qr_token text,
  p_product_id bigint,
  p_variant_id bigint,
  p_quantity integer,
  p_notes text,
  p_added_by text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_table_id      bigint;
  v_restaurant_id bigint;
  v_price         int;
  v_qty           int;
  v_notes         text;
  v_existing_id   uuid;
begin
  select table_id, restaurant_id into v_table_id, v_restaurant_id
  from public.resolve_qr_token(p_qr_token);
  if v_table_id is null then
    raise exception 'Mesa no encontrada o sin QR activo';
  end if;

  perform public.rate_limit_check('cart:' || v_table_id, 60, 60);

  -- BLOQUEO POR RESERVA: no se puede armar carrito en una mesa reservada.
  if public.is_table_reserved_now(v_table_id) then
    raise exception 'Esta mesa está reservada en este horario';
  end if;

  v_qty := coalesce(p_quantity, 1);
  if v_qty < 1 or v_qty > 20 then
    raise exception 'Cantidad inválida (1-20)';
  end if;

  v_notes := nullif(left(coalesce(p_notes, ''), 250), '');

  v_price := public.cart_resolve_price(v_restaurant_id, p_product_id, p_variant_id);
  if v_price is null then
    raise exception 'Producto o variante no pertenece al restaurante de la mesa';
  end if;

  select id into v_existing_id
  from public.table_cart_items
  where table_id = v_table_id
    and product_id = p_product_id
    and variant_id is not distinct from p_variant_id
    and notes is not distinct from v_notes
  limit 1;

  if v_existing_id is not null then
    update public.table_cart_items
    set quantity = quantity + v_qty
    where id = v_existing_id;
  else
    insert into public.table_cart_items
      (restaurant_id, table_id, product_id, variant_id, unit_price, quantity, notes, added_by)
    values
      (v_restaurant_id, v_table_id, p_product_id, p_variant_id, v_price, v_qty, v_notes,
       nullif(left(coalesce(p_added_by, ''), 100), ''));
  end if;
end;
$$;

-- 2b) cart_update_quantity_qr
create or replace function public.cart_update_quantity_qr(
  p_qr_token text,
  p_row_id   uuid,
  p_quantity integer
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_table_id     bigint;
  v_row_table_id bigint;
begin
  select table_id into v_table_id from public.resolve_qr_token(p_qr_token);
  if v_table_id is null then
    raise exception 'Mesa no encontrada o sin QR activo';
  end if;

  perform public.rate_limit_check('cart:' || v_table_id, 60, 60);

  if p_quantity < 1 or p_quantity > 20 then
    raise exception 'Cantidad inválida (1-20)';
  end if;

  select table_id into v_row_table_id from public.table_cart_items where id = p_row_id;
  if v_row_table_id is null or v_row_table_id <> v_table_id then
    raise exception 'El ítem no pertenece a esta mesa';
  end if;

  update public.table_cart_items set quantity = p_quantity where id = p_row_id;
end;
$$;

-- 2c) cart_remove_item_qr
create or replace function public.cart_remove_item_qr(
  p_qr_token text,
  p_row_id   uuid
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_table_id     bigint;
  v_row_table_id bigint;
begin
  select table_id into v_table_id from public.resolve_qr_token(p_qr_token);
  if v_table_id is null then
    raise exception 'Mesa no encontrada o sin QR activo';
  end if;

  perform public.rate_limit_check('cart:' || v_table_id, 60, 60);

  select table_id into v_row_table_id from public.table_cart_items where id = p_row_id;
  if v_row_table_id is null then
    return; -- ya no existe
  end if;
  if v_row_table_id <> v_table_id then
    raise exception 'El ítem no pertenece a esta mesa';
  end if;

  delete from public.table_cart_items where id = p_row_id;
end;
$$;

-- 2d) cart_clear_qr
create or replace function public.cart_clear_qr(p_qr_token text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_table_id bigint;
begin
  select table_id into v_table_id from public.resolve_qr_token(p_qr_token);
  if v_table_id is null then
    raise exception 'Mesa no encontrada o sin QR activo';
  end if;

  perform public.rate_limit_check('cart:' || v_table_id, 60, 60);

  delete from public.table_cart_items where table_id = v_table_id;
end;
$$;

-- 2e) claim_diner_slot_qr: rate limit solo en la creación de slots nuevos,
--     para no penalizar el re-claim idempotente que ocurre en cada carga
--     de página del comensal.
create or replace function public.claim_diner_slot_qr(p_qr_token text, p_diner_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_table_id bigint;
  v_slot     int;
begin
  if p_diner_token is null or length(p_diner_token) < 8 or length(p_diner_token) > 128 then
    raise exception 'Token de comensal inválido';
  end if;

  select table_id into v_table_id from public.resolve_qr_token(p_qr_token);
  if v_table_id is null then
    raise exception 'Mesa no encontrada o sin QR activo';
  end if;

  -- Si ya existe, devolver su slot.
  select diner_slot into v_slot
  from public.table_diners
  where table_id = v_table_id and diner_token = p_diner_token;

  if v_slot is not null then
    return jsonb_build_object('slot', v_slot, 'label', 'Comensal ' || v_slot);
  end if;

  perform public.rate_limit_check('diner:' || v_table_id, 15, 60);

  -- Asignar siguiente slot libre, con reintento ante carrera.
  for i in 1..10 loop
    select coalesce(max(diner_slot), 0) + 1 into v_slot
    from public.table_diners
    where table_id = v_table_id;

    begin
      insert into public.table_diners (table_id, diner_slot, diner_token)
      values (v_table_id, v_slot, p_diner_token);
      return jsonb_build_object('slot', v_slot, 'label', 'Comensal ' || v_slot);
    exception when unique_violation then
      continue;
    end;
  end loop;

  raise exception 'No se pudo asignar slot de comensal';
end;
$$;
