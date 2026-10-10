-- Identity, groups, membership and invitations.
--
-- Security model: every table has row level security. Reads are limited to
-- yourself or people you share a group with. Writes that need more than one
-- row to stay consistent (creating a group, accepting an invite) go through
-- SECURITY DEFINER functions that check auth.uid() themselves.

-- Nothing in public is for anonymous visitors.
revoke all on all tables in schema public from anon;
revoke all on all functions in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on functions from anon;

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  avatar_url text check (avatar_url is null or avatar_url ~ '^https://'),
  locale text not null default 'id' check (locale in ('id', 'en')),
  created_at timestamptz not null default now()
);
comment on table public.profiles is 'Public face of a person, visible to everyone who shares a group with them.';

-- Contact details are private: only the person (and server jobs) can see them.
create table public.contact_channels (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  telegram_chat_id bigint unique,
  wa_number text check (wa_number is null or wa_number ~ '^62[0-9]{8,13}$'),
  notify_telegram boolean not null default true,
  notify_push boolean not null default true,
  notify_whatsapp boolean not null default false,
  updated_at timestamptz not null default now()
);

-- Optional sign-up allowlist. Empty means anyone may sign in; they still see
-- nothing until someone invites them into a group.
create table public.allowed_emails (
  email text primary key check (email = lower(email))
);

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  if exists (select 1 from public.allowed_emails)
     and not exists (select 1 from public.allowed_emails where email = lower(new.email)) then
    raise exception 'This email is not on the allowlist' using errcode = '42501';
  end if;

  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    left(coalesce(nullif(meta ->> 'full_name', ''), nullif(meta ->> 'name', ''), split_part(new.email, '@', 1)), 40),
    case when coalesce(meta ->> 'avatar_url', meta ->> 'picture', '') ~ '^https://'
         then coalesce(meta ->> 'avatar_url', meta ->> 'picture') end
  );
  insert into public.contact_channels (user_id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Groups and membership
-- ---------------------------------------------------------------------------

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 40),
  hull text not null default 'band' check (hull in ('band', 'action', 'surface', 'debt')),
  simplify_debts boolean not null default true,
  auto_confirm_days smallint not null default 3 check (auto_confirm_days between 0 and 30),
  -- Days after an unpaid debt appears to remind, then how often to repeat.
  reminder_after_days smallint[] not null default '{1,3}',
  reminder_repeat_days smallint not null default 7 check (reminder_repeat_days between 1 and 30),
  telegram_chat_id bigint unique,
  telegram_recap_amounts boolean not null default false,
  -- Shared counter behind the PT-0001 registration numbers on expenses and transfers.
  next_number integer not null default 1,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.group_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member')),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index group_members_user_idx on public.group_members (user_id);

create table public.group_invites (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  token_hash bytea not null unique,
  created_by uuid not null references public.profiles (id),
  expires_at timestamptz not null,
  max_uses integer not null check (max_uses between 1 and 100),
  uses integer not null default 0,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index group_invites_group_idx on public.group_invites (group_id);

-- Membership checks used by policies. SECURITY DEFINER so a policy on
-- group_members can ask about group_members without recursing into itself.
create function public.is_group_member(gid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.group_members
    where group_id = gid and user_id = (select auth.uid())
  );
$$;

create function public.is_group_admin(gid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.group_members
    where group_id = gid and user_id = (select auth.uid()) and role = 'admin'
  );
$$;

create function public.shares_group_with(other uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select other = (select auth.uid()) or exists (
    select 1
    from public.group_members mine
    join public.group_members theirs on theirs.group_id = mine.group_id
    where mine.user_id = (select auth.uid()) and theirs.user_id = other
  );
$$;

-- Hands out the next registration number for a group, atomically.
create function public.take_group_number(gid uuid)
returns integer
language sql
security definer
set search_path = ''
as $$
  update public.groups set next_number = next_number + 1
  where id = gid
  returning next_number - 1;
$$;
revoke execute on function public.take_group_number(uuid) from public, authenticated;

-- ---------------------------------------------------------------------------
-- Payment methods: where each person can receive money
-- ---------------------------------------------------------------------------

create table public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- Keep in sync with src/domain/providers.ts.
  provider text not null check (provider in (
    'bca', 'mandiri', 'bni', 'bri', 'bsi', 'cimb', 'permata', 'btn', 'danamon',
    'jago', 'seabank', 'blu', 'jenius', 'superbank',
    'gopay', 'ovo', 'dana', 'shopeepay', 'linkaja'
  )),
  account_number text not null check (account_number ~ '^[0-9]{4,24}$'),
  account_name text not null check (char_length(account_name) between 1 and 60),
  qris_path text,
  priority smallint not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, provider, account_number)
);
create index payment_methods_user_idx on public.payment_methods (user_id, priority);

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.contact_channels enable row level security;
alter table public.allowed_emails enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.group_invites enable row level security;
alter table public.payment_methods enable row level security;

