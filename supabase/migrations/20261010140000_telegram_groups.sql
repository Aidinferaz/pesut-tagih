-- Linking a group to a Telegram group chat for weekly recaps.
-- An admin creates a short-lived code; the bot receives it inside the
-- Telegram group (/hubungkan <code>) and stores that chat on the group.

create table public.telegram_group_links (
  token_hash bytea primary key,
  group_id uuid not null references public.groups (id) on delete cascade,
  expires_at timestamptz not null
);
alter table public.telegram_group_links enable row level security;
revoke all on public.telegram_group_links from authenticated;

create function public.create_telegram_group_link(gid uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  token text := encode(extensions.gen_random_bytes(12), 'hex');
begin
  if not public.is_group_admin(gid) then
    raise exception 'Only group admins can link Telegram' using errcode = '42501';
  end if;
  delete from public.telegram_group_links where group_id = gid or expires_at < now();
  insert into public.telegram_group_links (token_hash, group_id, expires_at)
  values (extensions.digest(token, 'sha256'), gid, now() + interval '30 minutes');
  return token;
end;
$$;
revoke execute on function public.create_telegram_group_link(uuid) from public;
grant execute on function public.create_telegram_group_link(uuid) to authenticated;

-- Admins can unlink, but never point a group at an arbitrary chat id.
create function public.unlink_telegram_group(gid uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_group_admin(gid) then
    raise exception 'Only group admins can unlink Telegram' using errcode = '42501';
  end if;
  update public.groups set telegram_chat_id = null where id = gid;
end;
$$;
revoke execute on function public.unlink_telegram_group(uuid) from public;
grant execute on function public.unlink_telegram_group(uuid) to authenticated;
