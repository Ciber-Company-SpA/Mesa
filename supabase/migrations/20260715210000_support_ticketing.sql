-- Ticketera de soporte real: los tickets nacen en el panel del restaurante
-- (admin) o en la app del mesero, y el portal del operador los atiende con un
-- hilo de conversación (respuestas públicas y notas internas), primera
-- respuesta y reapertura automática. RLS deny-all; todo pasa por RPCs con
-- SECURITY DEFINER + guards.

-- 1) Origen y ciclo de vida del ticket.
alter table public.support_tickets
  add column if not exists requester_user_id bigint references public.users(id) on delete set null,
  add column if not exists requester_name    text,
  add column if not exists requester_role    text,
  add column if not exists channel           text not null default 'portal',
  add column if not exists category          text,
  add column if not exists first_response_at timestamptz,
  add column if not exists updated_at        timestamptz not null default now();

-- 2) Hilo de conversación.
create table if not exists public.support_ticket_messages (
  id          bigint generated always as identity primary key,
  ticket_id   bigint not null references public.support_tickets(id) on delete cascade,
  author_type text not null check (author_type in ('customer','operator')),
  author_name text,
  body        text not null,
  internal    boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists support_ticket_messages_ticket_idx
  on public.support_ticket_messages (ticket_id, created_at);

alter table public.support_ticket_messages enable row level security;
revoke all on public.support_ticket_messages from anon, authenticated;

-- Contexto del usuario staff que llama (cualquier rol del restaurante).
create or replace function public._support_current_staff()
returns table(user_id bigint, restaurant_id bigint, user_name text, role_id integer)
language sql
stable security definer
set search_path to 'public'
as $$
  select u.id, u.restaurant_id, u.user_name::text, u.role_id::integer
  from public.users u
  where u.auth_user_id = auth.uid()
  limit 1;
$$;

-- 3) CLIENTE: crear ticket desde el panel admin o la app del mesero.
create or replace function public.create_support_ticket(
  p_subject text,
  p_description text,
  p_category text default null,
  p_priority text default 'medium'
)
returns bigint
language plpgsql
security definer
set search_path to 'public'
as $$
declare s record; v_id bigint; v_channel text;
begin
  select * into s from public._support_current_staff();
  if s.user_id is null then raise exception 'No autorizado'; end if;
  if coalesce(trim(p_subject), '') = '' then raise exception 'El asunto es obligatorio'; end if;

  v_channel := case s.role_id when 2 then 'admin' when 1 then 'waiter' else 'staff' end;

  insert into public.support_tickets
    (restaurant_id, subject, description, priority, category, channel,
     requester_user_id, requester_name, requester_role, status)
  values
    (s.restaurant_id, trim(p_subject), nullif(trim(coalesce(p_description,'')), ''),
     case when p_priority in ('low','medium','high','urgent') then p_priority else 'medium' end,
     nullif(trim(coalesce(p_category,'')), ''), v_channel,
     s.user_id, s.user_name,
     case s.role_id when 2 then 'Administrador' when 1 then 'Mesero' when 3 then 'Cocina' else 'Staff' end,
     'open')
  returning id into v_id;

  if coalesce(trim(p_description), '') <> '' then
    insert into public.support_ticket_messages (ticket_id, author_type, author_name, body)
    values (v_id, 'customer', s.user_name, trim(p_description));
  end if;

  return v_id;
end;
$$;

-- 4) CLIENTE: listado. El admin ve todos los tickets de su restaurante;
--    el resto del staff solo los propios.
create or replace function public.list_my_support_tickets()
returns table(
  id bigint, subject text, category text, priority text, status text,
  channel text, requester_name text, created_at timestamptz,
  updated_at timestamptz, resolved_at timestamptz, messages_count bigint,
  last_from text
)
language plpgsql
stable security definer
set search_path to 'public'
as $$
declare s record;
begin
  select * into s from public._support_current_staff();
  if s.user_id is null then raise exception 'No autorizado'; end if;

  return query
  select t.id, t.subject, t.category, t.priority, t.status, t.channel,
    t.requester_name, t.created_at, t.updated_at, t.resolved_at,
    (select count(*) from public.support_ticket_messages m
      where m.ticket_id = t.id and not m.internal),
    (select m.author_type from public.support_ticket_messages m
      where m.ticket_id = t.id and not m.internal
      order by m.created_at desc limit 1)
  from public.support_tickets t
  where t.restaurant_id = s.restaurant_id
    and (s.role_id = 2 or t.requester_user_id = s.user_id)
  order by
    case t.status when 'open' then 0 when 'in_progress' then 1 else 2 end,
    t.updated_at desc;
