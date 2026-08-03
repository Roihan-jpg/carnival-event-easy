create type public.incident_status as enum ('open', 'handled');

create table public.incidents (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  participant_id uuid not null,
  incident_type text not null check (length(btrim(incident_type)) > 0),
  note text not null check (length(btrim(note)) > 0),
  status public.incident_status not null default 'open',
  recorded_by uuid not null references public.profiles (id) on delete restrict,
  occurred_at timestamptz not null default now(),
  handled_at timestamptz,
  created_at timestamptz not null default now(),
  constraint incidents_participant_event_fk
    foreign key (participant_id, event_id)
    references public.participants (id, event_id),
  constraint incidents_handled_check check (
    status <> 'handled' or handled_at is not null
  )
);

create index incidents_event_status_occurred_idx
  on public.incidents (event_id, status, occurred_at desc);

create table public.jury_council_decisions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  category_id uuid not null,
  participant_id uuid not null,
  priority integer not null check (priority > 0),
  minutes_reference text not null check (length(btrim(minutes_reference)) > 0),
  decided_by uuid not null references public.profiles (id) on delete restrict,
  decided_at timestamptz not null default now(),
  constraint jury_council_category_event_fk
    foreign key (category_id, event_id)
    references public.participant_categories (id, event_id),
  constraint jury_council_participant_event_fk
    foreign key (participant_id, event_id)
    references public.participants (id, event_id),
  constraint jury_council_event_participant_key unique (event_id, participant_id),
  constraint jury_council_event_category_priority_key unique (event_id, category_id, priority)
);

alter table public.incidents enable row level security;
alter table public.jury_council_decisions enable row level security;

grant select, insert, update on public.incidents to authenticated;
grant select on public.jury_council_decisions to authenticated;
grant all privileges on public.incidents, public.jury_council_decisions to service_role;

create policy incidents_admin_operator_select
on public.incidents for select to authenticated
using ((select public.is_admin()) or public.current_user_role() = 'operator');

create policy incidents_admin_operator_insert
on public.incidents for insert to authenticated
with check (
  ((select public.is_admin()) or public.current_user_role() = 'operator')
  and recorded_by = (select auth.uid())
);

create policy incidents_admin_operator_update
on public.incidents for update to authenticated
using ((select public.is_admin()) or recorded_by = (select auth.uid()))
with check ((select public.is_admin()) or recorded_by = (select auth.uid()));

create policy jury_council_admin_select
on public.jury_council_decisions for select to authenticated
using ((select public.is_admin()));

create function public.validate_score_entry()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  sheet_event_id uuid;
  sheet_status public.score_sheet_status;
  criterion_event_id uuid;
  criterion_max numeric;
begin
  select sheet.event_id, sheet.status
    into sheet_event_id, sheet_status
  from public.score_sheets as sheet
  where sheet.id = new.score_sheet_id;

  select criterion.event_id, criterion.max_score
    into criterion_event_id, criterion_max
  from public.score_criteria as criterion
  where criterion.id = new.criterion_id
    and criterion.is_active;

  if sheet_event_id is null or criterion_event_id is null
     or sheet_event_id <> criterion_event_id then
    raise exception using errcode = '23514', message = 'score_criterion_event_mismatch';
  end if;
  if sheet_status not in ('draft', 'unlocked') then
    raise exception using errcode = 'P0001', message = 'score_sheet_locked';
  end if;
  if new.score > criterion_max then
    raise exception using errcode = '23514', message = 'score_exceeds_criterion_maximum';
  end if;
  if new.score = 0 and length(btrim(coalesce(new.note, ''))) = 0 then
    raise exception using errcode = '23514', message = 'zero_score_requires_reason';
  end if;
  return new;
end;
$$;

create trigger score_entries_validate
before insert or update on public.score_entries
for each row execute function public.validate_score_entry();

create function public.recalculate_score_sheet_total()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_sheet_id uuid := coalesce(new.score_sheet_id, old.score_sheet_id);
begin
  update public.score_sheets
  set total_score = coalesce((
    select sum(entry.score)
    from public.score_entries as entry
    where entry.score_sheet_id = target_sheet_id
  ), 0)
  where id = target_sheet_id;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger score_entries_recalculate_total
after insert or update or delete on public.score_entries
for each row execute function public.recalculate_score_sheet_total();

create function public.protect_sensitive_state_changes()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  allowed boolean := current_setting('app.sensitive_operation', true) = 'allowed';
begin
  if tg_table_name = 'score_sheets' then
    if tg_op = 'INSERT' and new.status <> 'draft' and not allowed then
      raise exception using errcode = '42501', message = 'score_status_requires_rpc';
    end if;
    if tg_op = 'UPDATE' and new.status is distinct from old.status and not allowed then
      raise exception using errcode = '42501', message = 'score_status_requires_rpc';
    end if;
  elsif tg_table_name = 'events' then
    if tg_op = 'UPDATE' and new.status is distinct from old.status and not allowed then
      raise exception using errcode = '42501', message = 'event_status_requires_rpc';
    end if;
    if tg_op = 'UPDATE' and old.config_locked_at is not null and (
      new.aggregation_method is distinct from old.aggregation_method
      or new.rounding_scale is distinct from old.rounding_scale
      or new.attraction_mode is distinct from old.attraction_mode
      or new.attraction_point_value is distinct from old.attraction_point_value
      or new.tie_break_config is distinct from old.tie_break_config
    ) and not allowed then
      raise exception using errcode = '42501', message = 'event_configuration_locked';
    end if;
  end if;
  return new;
