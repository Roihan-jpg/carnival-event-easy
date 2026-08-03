begin;

create extension if not exists pgtap with schema extensions;
set local role postgres;
set local search_path = public, extensions;

select plan(34);

select has_type('public', 'user_role', 'user_role enum exists');
select has_table('public', 'profiles', 'profiles table exists');
select has_table('public', 'participants', 'participants table exists');
select has_table('public', 'score_sheets', 'score_sheets table exists');
select has_table('public', 'result_snapshots', 'result_snapshots table exists');
select has_table('public', 'audit_logs', 'audit_logs table exists');
select has_table(
  'public',
  'attraction_verifier_assignments',
  'attraction verifier assignments table exists'
);

select ok(
  not has_table_privilege('anon', 'public.participants', 'TRUNCATE'),
  'public role cannot truncate participants'
);
select ok(
  not has_table_privilege('authenticated', 'public.audit_logs', 'TRUNCATE'),
  'authenticated role cannot truncate audit logs'
);
select ok(
  not has_table_privilege(
    'authenticated',
    'public.participant_status_logs',
    'UPDATE'
  ),
  'participant status logs cannot be updated by authenticated users'
);
select ok(
  not has_table_privilege(
    'authenticated',
    'public.participant_status_logs',
    'DELETE'
  ),
  'participant status logs cannot be deleted by authenticated users'
);

select has_index(
  'public',
  'participants',
  'participants_event_sequence_idx',
  'participant sequence index exists'
);
select has_index(
  'public',
  'participants',
  'participants_event_category_status_idx',
  'participant category and status index exists'
);
select has_index(
  'public',
  'score_sheets',
  'score_sheets_event_participant_location_idx',
  'score sheet participant and location index exists'
);
select has_index(
  'public',
  'score_sheets',
  'score_sheets_event_status_idx',
  'score sheet status index exists'
);
select has_index(
  'public',
  'penalties',
  'penalties_event_participant_status_idx',
  'penalty status index exists'
);
select has_index(
  'public',
  'attraction_checks',
  'attraction_checks_event_participant_idx',
  'attraction check participant index exists'
);
select has_index(
  'public',
  'audit_logs',
  'audit_logs_event_created_at_idx',
  'audit event time index exists'
);

select is(
  (select count(*) from public.participants),
  20::bigint,
  'seed contains 20 participants'
);
select is(
  (
    select count(*)
    from public.participants p
    join public.participant_categories c on c.id = p.category_id
    where c.code = 'EDUCATION'
  ),
  3::bigint,
  'participants 1-3 are Education'
);
select is(
  (
    select count(*)
    from public.participants p
    join public.participant_categories c on c.id = p.category_id
    where c.code = 'GENERAL'
  ),
  17::bigint,
  'participants 4-20 are General'
);
select is(
  (select sum(max_score) from public.score_criteria where is_active),
  100::numeric,
  'active criteria total exactly 100'
);
select is(
  (select count(*) from public.judging_locations where is_active),
  3::bigint,
  'seed contains three active judging locations'
);
select is(
  (select count(*) from public.attraction_points where is_active),
  3::bigint,
  'seed contains three active attraction points'
);
select is(
  (
    select scheduled_departure_at
    from public.participants
    where sequence_number = 1
  ),
  '2026-08-22 10:30:00+07'::timestamptz,
  'first participant departs at 10:30 WIB'
);
select is(
  (
    select estimated_finish_at
    from public.participants
    where sequence_number = 20
  ),
  '2026-08-22 22:15:00+07'::timestamptz,
  'last participant is estimated to finish at 22:15 WIB'
);

insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  (
    '10000000-0000-4000-8000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'judge-a@test.local',
    '',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '10000000-0000-4000-8000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'judge-b@test.local',
    '',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '10000000-0000-4000-8000-000000000003',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'operator-a@test.local',
    '',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '10000000-0000-4000-8000-000000000004',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'operator-b@test.local',
    '',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  );

