-- Logo del emisor para las boletas y facturas: se carga en Datos tributarios y
-- se aplica a la representación de los documentos. get_my_tax_profile devuelve
-- to_jsonb de la fila, así que la nueva columna se incluye automáticamente.
alter table public.restaurant_tax_profile
  add column if not exists logo_url text;

-- upsert con el nuevo campo (se agrega parámetro -> hay que recrear la función).
drop function if exists public.upsert_my_tax_profile(text, text, text, text, text, text, text);

create or replace function public.upsert_my_tax_profile(
  p_rut text,
  p_razon text,
  p_giro text,
  p_direccion text,
  p_comuna text,
  p_actividad text,
  p_regimen text,
  p_logo_url text default null
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_rid bigint;
begin
  if not public.current_user_is_admin() then raise exception 'No autorizado'; end if;
  v_rid := public.current_user_restaurant_id();
  insert into public.restaurant_tax_profile
    (restaurant_id, rut, razon_social, giro, direccion, comuna, actividad_economica, regimen_iva, logo_url, updated_at)
  values (v_rid, p_rut, p_razon, p_giro, p_direccion, p_comuna, p_actividad, p_regimen,
          nullif(trim(coalesce(p_logo_url, '')), ''), now())
  on conflict (restaurant_id) do update set
    rut = excluded.rut, razon_social = excluded.razon_social, giro = excluded.giro,
    direccion = excluded.direccion, comuna = excluded.comuna,
    actividad_economica = excluded.actividad_economica, regimen_iva = excluded.regimen_iva,
    logo_url = excluded.logo_url, updated_at = now();
end;
$function$;

revoke all on function public.upsert_my_tax_profile(text, text, text, text, text, text, text, text) from public, anon;
grant execute on function public.upsert_my_tax_profile(text, text, text, text, text, text, text, text) to authenticated, service_role;