end;
$$;

create trigger score_sheets_protect_sensitive_state
before insert or update on public.score_sheets
for each row execute function public.protect_sensitive_state_changes();

create trigger events_protect_sensitive_state
before update on public.events
for each row execute function public.protect_sensitive_state_changes();

create function public.audit_domain_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  before_row jsonb := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  after_row jsonb := case when tg_op = 'DELETE' then null else to_jsonb(new) end;
  source_row jsonb := coalesce(after_row, before_row);
  source_event_id uuid;
  source_entity_id text;
begin
  source_event_id := nullif(source_row ->> 'event_id', '')::uuid;
  source_entity_id := source_row ->> 'id';
  insert into public.audit_logs (
    event_id, actor_id, action, entity_type, entity_id, before_data, after_data
  ) values (
    source_event_id,
    (select auth.uid()),
    upper(tg_table_name || '_' || tg_op),
    tg_table_name,
    source_entity_id,
    before_row,
    after_row
  );
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger participants_audit_mutation
after insert or update on public.participants
for each row execute function public.audit_domain_mutation();

create trigger profiles_audit_mutation
after insert or update on public.profiles
for each row execute function public.audit_domain_mutation();

create trigger judge_assignments_audit_mutation
after insert or update on public.judge_assignments
for each row execute function public.audit_domain_mutation();

create trigger attraction_assignments_audit_mutation
after insert or update on public.attraction_verifier_assignments
for each row execute function public.audit_domain_mutation();

create trigger event_config_audit_mutation
after update on public.events
for each row execute function public.audit_domain_mutation();

create trigger score_criteria_audit_mutation
after insert or update on public.score_criteria
for each row execute function public.audit_domain_mutation();

create trigger penalties_audit_mutation
after insert or update on public.penalties
for each row execute function public.audit_domain_mutation();

create trigger incidents_audit_mutation
after insert or update on public.incidents
for each row execute function public.audit_domain_mutation();

drop policy score_sheets_update_admin_or_assigned_judge on public.score_sheets;
create policy score_sheets_update_admin_or_editable_assigned_judge
on public.score_sheets for update to authenticated
using (
  (select public.is_admin())
  or (
    judge_id = (select auth.uid())
    and status in ('draft', 'unlocked')
    and public.has_active_judge_assignment(event_id, location_id)
  )
)
with check (
  (select public.is_admin())
  or (
    judge_id = (select auth.uid())
    and status in ('draft', 'unlocked')
    and public.has_active_judge_assignment(event_id, location_id)
  )
);

drop policy penalties_admin_update on public.penalties;
drop policy result_snapshots_admin_insert on public.result_snapshots;
drop policy result_snapshots_admin_update on public.result_snapshots;

create function public.ensure_score_sheet(target_participant_id uuid)
returns public.score_sheets
language plpgsql
security definer
set search_path = ''
as $$
declare
  participant_event_id uuid;
  assigned_location_id uuid;
  event_state public.event_status;
  result public.score_sheets;
begin
  if public.current_user_role() <> 'judge' then
    raise exception using errcode = '42501', message = 'judge_role_required';
  end if;

  select participant.event_id, event.status
    into participant_event_id, event_state
  from public.participants as participant
  join public.events as event on event.id = participant.event_id
  where participant.id = target_participant_id and participant.is_active;

  if participant_event_id is null then
    raise exception using errcode = 'P0002', message = 'participant_not_found';
  end if;
  if event_state <> 'scoring_open' then
    raise exception using errcode = 'P0001', message = 'scoring_not_open';
  end if;

  select assignment.location_id into assigned_location_id
  from public.judge_assignments as assignment
  where assignment.event_id = participant_event_id
    and assignment.judge_id = (select auth.uid())
    and assignment.revoked_at is null;

  if assigned_location_id is null then
    raise exception using errcode = '42501', message = 'judge_assignment_required';
  end if;

  insert into public.score_sheets (event_id, participant_id, location_id, judge_id)
  values (participant_event_id, target_participant_id, assigned_location_id, (select auth.uid()))
  on conflict (event_id, participant_id, location_id) do nothing;

  select sheet.* into result
  from public.score_sheets as sheet
  where sheet.event_id = participant_event_id
    and sheet.participant_id = target_participant_id
    and sheet.location_id = assigned_location_id
    and sheet.judge_id = (select auth.uid());

  if result.id is null then
    raise exception using errcode = '42501', message = 'score_sheet_owned_by_other_judge';
  end if;
  return result;
