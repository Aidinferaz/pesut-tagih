-- Monthly bills, second pass:
-- * a new bill whose day has already passed this month bills this month right
--   away (everyone on it starts out unpaid), unless the person says it starts
--   next month;
-- * bills can be edited (future months only) and deleted;
-- * creating, editing and deleting a bill is written to the activity log.

-- One month's charge for a bill, split evenly. The split mirrors allocate() in
-- src/domain/money.ts: whole rupiah, leftover rupiah to the earliest
-- participants. People who have left the group are skipped. Returns the new
-- expense, or null when nobody (or no payer) is left to bill.
create function public.bill_expense(bid uuid, on_date date)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  b public.recurring_bills;
  people uuid[];
  eid uuid;
  n integer;
  base bigint;
  leftover bigint;
  i integer;
begin
  select * into b from public.recurring_bills where id = bid;
  select array_agg(p order by ord) into people
  from unnest(b.participants) with ordinality as u (p, ord)
  where exists (select 1 from public.group_members m where m.group_id = b.group_id and m.user_id = p);

  if people is null
     or not exists (select 1 from public.group_members m where m.group_id = b.group_id and m.user_id = b.paid_by) then
    return null;
  end if;

  n := cardinality(people);
  base := b.amount / n;
  leftover := b.amount - base * n;

  insert into public.expenses (group_id, number, title, total, paid_by, split_method, occurred_on, recurring_bill_id, created_by)
  values (b.group_id, public.take_group_number(b.group_id), b.title, b.amount, b.paid_by, 'equal', on_date, b.id, b.created_by)
  returning id into eid;

  for i in 1 .. n loop
    insert into public.expense_shares (expense_id, user_id, amount)
    values (eid, people[i], base + case when i <= leftover then 1 else 0 end);
  end loop;
  return eid;
end;
$$;
revoke execute on function public.bill_expense(uuid, date) from public, authenticated;

-- The daily job now uses the shared helper.
create or replace function public.run_recurring_bills()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  b public.recurring_bills;
  made integer := 0;
  today date := (now() at time zone 'Asia/Makassar')::date;
begin
  for b in
    select * from public.recurring_bills where active and next_run_on <= today for update skip locked
  loop
    if public.bill_expense(b.id, b.next_run_on) is null then
      update public.recurring_bills set active = false where id = b.id;
      continue;
    end if;
    update public.recurring_bills set next_run_on = public.next_monthly(b.next_run_on, b.day_of_month) where id = b.id;
    made := made + 1;
  end loop;
  return made;
end;
$$;

-- This month's and next month's date for a day of the month, in WITA.
create function public.bill_dates(day smallint, out today date, out this_month date, out next_month date)
language sql
stable
set search_path = ''
as $$
  select t, make_date(extract(year from t)::int, extract(month from t)::int, day),
         (date_trunc('month', t) + interval '1 month')::date + (day - 1)
  from (select (now() at time zone 'Asia/Makassar')::date as t) as now_wita;
$$;

create function public.check_bill_people(gid uuid, payer uuid, people uuid[])
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  person uuid;
begin
  perform public.assert_member(gid, payer);
  if people is null or cardinality(people) = 0 then
    raise exception 'A bill needs at least one person' using errcode = '22023';
  end if;
  foreach person in array people loop
    perform public.assert_member(gid, person);
  end loop;
end;
$$;
revoke execute on function public.check_bill_people(uuid, uuid, uuid[]) from public, authenticated;

drop function public.create_recurring_bill(uuid, text, bigint, uuid, uuid[], smallint);