end;
$$;

-- 5) CLIENTE: detalle con hilo (sin notas internas).
create or replace function public.get_my_support_ticket(p_ticket_id bigint)
returns jsonb
language plpgsql
stable security definer
set search_path to 'public'
as $$
declare s record; v jsonb;
begin
  select * into s from public._support_current_staff();
  if s.user_id is null then raise exception 'No autorizado'; end if;

  select jsonb_build_object(
    'ticket', to_jsonb(t),
    'messages', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', m.id, 'author_type', m.author_type, 'author_name', m.author_name,
        'body', m.body, 'created_at', m.created_at
      ) order by m.created_at), '[]'::jsonb)
      from public.support_ticket_messages m
      where m.ticket_id = t.id and not m.internal
    )
  ) into v
  from (
    select t.id, t.subject, t.description, t.category, t.priority, t.status,
           t.channel, t.requester_name, t.created_at, t.updated_at, t.resolved_at
    from public.support_tickets t
    where t.id = p_ticket_id
      and t.restaurant_id = s.restaurant_id
      and (s.role_id = 2 or t.requester_user_id = s.user_id)
  ) t;

  if v is null then raise exception 'Ticket no encontrado'; end if;
  return v;
end;
$$;

-- 6) CLIENTE: responder. Si el ticket estaba resuelto/cerrado, se reabre.
create or replace function public.reply_my_support_ticket(p_ticket_id bigint, p_body text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare s record; v_status text;
begin
  select * into s from public._support_current_staff();
  if s.user_id is null then raise exception 'No autorizado'; end if;
  if coalesce(trim(p_body), '') = '' then raise exception 'El mensaje no puede estar vacío'; end if;

  select t.status into v_status
  from public.support_tickets t
  where t.id = p_ticket_id
    and t.restaurant_id = s.restaurant_id
    and (s.role_id = 2 or t.requester_user_id = s.user_id);
  if v_status is null then raise exception 'Ticket no encontrado'; end if;

  insert into public.support_ticket_messages (ticket_id, author_type, author_name, body)
  values (p_ticket_id, 'customer', s.user_name, trim(p_body));

  update public.support_tickets set
    updated_at = now(),
    status = case when status in ('resolved','closed') then 'open' else status end,
    resolved_at = case when status in ('resolved','closed') then null else resolved_at end
  where id = p_ticket_id;
end;
$$;

-- 7) OPERADOR: detalle completo (incluye notas internas y datos del solicitante).
create or replace function public.platform_ticket_detail(p_id bigint)
returns jsonb
language plpgsql
stable security definer
set search_path to 'public'
as $$
declare v jsonb;
begin
  if not public.is_platform_owner() then raise exception 'No autorizado'; end if;

  select jsonb_build_object(
    'ticket', (
      select to_jsonb(x) from (
        select t.id, t.restaurant_id, r.restaurant_name::text as restaurant_name,
               t.subject, t.description, t.category, t.priority, t.status,
               t.channel, t.requester_name, t.requester_role, t.assigned_to,
               t.sla_due_at, t.first_response_at, t.created_at, t.updated_at, t.resolved_at
        from public.support_tickets t
        left join public.restaurants r on r.id = t.restaurant_id
        where t.id = p_id
      ) x
    ),
    'messages', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', m.id, 'author_type', m.author_type, 'author_name', m.author_name,
        'body', m.body, 'internal', m.internal, 'created_at', m.created_at
      ) order by m.created_at), '[]'::jsonb)
      from public.support_ticket_messages m where m.ticket_id = p_id
    )
  ) into v;

  if v->'ticket' is null then raise exception 'Ticket no encontrado'; end if;
  return v;
end;
$$;

-- 8) OPERADOR: responder (público o nota interna). Registra primera respuesta
--    y pasa open→in_progress al responder en público.
create or replace function public.platform_ticket_reply(p_id bigint, p_body text, p_internal boolean default false)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_email text;
begin
  if not public.is_platform_owner() then raise exception 'No autorizado'; end if;
  if coalesce(trim(p_body), '') = '' then raise exception 'El mensaje no puede estar vacío'; end if;
  if not exists (select 1 from public.support_tickets t where t.id = p_id) then
    raise exception 'Ticket no encontrado';
  end if;

  v_email := coalesce(nullif(auth.jwt() ->> 'email', ''), 'Soporte MESA');

  insert into public.support_ticket_messages (ticket_id, author_type, author_name, body, internal)
  values (p_id, 'operator', v_email, trim(p_body), coalesce(p_internal, false));

  update public.support_tickets set
    updated_at = now(),
    first_response_at = case
      when first_response_at is null and not coalesce(p_internal, false) then now()
      else first_response_at end,
    status = case
      when status = 'open' and not coalesce(p_internal, false) then 'in_progress'
      else status end
  where id = p_id;

  perform public._platform_audit('reply_ticket', 'ticket', p_id::text,
    jsonb_build_object('internal', coalesce(p_internal, false)));