end;
$$;

create function public.save_score_draft(
  target_sheet_id uuid,
  expected_version integer,
  entries jsonb,
  general_note text default null
)
returns public.score_sheets
language plpgsql
security definer
set search_path = ''
as $$
declare
  sheet public.score_sheets;
  item jsonb;
  result public.score_sheets;
begin
  if public.current_user_role() <> 'judge' then
    raise exception using errcode = '42501', message = 'judge_role_required';
  end if;
  if jsonb_typeof(entries) <> 'array' then
    raise exception using errcode = '22023', message = 'entries_must_be_array';
  end if;

  select current_sheet.* into sheet
  from public.score_sheets as current_sheet
  join public.events as event on event.id = current_sheet.event_id
  where current_sheet.id = target_sheet_id
    and current_sheet.judge_id = (select auth.uid())
    and event.status = 'scoring_open'
    and public.has_active_judge_assignment(current_sheet.event_id, current_sheet.location_id)
  for update of current_sheet;

  if sheet.id is null then
    raise exception using errcode = '42501', message = 'score_sheet_not_accessible';
  end if;
  if sheet.status not in ('draft', 'unlocked') then
    raise exception using errcode = 'P0001', message = 'score_sheet_locked';
  end if;
  if sheet.version <> expected_version then
    raise exception using errcode = 'P0001', message = 'version_conflict';
  end if;

  perform set_config('app.sensitive_operation', 'allowed', true);

  for item in select value from jsonb_array_elements(entries)
  loop
    insert into public.score_entries (score_sheet_id, criterion_id, score, note)
    values (
      target_sheet_id,
      (item ->> 'criterion_id')::uuid,
      (item ->> 'score')::numeric,
      nullif(btrim(item ->> 'note'), '')
    )
    on conflict (score_sheet_id, criterion_id) do update
    set score = excluded.score, note = excluded.note;
  end loop;

  update public.score_sheets
  set general_note = nullif(btrim(general_note), ''), version = version + 1
  where id = target_sheet_id
  returning * into result;
  return result;
end;
$$;

create function public.submit_score_sheet(target_sheet_id uuid, expected_version integer)
returns public.score_sheets
language plpgsql
security definer
set search_path = ''
as $$
declare
  sheet public.score_sheets;
  criterion_count integer;
  entry_count integer;
  criterion_total numeric;
  calculated_total numeric;
  result public.score_sheets;
begin
  if public.current_user_role() <> 'judge' then
    raise exception using errcode = '42501', message = 'judge_role_required';
  end if;

  select current_sheet.* into sheet
  from public.score_sheets as current_sheet
  join public.events as event on event.id = current_sheet.event_id
  where current_sheet.id = target_sheet_id
    and current_sheet.judge_id = (select auth.uid())
    and event.status = 'scoring_open'
    and public.has_active_judge_assignment(current_sheet.event_id, current_sheet.location_id)
  for update of current_sheet;

  if sheet.id is null then
    raise exception using errcode = '42501', message = 'score_sheet_not_accessible';
  end if;
  if sheet.status = 'submitted' then return sheet; end if;
  if sheet.status not in ('draft', 'unlocked') then
    raise exception using errcode = 'P0001', message = 'score_sheet_locked';
  end if;
  if sheet.version <> expected_version then
    raise exception using errcode = 'P0001', message = 'version_conflict';
  end if;

  select count(*), sum(max_score) into criterion_count, criterion_total
  from public.score_criteria
  where event_id = sheet.event_id and is_active;

  select count(*), coalesce(sum(entry.score), 0) into entry_count, calculated_total
  from public.score_entries as entry
  join public.score_criteria as criterion on criterion.id = entry.criterion_id
  where entry.score_sheet_id = target_sheet_id
    and criterion.event_id = sheet.event_id
    and criterion.is_active;

  if criterion_count <> 8 or criterion_total <> 100 or entry_count <> criterion_count then
    raise exception using errcode = 'P0001', message = 'score_sheet_incomplete';
  end if;

  perform set_config('app.sensitive_operation', 'allowed', true);
  update public.score_sheets
  set status = 'submitted', total_score = calculated_total,
      submitted_at = now(), version = version + 1
  where id = target_sheet_id
  returning * into result;

  insert into public.audit_logs (event_id, actor_id, action, entity_type, entity_id, before_data, after_data)
  values (sheet.event_id, (select auth.uid()), 'SCORE_SUBMITTED', 'score_sheet', target_sheet_id::text,
    jsonb_build_object('status', sheet.status, 'version', sheet.version),
    jsonb_build_object('status', result.status, 'version', result.version, 'total_score', result.total_score));
  return result;
end;
$$;

create function public.unlock_score_sheet(target_sheet_id uuid, reason text)
returns public.score_sheets
language plpgsql
security definer
set search_path = ''
as $$
declare
  sheet public.score_sheets;
  result public.score_sheets;
