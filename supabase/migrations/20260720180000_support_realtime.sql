-- ============================================================================
-- SOPORTE EN VIVO: realtime para el hilo de mensajes (lado cliente)
--
-- Habilita que el panel del cliente reciba los mensajes del operador al instante
-- (sin refrescar), vía Supabase Realtime sobre support_ticket_messages.
--
-- Realtime respeta RLS: por eso se agrega una policy SELECT acotada que entrega
-- SOLO mensajes públicos (not internal) de tickets accesibles por el staff
-- (admin: todos los del restaurante; staff: los propios). Las notas internas del
-- operador NUNCA se exponen. El operador (portal) NO usa esta vía (ve el hilo por
-- RPC SECURITY DEFINER + auto-refresh), así que su RLS no cambia.
-- ============================================================================

begin;

-- Necesario para filtros/eventos de realtime.
alter table public.support_ticket_messages replica identity full;

-- Agregar a la publicación de realtime (idempotente).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public'
      and tablename = 'support_ticket_messages'
  ) then
    alter publication supabase_realtime add table public.support_ticket_messages;
  end if;
end $$;

-- El rol authenticated necesita el privilegio SELECT (fue revocado en deny-all)
-- para que la policy pueda entregar filas. La policy lo acota a lo público.
grant select on public.support_ticket_messages to authenticated;

-- El chequeo de alcance vive en una función SECURITY DEFINER: la policy no
-- puede leer support_tickets/users directamente (son deny-all para el rol
-- authenticated), así que se evalúan acá con privilegios de owner. Devuelve
-- true SOLO para mensajes públicos de tickets accesibles por el staff.
create or replace function public._support_msg_visible_to_staff(p_ticket_id bigint, p_internal boolean)
  returns boolean
  language sql
  stable
  security definer
  set search_path = public
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

commit;
