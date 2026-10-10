-- Row level security for identity, groups, invites and payment methods.
-- Alice owns a group, Bob joins it through an invite, Carol is an outsider.
begin;
select plan(24);

create schema if not exists tests;
create function tests.act_as(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
end;
$$;
create function tests.act_as_server() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end;
$$;
grant usage on schema tests to authenticated, anon;
grant execute on all functions in schema tests to authenticated, anon;

insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('00000000-0000-0000-0000-00000000000a', 'alice@example.com', '{"full_name": "Alice"}', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000b', 'bob@example.com', '{"name": "Bob"}', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000c', 'carol@example.com', '{}', 'authenticated', 'authenticated');

select is(
  (select display_name from public.profiles where id = '00000000-0000-0000-0000-00000000000c'),
  'carol',
  'a new account gets a profile named after its email when no name is given'
);
select ok(
  exists (select 1 from public.contact_channels where user_id = '00000000-0000-0000-0000-00000000000a'),
  'a new account gets private contact settings'
);

-- Alice creates a group and adds a payment method.
select tests.act_as('00000000-0000-0000-0000-00000000000a');
create temp table ctx (gid uuid, token text) on commit drop;
grant all on ctx to authenticated;
insert into ctx (gid) select public.create_group('Circle Pesut');
insert into public.payment_methods (user_id, provider, account_number, account_name)
values ('00000000-0000-0000-0000-00000000000a', 'bca', '1234567890', 'Alice');

select is(
  (select role from public.group_members where group_id = (select gid from ctx)),
  'admin',
  'the creator becomes the group admin'
);

-- Bob is not in the group yet.
select tests.act_as('00000000-0000-0000-0000-00000000000b');
select is((select count(*) from public.groups)::int, 0, 'outsiders cannot see a group');
select is((select count(*) from public.profiles where id = '00000000-0000-0000-0000-00000000000a')::int, 0,
  'outsiders cannot see the members of a group');
select is((select count(*) from public.payment_methods)::int, 0, 'outsiders cannot see account numbers');
select throws_ok(
  $$ insert into public.group_members (group_id, user_id) select gid, '00000000-0000-0000-0000-00000000000b' from ctx $$,
  '42501', null, 'nobody can add themselves to a group directly'
);
select throws_ok(
  $$ select public.create_invite((select gid from ctx)) $$,
  '42501', null, 'non-members cannot create invites'
);

-- Alice invites, Bob peeks and joins.
select tests.act_as('00000000-0000-0000-0000-00000000000a');
update ctx set token = public.create_invite(gid);
select matches((select token from ctx), '^[0-9a-f]{64}$', 'invites are 32 random bytes in hex');
select is(
  (select count(*) from public.group_invites where token_hash = extensions.digest((select token from ctx), 'sha256'))::int,
  1,
  'only the hash of the invite token is stored'
);

select tests.act_as('00000000-0000-0000-0000-00000000000b');
select is((select group_name from public.peek_invite((select token from ctx))), 'Circle Pesut',
  'an invitee can see the group name before joining');
select is(public.accept_invite((select token from ctx)), (select gid from ctx), 'accepting an invite joins the group');
select is(public.accept_invite((select token from ctx)), (select gid from ctx), 'accepting twice is harmless');
select is((select count(*) from public.profiles)::int, 2, 'members see each other');
select is((select account_number from public.payment_methods), '1234567890', 'members see where to pay each other');
select throws_ok(
  $$ select public.create_invite((select gid from ctx)) $$,
  '42501', null, 'plain members cannot create invites'
);

update public.groups set name = 'Hijacked' where id = (select gid from ctx);
select tests.act_as_server();
select is((select name from public.groups where id = (select gid from ctx)), 'Circle Pesut',
  'plain members cannot rename the group');

select tests.act_as('00000000-0000-0000-0000-00000000000b');
select throws_ok(
  $$ update public.groups set next_number = 1000 where id = (select gid from ctx) $$,
  '42501', null, 'nobody can move the registration counter'
);
select throws_ok(
  $$ insert into public.payment_methods (user_id, provider, account_number, account_name)
     values ('00000000-0000-0000-0000-00000000000a', 'bca', '999999999', 'Bob pretending') $$,
  '42501', null, 'nobody can add an account in someone else''s name'
);
select is((select count(*) from public.contact_channels)::int, 1, 'contact details stay private, even from group-mates');
select ok(
  exists (select 1 from public.activity_log where action = 'member.joined' and entity_id = '00000000-0000-0000-0000-00000000000b'),
  'joining is written to the activity log'
);
select throws_ok(
  $$ insert into public.activity_log (group_id, action) select gid, 'forged' from ctx $$,
  '42501', null, 'nobody can write to the activity log by hand'
);

-- The only admin cannot walk out on a group that still has members.
select tests.act_as('00000000-0000-0000-0000-00000000000a');
select throws_ok(
  $$ delete from public.group_members where user_id = '00000000-0000-0000-0000-00000000000a' $$,
  '23514', null, 'the last admin must hand over before leaving'
);

-- Revoked invites stop working.
update public.group_invites set revoked_at = now();
select tests.act_as('00000000-0000-0000-0000-00000000000c');
select throws_ok(
  $$ select public.accept_invite((select token from ctx)) $$,
  'P0002', null, 'a revoked invite cannot be used'
);

select * from finish();
rollback;