create policy "see yourself and group-mates" on public.profiles
  for select to authenticated using (public.shares_group_with(id));
create policy "edit your own profile" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
-- Column grants: a table-wide UPDATE grant would make column revokes meaningless.
revoke insert, update, delete on public.profiles from authenticated;
grant update (display_name, avatar_url, locale) on public.profiles to authenticated;

create policy "see your own channels" on public.contact_channels
  for select to authenticated using (user_id = (select auth.uid()));
create policy "edit your own channels" on public.contact_channels
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
-- Linking Telegram happens through the bot (server side), never from the browser.
revoke update on public.contact_channels from authenticated;
grant update (wa_number, notify_telegram, notify_push, notify_whatsapp, updated_at)
  on public.contact_channels to authenticated;
revoke insert, delete on public.contact_channels from authenticated;

-- allowed_emails: no policies; managed with SQL by the owner.

create policy "members see their groups" on public.groups
  for select to authenticated using (public.is_group_member(id));
create policy "admins edit group settings" on public.groups
  for update to authenticated using (public.is_group_admin(id)) with check (public.is_group_admin(id));
create policy "admins delete groups" on public.groups
  for delete to authenticated using (public.is_group_admin(id));
-- Created only through create_group(); the counter only moves through take_group_number().
revoke insert, update on public.groups from authenticated;
grant update (name, hull, simplify_debts, auto_confirm_days, reminder_after_days, reminder_repeat_days, telegram_recap_amounts)
  on public.groups to authenticated;

create policy "members see the member list" on public.group_members
  for select to authenticated using (public.is_group_member(group_id));
create policy "admins change roles" on public.group_members
  for update to authenticated using (public.is_group_admin(group_id)) with check (public.is_group_admin(group_id));
create policy "leave, or be removed by an admin" on public.group_members
  for delete to authenticated using (user_id = (select auth.uid()) or public.is_group_admin(group_id));
revoke insert, update on public.group_members from authenticated;
grant update (role) on public.group_members to authenticated;

create policy "admins see invites" on public.group_invites
  for select to authenticated using (public.is_group_admin(group_id));
create policy "admins revoke invites" on public.group_invites
  for update to authenticated using (public.is_group_admin(group_id)) with check (public.is_group_admin(group_id));
revoke insert, update, delete on public.group_invites from authenticated;
grant update (revoked_at) on public.group_invites to authenticated;

create policy "group-mates see where to pay" on public.payment_methods
  for select to authenticated using (public.shares_group_with(user_id));
create policy "add your own methods" on public.payment_methods
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "edit your own methods" on public.payment_methods
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "remove your own methods" on public.payment_methods
  for delete to authenticated using (user_id = (select auth.uid()));
revoke update on public.payment_methods from authenticated;
grant update (provider, account_number, account_name, qris_path, priority) on public.payment_methods to authenticated;

