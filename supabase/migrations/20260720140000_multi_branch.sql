-- ============================================================================
-- MULTI-SUCURSAL: un dueño (login) administra varios locales
--
-- Aprovecha el cimiento ya existente (restaurants.owner_user_id +
-- set_active_restaurant/list_my_restaurants de 20260607000000). Agrega:
--   - organizations.max_branches : cupo de sucursales del grupo (lo fija el operador).
--   - restaurants.branch_label   : etiqueta corta para identificar la sucursal.
--   - create_branch()            : el cliente-dueño crea una sucursal (hasta el cupo).
--   - platform_provision_branch(): el operador añade una sucursal a un grupo
--                                  reutilizando el dueño existente (sin login nuevo).
--   - get_my_branches()          : locales del dueño + cupo (para el módulo cliente).
--   - update_my_branch()         : el dueño edita la identidad de una sucursal suya.
--   - copy_menu_to_branch()      : copia carta (categorías+productos+variantes) entre locales del dueño.
--   - max_branches en las RPCs de organización del portal.
--
-- Seguridad: create_branch/update_my_branch/copy_menu validan owner_user_id =
-- usuario actual; platform_* validan is_platform_owner. La RLS de tenant sigue
-- aislando por el "local activo" (users.restaurant_id).
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1) Columnas
-- ----------------------------------------------------------------------------
alter table public.organizations add column if not exists max_branches int;
alter table public.restaurants   add column if not exists branch_label text;

comment on column public.organizations.max_branches is
  'Cupo de sucursales del grupo (null = sin límite). Lo fija el operador.';
comment on column public.restaurants.branch_label is
  'Etiqueta corta para identificar la sucursal dentro de su grupo (ej. "Centro").';

-- ----------------------------------------------------------------------------
-- 1b) Cimiento "1 usuario → N restaurantes" (la columna owner_user_id ya existe
--     en prod desde 20260607000000, pero estas funciones faltaban). Se recrean
--     acá para dejar repo y base alineados.
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- 2) Helper interno: crear N mesas con QR (sin guard de rol; solo lo llaman
--    RPCs que ya validan). Ejecuta como owner postgres.
-- ----------------------------------------------------------------------------
create or replace function public._mb_create_tables(p_restaurant_id bigint, p_count int)
  returns int
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  i int; v_qr bigint; v_token text; v_start int; v_created int := 0;
begin
  if coalesce(p_count, 0) <= 0 then return 0; end if;
  if p_count > 200 then raise exception 'Cantidad de mesas inválida (1-200)'; end if;

  select coalesce(max(table_number), 0) into v_start
  from public.tables where restaurant_id = p_restaurant_id;

  for i in 1..p_count loop
    v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
    insert into public.table_qr_codes (qr_code, qr_active) values (v_token, true) returning id into v_qr;
    insert into public.tables (table_number, restaurant_id, qr_code_id) values (v_start + i, p_restaurant_id, v_qr);
    v_created := v_created + 1;
  end loop;
  return v_created;
end;
$$;
alter function public._mb_create_tables(bigint, int) owner to postgres;
revoke all on function public._mb_create_tables(bigint, int) from public, anon, authenticated;
grant execute on function public._mb_create_tables(bigint, int) to service_role;

-- ----------------------------------------------------------------------------
-- 3) create_branch: el cliente-dueño crea una sucursal en su grupo (hasta cupo).
-- ----------------------------------------------------------------------------
create or replace function public.create_branch(
  p_name text,
  p_branch_label text default null,
  p_city text default null,
  p_tables int default 0
) returns bigint
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_user bigint; v_role int; v_active bigint; v_org bigint; v_plan text;
  v_max int; v_count int; v_new bigint; v_name text;