-- Returns the bill, and this month's expense when one was billed right away.
create function public.create_recurring_bill(
  gid uuid,
  bill_title text,
  bill_amount bigint,
  payer uuid,
  people uuid[],
  day smallint,
  bill_this_month boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  d record;
  bid uuid;
  eid uuid;
begin
  select * into d from public.bill_dates(day);
  if me is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  perform public.assert_member(gid, me);
  perform public.check_bill_people(gid, payer, people);

  insert into public.recurring_bills (group_id, title, amount, paid_by, participants, day_of_month, next_run_on, created_by)
  values (
    gid, trim(bill_title), bill_amount, payer, people, day,
    case
      when not bill_this_month then d.next_month
      when d.this_month <= d.today then d.next_month
      else d.this_month
    end,
    me
  )
  returning id into bid;

  -- The day already passed this month: bill it now so everyone starts unpaid.
  if bill_this_month and d.this_month <= d.today then
    eid := public.bill_expense(bid, d.this_month);
  end if;

  insert into public.activity_log (group_id, actor, action, entity_id, details)
  values (gid, me, 'bill.created', bid, jsonb_build_object('title', trim(bill_title), 'amount', bill_amount, 'day', day));
  return jsonb_build_object('bill_id', bid, 'expense_id', eid);
end;
$$;

-- Changes apply from the next month that hasn't been billed yet; charges
-- already in the book stay as they are (correct those in the ledger).
create function public.update_recurring_bill(
  bid uuid,
  bill_title text,
  bill_amount bigint,
  payer uuid,
  people uuid[],
  day smallint
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  b public.recurring_bills;
  d record;
  billed_this_month boolean;
begin
  select * into d from public.bill_dates(day);
  select * into b from public.recurring_bills where id = bid for update;
  if not found or not public.is_group_member(b.group_id) then
    raise exception 'Bill not found' using errcode = 'P0002';
  end if;
  if me not in (b.created_by, b.paid_by) and not public.is_group_admin(b.group_id) then
    raise exception 'Only whoever set it up, the payer, or an admin can change this' using errcode = '42501';
  end if;
  perform public.check_bill_people(b.group_id, payer, people);

  billed_this_month := exists (
    select 1 from public.expenses
    where recurring_bill_id = bid and deleted_at is null
      and date_trunc('month', occurred_on) = date_trunc('month', d.today)
  );

  update public.recurring_bills
  set title = trim(bill_title), amount = bill_amount, paid_by = payer, participants = people, day_of_month = day,
      next_run_on = case when not billed_this_month and d.this_month >= d.today then d.this_month else d.next_month end
  where id = bid;

  insert into public.activity_log (group_id, actor, action, entity_id, details)
  values (b.group_id, me, 'bill.updated', bid, jsonb_build_object(
    'title', trim(bill_title),
    'before', jsonb_build_object('title', b.title, 'amount', b.amount, 'day', b.day_of_month),
    'after', jsonb_build_object('title', trim(bill_title), 'amount', bill_amount, 'day', day)));
end;
$$;

-- Stops future charges. Charges already billed stay in the book.
create function public.delete_recurring_bill(bid uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  b public.recurring_bills;
begin
  select * into b from public.recurring_bills where id = bid for update;
  if not found or not public.is_group_member(b.group_id) then
    raise exception 'Bill not found' using errcode = 'P0002';
  end if;
  if me not in (b.created_by, b.paid_by) and not public.is_group_admin(b.group_id) then
    raise exception 'Only whoever set it up, the payer, or an admin can delete this' using errcode = '42501';
  end if;
  delete from public.recurring_bills where id = bid;
  insert into public.activity_log (group_id, actor, action, entity_id, details)
  values (b.group_id, me, 'bill.deleted', bid, jsonb_build_object('title', b.title, 'amount', b.amount));
end;
$$;

revoke execute on function public.create_recurring_bill(uuid, text, bigint, uuid, uuid[], smallint, boolean) from public;
revoke execute on function public.update_recurring_bill(uuid, text, bigint, uuid, uuid[], smallint) from public;
revoke execute on function public.delete_recurring_bill(uuid) from public;
grant execute on function public.create_recurring_bill(uuid, text, bigint, uuid, uuid[], smallint, boolean) to authenticated;
grant execute on function public.update_recurring_bill(uuid, text, bigint, uuid, uuid[], smallint) to authenticated;
grant execute on function public.delete_recurring_bill(uuid) to authenticated;
