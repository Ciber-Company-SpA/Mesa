-- ============================================================================
-- Atender automáticamente las llamadas "pedir la cuenta" al cobrar la mesa.
--
-- Problema:
--   service_calls permite UNA sola llamada pendiente por mesa (índice único
--   parcial). Si el mesero cobra la mesa sin tocar la tarjeta de la llamada,
--   la llamada queda 'pending' para siempre y bloquea todas las llamadas
--   futuras de esa mesa: request_bill_qr devuelve already_pending y al panel
--   del mesero no le llega ningún evento nuevo.
--
-- Solución:
--   Trigger en orders: cuando una orden pasa a PAGADO (4) y la mesa queda sin
--   órdenes activas (1=Nuevo, 2=Preparando, 3=Listo) — la misma condición que
--   ya libera la mesa — se marcan como atendidas las llamadas pendientes de
--   esa mesa. Cubre los tres flujos de cobro (markOrderAsPaid,
--   markTableOrdersAsPaid y pay_diner_orders) sin tocar el frontend.
--   attended_by queda NULL: lo cerró el sistema, no un mesero.
-- ============================================================================

begin;

create or replace function public.attend_service_calls_on_table_paid()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status_id = 4
     and old.status_id is distinct from 4
     and new.table_id is not null then

    if not exists (
      select 1
      from public.orders o
      where o.table_id = new.table_id
        and o.status_id in (1, 2, 3)
    ) then
      update public.service_calls
      set status = 'attended',
          attended_at = now()
      where table_id = new.table_id
        and status = 'pending';
    end if;
  end if;

  return new;
end;
$$;

alter function public.attend_service_calls_on_table_paid() owner to postgres;
revoke all on function public.attend_service_calls_on_table_paid() from public;

drop trigger if exists attend_service_calls_on_table_paid_trg on public.orders;
create trigger attend_service_calls_on_table_paid_trg
  after update of status_id on public.orders
  for each row
  execute function public.attend_service_calls_on_table_paid();

commit;