begin
  select id, role_id, restaurant_id into v_user, v_role, v_active
  from public.users where auth_user_id = auth.uid();
  if v_user is null or v_role <> 2 then
    raise exception 'Solo administradores pueden crear sucursales';
  end if;

  v_name := nullif(btrim(coalesce(p_name, '')), '');
  if v_name is null or length(v_name) > 80 then
    raise exception 'Nombre de sucursal inválido';
  end if;

  select organization_id, plan_id into v_org, v_plan
  from public.restaurant_accounts where restaurant_id = v_active;
  if v_org is null then
    raise exception 'Tu restaurante no pertenece a un grupo multi-sucursal';
  end if;

  select max_branches into v_max from public.organizations where id = v_org;
  select count(*) into v_count from public.restaurant_accounts where organization_id = v_org;
  if v_max is not null and v_count >= v_max then
    raise exception 'Alcanzaste el cupo de sucursales de tu plan (%).', v_max;
  end if;

  insert into public.restaurants (restaurant_name, owner_user_id, branch_label, restaurant_city)
  values (v_name, v_user,
          nullif(btrim(coalesce(p_branch_label, '')), ''),
          nullif(btrim(coalesce(p_city, '')), ''))
  returning id into v_new;

  insert into public.restaurant_accounts (restaurant_id, organization_id, plan_id, account_status)
  values (v_new, v_org, coalesce(v_plan, 'custom'), 'active');

  perform public._mb_create_tables(v_new, coalesce(p_tables, 0));
  return v_new;
end;
$$;
alter function public.create_branch(text, text, text, int) owner to postgres;
revoke all on function public.create_branch(text, text, text, int) from public, anon;
grant execute on function public.create_branch(text, text, text, int) to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 4) platform_provision_branch: el operador añade una sucursal a un grupo,
--    reutilizando el dueño existente (no crea login nuevo).
-- ----------------------------------------------------------------------------
create or replace function public.platform_provision_branch(
  p_org_id bigint,
  p_name text,
  p_branch_label text default null,
  p_city text default null,
  p_tables int default 0
) returns bigint
  language plpgsql
  security definer
  set search_path = public
as $$
declare v_owner bigint; v_plan text; v_max int; v_count int; v_new bigint; v_name text;
begin
  if not public.is_platform_owner() then raise exception 'No autorizado'; end if;

  v_name := nullif(btrim(coalesce(p_name, '')), '');
  if v_name is null or length(v_name) > 80 then raise exception 'Nombre de sucursal inválido'; end if;

  select r.owner_user_id into v_owner
  from public.restaurants r
  join public.restaurant_accounts ra on ra.restaurant_id = r.id
  where ra.organization_id = p_org_id and r.owner_user_id is not null
  order by r.id limit 1;
  if v_owner is null then
    raise exception 'El grupo no tiene un dueño; primero crea el cliente principal del grupo';
  end if;

  select plan_id into v_plan
  from public.restaurant_accounts where organization_id = p_org_id order by restaurant_id limit 1;
  select max_branches into v_max from public.organizations where id = p_org_id;
  select count(*) into v_count from public.restaurant_accounts where organization_id = p_org_id;
  if v_max is not null and v_count >= v_max then
    raise exception 'El grupo alcanzó su cupo de sucursales (%).', v_max;
  end if;

  insert into public.restaurants (restaurant_name, owner_user_id, branch_label, restaurant_city)
  values (v_name, v_owner,
          nullif(btrim(coalesce(p_branch_label, '')), ''),
          nullif(btrim(coalesce(p_city, '')), ''))
  returning id into v_new;

  insert into public.restaurant_accounts (restaurant_id, organization_id, plan_id, account_status)
  values (v_new, p_org_id, coalesce(v_plan, 'custom'), 'active');

  perform public._mb_create_tables(v_new, coalesce(p_tables, 0));
  perform public._platform_audit('provision_branch', 'restaurant', v_new::text,
    jsonb_build_object('org_id', p_org_id, 'name', v_name));
  return v_new;
end;
$$;
alter function public.platform_provision_branch(bigint, text, text, text, int) owner to postgres;
revoke all on function public.platform_provision_branch(bigint, text, text, text, int) from public, anon;
grant execute on function public.platform_provision_branch(bigint, text, text, text, int) to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 5) get_my_branches: locales del dueño + cupo, para el módulo del cliente.
-- ----------------------------------------------------------------------------
create or replace function public.get_my_branches()
  returns jsonb
  language plpgsql
  stable
  security definer
  set search_path = public
