-- Reminders, AI quota, and file storage.

-- ---------------------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------------------

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique check (endpoint ~ '^https://'),
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

-- One row per reminder sent, so the daily job never sends the same one twice.
create table public.notification_log (
  id bigint generated always as identity primary key,
  user_id uuid references public.profiles (id) on delete cascade,
  group_id uuid references public.groups (id) on delete cascade,
  kind text not null,
  dedupe_key text not null unique,
  channel text not null check (channel in ('telegram', 'push', 'whatsapp', 'telegram_group')),
  ok boolean not null,
  error text,
  sent_at timestamptz not null default now()
);

-- Short-lived tokens behind the "connect Telegram" deep link.
create table public.telegram_link_tokens (
  token_hash bytea primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  expires_at timestamptz not null
);

alter table public.push_subscriptions enable row level security;
alter table public.notification_log enable row level security;
alter table public.telegram_link_tokens enable row level security;

create policy "see your own devices" on public.push_subscriptions
  for select to authenticated using (user_id = (select auth.uid()));
create policy "register your own devices" on public.push_subscriptions
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "remove your own devices" on public.push_subscriptions
  for delete to authenticated using (user_id = (select auth.uid()));
revoke update on public.push_subscriptions from authenticated;

-- notification_log and telegram_link_tokens: server-only, no policies.
revoke all on public.notification_log, public.telegram_link_tokens from authenticated;

-- Creates the token for t.me/<bot>?start=<token>; valid for 15 minutes.
create function public.create_telegram_link()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  token text := encode(extensions.gen_random_bytes(24), 'hex');
begin
  if me is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  delete from public.telegram_link_tokens where user_id = me or expires_at < now();
  insert into public.telegram_link_tokens (token_hash, user_id, expires_at)
  values (extensions.digest(token, 'sha256'), me, now() + interval '15 minutes');
  return token;
end;
$$;
revoke execute on function public.create_telegram_link() from public;
grant execute on function public.create_telegram_link() to authenticated;

-- ---------------------------------------------------------------------------
-- AI quota: a per-person daily allowance, counted atomically
-- ---------------------------------------------------------------------------

create table public.ai_usage (
  user_id uuid not null references public.profiles (id) on delete cascade,
  day date not null default (now() at time zone 'Asia/Makassar')::date,
  chats integer not null default 0,
  scans integer not null default 0,
  primary key (user_id, day)
);
alter table public.ai_usage enable row level security;
create policy "see your own usage" on public.ai_usage
  for select to authenticated using (user_id = (select auth.uid()));
revoke insert, update, delete on public.ai_usage from authenticated;

-- Returns true and counts the use when there is allowance left today.
create function public.consume_ai_quota(kind text, daily_limit integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  today date := (now() at time zone 'Asia/Makassar')::date;
  used integer;
begin
  if me is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  if kind not in ('chat', 'scan') then
    raise exception 'Unknown quota %', kind using errcode = '22023';
  end if;
  insert into public.ai_usage (user_id, day) values (me, today) on conflict do nothing;
  if kind = 'chat' then
    update public.ai_usage set chats = chats + 1
    where user_id = me and day = today and chats < daily_limit
    returning chats into used;
  else
    update public.ai_usage set scans = scans + 1
    where user_id = me and day = today and scans < daily_limit
    returning scans into used;
  end if;
  return used is not null;
end;
$$;
revoke execute on function public.consume_ai_quota(text, integer) from public;
grant execute on function public.consume_ai_quota(text, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- Storage: private buckets, paths start with the owning group or user id
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('receipts', 'receipts', false, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('proofs', 'proofs', false, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('qris', 'qris', false, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- The first folder of an object path as a uuid, or null if it is not one,
-- so a malformed path fails the policy instead of erroring the query.
create function public.path_owner(object_name text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case when (storage.foldername(object_name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
              then ((storage.foldername(object_name))[1])::uuid end;
$$;

-- receipts/<group_id>/<file>, proofs/<group_id>/<file>
create policy "members read group files" on storage.objects
  for select to authenticated using (
    bucket_id in ('receipts', 'proofs')
    and public.is_group_member(public.path_owner(name))
  );
create policy "members upload group files" on storage.objects
  for insert to authenticated with check (
    bucket_id in ('receipts', 'proofs')
    and public.is_group_member(public.path_owner(name))
    and owner_id = (select auth.uid())::text
  );

-- qris/<user_id>/<file>
create policy "group-mates read QRIS" on storage.objects
  for select to authenticated using (
    bucket_id = 'qris' and public.shares_group_with(public.path_owner(name))
  );
create policy "upload your own QRIS" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'qris' and public.path_owner(name) = (select auth.uid())
  );
create policy "replace your own QRIS" on storage.objects
  for update to authenticated using (
    bucket_id = 'qris' and public.path_owner(name) = (select auth.uid())
  );
create policy "remove your own QRIS" on storage.objects
  for delete to authenticated using (
    bucket_id = 'qris' and public.path_owner(name) = (select auth.uid())
  );
