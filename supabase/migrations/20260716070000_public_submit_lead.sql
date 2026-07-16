-- Cotizaciones/contactos desde la web pública: el formulario de /demo debe
-- llegar al módulo Leads del portal. Hoy solo se enviaba por correo. Este RPC
-- público (SECURITY DEFINER) inserta el lead en public.leads con estado 'new';
-- anon puede ejecutarlo pero NO tiene acceso directo a la tabla (RLS deny-all),
-- así que no puede leer ni enumerar leads. El anti-spam por IP vive en la app.
create or replace function public.submit_lead(
  p_name          text,
  p_business_name text,
  p_email         text,
  p_phone         text,
  p_business_type text,
  p_city          text,
  p_message       text,
  p_plan_interest text
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if coalesce(trim(p_name), '') = '' or coalesce(trim(p_email), '') = '' then
    raise exception 'Datos insuficientes';
  end if;
  -- Cotas defensivas de longitud (además de la validación Zod en la app).
  if length(p_name) > 100 or length(p_email) > 150 or length(coalesce(p_message, '')) > 1000 then
    raise exception 'Datos inválidos';
  end if;

  insert into public.leads
    (name, business_name, email, phone, business_type, city, message, plan_interest, status)
  values (
    trim(p_name),
    nullif(trim(coalesce(p_business_name, '')), ''),
    trim(p_email),
    nullif(trim(coalesce(p_phone, '')), ''),
    nullif(trim(coalesce(p_business_type, '')), ''),
    nullif(trim(coalesce(p_city, '')), ''),
    nullif(trim(coalesce(p_message, '')), ''),
    nullif(trim(coalesce(p_plan_interest, '')), ''),
    'new'
  );
end;
$$;

-- Público (el formulario web es anónimo). El RPC es el único acceso; la tabla
-- sigue deny-all para anon.
revoke all on function public.submit_lead(text, text, text, text, text, text, text, text) from public;
grant execute on function public.submit_lead(text, text, text, text, text, text, text, text) to anon, authenticated, service_role;