as $$
declare v_user bigint; v_active bigint; v_org bigint; v_max int; v_used int; v_branches jsonb;
begin
  if not public.current_user_is_admin() then raise exception 'No autorizado'; end if;
  select id, restaurant_id into v_user, v_active from public.users where auth_user_id = auth.uid();
  select organization_id into v_org from public.restaurant_accounts where restaurant_id = v_active;

  select coalesce(jsonb_agg(b order by b.restaurant_name), '[]'::jsonb) into v_branches from (
    select r.id as restaurant_id,
           r.restaurant_name::text as restaurant_name,
           r.branch_label,
           r.restaurant_city as city,
           (r.id = v_active) as is_current,
           (select count(*) from public.tables t where t.restaurant_id = r.id) as tables_count,
           (select count(*) from public.orders o where o.restaurant_id = r.id) as orders_total,
           (select coalesce(sum(o.total), 0) from public.orders o where o.restaurant_id = r.id and o.status_id = 4) as revenue_total
    from public.restaurants r
    where r.owner_user_id = v_user
  ) b;

  select max_branches into v_max from public.organizations where id = v_org;
  select count(*) into v_used from public.restaurant_accounts where organization_id = v_org;

  return jsonb_build_object(
    'org_id',       v_org,
    'max_branches', v_max,
    'used',         coalesce(v_used, 0),
    'can_create',   (v_org is not null and (v_max is null or coalesce(v_used, 0) < v_max)),
    'branches',     v_branches
  );
end;
$$;
alter function public.get_my_branches() owner to postgres;
revoke all on function public.get_my_branches() from public, anon;
grant execute on function public.get_my_branches() to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 6) update_my_branch: el dueño edita la identidad de una de sus sucursales.
-- ----------------------------------------------------------------------------
create or replace function public.update_my_branch(
  p_restaurant_id bigint,
  p_name text,
  p_branch_label text default null,
  p_city text default null
) returns void
  language plpgsql
  security definer
  set search_path = public
as $$
declare v_user bigint; v_owner bigint; v_name text;
begin
  select id into v_user from public.users where auth_user_id = auth.uid();
  if v_user is null or not public.current_user_is_admin() then raise exception 'No autorizado'; end if;

  select owner_user_id into v_owner from public.restaurants where id = p_restaurant_id;
  if v_owner is null or v_owner <> v_user then raise exception 'No sos dueño de esa sucursal'; end if;

  v_name := nullif(btrim(coalesce(p_name, '')), '');
  if v_name is null or length(v_name) > 80 then raise exception 'Nombre inválido'; end if;

  update public.restaurants set
    restaurant_name = v_name,
    branch_label    = nullif(btrim(coalesce(p_branch_label, '')), ''),
    restaurant_city = nullif(btrim(coalesce(p_city, '')), '')
  where id = p_restaurant_id;
end;
$$;
alter function public.update_my_branch(bigint, text, text, text) owner to postgres;
revoke all on function public.update_my_branch(bigint, text, text, text) from public, anon;
grant execute on function public.update_my_branch(bigint, text, text, text) to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 7) copy_menu_to_branch: copia carta entre dos locales del mismo dueño (append).
-- ----------------------------------------------------------------------------
create or replace function public.copy_menu_to_branch(p_source bigint, p_target bigint)
  returns jsonb
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_user bigint; v_os bigint; v_ot bigint;
  v_cats int := 0; v_prods int := 0; v_vars int := 0; v_added int;
  c record; p record; v_new_cat bigint; v_new_prod bigint;
  cat_map jsonb := '{}'::jsonb;
begin
  select id into v_user from public.users where auth_user_id = auth.uid();
  if v_user is null or not public.current_user_is_admin() then raise exception 'No autorizado'; end if;
  if p_source = p_target then raise exception 'Origen y destino deben ser distintos'; end if;

  select owner_user_id into v_os from public.restaurants where id = p_source;
  select owner_user_id into v_ot from public.restaurants where id = p_target;
  if v_os is null or v_ot is null or v_os <> v_user or v_ot <> v_user then
    raise exception 'Solo podés copiar entre tus propias sucursales';
  end if;

  for c in select id, category_name from public.categories where restaurant_id = p_source loop
    insert into public.categories (category_name, restaurant_id)
    values (c.category_name, p_target) returning id into v_new_cat;
    cat_map := cat_map || jsonb_build_object(c.id::text, v_new_cat);
    v_cats := v_cats + 1;
  end loop;

  for p in select * from public.products where restaurant_id = p_source loop
    insert into public.products
      (product_name, product_description, product_price, product_image, product_image_public_id,
       category_id, restaurant_id, status_id)
    values
      (p.product_name, p.product_description, p.product_price, p.product_image, p.product_image_public_id,
       case when p.category_id is not null then (cat_map->>p.category_id::text)::bigint else null end,
       p_target, coalesce(p.status_id, 1))
    returning id into v_new_prod;
    v_prods := v_prods + 1;

    with ins as (
      insert into public.product_variants
        (product_id, variant_name, variant_price, variant_image, variant_image_public_id)
      select v_new_prod, pv.variant_name, pv.variant_price, pv.variant_image, pv.variant_image_public_id
      from public.product_variants pv where pv.product_id = p.id
      returning 1
    )
    select coalesce(count(*), 0) into v_added from ins;
    v_vars := v_vars + v_added;
  end loop;

  return jsonb_build_object('categories', v_cats, 'products', v_prods, 'variants', v_vars);
