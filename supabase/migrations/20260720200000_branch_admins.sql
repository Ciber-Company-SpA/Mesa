-- ============================================================================
-- ADMINISTRADOR DE LOCAL (delegación por sucursal)
--
-- El DUEÑO de un grupo multi-sucursal puede crear, desde su panel, un acceso
-- de administrador para una sucursal concreta: un usuario role_id=2 ligado SOLO
-- a esa sucursal (users.restaurant_id = sucursal), que NO es dueño del grupo
-- (owner_user_id de la sucursal sigue siendo el dueño). Ese admin entra directo
-- a su local: no ve el selector de sucursales, no puede crear sucursales, editar
-- el grupo ni cambiar de local (set_active_restaurant ya valida owner_user_id).
--
-- Guard común: "caller es dueño de la sucursal" = restaurants.owner_user_id de
-- esa sucursal == el user del auth.uid(). Se endurecen create_branch y
-- update_my_organization para exigir dueño (defensa contra escalada del admin
-- de local). get_my_restaurant_plan expone is_owner para el gating de UI.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1) Insertar la fila del admin de local (la crea la edge tras el auth user).
--    Guard: el caller es dueño de la sucursal destino.
-- ----------------------------------------------------------------------------
create or replace function public.link_branch_admin(
  p_auth_user_id uuid, p_email text, p_name text, p_restaurant_id bigint
) returns bigint
  language plpgsql security definer set search_path = public
as $$
declare v_caller bigint; v_owner bigint; v_new bigint;
begin
  select id into v_caller from public.users where auth_user_id = auth.uid();
  select owner_user_id into v_owner from public.restaurants where id = p_restaurant_id;
  if v_caller is null or v_owner is null or v_owner <> v_caller then
    raise exception 'No sos dueño de esa sucursal';
  end if;

  insert into public.users (auth_user_id, user_name, user_email, role_id, restaurant_id, must_change_password)
  values (p_auth_user_id, coalesce(nullif(trim(coalesce(p_name, '')), ''), 'Administrador'),
          p_email, 2, p_restaurant_id, true)
  returning id into v_new;
  return v_new;
end;
$$;
alter function public.link_branch_admin(uuid, text, text, bigint) owner to postgres;
revoke all on function public.link_branch_admin(uuid, text, text, bigint) from public, anon;
grant execute on function public.link_branch_admin(uuid, text, text, bigint) to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 2) Listar los administradores de local de una sucursal (excluye al dueño).
-- ----------------------------------------------------------------------------
create or replace function public.list_branch_admins(p_restaurant_id bigint)
  returns table(user_id bigint, auth_user_id uuid, name text, email text)
  language plpgsql stable security definer set search_path = public
as $$
declare v_caller bigint; v_owner bigint;
begin
  select u.id into v_caller from public.users u where u.auth_user_id = auth.uid();
  select owner_user_id into v_owner from public.restaurants where id = p_restaurant_id;
  if v_caller is null or v_owner is null or v_owner <> v_caller then
    raise exception 'No autorizado';
  end if;

  return query
  select u.id, u.auth_user_id, u.user_name::text, u.user_email::text
  from public.users u
  where u.restaurant_id = p_restaurant_id and u.role_id = 2 and u.id <> v_owner
  order by u.user_name;
end;
$$;
alter function public.list_branch_admins(bigint) owner to postgres;
revoke all on function public.list_branch_admins(bigint) from public, anon;
grant execute on function public.list_branch_admins(bigint) to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 3) Resolver el auth_user_id de un admin de local (valida dueño). La edge de
--    reseteo la usa para validar y obtener el id antes de cambiar la clave.
-- ----------------------------------------------------------------------------
create or replace function public.branch_admin_auth_id(p_user_id bigint)
  returns uuid
  language plpgsql stable security definer set search_path = public
