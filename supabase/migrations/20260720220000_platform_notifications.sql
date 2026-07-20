-- ============================================================================
-- FEED DE NOTIFICACIONES DEL PORTAL (operador)
--
-- RPC agregadora que alimenta la campana + toasts del portal. Reúne cuatro
-- fuentes en una sola lista ordenada por fecha (máx 40): soporte (tickets
-- abiertos / respuesta del cliente), cotizaciones nuevas (leads 'new'), cobranza
-- vencida (contract_billing overdue / pending vencida) y clientes nuevos
-- (restaurantes creados en los últimos 14 días). Guard is_platform_owner; sin
-- anon. El "no leído" lo deriva el cliente por timestamp (no se persiste aquí).
-- ============================================================================

create or replace function public.platform_notifications()
  returns jsonb
  language plpgsql
  stable
  security definer
  set search_path = public
as $$
declare v jsonb;
begin
  if not public.is_platform_owner() then raise exception 'No autorizado'; end if;

  with items as (
    -- SOPORTE: tickets abiertos / en curso
    select
      ('ticket:' || t.id)                                          as id,
      'support'                                                    as type,
      case when (
        select m.author_type from public.support_ticket_messages m
        where m.ticket_id = t.id order by m.created_at desc limit 1
      ) = 'customer' then 'Respuesta de cliente en soporte'
        else 'Ticket de soporte abierto' end                      as title,
      (coalesce(r.restaurant_name, 'General') || ' · ' || t.subject) as detail,
      t.updated_at                                                 as at,
      ('/soporte/' || t.id)                                        as href
    from public.support_tickets t
    left join public.restaurants r on r.id = t.restaurant_id
    where t.status in ('open', 'in_progress')

    union all
    -- COTIZACIONES nuevas (leads del formulario web)
    select
      ('lead:' || l.id), 'lead', 'Nueva cotización',
      coalesce(nullif(l.business_name, ''), l.name, l.email, 'Solicitud web'),
      l.created_at, ('/cotizaciones/' || l.id)
    from public.leads l
    where l.status = 'new'

    union all
    -- COBRANZA vencida
    select
      ('billing:' || cb.id), 'billing', 'Cobranza vencida',
      (r.restaurant_name || ' · $' || cb.amount::text),
      coalesce(cb.due_date, cb.period_end)::timestamptz, '/cobranza'
    from public.contract_billing cb
    join public.service_contracts sc on sc.id = cb.contract_id
    join public.restaurants r on r.id = sc.restaurant_id
    where cb.status = 'overdue'
       or (cb.status = 'pending' and cb.due_date is not null and cb.due_date < current_date)

    union all
    -- CLIENTES nuevos (últimos 14 días)
    select
      ('client:' || r.id), 'client', 'Nuevo cliente',
      r.restaurant_name::text,
      r.created_at::timestamptz, ('/restaurants/' || r.id)
    from public.restaurants r
    where r.created_at > (now() - interval '14 days')
  )
  select coalesce(jsonb_agg(to_jsonb(x) order by x.at desc), '[]'::jsonb) into v
  from (select * from items order by at desc limit 40) x;

  return v;
end;
$$;

alter function public.platform_notifications() owner to postgres;
revoke all on function public.platform_notifications() from public, anon;
grant execute on function public.platform_notifications() to authenticated, service_role;