end;
$$;
alter function public.copy_menu_to_branch(bigint, bigint) owner to postgres;
revoke all on function public.copy_menu_to_branch(bigint, bigint) from public, anon;
grant execute on function public.copy_menu_to_branch(bigint, bigint) to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 8) Cupo (max_branches) en las RPCs de organización del portal.
--    Se recrean con el parámetro extra (default null → retrocompatible).
-- ----------------------------------------------------------------------------
drop function if exists public.platform_create_organization(text, text, text, text, text, text, text, text, text);
create or replace function public.platform_create_organization(
  p_name text, p_notes text default null, p_legal_name text default null, p_rut text default null,
  p_contact_name text default null, p_contact_email text default null, p_contact_phone text default null,
  p_address text default null, p_city text default null, p_max_branches int default null
) returns bigint
  language plpgsql security definer set search_path to 'public'
as $$
declare v_id bigint;
begin
  if not public.is_platform_owner() then raise exception 'No autorizado'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'El nombre es obligatorio'; end if;

  insert into public.organizations
    (name, notes, legal_name, rut, contact_name, contact_email, contact_phone, address, city, max_branches)
  values
    (trim(p_name), nullif(trim(coalesce(p_notes,'')), ''),
     nullif(trim(coalesce(p_legal_name,'')), ''), nullif(trim(coalesce(p_rut,'')), ''),
     nullif(trim(coalesce(p_contact_name,'')), ''), nullif(trim(coalesce(p_contact_email,'')), ''),
     nullif(trim(coalesce(p_contact_phone,'')), ''), nullif(trim(coalesce(p_address,'')), ''),
     nullif(trim(coalesce(p_city,'')), ''),
     case when coalesce(p_max_branches, 0) > 0 then p_max_branches else null end)
  returning id into v_id;

  perform public._platform_audit('create_organization', 'organization', v_id::text,
    jsonb_build_object('name', trim(p_name), 'max_branches', p_max_branches));
  return v_id;
end;
$$;

drop function if exists public.platform_update_organization(bigint, text, text, text, text, text, text, text, text, text);
create or replace function public.platform_update_organization(
  p_id bigint, p_name text, p_notes text default null, p_legal_name text default null, p_rut text default null,
  p_contact_name text default null, p_contact_email text default null, p_contact_phone text default null,
  p_address text default null, p_city text default null, p_max_branches int default null
) returns void
  language plpgsql security definer set search_path to 'public'
as $$
begin
  if not public.is_platform_owner() then raise exception 'No autorizado'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'El nombre es obligatorio'; end if;

  update public.organizations set
    name          = trim(p_name),
    notes         = nullif(trim(coalesce(p_notes,'')), ''),
    legal_name    = nullif(trim(coalesce(p_legal_name,'')), ''),
    rut           = nullif(trim(coalesce(p_rut,'')), ''),
    contact_name  = nullif(trim(coalesce(p_contact_name,'')), ''),
    contact_email = nullif(trim(coalesce(p_contact_email,'')), ''),
    contact_phone = nullif(trim(coalesce(p_contact_phone,'')), ''),
    address       = nullif(trim(coalesce(p_address,'')), ''),
    city          = nullif(trim(coalesce(p_city,'')), ''),
    max_branches  = case when coalesce(p_max_branches, 0) > 0 then p_max_branches else null end
  where id = p_id;
  if not found then raise exception 'Organización no encontrada'; end if;

  perform public._platform_audit('update_organization', 'organization', p_id::text,
    jsonb_build_object('name', trim(p_name), 'max_branches', p_max_branches));
end;
$$;

