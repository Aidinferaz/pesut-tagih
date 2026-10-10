-- The ledger: expenses, who owes what for each, transfers between people,
-- monthly bills, and an append-only activity log.
--
-- Balances are not stored. The app derives them from expense_shares and
-- confirmed settlements with the same code that is unit-tested in
-- src/domain/settle.ts, so there is one definition of "who owes whom".

create table public.recurring_bills (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  amount bigint not null check (amount between 1 and 1000000000),
  paid_by uuid not null references public.profiles (id),
  participants uuid[] not null check (cardinality(participants) between 1 and 50),
  day_of_month smallint not null check (day_of_month between 1 and 28),
  next_run_on date not null,
  active boolean not null default true,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);
create index recurring_bills_due_idx on public.recurring_bills (next_run_on) where active;

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  number integer not null,
  title text not null check (char_length(title) between 1 and 80),
  total bigint not null check (total between 1 and 1000000000),
  paid_by uuid not null references public.profiles (id),
  split_method text not null check (split_method in ('equal', 'exact', 'itemized')),
  tax bigint not null default 0 check (tax >= 0),
  service bigint not null default 0 check (service >= 0),
  discount bigint not null default 0 check (discount >= 0),
  occurred_on date not null default current_date,
  note text check (char_length(note) <= 280),
  receipt_path text,
  recurring_bill_id uuid references public.recurring_bills (id) on delete set null,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (group_id, number)
);
create index expenses_group_idx on public.expenses (group_id, occurred_on desc) where deleted_at is null;

create table public.expense_items (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.expenses (id) on delete cascade,
  position smallint not null,
  name text not null check (char_length(name) between 1 and 80),
  amount bigint not null check (amount between 0 and 1000000000),
  unique (expense_id, position)
);

create table public.item_claims (
  item_id uuid not null references public.expense_items (id) on delete cascade,
  user_id uuid not null references public.profiles (id),
  weight smallint not null default 1 check (weight between 1 and 99),
  primary key (item_id, user_id)
);

create table public.expense_shares (
  expense_id uuid not null references public.expenses (id) on delete cascade,
  user_id uuid not null references public.profiles (id),
  amount bigint not null check (amount >= 0),
  primary key (expense_id, user_id)
);
create index expense_shares_user_idx on public.expense_shares (user_id);

create table public.settlements (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  number integer not null,
  from_user uuid not null references public.profiles (id),
  to_user uuid not null references public.profiles (id),
  amount bigint not null check (amount between 1 and 1000000000),
  provider text,
  proof_path text,
  note text check (char_length(note) <= 280),
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'rejected')),
  rejected_reason text check (char_length(rejected_reason) <= 280),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  auto_confirmed boolean not null default false,
  check (from_user <> to_user),
  unique (group_id, number)
);
create index settlements_group_idx on public.settlements (group_id, created_at desc);
create index settlements_pending_idx on public.settlements (created_at) where status = 'pending';

