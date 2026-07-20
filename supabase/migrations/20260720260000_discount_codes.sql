-- ============================================================================
-- DESCUENTOS (cupones) — backend.
-- El cliente genera códigos con reglas (día de la semana, franja horaria,
-- vigencia por fechas, alcance = toda la carta / categoría / producto, % o
-- monto fijo, mínimo de compra, límite de usos). Los cupones vigentes EN ESE
-- INSTANTE (hora de Chile) se muestran solos al comensal, que aplica uno al
-- enviar el pedido. El descuento NO afecta las líneas que ya están en promoción.
-- ============================================================================

create table if not exists public.discount_codes (
  id                bigint generated always as identity primary key,
  restaurant_id     bigint  not null references public.restaurants(id) on delete cascade,
  code              text    not null,
  description       text,
  discount_type     text    not null check (discount_type in ('percent','amount')),
  discount_value    integer not null check (discount_value >= 0),
  scope             text    not null default 'all' check (scope in ('all','category','product')),
  scope_category_id bigint  references public.categories(id) on delete cascade,
  scope_product_id  bigint  references public.products(id) on delete cascade,
  days_of_week      int[],           -- 0=domingo .. 6=sábado; null/[] = todos
  time_from         time,
  time_to           time,
  valid_from        date,
  valid_to          date,
  min_order_amount  integer,
  usage_limit       integer,
  used_count        integer not null default 0,
  active            boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create unique index if not exists uq_discount_codes_code
  on public.discount_codes (restaurant_id, lower(code));
create index if not exists idx_discount_codes_restaurant on public.discount_codes (restaurant_id);

alter table public.discount_codes enable row level security;
revoke all on public.discount_codes from anon, authenticated;

-- Descuento aplicado a cada pedido (0 si no hubo cupón).
alter table public.orders add column if not exists discount_amount  integer not null default 0;
alter table public.orders add column if not exists discount_code    text;
alter table public.orders add column if not exists discount_code_id bigint references public.discount_codes(id) on delete set null;

-- ----------------------------------------------------------------------------
-- ADMIN: listado del restaurante + flag "vigente ahora" (hora de Chile).
-- ----------------------------------------------------------------------------
create or replace function public.discount_list()
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare v_rid bigint; v_now timestamp; v_result jsonb;
begin
  if not public.current_user_is_admin() then raise exception 'No autorizado'; end if;
  v_rid := public.current_user_restaurant_id();
  if v_rid is null then raise exception 'Sin restaurante asociado'; end if;
  v_now := now() at time zone 'America/Santiago';

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',                d.id,
    'code',              d.code,
    'description',       d.description,
    'discount_type',     d.discount_type,
    'discount_value',    d.discount_value,
    'scope',             d.scope,
    'scope_category_id', d.scope_category_id,
    'scope_product_id',  d.scope_product_id,
    'days_of_week',      d.days_of_week,
    'time_from',         to_char(d.time_from, 'HH24:MI'),
    'time_to',           to_char(d.time_to, 'HH24:MI'),
    'valid_from',        d.valid_from,
    'valid_to',          d.valid_to,
    'min_order_amount',  d.min_order_amount,
    'usage_limit',       d.usage_limit,
    'used_count',        d.used_count,
    'active',            d.active,
    'available_now',     (
      d.active
      and (d.valid_from is null or v_now::date >= d.valid_from)
      and (d.valid_to   is null or v_now::date <= d.valid_to)
      and (d.days_of_week is null or array_length(d.days_of_week,1) is null
           or extract(dow from v_now)::int = any(d.days_of_week))
      and (
        d.time_from is null or d.time_to is null
        or (d.time_from <= d.time_to and v_now::time between d.time_from and d.time_to)
        or (d.time_from >  d.time_to and (v_now::time >= d.time_from or v_now::time <= d.time_to))
      )
      and (d.usage_limit is null or d.used_count < d.usage_limit)
    )
  ) order by d.created_at desc), '[]'::jsonb)
  into v_result
  from public.discount_codes d
  where d.restaurant_id = v_rid;

  return v_result;
end;
$$;

-- ----------------------------------------------------------------------------
-- ADMIN: crear/editar (upsert). p_id null = crear. Valida alcance/valores.
-- ----------------------------------------------------------------------------
create or replace function public.discount_save(
  p_id               bigint,
  p_code             text,
  p_description      text,
  p_discount_type    text,
  p_discount_value   integer,
  p_scope            text,
  p_scope_category_id bigint,
  p_scope_product_id bigint,
  p_days_of_week     int[],
  p_time_from        text,
  p_time_to          text,
  p_valid_from       date,
  p_valid_to         date,
  p_min_order_amount integer,
  p_usage_limit      integer,
  p_active           boolean
) returns bigint
language plpgsql security definer set search_path = public
as $$
declare
  v_rid bigint;
  v_id  bigint;
  v_cat bigint := null;
  v_prod bigint := null;
