-- Ledger functions: expenses, transfers and recurring bills.
begin;
select plan(24);

create schema if not exists tests;
create or replace function tests.act_as(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
end;
$$;
create or replace function tests.act_as_server() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end;
$$;
grant usage on schema tests to authenticated;
grant execute on all functions in schema tests to authenticated;

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'a@example.com', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000b1', 'b@example.com', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000c1', 'c@example.com', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000d1', 'outsider@example.com', 'authenticated', 'authenticated');

create temp table ctx (gid uuid, eid uuid, sid uuid) on commit drop;
grant all on ctx to authenticated;
insert into ctx default values;

-- A creates a group; B and C join.
select tests.act_as('00000000-0000-0000-0000-0000000000a1');
update ctx set gid = public.create_group('Kos Lt.2');
select tests.act_as_server();
insert into public.group_members (group_id, user_id)
select gid, u from ctx, unnest(array[
  '00000000-0000-0000-0000-0000000000b1'::uuid,
  '00000000-0000-0000-0000-0000000000c1'::uuid
]) as u;

-- A logs a 100k dinner split three ways.
select tests.act_as('00000000-0000-0000-0000-0000000000a1');
update ctx set eid = public.create_expense(
  (select gid from ctx), 'Nasi kuning', 100000, '00000000-0000-0000-0000-0000000000a1', 'equal',
  '[{"user_id":"00000000-0000-0000-0000-0000000000a1","amount":33334},
    {"user_id":"00000000-0000-0000-0000-0000000000b1","amount":33333},
    {"user_id":"00000000-0000-0000-0000-0000000000c1","amount":33333}]'::jsonb
);
select lives_ok($$ set constraints all immediate $$, 'the commit-time balance check passes for a valid expense');
set constraints all deferred;
select is((select number from public.expenses where id = (select eid from ctx)), 1, 'the first record gets PT-0001');
select is((select count(*) from public.expense_shares where expense_id = (select eid from ctx))::int, 3, 'every share is stored');
select ok(exists (select 1 from public.activity_log where action = 'expense.created'), 'logging an expense is recorded');

select throws_ok(
  $$ select public.create_expense((select gid from ctx), 'Wrong sum', 100000, '00000000-0000-0000-0000-0000000000a1', 'exact',
       '[{"user_id":"00000000-0000-0000-0000-0000000000a1","amount":50000}]'::jsonb) $$,
  '23514', null, 'shares that do not add up to the total are refused'
);
select throws_ok(
  $$ select public.create_expense((select gid from ctx), 'Sneaky', 1000, '00000000-0000-0000-0000-0000000000a1', 'equal',
       '[{"user_id":"00000000-0000-0000-0000-0000000000d1","amount":1000}]'::jsonb) $$,
  '42501', null, 'outsiders cannot be put on the bill'
);
select throws_ok(
  $$ insert into public.expenses (group_id, number, title, total, paid_by, split_method, created_by)
     select gid, 99, 'Direct', 1, '00000000-0000-0000-0000-0000000000a1', 'equal', '00000000-0000-0000-0000-0000000000a1' from ctx $$,
  '42501', null, 'expenses cannot be written to the table directly'
);

select tests.act_as('00000000-0000-0000-0000-0000000000d1');
select throws_ok(
  $$ select public.create_expense((select gid from ctx), 'Not mine', 1000, '00000000-0000-0000-0000-0000000000d1', 'equal',
       '[{"user_id":"00000000-0000-0000-0000-0000000000d1","amount":1000}]'::jsonb) $$,
  '42501', null, 'outsiders cannot log expenses in a group'
);
select is((select count(*) from public.expenses)::int, 0, 'outsiders cannot read a group''s expenses');

-- B pays A back; only A can confirm.
select tests.act_as('00000000-0000-0000-0000-0000000000b1');
update ctx set sid = public.mark_paid((select gid from ctx), '00000000-0000-0000-0000-0000000000a1', 33333, 'bca');
select is((select status from public.settlements where id = (select sid from ctx)), 'pending', 'a transfer starts out pending');
select is((select number from public.settlements where id = (select sid from ctx)), 2, 'transfers share the registration counter');
select throws_ok(
  $$ select public.decide_settlement((select sid from ctx), true) $$,
  '42501', null, 'the sender cannot confirm their own transfer'
);

select tests.act_as('00000000-0000-0000-0000-0000000000c1');
select throws_ok(
  $$ select public.decide_settlement((select sid from ctx), true) $$,
  '42501', null, 'a bystander cannot confirm someone else''s transfer'
);

select tests.act_as('00000000-0000-0000-0000-0000000000a1');
select lives_ok($$ select public.decide_settlement((select sid from ctx), true) $$, 'the receiver confirms');
select is((select status from public.settlements where id = (select sid from ctx)), 'confirmed', 'the transfer is confirmed');
select throws_ok(
  $$ select public.decide_settlement((select sid from ctx), false, 'changed my mind') $$,
  '22023', null, 'a decided transfer cannot be decided again'
);

-- C cannot delete A's expense; A can, and it stays in the log.
select tests.act_as('00000000-0000-0000-0000-0000000000c1');
select throws_ok($$ select public.delete_expense((select eid from ctx)) $$, '42501', null,
  'members cannot delete someone else''s expense');
select tests.act_as('00000000-0000-0000-0000-0000000000a1');
select lives_ok($$ select public.delete_expense((select eid from ctx)) $$, 'the payer can delete their expense');
select ok(exists (select 1 from public.activity_log where action = 'expense.deleted'), 'the deletion is logged');

-- A monthly WiFi bill of 100,001 over three people.
select public.create_recurring_bill((select gid from ctx), 'WiFi', 100001, '00000000-0000-0000-0000-0000000000a1',
  array['00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000c1']::uuid[], 1::smallint);
select tests.act_as_server();
update public.recurring_bills set next_run_on = current_date - 1;
select is(public.run_recurring_bills(), 1, 'a due bill becomes an expense');
select results_eq(
  $$ select s.amount from public.expense_shares s join public.expenses e on e.id = s.expense_id
     where e.title = 'WiFi' order by s.amount desc, s.user_id $$,
  $$ values (33334::bigint), (33334::bigint), (33333::bigint) $$,
  'leftover rupiah go to the earliest participants, like allocate()'
);
select ok((select next_run_on > current_date from public.recurring_bills), 'the bill moves to next month');
select lives_ok($$ set constraints all immediate $$, 'generated bills pass the commit-time balance check');
set constraints all deferred;

-- Auto-confirm picks up a transfer the receiver ignored.
select tests.act_as('00000000-0000-0000-0000-0000000000c1');
update ctx set sid = public.mark_paid((select gid from ctx), '00000000-0000-0000-0000-0000000000a1', 1000);
select tests.act_as_server();
update public.settlements set created_at = now() - interval '10 days' where id = (select sid from ctx);
select is(public.auto_confirm_settlements(), 1, 'ignored transfers are auto-confirmed after the grace period');

select * from finish();
rollback;