revoke all on function public.platform_create_organization(text,text,text,text,text,text,text,text,text,int) from public, anon;
revoke all on function public.platform_update_organization(bigint,text,text,text,text,text,text,text,text,text,int) from public, anon;
grant execute on function public.platform_create_organization(text,text,text,text,text,text,text,text,text,int) to authenticated, service_role;
grant execute on function public.platform_update_organization(bigint,text,text,text,text,text,text,text,text,text,int) to authenticated, service_role;

-- get_my_organization: exponer max_branches al panel del cliente.
create or replace function public.get_my_organization()
  returns jsonb
  language plpgsql stable security definer set search_path to 'public'
as $$
declare v_rid bigint; v_org bigint;
begin
  if not public.current_user_is_admin() then raise exception 'No autorizado'; end if;
  v_rid := public.current_user_restaurant_id();
  select organization_id into v_org from public.restaurant_accounts where restaurant_id = v_rid;
  if v_org is null then return null; end if;

  return (
    select to_jsonb(x) from (
      select o.name, o.legal_name, o.rut, o.contact_name, o.contact_email,
             o.contact_phone, o.address, o.city, o.max_branches,
             (select count(*) from public.restaurant_accounts ra
               where ra.organization_id = o.id) as branches_count
      from public.organizations o where o.id = v_org
    ) x
  );
end;
$$;
revoke all on function public.get_my_organization() from public, anon;
grant execute on function public.get_my_organization() to authenticated, service_role;

-- platform_organization_detail_v2: exponer max_branches en 'organization'.
-- (Idéntica a 20260715170000; solo se agrega max_branches al sub-select.)
create or replace function public.platform_organization_detail_v2(p_org_id bigint)
returns jsonb
language plpgsql
stable security definer
set search_path to 'public'
as $$
declare v jsonb;
begin
  if not public.is_platform_owner() then raise exception 'No autorizado'; end if;

  select jsonb_build_object(
    'organization', (
      select to_jsonb(x) from (
        select id, name, notes, legal_name, rut, contact_name, contact_email,
               contact_phone, address, city, max_branches, created_at
        from public.organizations where id = p_org_id
      ) x
    ),
    'branches', (
      select coalesce(jsonb_agg(b order by b.restaurant_name), '[]'::jsonb) from (
        select
          r.id as restaurant_id,
          r.restaurant_name::text as restaurant_name,
          coalesce(ra.account_status, 'active') as account_status,
          ra.plan_id,
          p.name as plan_name,
          p.max_tables as plan_max_tables,
          ra.trial_ends_at,
          ra.account_manager,
          (select count(*) from public.tables t where t.restaurant_id = r.id) as tables_count,
          (select count(*) from public.orders o where o.restaurant_id = r.id) as orders_total,
          (select coalesce(sum(o.total), 0) from public.orders o
            where o.restaurant_id = r.id and o.status_id = 4) as revenue_total,
          (select coalesce(sum(o.total), 0) from public.orders o
            where o.restaurant_id = r.id and o.status_id = 4
              and o.created_at >= now() - interval '30 days') as revenue_30d,
          (select count(*) from public.onboarding_tasks ot
            where ot.restaurant_id = r.id and ot.done) as onboarding_done,
          (select count(*) from public.onboarding_tasks ot
            where ot.restaurant_id = r.id) as onboarding_total,
          (select count(*) from public.support_tickets st
            where st.restaurant_id = r.id and st.status in ('open','in_progress')) as open_tickets,
          exists(select 1 from public.service_contracts sc
            where sc.restaurant_id = r.id and sc.status = 'active') as has_active_contract
        from public.restaurant_accounts ra
        join public.restaurants r on r.id = ra.restaurant_id
        left join public.plans p on p.id = ra.plan_id
        where ra.organization_id = p_org_id
      ) b
    ),
    'contracts', (
      select coalesce(jsonb_agg(c order by c.created_at desc), '[]'::jsonb) from (
        select sc.id, sc.restaurant_id, r.restaurant_name::text as restaurant_name,
               sc.plan_id, sc.status, sc.one_time_amount, sc.support_monthly_amount,
               sc.has_support, sc.starts_on, sc.ends_on, sc.signed_at, sc.created_at
        from public.service_contracts sc
        join public.restaurant_accounts ra on ra.restaurant_id = sc.restaurant_id
        join public.restaurants r on r.id = sc.restaurant_id
        where ra.organization_id = p_org_id
      ) c
    ),
    'billing', (
      select coalesce(jsonb_agg(bi order by bi.due_date asc nulls last), '[]'::jsonb) from (
        select cb.id, cb.contract_id, r.restaurant_name::text as restaurant_name,
               cb.period_start, cb.period_end, cb.amount, cb.status, cb.due_date, cb.invoice_number
        from public.contract_billing cb
        join public.service_contracts sc on sc.id = cb.contract_id
        join public.restaurant_accounts ra on ra.restaurant_id = sc.restaurant_id
        join public.restaurants r on r.id = sc.restaurant_id
        where ra.organization_id = p_org_id
          and cb.status in ('pending','overdue')
        limit 25
      ) bi
    ),
    'tickets', (
      select coalesce(jsonb_agg(tk order by tk.created_at desc), '[]'::jsonb) from (
        select st.id, r.restaurant_name::text as restaurant_name, st.subject,
               st.priority, st.status, st.sla_due_at, st.created_at
        from public.support_tickets st
        join public.restaurant_accounts ra on ra.restaurant_id = st.restaurant_id
        join public.restaurants r on r.id = st.restaurant_id
        where ra.organization_id = p_org_id
          and st.status in ('open','in_progress')
        limit 25
      ) tk
    ),
    'timeseries', (
      select coalesce(jsonb_agg(ts order by ts.day), '[]'::jsonb) from (
        select d.day,
               count(o.id) as orders,
               coalesce(sum(o.total) filter (where o.status_id = 4), 0) as revenue
        from (
          select generate_series(
            (date_trunc('day', now()) - interval '29 days')::date,
            date_trunc('day', now())::date,
            interval '1 day'
          )::date as day
        ) d
        left join public.orders o
          on o.created_at::date = d.day
         and o.restaurant_id in (
           select ra.restaurant_id from public.restaurant_accounts ra
           where ra.organization_id = p_org_id
         )
        group by d.day
      ) ts
    ),
    'unassigned', (
      select coalesce(jsonb_agg(u order by u.restaurant_name), '[]'::jsonb) from (
        select r.id, r.restaurant_name::text as restaurant_name
        from public.restaurants r
        left join public.restaurant_accounts ra on ra.restaurant_id = r.id
        where ra.organization_id is null
      ) u
    )
  ) into v;

  if v->'organization' is null then raise exception 'Organización no encontrada'; end if;
  return v;
