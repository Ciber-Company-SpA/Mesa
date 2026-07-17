-- Carga de los "documentos" que el SII exige a cada emisor para emitir DTE:
-- el certificado digital (llave privada del representante legal) y los folios
-- CAF por tipo de documento. Son datos MUY sensibles: el contenido se guarda
-- CIFRADO en Supabase Vault (clave gestionada por Supabase); las tablas solo
-- guardan metadatos + el id del secreto en Vault, y son deny-all. El contenido
-- descifrado solo lo leerá el adaptador DTE real (service_role) al firmar/emitir;
-- nunca se expone al cliente.

create table if not exists public.restaurant_dte_credentials (
  restaurant_id           bigint primary key references public.restaurants(id) on delete cascade,
  cert_secret_id          uuid,
  cert_password_secret_id uuid,
  cert_filename           text,
  cert_expires_on         date,
  cert_uploaded_at        timestamptz,
  updated_at              timestamptz not null default now()
);
alter table public.restaurant_dte_credentials enable row level security;
revoke all on public.restaurant_dte_credentials from anon, authenticated;

create table if not exists public.restaurant_dte_caf (
  id             bigint generated always as identity primary key,
  restaurant_id  bigint not null references public.restaurants(id) on delete cascade,
  doc_type       integer not null,
  caf_secret_id  uuid not null,
  folio_desde    integer,
  folio_hasta    integer,
  filename       text,
  uploaded_at    timestamptz not null default now()
);
alter table public.restaurant_dte_caf enable row level security;
revoke all on public.restaurant_dte_caf from anon, authenticated;
create index if not exists restaurant_dte_caf_rid_idx on public.restaurant_dte_caf (restaurant_id, doc_type);