begin
  if not public.is_super_admin() then
    raise exception using errcode = '42501', message = 'super_admin_required';
  end if;
  if length(btrim(coalesce(reason, ''))) = 0 then
    raise exception using errcode = '22023', message = 'unlock_reason_required';
  end if;
  select * into sheet from public.score_sheets where id = target_sheet_id for update;
  if sheet.status <> 'submitted' then
    raise exception using errcode = 'P0001', message = 'submitted_sheet_required';
  end if;
  perform set_config('app.sensitive_operation', 'allowed', true);
  update public.score_sheets
  set status = 'unlocked', unlocked_at = now(), unlock_reason = btrim(reason), version = version + 1
  where id = target_sheet_id returning * into result;
  insert into public.audit_logs (event_id, actor_id, action, entity_type, entity_id, before_data, after_data, metadata)
  values (sheet.event_id, (select auth.uid()), 'SCORE_UNLOCKED', 'score_sheet', target_sheet_id::text,
    to_jsonb(sheet), to_jsonb(result), jsonb_build_object('reason', btrim(reason)));
  return result;
end;
$$;

create function public.waive_missing_score(
  target_participant_id uuid,
  target_location_id uuid,
  reason text,
  minutes_reference text
)
returns public.score_sheets
language plpgsql
security definer
set search_path = ''
as $$
declare
  participant_event_id uuid;
  assigned_judge_id uuid;
  submitted_count integer;
  result public.score_sheets;
begin
  if not public.is_super_admin() then
    raise exception using errcode = '42501', message = 'super_admin_required';
  end if;
  if length(btrim(coalesce(reason, ''))) = 0 or length(btrim(coalesce(minutes_reference, ''))) = 0 then
    raise exception using errcode = '22023', message = 'waiver_reason_and_minutes_required';
  end if;
  select event_id into participant_event_id from public.participants where id = target_participant_id and is_active;
  select judge_id into assigned_judge_id from public.judge_assignments
  where event_id = participant_event_id and location_id = target_location_id and revoked_at is null;
  select count(*) into submitted_count from public.score_sheets
  where event_id = participant_event_id and participant_id = target_participant_id and status = 'submitted';
  if assigned_judge_id is null or submitted_count < 2 then
    raise exception using errcode = 'P0001', message = 'waiver_requires_two_submitted_scores';
  end if;
  perform set_config('app.sensitive_operation', 'allowed', true);
  insert into public.score_sheets (
    event_id, participant_id, location_id, judge_id, status, total_score,
    general_note, submitted_at, version
  ) values (
    participant_event_id, target_participant_id, target_location_id, assigned_judge_id,
    'waived', 0, btrim(reason), now(), 1
  )
  on conflict (event_id, participant_id, location_id) do update
  set status = 'waived', total_score = 0, general_note = excluded.general_note,
      submitted_at = now(), version = public.score_sheets.version + 1
  where public.score_sheets.status <> 'submitted'
  returning * into result;
  if result.id is null then
    raise exception using errcode = 'P0001', message = 'submitted_score_cannot_be_waived';
  end if;
  insert into public.audit_logs (event_id, actor_id, action, entity_type, entity_id, after_data, metadata)
  values (participant_event_id, (select auth.uid()), 'SCORE_WAIVED', 'score_sheet', result.id::text,
    to_jsonb(result), jsonb_build_object('reason', btrim(reason), 'minutes_reference', btrim(minutes_reference)));
  return result;
end;
$$;

create function public.update_participant_status(
  target_participant_id uuid,
  target_status public.participant_status,
  note text default null,
  actual_at timestamptz default now()
)
returns public.participants
language plpgsql
security definer
set search_path = ''
as $$
declare
  participant public.participants;
  result public.participants;
begin
  if public.current_user_role() not in ('super_admin', 'admin', 'operator') then
    raise exception using errcode = '42501', message = 'operator_or_admin_required';
  end if;
  select * into participant from public.participants where id = target_participant_id for update;
  if participant.id is null then raise exception using errcode = 'P0002', message = 'participant_not_found'; end if;
  update public.participants
  set status = target_status,
      actual_departure_at = case when target_status = 'departed' then actual_at else actual_departure_at end,
      actual_finish_at = case when target_status in ('arrived', 'completed') then actual_at else actual_finish_at end
  where id = target_participant_id returning * into result;
  insert into public.participant_status_logs (event_id, participant_id, from_status, to_status, note, recorded_by, recorded_at)
  values (participant.event_id, participant.id, participant.status, target_status, nullif(btrim(note), ''), (select auth.uid()), actual_at);
  insert into public.audit_logs (event_id, actor_id, action, entity_type, entity_id, before_data, after_data)
  values (participant.event_id, (select auth.uid()), 'PARTICIPANT_STATUS_CHANGED', 'participant', participant.id::text,
    jsonb_build_object('status', participant.status), jsonb_build_object('status', target_status, 'actual_at', actual_at));
  return result;
