-- Módulo "Plataforma" del portal del operador: registro central de los
-- módulos visibles en el panel admin del cliente y en la app del mesero.
-- El operador los enciende/apaga desde el portal; las apps del cliente arman
-- su navegación consultando get_visible_modules(). Los módulos "locked" son
-- esenciales y no se pueden apagar (evita dejar al cliente sin operación).

create table if not exists public.platform_modules (
  area        text not null check (area in ('admin','waiter')),
  key         text not null,
  label       text not null,
  description text,
  enabled     boolean not null default true,
  locked      boolean not null default false,
  sort_order  integer not null default 0,
  updated_at  timestamptz not null default now(),
  primary key (area, key)
);

alter table public.platform_modules enable row level security;
revoke all on public.platform_modules from anon, authenticated;

insert into public.platform_modules (area, key, label, description, locked, sort_order) values
  ('admin','dashboard',   'Resumen',      'Inicio del panel con indicadores del día',            true,  10),
  ('admin','categories',  'Categorías',   'Categorías de la carta',                              false, 20),
  ('admin','products',    'Productos',    'Carta y precios',                                     false, 30),
  ('admin','inventory',   'Inventario',   'Stock y control de insumos',                          false, 40),
  ('admin','tables',      'Mesas',        'Mesas y códigos QR',                                  false, 50),
  ('admin','reservations','Reservas',     'Gestión de reservas (si el restaurante las activa)',  false, 60),
  ('admin','orders',      'Pedidos',      'Historial y estado de pedidos',                       false, 70),
  ('admin','waiters',     'Meseros',      'Equipo de sala y cocina',                             false, 80),
  ('admin','reports',     'Reportes',     'Ventas, márgenes y horas peak',                       false, 90),
  ('admin','printer',     'Impresora',    'Configuración de impresión de comandas',              false, 100),
  ('admin','screen',      'Pantalla',     'Pantalla de cocina (KDS)',                            false, 110),
  ('admin','settings',    'Ajustes',      'Configuración del restaurante',                       true,  120),
  ('admin','plan',        'Mi plan',      'Plan contratado y límites',                           false, 130),
  ('admin','pagos',       'Pagos',        'Datos tributarios y cobros en línea',                 false, 140),
  ('admin','api',         'API',          'API de inventario y claves',                          false, 150),
  ('admin','soporte',     'Soporte',      'Tickets de ayuda al equipo MESA',                     false, 160),
  ('admin','sucursales',  'Sucursales',   'Consolidado del grupo (plan Personalizado)',          false, 170),
  ('waiter','control',    'Pedidos en vivo', 'Workspace del mesero',                             true,  10),
  ('waiter','caja',       'Caja',         'Apertura y cierre de turno',                          false, 20),
  ('waiter','soporte',    'Soporte',      'Tickets de ayuda al equipo MESA',                     false, 30)
on conflict (area, key) do nothing;

-- OPERADOR: listado completo para el portal.
create or replace function public.platform_modules_list()
returns table(
  area text, key text, label text, description text,
  enabled boolean, locked boolean, sort_order integer, updated_at timestamptz
)
language plpgsql
stable security definer
set search_path to 'public'
as $$
begin
  if not public.is_platform_owner() then raise exception 'No autorizado'; end if;
  return query
  select m.area, m.key, m.label, m.description, m.enabled, m.locked, m.sort_order, m.updated_at
  from public.platform_modules m
  order by m.area, m.sort_order;
end;
$$;

-- OPERADOR: encender/apagar un módulo (los locked no se pueden apagar).
create or replace function public.platform_set_module_enabled(p_area text, p_key text, p_enabled boolean)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_locked boolean;
begin
  if not public.is_platform_owner() then raise exception 'No autorizado'; end if;

  select m.locked into v_locked from public.platform_modules m
  where m.area = p_area and m.key = p_key;
  if v_locked is null then raise exception 'Módulo no encontrado'; end if;
  if v_locked and not p_enabled then
    raise exception 'Este módulo es esencial y no se puede desactivar';
  end if;

  update public.platform_modules
  set enabled = p_enabled, updated_at = now()
  where area = p_area and key = p_key;

  perform public._platform_audit('set_module_enabled', 'module', p_area || ':' || p_key,
    jsonb_build_object('enabled', p_enabled));
end;
$$;

-- CLIENTE (cualquier staff autenticado): claves habilitadas por área para
-- armar la navegación. Fail-open en el front: si esto falla, se muestra todo.
create or replace function public.get_visible_modules()
returns jsonb
language plpgsql
stable security definer
set search_path to 'public'
as $$
declare s record;
begin
  select * into s from public._support_current_staff();
  if s.user_id is null then raise exception 'No autorizado'; end if;

  return jsonb_build_object(
    'admin', (
      select coalesce(jsonb_agg(m.key order by m.sort_order), '[]'::jsonb)
      from public.platform_modules m where m.area = 'admin' and m.enabled
    ),
    'waiter', (
      select coalesce(jsonb_agg(m.key order by m.sort_order), '[]'::jsonb)
      from public.platform_modules m where m.area = 'waiter' and m.enabled
    )
  );
end;
$$;

-- Lockdown.
revoke all on function public.platform_modules_list() from public, anon;
revoke all on function public.platform_set_module_enabled(text, text, boolean) from public, anon;
revoke all on function public.get_visible_modules() from public, anon;

grant execute on function public.platform_modules_list() to authenticated, service_role;
grant execute on function public.platform_set_module_enabled(text, text, boolean) to authenticated, service_role;
grant execute on function public.get_visible_modules() to authenticated, service_role;