begin
  if not public.current_user_is_admin() then raise exception 'No autorizado'; end if;
  v_rid := public.current_user_restaurant_id();
  if v_rid is null then raise exception 'Sin restaurante asociado'; end if;

  if p_code is null or length(trim(p_code)) = 0 then raise exception 'El código es obligatorio'; end if;
  if p_discount_type not in ('percent','amount') then raise exception 'Tipo de descuento inválido'; end if;
  if p_discount_value is null or p_discount_value < 0 then raise exception 'Valor de descuento inválido'; end if;
  if p_discount_type = 'percent' and p_discount_value > 100 then raise exception 'El porcentaje no puede superar 100'; end if;
  if coalesce(p_scope,'all') not in ('all','category','product') then raise exception 'Alcance inválido'; end if;

  if p_scope = 'category' then
    if p_scope_category_id is null then raise exception 'Elegí una categoría para el alcance'; end if;
    perform 1 from public.categories where id = p_scope_category_id and restaurant_id = v_rid;
    if not found then raise exception 'La categoría no pertenece a tu restaurante'; end if;
    v_cat := p_scope_category_id;
  elsif p_scope = 'product' then
    if p_scope_product_id is null then raise exception 'Elegí un producto para el alcance'; end if;
    perform 1 from public.products where id = p_scope_product_id and restaurant_id = v_rid;
    if not found then raise exception 'El producto no pertenece a tu restaurante'; end if;
    v_prod := p_scope_product_id;
  end if;

  if p_id is null then
    insert into public.discount_codes
      (restaurant_id, code, description, discount_type, discount_value, scope,
       scope_category_id, scope_product_id, days_of_week, time_from, time_to,
       valid_from, valid_to, min_order_amount, usage_limit, active)
    values
      (v_rid, trim(p_code), nullif(trim(coalesce(p_description,'')),''), p_discount_type, p_discount_value,
       coalesce(p_scope,'all'), v_cat, v_prod, p_days_of_week,
       nullif(p_time_from,'')::time, nullif(p_time_to,'')::time,
       p_valid_from, p_valid_to, p_min_order_amount, p_usage_limit, coalesce(p_active,true))
    returning id into v_id;
  else
    update public.discount_codes set
      code = trim(p_code),
      description = nullif(trim(coalesce(p_description,'')),''),
      discount_type = p_discount_type,
      discount_value = p_discount_value,
      scope = coalesce(p_scope,'all'),
      scope_category_id = v_cat,
      scope_product_id = v_prod,
      days_of_week = p_days_of_week,
      time_from = nullif(p_time_from,'')::time,
      time_to = nullif(p_time_to,'')::time,
      valid_from = p_valid_from,
      valid_to = p_valid_to,
      min_order_amount = p_min_order_amount,
      usage_limit = p_usage_limit,
      active = coalesce(p_active,true),
      updated_at = now()
    where id = p_id and restaurant_id = v_rid
    returning id into v_id;
    if v_id is null then raise exception 'Cupón no encontrado'; end if;
  end if;

  return v_id;
exception when unique_violation then
  raise exception 'Ya existe un cupón con ese código';
end;
$$;

create or replace function public.discount_set_active(p_id bigint, p_active boolean)
returns void language plpgsql security definer set search_path = public
as $$
declare v_rid bigint;
begin
  if not public.current_user_is_admin() then raise exception 'No autorizado'; end if;
  v_rid := public.current_user_restaurant_id();
  update public.discount_codes set active = p_active, updated_at = now()
    where id = p_id and restaurant_id = v_rid;
  if not found then raise exception 'Cupón no encontrado'; end if;
end;
$$;

create or replace function public.discount_delete(p_id bigint)
returns void language plpgsql security definer set search_path = public
as $$
declare v_rid bigint;
begin
  if not public.current_user_is_admin() then raise exception 'No autorizado'; end if;
  v_rid := public.current_user_restaurant_id();
  delete from public.discount_codes where id = p_id and restaurant_id = v_rid;
  if not found then raise exception 'Cupón no encontrado'; end if;
end;
$$;

-- ----------------------------------------------------------------------------
-- COMENSAL (anon): cupones vigentes AHORA (hora de Chile) para el QR.
-- ----------------------------------------------------------------------------
create or replace function public.list_available_coupons_qr(p_qr_token text)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare v_rid bigint; v_now timestamp; v_result jsonb;
begin
  select restaurant_id into v_rid from public.resolve_qr_token(p_qr_token);
  if v_rid is null then raise exception 'QR no válido'; end if;
  v_now := now() at time zone 'America/Santiago';

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',               d.id,
    'code',             d.code,
    'description',      d.description,
    'discount_type',    d.discount_type,
    'discount_value',   d.discount_value,
    'scope',            d.scope,
    'scope_category_id', d.scope_category_id,
    'scope_product_id', d.scope_product_id,
    'min_order_amount', d.min_order_amount
  ) order by d.discount_value desc), '[]'::jsonb)
  into v_result
  from public.discount_codes d
  where d.restaurant_id = v_rid
    and d.active
    and (d.valid_from is null or v_now::date >= d.valid_from)
    and (d.valid_to   is null or v_now::date <= d.valid_to)
    and (d.days_of_week is null or array_length(d.days_of_week,1) is null
         or extract(dow from v_now)::int = any(d.days_of_week))
    and (
      d.time_from is null or d.time_to is null
      or (d.time_from <= d.time_to and v_now::time between d.time_from and d.time_to)
      or (d.time_from >  d.time_to and (v_now::time >= d.time_from or v_now::time <= d.time_to))
    )
    and (d.usage_limit is null or d.used_count < d.usage_limit);

  return v_result;
end;
$$;

-- Lockdown de grants.
revoke all on function public.discount_list()                    from public, anon;
revoke all on function public.discount_save(bigint,text,text,text,integer,text,bigint,bigint,int[],text,text,date,date,integer,integer,boolean) from public, anon;
revoke all on function public.discount_set_active(bigint,boolean) from public, anon;
revoke all on function public.discount_delete(bigint)            from public, anon;
grant execute on function public.discount_list()                    to authenticated, service_role;
grant execute on function public.discount_save(bigint,text,text,text,integer,text,bigint,bigint,int[],text,text,date,date,integer,integer,boolean) to authenticated, service_role;
grant execute on function public.discount_set_active(bigint,boolean) to authenticated, service_role;
grant execute on function public.discount_delete(bigint)            to authenticated, service_role;

revoke all on function public.list_available_coupons_qr(text) from public;
grant execute on function public.list_available_coupons_qr(text) to anon, authenticated, service_role;