end;
$$;

create function public.record_attraction_check(
  target_participant_id uuid,
  target_point_id uuid,
  target_status public.attraction_check_status,
  note text default null,
  evidence_path text default null
)
returns public.attraction_checks
language plpgsql
security definer
set search_path = ''
as $$
declare
  participant_event_id uuid;
  result public.attraction_checks;
begin
  select event_id into participant_event_id from public.participants where id = target_participant_id and is_active;
  if participant_event_id is null then raise exception using errcode = 'P0002', message = 'participant_not_found'; end if;
  if not public.is_admin() and not public.has_active_attraction_assignment(participant_event_id, target_point_id) then
    raise exception using errcode = '42501', message = 'attraction_assignment_required';
  end if;
  insert into public.attraction_checks (
    event_id, participant_id, attraction_point_id, status, verified_by, verified_at, note, evidence_path
  ) values (
    participant_event_id, target_participant_id, target_point_id, target_status,
    (select auth.uid()), now(), nullif(btrim(note), ''), nullif(btrim(evidence_path), '')
  )
  on conflict (event_id, participant_id, attraction_point_id) do update
  set status = excluded.status, verified_by = excluded.verified_by, verified_at = excluded.verified_at,
      note = excluded.note, evidence_path = excluded.evidence_path
  returning * into result;
  insert into public.audit_logs (event_id, actor_id, action, entity_type, entity_id, after_data)
  values (participant_event_id, (select auth.uid()), 'ATTRACTION_CHECK_RECORDED', 'attraction_check', result.id::text, to_jsonb(result));
  return result;
end;
$$;

create function public.confirm_penalty(target_penalty_id uuid)
returns public.penalties
language plpgsql
security definer
set search_path = ''
as $$
declare
  penalty public.penalties;
  approval_required boolean;
  result public.penalties;
begin
  if not public.is_admin() then raise exception using errcode = '42501', message = 'admin_required'; end if;
  select item.* into penalty
  from public.penalties as item
  where item.id = target_penalty_id
  for update;
  select penalty_type.requires_approval into approval_required
  from public.penalty_types as penalty_type
  where penalty_type.id = penalty.penalty_type_id;
  if penalty.status <> 'draft' then raise exception using errcode = 'P0001', message = 'draft_penalty_required'; end if;
  if approval_required and not public.is_super_admin() then
    raise exception using errcode = '42501', message = 'heavy_penalty_requires_super_admin';
  end if;
  update public.penalties set status = 'confirmed', confirmed_by = (select auth.uid()), confirmed_at = now()
  where id = target_penalty_id returning * into result;
  insert into public.audit_logs (event_id, actor_id, action, entity_type, entity_id, before_data, after_data)
  values (penalty.event_id, (select auth.uid()), 'PENALTY_CONFIRMED', 'penalty', penalty.id::text, to_jsonb(penalty), to_jsonb(result));
  return result;
end;
$$;

create function public.cancel_penalty(target_penalty_id uuid, reason text)
returns public.penalties
language plpgsql
security definer
set search_path = ''
as $$
declare
  penalty public.penalties;
  result public.penalties;
begin
  if not public.is_admin() then raise exception using errcode = '42501', message = 'admin_required'; end if;
  if length(btrim(coalesce(reason, ''))) = 0 then raise exception using errcode = '22023', message = 'cancellation_reason_required'; end if;
  select * into penalty from public.penalties where id = target_penalty_id for update;
  if penalty.status = 'cancelled' then return penalty; end if;
  update public.penalties set status = 'cancelled', cancelled_by = (select auth.uid()), cancelled_at = now()
  where id = target_penalty_id returning * into result;
  insert into public.audit_logs (event_id, actor_id, action, entity_type, entity_id, before_data, after_data, metadata)
  values (penalty.event_id, (select auth.uid()), 'PENALTY_CANCELLED', 'penalty', penalty.id::text,
    to_jsonb(penalty), to_jsonb(result), jsonb_build_object('reason', btrim(reason)));
  return result;
end;
$$;

create function public.transition_event_status(target_event_id uuid, target_status public.event_status)
returns public.events
language plpgsql
security definer
set search_path = ''
as $$
declare
  event public.events;
  active_criteria integer;
  criteria_total numeric;
  active_locations integer;
  active_assignments integer;
  active_points integer;
  result public.events;