insert into public.profiles (id, full_name, role)
values
  (
    '10000000-0000-4000-8000-000000000001',
    'Judge A',
    'judge'
  ),
  (
    '10000000-0000-4000-8000-000000000002',
    'Judge B',
    'judge'
  ),
  (
    '10000000-0000-4000-8000-000000000003',
    'Operator A',
    'operator'
  ),
  (
    '10000000-0000-4000-8000-000000000004',
    'Operator B',
    'operator'
  );

insert into public.judge_assignments (
  event_id,
  judge_id,
  location_id,
  assigned_by
)
values
  (
    '00000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8100-000000000001',
    null
  ),
  (
    '00000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000002',
    '00000000-0000-4000-8100-000000000002',
    null
  );

insert into public.score_sheets (
  event_id,
  participant_id,
  location_id,
  judge_id
)
values
  (
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-9000-000000000001',
    '00000000-0000-4000-8100-000000000001',
    '10000000-0000-4000-8000-000000000001'
  ),
  (
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-9000-000000000001',
    '00000000-0000-4000-8100-000000000002',
    '10000000-0000-4000-8000-000000000002'
  );

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000001',
  true
);

select is(
  (select count(*) from public.score_sheets),
  1::bigint,
  'Judge A can read only their assigned score sheet'
);

set local role postgres;

select throws_ok(
  $$
    insert into public.score_entries (score_sheet_id, criterion_id, score)
    select
      sheet.id,
      '00000000-0000-4000-8400-000000000001'::uuid,
      1.5
    from public.score_sheets as sheet
    limit 1
  $$,
  '23514',
  'new row for relation "score_entries" violates check constraint "score_entries_score_check"',
  'fractional scores are rejected'
);

insert into public.attraction_verifier_assignments (
  event_id,
  operator_id,
  attraction_point_id,
  assigned_by
)
values
  (
    '00000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000003',
    '00000000-0000-4000-8200-000000000001',
    null
  ),
  (
    '00000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000004',
    '00000000-0000-4000-8200-000000000002',
    null
  );

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000003',
  true
);

select lives_ok(
  $$
    insert into public.attraction_checks (
      event_id,
      participant_id,
      attraction_point_id,
      status,
      verified_by
    )
    values (
      '00000000-0000-4000-8000-000000000001',
      '00000000-0000-4000-9000-000000000002',
      '00000000-0000-4000-8200-000000000001',
      'performed',
      '10000000-0000-4000-8000-000000000003'
    )
  $$,
  'assigned attraction verifier can record their point'
);

select throws_ok(
  $$
    insert into public.attraction_checks (
      event_id,
      participant_id,
      attraction_point_id,
      status,
      verified_by
    )
    values (
      '00000000-0000-4000-8000-000000000001',
      '00000000-0000-4000-9000-000000000002',
      '00000000-0000-4000-8200-000000000002',
      'performed',
      '10000000-0000-4000-8000-000000000003'
    )
  $$,
  '42501',
  'new row violates row-level security policy for table "attraction_checks"',
  'attraction verifier cannot record another point'
);

set local role postgres;

insert into public.result_snapshots (
  event_id,
  version,
  calculation_config,
  results,
  published_at
)
values
  (
    '00000000-0000-4000-8000-000000000001',
    1,
    '{}'::jsonb,
    '[]'::jsonb,
    null
  ),
  (
    '00000000-0000-4000-8000-000000000001',
    2,
    '{}'::jsonb,
    '[]'::jsonb,
    now()
  );

set local role anon;

select is(
  (
    select count(*)
    from public.result_snapshots
    where published_at is null
  ),
  0::bigint,
  'Public cannot read draft result snapshots'
);
select is(
  (select count(*) from public.get_published_results()),
  1::bigint,
  'Public can read one sanitized published result through RPC'
);

set local role postgres;

insert into public.audit_logs (action, entity_type)
values ('TEST_APPEND_ONLY', 'test');

select throws_ok(
  $$
    update public.audit_logs
    set action = 'TAMPERED'
    where action = 'TEST_APPEND_ONLY'
  $$,
  '42501',
  'audit_logs is append-only',
  'audit rows cannot be updated'
);
select throws_ok(
  $$
    delete from public.audit_logs
    where action = 'TEST_APPEND_ONLY'
  $$,
  '42501',
  'audit_logs is append-only',
  'audit rows cannot be deleted'
);

select * from finish();
rollback;
