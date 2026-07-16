-- Capa de abstracción de DTE (documentos tributarios electrónicos).
-- La lógica de emisión vive en la app (src/lib/dte, con adaptadores
-- intercambiables: hoy simulado, mañana LibreDTE/SimpleAPI/SII directo). Estos
-- RPCs son la persistencia con guard: la tabla tax_documents es deny-all, así
-- que solo el admin del restaurante escribe/lee SUS documentos, y el
-- restaurant_id se toma de la sesión (nunca del cliente).

-- Registrar un documento emitido (o en trámite).
create or replace function public.dte_record_document(
  p_doc_type       integer,
  p_net            integer,
  p_iva            integer,
  p_total          integer,
  p_receptor_rut   text,
  p_receptor_razon text,
  p_receptor_giro  text,
  p_receptor_dir   text,
  p_sii_status     text,
  p_folio          bigint,
  p_track_id       text,
  p_pdf_url        text,
  p_xml_url        text,
  p_payment_id     bigint
)
returns bigint
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_rid bigint; v_id bigint;
begin
  if not public.current_user_is_admin() then raise exception 'No autorizado'; end if;
  v_rid := public.current_user_restaurant_id();
  if v_rid is null then raise exception 'Sin restaurante asociado'; end if;
  if p_doc_type not in (33, 34, 39, 41, 56, 61) then raise exception 'Tipo de documento inválido'; end if;

  insert into public.tax_documents
    (payment_id, restaurant_id, doc_type, folio, net, iva, total,
     receptor_rut, receptor_razon, receptor_giro, receptor_dir,
     sii_status, track_id, pdf_url, xml_url, emitted_at)
  values (
    p_payment_id, v_rid, p_doc_type, p_folio, p_net, p_iva, p_total,
    nullif(trim(coalesce(p_receptor_rut, '')), ''),
    nullif(trim(coalesce(p_receptor_razon, '')), ''),
    nullif(trim(coalesce(p_receptor_giro, '')), ''),
    nullif(trim(coalesce(p_receptor_dir, '')), ''),
    coalesce(nullif(trim(coalesce(p_sii_status, '')), ''), 'pending'),
    p_track_id, p_pdf_url, p_xml_url,
    case when p_sii_status = 'accepted' then now() else null end
  )
  returning id into v_id;

  return v_id;
end;
$$;

-- Actualizar el estado (lo usa el worker de sondeo cuando el proveedor/SII
-- resuelve un documento que quedó 'pending').
create or replace function public.dte_update_status(
  p_id         bigint,
  p_sii_status text,
  p_folio      bigint,
  p_pdf_url    text,
  p_xml_url    text
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_rid bigint;
begin
  if not public.current_user_is_admin() then raise exception 'No autorizado'; end if;
  v_rid := public.current_user_restaurant_id();

  update public.tax_documents set
    sii_status = coalesce(nullif(trim(coalesce(p_sii_status, '')), ''), sii_status),
    folio      = coalesce(p_folio, folio),
    pdf_url    = coalesce(p_pdf_url, pdf_url),
    xml_url    = coalesce(p_xml_url, xml_url),
    emitted_at = case when p_sii_status = 'accepted' and emitted_at is null then now() else emitted_at end
  where id = p_id and restaurant_id = v_rid;
  if not found then raise exception 'Documento no encontrado'; end if;
end;
$$;

-- Listado de documentos del restaurante del admin.
create or replace function public.get_my_tax_documents()
returns setof public.tax_documents
language plpgsql
stable security definer
set search_path to 'public'
as $$
declare v_rid bigint;
begin
  if not public.current_user_is_admin() then raise exception 'No autorizado'; end if;
  v_rid := public.current_user_restaurant_id();
  return query
    select * from public.tax_documents
    where restaurant_id = v_rid
    order by created_at desc;
end;
$$;

revoke all on function public.dte_record_document(integer, integer, integer, integer, text, text, text, text, text, bigint, text, text, text, bigint) from public, anon;
revoke all on function public.dte_update_status(bigint, text, bigint, text, text) from public, anon;
revoke all on function public.get_my_tax_documents() from public, anon;

grant execute on function public.dte_record_document(integer, integer, integer, integer, text, text, text, text, text, bigint, text, text, text, bigint) to authenticated, service_role;
grant execute on function public.dte_update_status(bigint, text, bigint, text, text) to authenticated, service_role;
grant execute on function public.get_my_tax_documents() to authenticated, service_role;