begin
  if not public.is_admin() then raise exception using errcode = '42501', message = 'admin_required'; end if;
  select * into event from public.events where id = target_event_id for update;
  if target_status = 'scoring_open' then
    select count(*), coalesce(sum(max_score), 0) into active_criteria, criteria_total
      from public.score_criteria where event_id = target_event_id and is_active;
    select count(*) into active_locations from public.judging_locations where event_id = target_event_id and is_active;
    select count(*) into active_assignments from public.judge_assignments where event_id = target_event_id and revoked_at is null;
    select count(*) into active_points from public.attraction_points where event_id = target_event_id and is_active;
    if active_criteria <> 8 or criteria_total <> 100 or active_locations <> 3
       or active_assignments <> 3 or active_points <> 3 then
      raise exception using errcode = 'P0001', message = 'configuration_incomplete';
    end if;
    if event.status not in ('draft', 'configured') then raise exception using errcode = 'P0001', message = 'invalid_event_transition'; end if;
  elsif target_status = 'scoring_closed' then
    if event.status <> 'scoring_open' then raise exception using errcode = 'P0001', message = 'invalid_event_transition'; end if;
  elsif target_status = 'configured' then
    if event.status <> 'draft' then raise exception using errcode = 'P0001', message = 'invalid_event_transition'; end if;
  else
    raise exception using errcode = '22023', message = 'unsupported_event_transition';
  end if;
  perform set_config('app.sensitive_operation', 'allowed', true);
  update public.events
  set status = target_status,
      config_locked_at = case when target_status = 'scoring_open' then now() else config_locked_at end
  where id = target_event_id returning * into result;
  insert into public.audit_logs (event_id, actor_id, action, entity_type, entity_id, before_data, after_data)
  values (target_event_id, (select auth.uid()), 'EVENT_STATUS_CHANGED', 'event', target_event_id::text,
    jsonb_build_object('status', event.status), jsonb_build_object('status', result.status));
  return result;
end;
$$;

