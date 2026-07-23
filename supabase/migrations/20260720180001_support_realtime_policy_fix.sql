-- Rescatada del historial remoto (aplicada vía MCP el 20-jul como 20260720165136).
-- Fix de la policy realtime de mensajes de soporte: la visibilidad staff se
-- resuelve vía función SECURITY DEFINER (la policy directa fallaba en realtime).

create or replace function public._support_msg_visible_to_staff(p_ticket_id bigint, p_internal boolean)
  returns boolean language sql stable security definer set search_path = public
as $$
  select (not p_internal) and exists (
    select 1
    from public.support_tickets t
    join public.users u on u.auth_user_id = auth.uid()
    where t.id = p_ticket_id
      and t.restaurant_id = u.restaurant_id
      and (u.role_id = 2 or t.requester_user_id = u.id)
  );
$$;
alter function public._support_msg_visible_to_staff(bigint, boolean) owner to postgres;
revoke all on function public._support_msg_visible_to_staff(bigint, boolean) from public, anon;
grant execute on function public._support_msg_visible_to_staff(bigint, boolean) to authenticated, service_role;

drop policy if exists "staff reads public ticket messages" on public.support_ticket_messages;
create policy "staff reads public ticket messages"
  on public.support_ticket_messages
  for select to authenticated
  using (public._support_msg_visible_to_staff(ticket_id, internal));
