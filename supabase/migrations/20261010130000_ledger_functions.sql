-- Ledger writes. Each function checks who is calling, keeps multi-row
-- changes atomic, and leaves the activity log to the triggers.
--
-- Shares are computed by the app (src/domain/split.ts) and verified here:
-- every person must be a member and the shares must add up to the total.

create function public.assert_member(gid uuid, uid uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.group_members where group_id = gid and user_id = uid) then
    raise exception 'Not a member of this group' using errcode = '42501';
  end if;
end;
$$;
revoke execute on function public.assert_member(uuid, uuid) from public, authenticated;

create function public.create_expense(
  gid uuid,
  expense_title text,
  expense_total bigint,
  payer uuid,
  method text,
  shares jsonb,
  items jsonb default '[]'::jsonb,
  tax_amount bigint default 0,
  service_amount bigint default 0,
  discount_amount bigint default 0,
  on_date date default null,
  expense_note text default null,
  receipt text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  eid uuid;
  item jsonb;
  claim jsonb;
  iid uuid;
  pos smallint := 0;
begin
  if me is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  perform public.assert_member(gid, me);
  perform public.assert_member(gid, payer);
  if jsonb_typeof(shares) <> 'array' or jsonb_array_length(shares) = 0 then
    raise exception 'An expense needs at least one share' using errcode = '22023';
  end if;
  if receipt is not null and split_part(receipt, '/', 1) <> gid::text then
    raise exception 'Receipt belongs to another group' using errcode = '42501';
  end if;

  insert into public.expenses (
    group_id, number, title, total, paid_by, split_method, tax, service, discount,
    occurred_on, note, receipt_path, created_by
  ) values (
    gid, public.take_group_number(gid), trim(expense_title), expense_total, payer, method,
    tax_amount, service_amount, discount_amount,
    coalesce(on_date, (now() at time zone 'Asia/Makassar')::date), nullif(trim(expense_note), ''), receipt, me
  ) returning id into eid;

  for item in select * from jsonb_array_elements(shares) loop
    perform public.assert_member(gid, (item ->> 'user_id')::uuid);
    insert into public.expense_shares (expense_id, user_id, amount)
    values (eid, (item ->> 'user_id')::uuid, (item ->> 'amount')::bigint);
  end loop;
  -- Fail fast with a clear error; the deferred trigger re-checks at commit.
  if (select sum(amount) from public.expense_shares where expense_id = eid) <> expense_total then
    raise exception 'Shares do not add up to the total' using errcode = '23514';
  end if;

  for item in select * from jsonb_array_elements(items) loop
    insert into public.expense_items (expense_id, position, name, amount)
    values (eid, pos, trim(item ->> 'name'), (item ->> 'amount')::bigint)
    returning id into iid;
    pos := pos + 1;
    for claim in select * from jsonb_array_elements(item -> 'claims') loop
      perform public.assert_member(gid, (claim ->> 'user_id')::uuid);
      insert into public.item_claims (item_id, user_id, weight)
      values (iid, (claim ->> 'user_id')::uuid, coalesce((claim ->> 'weight')::smallint, 1));
    end loop;
  end loop;

  return eid;
end;
$$;

-- Soft delete: the expense leaves the balances but stays in the log.
create function public.delete_expense(eid uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  e public.expenses;
begin
  select * into e from public.expenses where id = eid and deleted_at is null for update;
  if not found or not public.is_group_member(e.group_id) then
    raise exception 'Expense not found' using errcode = 'P0002';
  end if;
  if me not in (e.created_by, e.paid_by) and not public.is_group_admin(e.group_id) then
    raise exception 'Only whoever logged or paid it, or an admin, can delete this' using errcode = '42501';
  end if;
  update public.expenses set deleted_at = now(), updated_at = now() where id = eid;
end;
$$;

-- ---------------------------------------------------------------------------
-- Settlements
-- ---------------------------------------------------------------------------

-- The payer says "I've transferred". The receiver confirms or rejects.
create function public.mark_paid(
  gid uuid,
  receiver uuid,
  paid_amount bigint,
  via text default null,
  proof text default null,
  settlement_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  sid uuid;
begin
  if me is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  perform public.assert_member(gid, me);
  perform public.assert_member(gid, receiver);
  if proof is not null and split_part(proof, '/', 1) <> gid::text then
    raise exception 'Proof belongs to another group' using errcode = '42501';
  end if;
  insert into public.settlements (group_id, number, from_user, to_user, amount, provider, proof_path, note)
  values (gid, public.take_group_number(gid), me, receiver, paid_amount, via, proof, nullif(trim(settlement_note), ''))
  returning id into sid;
  return sid;
end;
$$;

-- The receiver records money handed over in person: confirmed straight away.
create function public.record_received(gid uuid, payer uuid, paid_amount bigint, settlement_note text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  sid uuid;
begin
  if me is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  perform public.assert_member(gid, me);
  perform public.assert_member(gid, payer);
  insert into public.settlements (group_id, number, from_user, to_user, amount, note, status, decided_at)
  values (gid, public.take_group_number(gid), payer, me, paid_amount, nullif(trim(settlement_note), ''), 'confirmed', now())
  returning id into sid;
  return sid;
end;
$$;

create function public.decide_settlement(sid uuid, accept boolean, reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  s public.settlements;
begin
  select * into s from public.settlements where id = sid for update;
  if not found or not public.is_group_member(s.group_id) then
    raise exception 'Transfer not found' using errcode = 'P0002';
  end if;
  if s.status <> 'pending' then
    raise exception 'This transfer was already decided' using errcode = '22023';
  end if;
  -- The receiver decides; the sender may only withdraw their own claim.
  if not (me = s.to_user or (me = s.from_user and not accept)) then
    raise exception 'Only the receiver can confirm this transfer' using errcode = '42501';
  end if;
  update public.settlements
  set status = case when accept then 'confirmed' else 'rejected' end,
      rejected_reason = case when accept then null else left(nullif(trim(reason), ''), 280) end,
      decided_at = now()
  where id = sid;
end;
$$;

-- Daily job: confirms transfers the receiver has ignored for the group's grace period.
create function public.auto_confirm_settlements()
returns integer
language sql
security definer
set search_path = ''
as $$
  with due as (
    update public.settlements s
    set status = 'confirmed', decided_at = now(), auto_confirmed = true
    from public.groups g
    where g.id = s.group_id
      and s.status = 'pending'
      and g.auto_confirm_days > 0
      and s.created_at < now() - make_interval(days => g.auto_confirm_days)
    returning s.id
  )
  select count(*)::integer from due;
$$;

-- ---------------------------------------------------------------------------
-- Recurring bills
-- ---------------------------------------------------------------------------

create function public.next_monthly(after date, day_of_month smallint)
returns date
language sql
immutable
set search_path = ''
as $$
  select case
    when extract(day from after) < day_of_month
      then make_date(extract(year from after)::int, extract(month from after)::int, day_of_month)
    else (date_trunc('month', after) + interval '1 month')::date + (day_of_month - 1)
  end;
$$;

create function public.create_recurring_bill(
  gid uuid,
  bill_title text,
  bill_amount bigint,
  payer uuid,
  people uuid[],
  day smallint
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  person uuid;
  bid uuid;
  today date := (now() at time zone 'Asia/Makassar')::date;
begin
  if me is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  perform public.assert_member(gid, me);
  perform public.assert_member(gid, payer);
  foreach person in array people loop
    perform public.assert_member(gid, person);
  end loop;
  insert into public.recurring_bills (group_id, title, amount, paid_by, participants, day_of_month, next_run_on, created_by)
  values (gid, trim(bill_title), bill_amount, payer, people, day, public.next_monthly(today - 1, day), me)
  returning id into bid;
  return bid;
end;
$$;

create function public.set_recurring_bill_active(bid uuid, is_active boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  b public.recurring_bills;
begin
  select * into b from public.recurring_bills where id = bid for update;
  if not found or not public.is_group_member(b.group_id) then
    raise exception 'Bill not found' using errcode = 'P0002';
  end if;
  if auth.uid() not in (b.created_by, b.paid_by) and not public.is_group_admin(b.group_id) then
    raise exception 'Only whoever set it up, the payer, or an admin can change this' using errcode = '42501';
  end if;
  update public.recurring_bills set active = is_active where id = bid;
end;
$$;

-- Daily job: turns every due bill into an expense split evenly. The split
-- mirrors allocate() in src/domain/money.ts: whole rupiah, leftover rupiah to
-- the earliest participants, so the shares always add up.
create function public.run_recurring_bills()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  b public.recurring_bills;
  eid uuid;
  n integer;
  base bigint;
  leftover bigint;
  i integer;
  made integer := 0;
  today date := (now() at time zone 'Asia/Makassar')::date;
begin
  for b in
    select * from public.recurring_bills where active and next_run_on <= today for update skip locked
  loop
    -- Skip people who have left the group since the bill was set up.
    select array_agg(p order by ord) into b.participants
    from unnest(b.participants) with ordinality as u (p, ord)
    where exists (select 1 from public.group_members m where m.group_id = b.group_id and m.user_id = p);

    if b.participants is null
       or not exists (select 1 from public.group_members m where m.group_id = b.group_id and m.user_id = b.paid_by) then
      update public.recurring_bills set active = false where id = b.id;
      continue;
    end if;

    n := cardinality(b.participants);
    base := b.amount / n;
    leftover := b.amount - base * n;

    insert into public.expenses (group_id, number, title, total, paid_by, split_method, occurred_on, recurring_bill_id, created_by)
    values (b.group_id, public.take_group_number(b.group_id), b.title, b.amount, b.paid_by, 'equal', b.next_run_on, b.id, b.created_by)
    returning id into eid;

    for i in 1 .. n loop
      insert into public.expense_shares (expense_id, user_id, amount)
      values (eid, b.participants[i], base + case when i <= leftover then 1 else 0 end);
    end loop;

    update public.recurring_bills set next_run_on = public.next_monthly(b.next_run_on, b.day_of_month) where id = b.id;
    made := made + 1;
  end loop;
  return made;
end;
$$;

-- ---------------------------------------------------------------------------
-- Who may call what
-- ---------------------------------------------------------------------------

revoke execute on function public.create_expense(uuid, text, bigint, uuid, text, jsonb, jsonb, bigint, bigint, bigint, date, text, text) from public;
revoke execute on function public.delete_expense(uuid) from public;
revoke execute on function public.mark_paid(uuid, uuid, bigint, text, text, text) from public;
revoke execute on function public.record_received(uuid, uuid, bigint, text) from public;
revoke execute on function public.decide_settlement(uuid, boolean, text) from public;
revoke execute on function public.create_recurring_bill(uuid, text, bigint, uuid, uuid[], smallint) from public;
revoke execute on function public.set_recurring_bill_active(uuid, boolean) from public;
revoke execute on function public.auto_confirm_settlements() from public, authenticated;
revoke execute on function public.run_recurring_bills() from public, authenticated;

grant execute on function public.create_expense(uuid, text, bigint, uuid, text, jsonb, jsonb, bigint, bigint, bigint, date, text, text) to authenticated;
grant execute on function public.delete_expense(uuid) to authenticated;
grant execute on function public.mark_paid(uuid, uuid, bigint, text, text, text) to authenticated;
grant execute on function public.record_received(uuid, uuid, bigint, text) to authenticated;
grant execute on function public.decide_settlement(uuid, boolean, text) to authenticated;
grant execute on function public.create_recurring_bill(uuid, text, bigint, uuid, uuid[], smallint) to authenticated;
grant execute on function public.set_recurring_bill_active(uuid, boolean) to authenticated;
grant execute on function public.auto_confirm_settlements() to service_role;
grant execute on function public.run_recurring_bills() to service_role;