create table public.activity_log (
  id bigint generated always as identity primary key,
  group_id uuid not null references public.groups (id) on delete cascade,
  actor uuid references public.profiles (id) on delete set null,
  action text not null,
  entity_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index activity_log_group_idx on public.activity_log (group_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Integrity
-- ---------------------------------------------------------------------------

-- Every live expense's shares add up to its total, checked at commit so the
-- expense and its shares can be written in any order inside one transaction.
create function public.check_expense_balanced()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  eid uuid;
  expected bigint;
  actual bigint;
begin
  -- Fired from both tables; only touch the fields the firing table has.
  if tg_table_name = 'expenses' then
    eid := coalesce(new.id, old.id);
  else
    eid := coalesce(new.expense_id, old.expense_id);
  end if;
  select total into expected from public.expenses where id = eid and deleted_at is null;
  if not found then
    return null;
  end if;
  select coalesce(sum(amount), 0) into actual from public.expense_shares where expense_id = eid;
  if actual <> expected then
    raise exception 'Shares (%) do not add up to the total (%)', actual, expected using errcode = '23514';
  end if;
  return null;
end;
$$;

create constraint trigger expense_shares_balanced
  after insert or update or delete on public.expense_shares
  deferrable initially deferred
  for each row execute function public.check_expense_balanced();

create constraint trigger expenses_balanced
  after insert or update of total, deleted_at on public.expenses
  deferrable initially deferred
  for each row execute function public.check_expense_balanced();

-- ---------------------------------------------------------------------------
-- Activity log, written only by triggers
-- ---------------------------------------------------------------------------

create function public.log_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  if tg_table_name = 'expenses' then
    if tg_op = 'INSERT' then
      insert into public.activity_log (group_id, actor, action, entity_id, details)
      values (new.group_id, coalesce(me, new.created_by), 'expense.created', new.id,
              jsonb_build_object('number', new.number, 'title', new.title, 'total', new.total, 'paid_by', new.paid_by));
    elsif new.deleted_at is not null and old.deleted_at is null then
      insert into public.activity_log (group_id, actor, action, entity_id, details)
      values (new.group_id, me, 'expense.deleted', new.id,
              jsonb_build_object('number', new.number, 'title', new.title, 'total', new.total));
    else
      insert into public.activity_log (group_id, actor, action, entity_id, details)
      values (new.group_id, me, 'expense.updated', new.id,
              jsonb_build_object('number', new.number, 'title', new.title,
                                 'before', jsonb_build_object('title', old.title, 'total', old.total, 'paid_by', old.paid_by),
                                 'after', jsonb_build_object('title', new.title, 'total', new.total, 'paid_by', new.paid_by)));
    end if;
  elsif tg_table_name = 'settlements' then
    if tg_op = 'INSERT' then
      insert into public.activity_log (group_id, actor, action, entity_id, details)
      values (new.group_id, coalesce(me, new.from_user), 'settlement.' || new.status, new.id,
              jsonb_build_object('number', new.number, 'from', new.from_user, 'to', new.to_user, 'amount', new.amount));
    elsif new.status <> old.status then
      insert into public.activity_log (group_id, actor, action, entity_id, details)
      values (new.group_id, me, 'settlement.' || new.status, new.id,
              jsonb_build_object('number', new.number, 'from', new.from_user, 'to', new.to_user,
                                 'amount', new.amount, 'auto', new.auto_confirmed, 'reason', new.rejected_reason));
    end if;
  elsif tg_table_name = 'group_members' then
    insert into public.activity_log (group_id, actor, action, entity_id, details)
    select coalesce(new.group_id, old.group_id), me,
           case tg_op when 'INSERT' then 'member.joined' when 'DELETE' then 'member.left' else 'member.role' end,
           coalesce(new.user_id, old.user_id),
           jsonb_build_object('role', coalesce(new.role, old.role))
    where exists (select 1 from public.groups where id = coalesce(new.group_id, old.group_id));
  end if;
  return null;
end;
$$;

create trigger expenses_log after insert or update on public.expenses
  for each row execute function public.log_activity();
create trigger settlements_log after insert or update on public.settlements
  for each row execute function public.log_activity();
create trigger group_members_log after insert or update or delete on public.group_members
  for each row execute function public.log_activity();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.recurring_bills enable row level security;
alter table public.expenses enable row level security;
alter table public.expense_items enable row level security;
alter table public.item_claims enable row level security;
alter table public.expense_shares enable row level security;
alter table public.settlements enable row level security;
alter table public.activity_log enable row level security;

-- Reads: anyone in the group sees the whole ledger. That is the transparency.
create policy "members read bills" on public.recurring_bills
  for select to authenticated using (public.is_group_member(group_id));
create policy "members read expenses" on public.expenses
  for select to authenticated using (public.is_group_member(group_id));
create policy "members read items" on public.expense_items
  for select to authenticated using (
    exists (select 1 from public.expenses e where e.id = expense_id and public.is_group_member(e.group_id)));
create policy "members read claims" on public.item_claims
  for select to authenticated using (
    exists (select 1 from public.expense_items i join public.expenses e on e.id = i.expense_id
            where i.id = item_id and public.is_group_member(e.group_id)));
create policy "members read shares" on public.expense_shares
  for select to authenticated using (
    exists (select 1 from public.expenses e where e.id = expense_id and public.is_group_member(e.group_id)));
create policy "members read settlements" on public.settlements
  for select to authenticated using (public.is_group_member(group_id));
create policy "members read the log" on public.activity_log
  for select to authenticated using (public.is_group_member(group_id));

-- Writes go through the functions below, which check membership and keep
-- multi-row changes atomic. Direct table writes are closed.
revoke insert, update, delete on public.recurring_bills, public.expenses, public.expense_items,
  public.item_claims, public.expense_shares, public.settlements, public.activity_log from authenticated;
