-- Sincroniza borrados entre auth.users y public.users en ambas direcciones.
-- 1. FK con ON DELETE CASCADE: borrar de auth.users limpia public.users.
-- 2. Trigger AFTER DELETE en public.users: borrar de public.users limpia auth.users.

begin;

alter table public.users
  drop constraint if exists users_auth_user_id_fkey;

alter table public.users
  add constraint users_auth_user_id_fkey
  foreign key (auth_user_id) references auth.users(id) on delete cascade;

create or replace function public.handle_user_deletion()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'auth'
as $$
begin
  if old.auth_user_id is not null then
    delete from auth.users where id = old.auth_user_id;
  end if;
  return old;
end;
$$;

drop trigger if exists on_user_deleted on public.users;
create trigger on_user_deleted
  after delete on public.users
  for each row execute function public.handle_user_deletion();

commit;