create function public.calculate_event_results(target_event_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  event public.events;
  result jsonb;
begin
  if not public.is_admin() then raise exception using errcode = '42501', message = 'admin_required'; end if;
  select * into event from public.events where id = target_event_id;
  if event.id is null or event.aggregation_method is null or event.rounding_scale is null
     or jsonb_array_length(event.tie_break_config) < 6 then
    raise exception using errcode = 'P0001', message = 'configuration_incomplete';
  end if;

  with sheet_summary as (
    select sheet.participant_id,
      count(*) filter (where sheet.status = 'submitted') as submitted_count,
      count(*) filter (where sheet.status = 'waived') as waived_count,
      avg(sheet.total_score) filter (where sheet.status = 'submitted') as average_total,
      sum(sheet.total_score) filter (where sheet.status = 'submitted') as sum_total
    from public.score_sheets as sheet
    where sheet.event_id = target_event_id
    group by sheet.participant_id
  ), criterion_summary as (
    select sheet.participant_id,
      avg(entry.score) filter (where criterion.code = 'CONCEPT_ORIGINALITY') as concept_score,
      avg(entry.score) filter (where criterion.code = 'VISUAL_ARTISTRY') as visual_score,
      avg(entry.score) filter (where criterion.code = 'CULTURAL_VALUE') as cultural_score,
      avg(entry.score) filter (where criterion.code = 'DISCIPLINE_COHESION') as discipline_score
    from public.score_sheets as sheet
    join public.score_entries as entry on entry.score_sheet_id = sheet.id
    join public.score_criteria as criterion on criterion.id = entry.criterion_id
    where sheet.event_id = target_event_id and sheet.status = 'submitted'
    group by sheet.participant_id
  ), point_total as (
    select count(*) as total from public.attraction_points where event_id = target_event_id and is_active
  ), attraction_summary as (
    select participant.id as participant_id,
      count(check_item.id) filter (where check_item.status in ('performed', 'not_performed')) as resolved_count,
      count(check_item.id) filter (where check_item.status = 'unable_to_verify') as unable_count,
      coalesce(sum(case when check_item.status = 'performed' then
        coalesce(point.point_value, event.attraction_point_value, 0) else 0 end), 0) as attraction_total
    from public.participants as participant
    cross join public.events as event
    left join public.attraction_checks as check_item on check_item.participant_id = participant.id
    left join public.attraction_points as point on point.id = check_item.attraction_point_id and point.is_active
    where participant.event_id = target_event_id and event.id = target_event_id and participant.is_active
    group by participant.id
  ), penalty_summary as (
    select participant_id, coalesce(sum(deduction), 0) as penalty_total
    from public.penalties where event_id = target_event_id and status = 'confirmed'
    group by participant_id
  ), raw as (
    select participant.id as participant_id, participant.category_id, category.code as category_code,
      category.name as category_name, category.sort_order as category_sort_order,
      participant.sequence_number, participant.name as participant_name, participant.theme,
      coalesce(sheet.submitted_count, 0) as submitted_judges,
      coalesce(sheet.waived_count, 0) > 0 as waived,
      case when event.aggregation_method = 'average' then coalesce(sheet.average_total, 0)
           else coalesce(sheet.sum_total, 0) end as judge_score,
      attraction.attraction_total as attraction_points,
      coalesce(penalty.penalty_total, 0) as penalty_total,
      coalesce(criteria.concept_score, 0) as concept_score,
      coalesce(criteria.visual_score, 0) as visual_score,
      coalesce(criteria.cultural_score, 0) as cultural_score,
      coalesce(criteria.discipline_score, 0) as discipline_score,
      decision.priority as council_priority,
      decision.minutes_reference,
      ((coalesce(sheet.submitted_count, 0) = 3)
        or (coalesce(sheet.submitted_count, 0) >= 2 and coalesce(sheet.waived_count, 0) > 0))
        and attraction.resolved_count = point_total.total and attraction.unable_count = 0 as complete
    from public.participants as participant
    join public.participant_categories as category on category.id = participant.category_id
    cross join public.events as event
    cross join point_total
    left join sheet_summary as sheet on sheet.participant_id = participant.id
    left join criterion_summary as criteria on criteria.participant_id = participant.id
    left join attraction_summary as attraction on attraction.participant_id = participant.id
    left join penalty_summary as penalty on penalty.participant_id = participant.id
    left join public.jury_council_decisions as decision on decision.participant_id = participant.id
    where participant.event_id = target_event_id and participant.is_active and event.id = target_event_id
  ), calculated as (
    select raw.*,
      round(greatest(0, judge_score + attraction_points - penalty_total), event.rounding_scale) as final_score,
      case when complete then 'complete' else 'incomplete' end as status,
      case
        when submitted_judges < 2 then 'Nilai juri belum memenuhi minimum.'
        when submitted_judges < 3 and not waived then 'Nilai tiga juri belum lengkap dan belum ada waiver.'
        when not complete then 'Verifikasi atraksi wajib belum lengkap.'
        else ''
      end as incomplete_reason
    from raw cross join public.events as event where event.id = target_event_id
  ), tied as (
    select calculated.*,
      count(*) over (partition by category_id, final_score, concept_score, visual_score,
        cultural_score, discipline_score, penalty_total) > 1 and council_priority is null as tie_requires_council
    from calculated
  ), ranked as (
    select tied.*,
      case when complete then row_number() over (
        partition by category_id order by complete desc, final_score desc, concept_score desc,
          visual_score desc, cultural_score desc, discipline_score desc, penalty_total asc,
          council_priority asc nulls last, sequence_number asc
      ) end as rank
    from tied
  )
  select coalesce(jsonb_agg(to_jsonb(ranked) order by category_sort_order, rank nulls last, sequence_number), '[]'::jsonb)
  into result from ranked;
  return result;
end;
$$;

create function public.snapshot_event_results(target_event_id uuid)
returns public.result_snapshots
language plpgsql
security definer
set search_path = ''
as $$
declare
  event public.events;
  calculated jsonb;
  next_version integer;
  result public.result_snapshots;
begin
  if not public.is_admin() then raise exception using errcode = '42501', message = 'admin_required'; end if;
  select * into event from public.events where id = target_event_id for update;
  if event.status <> 'scoring_closed' then raise exception using errcode = 'P0001', message = 'scoring_must_be_closed'; end if;
  calculated := public.calculate_event_results(target_event_id);
  if exists (select 1 from jsonb_array_elements(calculated) item
    where item ->> 'status' <> 'complete' or coalesce((item ->> 'tie_requires_council')::boolean, false)) then
    raise exception using errcode = 'P0001', message = 'results_incomplete';
  end if;
  select coalesce(max(version), 0) + 1 into next_version from public.result_snapshots where event_id = target_event_id;
  insert into public.result_snapshots (event_id, version, calculation_config, results, created_by)
  values (target_event_id, next_version,
    jsonb_build_object('aggregation_method', event.aggregation_method, 'rounding_scale', event.rounding_scale,
      'attraction_mode', event.attraction_mode, 'attraction_point_value', event.attraction_point_value,
      'tie_break_config', event.tie_break_config),
    calculated, (select auth.uid()))
  returning * into result;
  insert into public.audit_logs (event_id, actor_id, action, entity_type, entity_id, after_data)
  values (target_event_id, (select auth.uid()), 'RESULT_SNAPSHOT_CREATED', 'result_snapshot', result.id::text,
    jsonb_build_object('version', result.version));
  return result;
end;
$$;

create function public.publish_result_snapshot(target_snapshot_id uuid)
returns public.result_snapshots
language plpgsql
security definer
set search_path = ''
as $$
declare
  snapshot public.result_snapshots;
  result public.result_snapshots;
begin
  if not public.is_admin() then raise exception using errcode = '42501', message = 'admin_required'; end if;
  select * into snapshot from public.result_snapshots where id = target_snapshot_id for update;
  if snapshot.id is null then raise exception using errcode = 'P0002', message = 'snapshot_not_found'; end if;
  if exists (select 1 from jsonb_array_elements(snapshot.results) item where item ->> 'status' <> 'complete') then
    raise exception using errcode = 'P0001', message = 'results_incomplete';
  end if;
  perform set_config('app.sensitive_operation', 'allowed', true);
  update public.result_snapshots set published_at = null
    where event_id = snapshot.event_id and id <> snapshot.id and published_at is not null;
  update public.result_snapshots set published_at = coalesce(published_at, now())
    where id = snapshot.id returning * into result;
  update public.events set status = 'published', published_at = result.published_at where id = snapshot.event_id;
  insert into public.audit_logs (event_id, actor_id, action, entity_type, entity_id, after_data)
  values (snapshot.event_id, (select auth.uid()), 'RESULT_PUBLISHED', 'result_snapshot', snapshot.id::text,
    jsonb_build_object('version', snapshot.version, 'published_at', result.published_at));
  return result;
end;
$$;

create function public.set_jury_council_decision(
  target_participant_id uuid,
  target_priority integer,
  target_minutes_reference text
)
returns public.jury_council_decisions
language plpgsql
security definer
set search_path = ''
as $$
declare
  participant public.participants;
  result public.jury_council_decisions;
begin
  if not public.is_super_admin() then raise exception using errcode = '42501', message = 'super_admin_required'; end if;
  if target_priority < 1 or length(btrim(coalesce(target_minutes_reference, ''))) = 0 then
    raise exception using errcode = '22023', message = 'council_decision_invalid';
  end if;
  select * into participant from public.participants where id = target_participant_id;
  insert into public.jury_council_decisions (
    event_id, category_id, participant_id, priority, minutes_reference, decided_by
  ) values (
    participant.event_id, participant.category_id, participant.id, target_priority,
    btrim(target_minutes_reference), (select auth.uid())
  )
  on conflict (event_id, participant_id) do update
  set priority = excluded.priority, minutes_reference = excluded.minutes_reference,
      decided_by = excluded.decided_by, decided_at = now()
  returning * into result;
  insert into public.audit_logs (event_id, actor_id, action, entity_type, entity_id, after_data)
  values (participant.event_id, (select auth.uid()), 'JURY_COUNCIL_DECISION_RECORDED', 'participant', participant.id::text,
    to_jsonb(result));
  return result;
end;
$$;

create function public.record_login()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.current_user_role() is null then raise exception using errcode = '42501', message = 'active_profile_required'; end if;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id)
  values ((select auth.uid()), 'USER_LOGIN', 'profile', (select auth.uid())::text);
