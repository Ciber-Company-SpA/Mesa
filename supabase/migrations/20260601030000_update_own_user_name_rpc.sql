-- RPC para que un usuario pueda actualizar su propio user_name sin abrir
-- update genérico en public.users (que permitiría escalada a role_id=2).

begin;

create or replace function public.update_own_user_name(p_user_name text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_name text;
begin
  if auth.uid() is null then
    raise exception 'No autorizado';
  end if;

  v_name := trim(coalesce(p_user_name, ''));
  if v_name = '' then
    raise exception 'El nombre no puede estar vacío';
  end if;
  if length(v_name) > 60 then
    raise exception 'Máximo 60 caracteres';
  end if;

  update public.users
  set user_name = v_name
  where auth_user_id = auth.uid();
end;
$$;

revoke all on function public.update_own_user_name(text) from public;
grant execute on function public.update_own_user_name(text) to authenticated;

commit;