end;
$$;
revoke all on function public.platform_organization_detail_v2(bigint) from public, anon;
grant execute on function public.platform_organization_detail_v2(bigint) to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 9) update_my_organization: el cliente-dueño edita la ficha de SU grupo.
--    No toca el cupo (max_branches) ni las notas internas (las controla el operador).
-- ----------------------------------------------------------------------------
create or replace function public.update_my_organization(
  p_name text,
  p_legal_name text default null,
  p_rut text default null,
  p_contact_name text default null,
  p_contact_email text default null,
  p_contact_phone text default null,
  p_address text default null,
  p_city text default null
) returns void
  language plpgsql security definer set search_path to 'public'
as $$
declare v_rid bigint; v_org bigint;
begin
  if not public.current_user_is_admin() then raise exception 'No autorizado'; end if;
  v_rid := public.current_user_restaurant_id();
  select organization_id into v_org from public.restaurant_accounts where restaurant_id = v_rid;
  if v_org is null then raise exception 'Tu restaurante no pertenece a un grupo'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'El nombre del grupo es obligatorio'; end if;

  update public.organizations set
    name          = trim(p_name),
    legal_name    = nullif(trim(coalesce(p_legal_name,'')), ''),
    rut           = nullif(trim(coalesce(p_rut,'')), ''),
    contact_name  = nullif(trim(coalesce(p_contact_name,'')), ''),
    contact_email = nullif(trim(coalesce(p_contact_email,'')), ''),
    contact_phone = nullif(trim(coalesce(p_contact_phone,'')), ''),
    address       = nullif(trim(coalesce(p_address,'')), ''),
    city          = nullif(trim(coalesce(p_city,'')), '')
  where id = v_org;
end;
$$;
alter function public.update_my_organization(text, text, text, text, text, text, text, text) owner to postgres;
revoke all on function public.update_my_organization(text, text, text, text, text, text, text, text) from public, anon;
grant execute on function public.update_my_organization(text, text, text, text, text, text, text, text) to authenticated, service_role;

commit;
