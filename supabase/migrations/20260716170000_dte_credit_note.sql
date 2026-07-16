-- Anulación de facturas mediante Nota de Crédito electrónica (DTE tipo 61).
-- En Chile no se "borra" un DTE aceptado: se emite una nota de crédito que deja
-- sin efecto el documento original, referenciándolo. El bloque Referencia exige:
-- TpoDocRef (33/34), FolioRef, FchRef, CodRef (1=Anula, 2=Corrige texto,
-- 3=Corrige montos) y RazonRef. Para anulación total: CodRef=1 y montos = los
-- del documento original.

alter table public.tax_documents
  add column if not exists voided           boolean not null default false,
  add column if not exists voided_by_doc_id bigint,
  add column if not exists ref_doc_type     integer,
  add column if not exists ref_folio        bigint,
  add column if not exists ref_code         integer,
  add column if not exists ref_reason       text;

-- Emite (registra) la NC que anula una factura y marca la factura como anulada,
-- en una sola transacción. La emisión contra el proveedor/adaptador ocurre en la
-- app; acá se persiste el resultado copiando montos y receptor del original.
create or replace function public.dte_annul_with_credit_note(
  p_original_id bigint,
  p_reason      text,
  p_sii_status  text,
  p_folio       bigint,
  p_track_id    text,
  p_pdf_url     text,
  p_xml_url     text
)
returns bigint
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_rid bigint; o public.tax_documents; v_nc_id bigint;
begin
  if not public.current_user_is_admin() then raise exception 'No autorizado'; end if;
  v_rid := public.current_user_restaurant_id();

  select * into o from public.tax_documents where id = p_original_id and restaurant_id = v_rid;
  if not found then raise exception 'Documento no encontrado'; end if;
  if o.doc_type not in (33, 34) then
    raise exception 'Solo se anula una factura mediante nota de crédito';
  end if;
  if o.voided then raise exception 'La factura ya fue anulada'; end if;

  insert into public.tax_documents
    (payment_id, restaurant_id, doc_type, folio, net, iva, total,
     receptor_rut, receptor_razon, receptor_giro, receptor_dir,
     sii_status, track_id, pdf_url, xml_url, emitted_at,
     ref_doc_type, ref_folio, ref_code, ref_reason)
  values
    (o.payment_id, v_rid, 61, p_folio, o.net, o.iva, o.total,
     o.receptor_rut, o.receptor_razon, o.receptor_giro, o.receptor_dir,
     coalesce(nullif(trim(coalesce(p_sii_status, '')), ''), 'pending'),
     p_track_id, p_pdf_url, p_xml_url,
     case when p_sii_status = 'accepted' then now() else null end,
     o.doc_type, o.folio, 1, nullif(trim(coalesce(p_reason, '')), ''))
  returning id into v_nc_id;

  update public.tax_documents
    set voided = true, voided_by_doc_id = v_nc_id
    where id = p_original_id;

  return v_nc_id;
end;
$$;

revoke all on function public.dte_annul_with_credit_note(bigint, text, text, bigint, text, text, text) from public, anon;
grant execute on function public.dte_annul_with_credit_note(bigint, text, text, bigint, text, text, text) to authenticated, service_role;