-- A group always keeps an admin while it has members, and disappears with its last member.
create function public.guard_group_admins()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.groups where id = old.group_id) then
    return coalesce(new, old); -- the whole group is being deleted
  end if;
  if old.role = 'admin'
     and (tg_op = 'DELETE' or new.role <> 'admin')
     and not exists (
       select 1 from public.group_members
       where group_id = old.group_id and role = 'admin' and user_id <> old.user_id
     )
     and exists (
       select 1 from public.group_members where group_id = old.group_id and user_id <> old.user_id
     ) then
    raise exception 'Make someone else an admin first' using errcode = '23514';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger group_members_keep_admin
  before update or delete on public.group_members
  for each row execute function public.guard_group_admins();

create function public.drop_empty_group()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.groups g
  where g.id = old.group_id
    and not exists (select 1 from public.group_members m where m.group_id = old.group_id);
  return null;
end;
$$;

create trigger group_members_drop_empty
  after delete on public.group_members
  for each row execute function public.drop_empty_group();

-- ---------------------------------------------------------------------------
-- Group lifecycle
-- ---------------------------------------------------------------------------

create function public.create_group(group_name text, group_hull text default 'band')
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  gid uuid;
begin
  if me is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  insert into public.groups (name, hull, created_by)
  values (trim(group_name), group_hull, me)
  returning id into gid;
  insert into public.group_members (group_id, user_id, role) values (gid, me, 'admin');
  return gid;
end;
$$;

-- Returns the raw token once; only its SHA-256 is stored.
create function public.create_invite(gid uuid, valid_days integer default 7, uses_allowed integer default 30)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  token text := encode(extensions.gen_random_bytes(32), 'hex');
begin
  if not public.is_group_admin(gid) then
    raise exception 'Only group admins can invite' using errcode = '42501';
  end if;
  if valid_days not between 1 and 30 then
    raise exception 'Invites last between 1 and 30 days' using errcode = '22023';
  end if;
  insert into public.group_invites (group_id, token_hash, created_by, expires_at, max_uses)
  values (gid, extensions.digest(token, 'sha256'), auth.uid(), now() + make_interval(days => valid_days), uses_allowed);
  return token;
end;
$$;

-- Joins the group behind an invite token. Safe to call twice.
create function public.accept_invite(token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  invite public.group_invites;
begin
  if me is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  if token !~ '^[0-9a-f]{64}$' then
    raise exception 'Invite not found' using errcode = 'P0002';
  end if;

  select * into invite from public.group_invites
  where token_hash = extensions.digest(token, 'sha256')
  for update;

  if not found or invite.revoked_at is not null or invite.expires_at < now() then
    raise exception 'Invite not found or expired' using errcode = 'P0002';
  end if;

  if exists (select 1 from public.group_members where group_id = invite.group_id and user_id = me) then
    return invite.group_id;
  end if;

  if invite.uses >= invite.max_uses then
    raise exception 'Invite has been used up' using errcode = 'P0002';
  end if;

  insert into public.group_members (group_id, user_id) values (invite.group_id, me);
  update public.group_invites set uses = uses + 1 where id = invite.id;
  return invite.group_id;
end;
$$;

-- What an invitee may see before joining: just the group's name.
create function public.peek_invite(token text)
returns table (group_name text, member_count integer)
language sql
stable
security definer
set search_path = ''
as $$
  select g.name, (select count(*)::integer from public.group_members m where m.group_id = g.id)
  from public.group_invites i
  join public.groups g on g.id = i.group_id
  where token ~ '^[0-9a-f]{64}$'
    and i.token_hash = extensions.digest(token, 'sha256')
    and i.revoked_at is null
    and i.expires_at > now()
    and i.uses < i.max_uses
    and auth.uid() is not null;
$$;

revoke execute on function public.create_group(text, text) from public;
revoke execute on function public.create_invite(uuid, integer, integer) from public;
revoke execute on function public.accept_invite(text) from public;
revoke execute on function public.peek_invite(text) from public;
grant execute on function public.create_group(text, text) to authenticated;
grant execute on function public.create_invite(uuid, integer, integer) to authenticated;
grant execute on function public.accept_invite(text) to authenticated;
grant execute on function public.peek_invite(text) to authenticated;