end;
$$;

revoke all on function public.ensure_score_sheet(uuid) from public;
revoke all on function public.save_score_draft(uuid, integer, jsonb, text) from public;
revoke all on function public.submit_score_sheet(uuid, integer) from public;
revoke all on function public.unlock_score_sheet(uuid, text) from public;
revoke all on function public.waive_missing_score(uuid, uuid, text, text) from public;
revoke all on function public.update_participant_status(uuid, public.participant_status, text, timestamptz) from public;
revoke all on function public.record_attraction_check(uuid, uuid, public.attraction_check_status, text, text) from public;
revoke all on function public.confirm_penalty(uuid) from public;
revoke all on function public.cancel_penalty(uuid, text) from public;
revoke all on function public.transition_event_status(uuid, public.event_status) from public;
revoke all on function public.calculate_event_results(uuid) from public;
revoke all on function public.snapshot_event_results(uuid) from public;
revoke all on function public.publish_result_snapshot(uuid) from public;
revoke all on function public.set_jury_council_decision(uuid, integer, text) from public;
revoke all on function public.record_login() from public;

grant execute on function public.ensure_score_sheet(uuid) to authenticated;
grant execute on function public.save_score_draft(uuid, integer, jsonb, text) to authenticated;
grant execute on function public.submit_score_sheet(uuid, integer) to authenticated;
grant execute on function public.unlock_score_sheet(uuid, text) to authenticated;
grant execute on function public.waive_missing_score(uuid, uuid, text, text) to authenticated;
grant execute on function public.update_participant_status(uuid, public.participant_status, text, timestamptz) to authenticated;
grant execute on function public.record_attraction_check(uuid, uuid, public.attraction_check_status, text, text) to authenticated;
grant execute on function public.confirm_penalty(uuid) to authenticated;
grant execute on function public.cancel_penalty(uuid, text) to authenticated;
grant execute on function public.transition_event_status(uuid, public.event_status) to authenticated;
grant execute on function public.calculate_event_results(uuid) to authenticated;
grant execute on function public.snapshot_event_results(uuid) to authenticated;
grant execute on function public.publish_result_snapshot(uuid) to authenticated;
grant execute on function public.set_jury_council_decision(uuid, integer, text) to authenticated;
grant execute on function public.record_login() to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'participants'
  ) then alter publication supabase_realtime add table public.participants; end if;
  if not exists (
    select 1 from pg_catalog.pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'score_sheets'
  ) then alter publication supabase_realtime add table public.score_sheets; end if;
  if not exists (
    select 1 from pg_catalog.pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'attraction_checks'
  ) then alter publication supabase_realtime add table public.attraction_checks; end if;
  if not exists (
    select 1 from pg_catalog.pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'events'
  ) then alter publication supabase_realtime add table public.events; end if;
end
$$;
