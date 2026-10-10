-- Editing an expense: same people who may delete it (whoever logged it,
-- whoever paid, or an admin). The registration number stays; the old and new
-- values land in the activity log through the existing trigger.

create function public.update_expense(
  eid uuid,
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
  expense_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  e public.expenses;
  item jsonb;
  claim jsonb;
  iid uuid;
  pos smallint := 0;
begin
  select * into e from public.expenses where id = eid and deleted_at is null for update;
  if not found or not public.is_group_member(e.group_id) then
    raise exception 'Expense not found' using errcode = 'P0002';
  end if;
  if me not in (e.created_by, e.paid_by) and not public.is_group_admin(e.group_id) then
    raise exception 'Only whoever logged or paid it, or an admin, can change this' using errcode = '42501';
  end if;
  perform public.assert_member(e.group_id, payer);
  if jsonb_typeof(shares) <> 'array' or jsonb_array_length(shares) = 0 then
    raise exception 'An expense needs at least one share' using errcode = '22023';
  end if;

  update public.expenses
  set title = trim(expense_title), total = expense_total, paid_by = payer, split_method = method,
      tax = tax_amount, service = service_amount, discount = discount_amount,
      occurred_on = coalesce(on_date, e.occurred_on), note = nullif(trim(expense_note), ''), updated_at = now()
  where id = eid;

  delete from public.expense_shares where expense_id = eid;
  delete from public.expense_items where expense_id = eid;

  for item in select * from jsonb_array_elements(shares) loop
    perform public.assert_member(e.group_id, (item ->> 'user_id')::uuid);
    insert into public.expense_shares (expense_id, user_id, amount)
    values (eid, (item ->> 'user_id')::uuid, (item ->> 'amount')::bigint);
  end loop;
  if (select sum(amount) from public.expense_shares where expense_id = eid) <> expense_total then
    raise exception 'Shares do not add up to the total' using errcode = '23514';
  end if;

  for item in select * from jsonb_array_elements(items) loop
    insert into public.expense_items (expense_id, position, name, amount)
    values (eid, pos, trim(item ->> 'name'), (item ->> 'amount')::bigint)
    returning id into iid;
    pos := pos + 1;
    for claim in select * from jsonb_array_elements(item -> 'claims') loop
      perform public.assert_member(e.group_id, (claim ->> 'user_id')::uuid);
      insert into public.item_claims (item_id, user_id, weight)
      values (iid, (claim ->> 'user_id')::uuid, coalesce((claim ->> 'weight')::smallint, 1));
    end loop;
  end loop;
end;
$$;

revoke execute on function public.update_expense(uuid, text, bigint, uuid, text, jsonb, jsonb, bigint, bigint, bigint, date, text) from public;
grant execute on function public.update_expense(uuid, text, bigint, uuid, text, jsonb, jsonb, bigint, bigint, bigint, date, text) to authenticated;