-- Guardar/reemplazar el certificado (base64 del .pfx) + su contraseña, cifrados.
create or replace function public.dte_save_certificate(
  p_cert_b64 text,
  p_password text,
  p_filename text,
  p_expires  date
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_rid bigint; v_ex record; v_cert uuid; v_pwd uuid; v_sfx text;
begin
  if not public.current_user_is_admin() then raise exception 'No autorizado'; end if;
  if coalesce(trim(p_cert_b64), '') = '' then raise exception 'Falta el archivo del certificado'; end if;
  v_rid := public.current_user_restaurant_id();
  v_sfx := v_rid::text || '_' || floor(extract(epoch from clock_timestamp()) * 1000)::bigint::text;

  select * into v_ex from public.restaurant_dte_credentials where restaurant_id = v_rid;
  if found then
    delete from vault.secrets where id in (v_ex.cert_secret_id, v_ex.cert_password_secret_id);
  end if;

  v_cert := vault.create_secret(p_cert_b64, 'dte_cert_' || v_sfx, 'Certificado DTE (.pfx base64)');
  v_pwd  := vault.create_secret(coalesce(p_password, ''), 'dte_certpwd_' || v_sfx, 'Contraseña del certificado DTE');

  insert into public.restaurant_dte_credentials
    (restaurant_id, cert_secret_id, cert_password_secret_id, cert_filename, cert_expires_on, cert_uploaded_at, updated_at)
  values (v_rid, v_cert, v_pwd, nullif(trim(coalesce(p_filename, '')), ''), p_expires, now(), now())
  on conflict (restaurant_id) do update set
    cert_secret_id = excluded.cert_secret_id,
    cert_password_secret_id = excluded.cert_password_secret_id,
    cert_filename = excluded.cert_filename,
    cert_expires_on = excluded.cert_expires_on,
    cert_uploaded_at = now(),
    updated_at = now();
end;
$$;

-- Borrar el certificado.
create or replace function public.dte_delete_certificate()
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_rid bigint; v_ex record;
begin
  if not public.current_user_is_admin() then raise exception 'No autorizado'; end if;
  v_rid := public.current_user_restaurant_id();
  select * into v_ex from public.restaurant_dte_credentials where restaurant_id = v_rid;
  if not found then return; end if;
  delete from vault.secrets where id in (v_ex.cert_secret_id, v_ex.cert_password_secret_id);
  delete from public.restaurant_dte_credentials where restaurant_id = v_rid;
end;
$$;

-- Agregar un archivo CAF (folios) cifrado.
create or replace function public.dte_save_caf(
  p_doc_type    integer,
  p_caf_b64     text,
  p_folio_desde integer,
  p_folio_hasta integer,
  p_filename    text
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_rid bigint; v_caf uuid; v_sfx text;
begin
  if not public.current_user_is_admin() then raise exception 'No autorizado'; end if;
  if p_doc_type not in (33, 34, 39, 41, 56, 61) then raise exception 'Tipo de documento inválido'; end if;
  if coalesce(trim(p_caf_b64), '') = '' then raise exception 'Falta el archivo CAF'; end if;
  v_rid := public.current_user_restaurant_id();
  v_sfx := v_rid::text || '_' || p_doc_type::text || '_' || floor(extract(epoch from clock_timestamp()) * 1000)::bigint::text;

  v_caf := vault.create_secret(p_caf_b64, 'dte_caf_' || v_sfx, 'CAF DTE');

  insert into public.restaurant_dte_caf
    (restaurant_id, doc_type, caf_secret_id, folio_desde, folio_hasta, filename, uploaded_at)
  values (v_rid, p_doc_type, v_caf, p_folio_desde, p_folio_hasta,
          nullif(trim(coalesce(p_filename, '')), ''), now());
end;
$$;

-- Borrar un CAF.
create or replace function public.dte_delete_caf(p_id bigint)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_rid bigint; v_sid uuid;
begin
  if not public.current_user_is_admin() then raise exception 'No autorizado'; end if;
  v_rid := public.current_user_restaurant_id();
  select caf_secret_id into v_sid from public.restaurant_dte_caf where id = p_id and restaurant_id = v_rid;
  if v_sid is null then raise exception 'CAF no encontrado'; end if;
  delete from vault.secrets where id = v_sid;
  delete from public.restaurant_dte_caf where id = p_id and restaurant_id = v_rid;
end;
$$;

-- Metadatos (NUNCA el secreto) para mostrar el estado en el panel.
create or replace function public.get_my_dte_credentials()
returns jsonb
language plpgsql
stable security definer
set search_path to 'public'
as $$
declare v_rid bigint; v jsonb;
begin
  if not public.current_user_is_admin() then raise exception 'No autorizado'; end if;
  v_rid := public.current_user_restaurant_id();
  select jsonb_build_object(
    'certificate', (
      select case when c.cert_secret_id is not null then jsonb_build_object(
        'filename', c.cert_filename, 'expires_on', c.cert_expires_on, 'uploaded_at', c.cert_uploaded_at
      ) else null end
      from public.restaurant_dte_credentials c where c.restaurant_id = v_rid
    ),
    'caf', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', k.id, 'doc_type', k.doc_type, 'folio_desde', k.folio_desde,
        'folio_hasta', k.folio_hasta, 'filename', k.filename, 'uploaded_at', k.uploaded_at
      ) order by k.doc_type, k.folio_desde), '[]'::jsonb)
      from public.restaurant_dte_caf k where k.restaurant_id = v_rid
    )
  ) into v;
  return v;
end;
$$;

revoke all on function public.dte_save_certificate(text, text, text, date) from public, anon;
revoke all on function public.dte_delete_certificate() from public, anon;
revoke all on function public.dte_save_caf(integer, text, integer, integer, text) from public, anon;
revoke all on function public.dte_delete_caf(bigint) from public, anon;
revoke all on function public.get_my_dte_credentials() from public, anon;

grant execute on function public.dte_save_certificate(text, text, text, date) to authenticated, service_role;
grant execute on function public.dte_delete_certificate() to authenticated, service_role;
grant execute on function public.dte_save_caf(integer, text, integer, integer, text) to authenticated, service_role;
grant execute on function public.dte_delete_caf(bigint) to authenticated, service_role;
grant execute on function public.get_my_dte_credentials() to authenticated, service_role;