as $$
declare v_caller bigint; v_owner bigint; v_rid bigint; v_role int; v_auth uuid;
begin
  select id into v_caller from public.users where auth_user_id = auth.uid();
  select restaurant_id, role_id, auth_user_id into v_rid, v_role, v_auth
  from public.users where id = p_user_id;
  if v_rid is null then raise exception 'Usuario no encontrado'; end if;
  if v_role <> 2 then raise exception 'No es un administrador de local'; end if;
  select owner_user_id into v_owner from public.restaurants where id = v_rid;
  if v_caller is null or v_owner is null or v_owner <> v_caller then raise exception 'No autorizado'; end if;
  if p_user_id = v_owner then raise exception 'No corresponde'; end if;  -- nunca el dueño
  return v_auth;
end;
$$;
alter function public.branch_admin_auth_id(bigint) owner to postgres;
revoke all on function public.branch_admin_auth_id(bigint) from public, anon;
grant execute on function public.branch_admin_auth_id(bigint) to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 4) Revocar (borrar) un admin de local: public.users + auth.users.
-- ----------------------------------------------------------------------------
create or replace function public.revoke_branch_admin(p_user_id bigint)
  returns boolean
  language plpgsql security definer set search_path = public
as $$
declare v_caller bigint; v_owner bigint; v_rid bigint; v_role int; v_auth uuid;
begin
  select id into v_caller from public.users where auth_user_id = auth.uid();
  select restaurant_id, role_id, auth_user_id into v_rid, v_role, v_auth
  from public.users where id = p_user_id;
  if v_rid is null then raise exception 'Usuario no encontrado'; end if;
  if v_role <> 2 then raise exception 'Solo administradores de local'; end if;
  select owner_user_id into v_owner from public.restaurants where id = v_rid;
  if v_caller is null or v_owner is null or v_owner <> v_caller then raise exception 'No autorizado'; end if;
  if p_user_id = v_owner then raise exception 'No podés revocar tu propio acceso de dueño'; end if;

  delete from public.users where id = p_user_id;
  if v_auth is not null then delete from auth.users where id = v_auth; end if;
  return true;
end;
$$;
alter function public.revoke_branch_admin(bigint) owner to postgres;
revoke all on function public.revoke_branch_admin(bigint) from public, anon;
grant execute on function public.revoke_branch_admin(bigint) to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 5) Endurecer create_branch: SOLO el dueño (owner del restaurante activo).
--    Cuerpo idéntico a 20260720140000 + un guard de dueño.
-- ----------------------------------------------------------------------------
create or replace function public.create_branch(
  p_name text, p_branch_label text default null, p_city text default null, p_tables int default 0
) returns bigint language plpgsql security definer set search_path = public as $$
declare v_user bigint; v_role int; v_active bigint; v_org bigint; v_plan text; v_max int; v_count int; v_new bigint; v_name text;
begin
  select id, role_id, restaurant_id into v_user, v_role, v_active from public.users where auth_user_id = auth.uid();
  if v_user is null or v_role <> 2 then raise exception 'Solo administradores pueden crear sucursales'; end if;
  -- Solo el DUEÑO del grupo (no un administrador de local delegado).
  if (select owner_user_id from public.restaurants where id = v_active) is distinct from v_user then
    raise exception 'Solo el dueño del grupo puede crear sucursales';
  end if;
  v_name := nullif(btrim(coalesce(p_name, '')), '');
  if v_name is null or length(v_name) > 80 then raise exception 'Nombre de sucursal inválido'; end if;
  select organization_id, plan_id into v_org, v_plan from public.restaurant_accounts where restaurant_id = v_active;
  if v_org is null then raise exception 'Tu restaurante no pertenece a un grupo multi-sucursal'; end if;
  select max_branches into v_max from public.organizations where id = v_org;
  select count(*) into v_count from public.restaurant_accounts where organization_id = v_org;
  if v_max is not null and v_count >= v_max then raise exception 'Alcanzaste el cupo de sucursales de tu plan (%).', v_max; end if;
  insert into public.restaurants (restaurant_name, owner_user_id, branch_label, restaurant_city)
  values (v_name, v_user, nullif(btrim(coalesce(p_branch_label, '')), ''), nullif(btrim(coalesce(p_city, '')), ''))
  returning id into v_new;
  insert into public.restaurant_accounts (restaurant_id, organization_id, plan_id, account_status)
  values (v_new, v_org, coalesce(v_plan, 'custom'), 'active');
  perform public._mb_create_tables(v_new, coalesce(p_tables, 0));
  return v_new;