end;
$$;

-- 9) OPERADOR: editar propiedades del ticket.
create or replace function public.platform_update_ticket(
  p_id bigint,
  p_priority text,
  p_category text,
  p_assigned_to text,
  p_sla_due_at timestamptz
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not public.is_platform_owner() then raise exception 'No autorizado'; end if;

  update public.support_tickets set
    priority    = case when p_priority in ('low','medium','high','urgent') then p_priority else priority end,
    category    = nullif(trim(coalesce(p_category,'')), ''),
    assigned_to = nullif(trim(coalesce(p_assigned_to,'')), ''),
    sla_due_at  = p_sla_due_at,
    updated_at  = now()
  where id = p_id;
  if not found then raise exception 'Ticket no encontrado'; end if;

  perform public._platform_audit('update_ticket', 'ticket', p_id::text,
    jsonb_build_object('priority', p_priority, 'assigned_to', p_assigned_to));
end;
$$;

-- 10) Lista del operador enriquecida (canal, categoría, solicitante, hilo).
drop function if exists public.platform_tickets_list();

create or replace function public.platform_tickets_list()
returns table(
  id bigint, restaurant_id bigint, restaurant_name text, subject text,
  description text, priority text, status text, channel text, category text,
  requester_name text, assigned_to text, sla_due_at timestamptz,
  first_response_at timestamptz, created_at timestamptz, updated_at timestamptz,
  resolved_at timestamptz, messages_count bigint, last_from text
)
language plpgsql
stable security definer
set search_path to 'public'
as $$
begin
  if not public.is_platform_owner() then raise exception 'No autorizado'; end if;
  return query
  select t.id, t.restaurant_id, r.restaurant_name::text, t.subject, t.description,
    t.priority, t.status, t.channel, t.category, t.requester_name, t.assigned_to,
    t.sla_due_at, t.first_response_at, t.created_at, t.updated_at, t.resolved_at,
    (select count(*) from public.support_ticket_messages m where m.ticket_id = t.id),
    (select m.author_type from public.support_ticket_messages m
      where m.ticket_id = t.id order by m.created_at desc limit 1)
  from public.support_tickets t
  left join public.restaurants r on r.id = t.restaurant_id
  order by
    case t.status when 'open' then 0 when 'in_progress' then 1 else 2 end,
    case t.priority when 'urgent' then 0 when 'high' then 1 when 'medium' then 2 else 3 end,
    t.updated_at desc;
end;
$$;

-- Lockdown.
revoke all on function public._support_current_staff() from public, anon, authenticated;
revoke all on function public.create_support_ticket(text, text, text, text) from public, anon;
revoke all on function public.list_my_support_tickets() from public, anon;
revoke all on function public.get_my_support_ticket(bigint) from public, anon;
revoke all on function public.reply_my_support_ticket(bigint, text) from public, anon;
revoke all on function public.platform_ticket_detail(bigint) from public, anon;
revoke all on function public.platform_ticket_reply(bigint, text, boolean) from public, anon;
revoke all on function public.platform_update_ticket(bigint, text, text, text, timestamptz) from public, anon;
revoke all on function public.platform_tickets_list() from public, anon;

grant execute on function public.create_support_ticket(text, text, text, text) to authenticated, service_role;
grant execute on function public.list_my_support_tickets() to authenticated, service_role;
grant execute on function public.get_my_support_ticket(bigint) to authenticated, service_role;
grant execute on function public.reply_my_support_ticket(bigint, text) to authenticated, service_role;
grant execute on function public.platform_ticket_detail(bigint) to authenticated, service_role;
grant execute on function public.platform_ticket_reply(bigint, text, boolean) to authenticated, service_role;
grant execute on function public.platform_update_ticket(bigint, text, text, text, timestamptz) to authenticated, service_role;
grant execute on function public.platform_tickets_list() to authenticated, service_role;