end; $$;
alter function public.create_branch(text, text, text, int) owner to postgres;
revoke all on function public.create_branch(text, text, text, int) from public, anon;
grant execute on function public.create_branch(text, text, text, int) to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 6) Endurecer update_my_organization: SOLO el dueño.
-- ----------------------------------------------------------------------------
create or replace function public.update_my_organization(
  p_name text, p_legal_name text default null, p_rut text default null, p_contact_name text default null,
  p_contact_email text default null, p_contact_phone text default null, p_address text default null, p_city text default null
) returns void language plpgsql security definer set search_path to 'public' as $$
declare v_rid bigint; v_org bigint; v_user bigint;
begin
  if not public.current_user_is_admin() then raise exception 'No autorizado'; end if;
  select id into v_user from public.users where auth_user_id = auth.uid();
  v_rid := public.current_user_restaurant_id();
  if (select owner_user_id from public.restaurants where id = v_rid) is distinct from v_user then
    raise exception 'Solo el dueño del grupo puede editar sus datos';
  end if;
  select organization_id into v_org from public.restaurant_accounts where restaurant_id = v_rid;
  if v_org is null then raise exception 'Tu restaurante no pertenece a un grupo'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'El nombre del grupo es obligatorio'; end if;
  update public.organizations set
    name = trim(p_name), legal_name = nullif(trim(coalesce(p_legal_name,'')), ''), rut = nullif(trim(coalesce(p_rut,'')), ''),
    contact_name = nullif(trim(coalesce(p_contact_name,'')), ''), contact_email = nullif(trim(coalesce(p_contact_email,'')), ''),
    contact_phone = nullif(trim(coalesce(p_contact_phone,'')), ''), address = nullif(trim(coalesce(p_address,'')), ''),
    city = nullif(trim(coalesce(p_city,'')), '')
  where id = v_org;
end; $$;
alter function public.update_my_organization(text, text, text, text, text, text, text, text) owner to postgres;
revoke all on function public.update_my_organization(text, text, text, text, text, text, text, text) from public, anon;
grant execute on function public.update_my_organization(text, text, text, text, text, text, text, text) to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 7) is_owner en get_my_restaurant_plan (gating de Sucursales/selector).
-- ----------------------------------------------------------------------------
create or replace function public.get_my_restaurant_plan()
  returns jsonb language plpgsql stable security definer set search_path to 'public'
as $function$
declare v_rid bigint; v_is_owner boolean; v jsonb;
begin
  v_rid := public.current_user_restaurant_id();
  if v_rid is null then return null; end if;

  v_is_owner := (
    (select r.owner_user_id from public.restaurants r where r.id = v_rid)
    = (select u.id from public.users u where u.auth_user_id = auth.uid())
  );

  select jsonb_build_object(
    'restaurant_id', v_rid,
    'plan_id', ra.plan_id,
    'plan_name', pl.name,
    'max_tables', pl.max_tables,
    'one_time_price', pl.one_time_price,
    'support_monthly_price', pl.support_monthly_price,
    'account_status', coalesce(ra.account_status, 'active'),
    'trial_ends_at', ra.trial_ends_at,
    'tables_count', (select count(*) from public.tables t where t.restaurant_id = v_rid),
    'has_reports_advanced', (ra.plan_id is distinct from 'plan15'),
    'has_full_waiter_mgmt', true,
    'has_multi_branch', (ra.plan_id = 'custom'),
    'is_owner', coalesce(v_is_owner, false)
  ) into v
  from public.restaurant_accounts ra
  left join public.plans pl on pl.id = ra.plan_id
  where ra.restaurant_id = v_rid;

  return coalesce(v, jsonb_build_object(
    'restaurant_id', v_rid,
    'plan_id', null,
    'account_status', 'active',
    'has_reports_advanced', true,
    'has_full_waiter_mgmt', true,
    'has_multi_branch', false,
    'is_owner', coalesce(v_is_owner, false),
    'tables_count', (select count(*) from public.tables t where t.restaurant_id = v_rid)
  ));
end;
$function$;

commit;
