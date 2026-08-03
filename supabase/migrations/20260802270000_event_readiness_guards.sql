-- Opening scoring is blocked unless the event has usable participants and all
-- assigned staff profiles are still active with the expected role.

create or replace function public.transition_event_status(
  target_event_id uuid,
  target_status public.event_status
)
returns public.events
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_record public.events;
  active_criteria integer;
  criteria_total numeric;
  active_locations integer;
  active_judges integer;
  active_points integer;
  active_verifiers integer;
  active_participants integer;
  category_count integer;
  penalty_type_count integer;
  result public.events;
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'admin_required';
  end if;
  select event_row.* into event_record
  from public.events as event_row
  where event_row.id = target_event_id
  for update;
  if event_record.id is null then
    raise exception using errcode = 'P0002', message = 'event_not_found';
  end if;

  if target_status = 'scoring_open' then
    select count(*), coalesce(sum(max_score), 0)
      into active_criteria, criteria_total
    from public.score_criteria where event_id = target_event_id and is_active;
    select count(*) into active_locations
      from public.judging_locations where event_id = target_event_id and is_active;
    select count(*) into active_judges
      from public.judge_assignments as assignment
      join public.profiles as profile on profile.id = assignment.judge_id
      where assignment.event_id = target_event_id and assignment.revoked_at is null
        and profile.is_active and profile.role = 'judge';
    select count(*) into active_points
      from public.attraction_points where event_id = target_event_id and is_active;
    select count(*) into active_verifiers
      from public.attraction_verifier_assignments as assignment
      join public.profiles as profile on profile.id = assignment.operator_id
      where assignment.event_id = target_event_id and assignment.revoked_at is null
        and profile.is_active and profile.role = 'operator';
    select count(*) into active_participants
      from public.participants where event_id = target_event_id and is_active;
    select count(*) into category_count
      from public.participant_categories where event_id = target_event_id;
    select count(*) into penalty_type_count
      from public.penalty_types where event_id = target_event_id and is_active;

    if active_criteria <> 8 or criteria_total <> 100
       or active_locations <> 3 or active_judges <> 3
       or active_points <> 3 or active_verifiers <> 3
       or active_participants = 0 or category_count = 0 or penalty_type_count = 0
       or jsonb_array_length(event_record.tie_break_config) < 6 then
      raise exception using errcode = 'P0001', message = 'configuration_incomplete';
    end if;
    if event_record.status not in ('draft', 'configured') then
      raise exception using errcode = 'P0001', message = 'invalid_event_transition';
    end if;
  elsif target_status = 'scoring_closed' then
    if event_record.status <> 'scoring_open' then
      raise exception using errcode = 'P0001', message = 'invalid_event_transition';
    end if;
  elsif target_status = 'configured' then
    if event_record.status <> 'draft' then
      raise exception using errcode = 'P0001', message = 'invalid_event_transition';
    end if;
  else
    raise exception using errcode = '22023', message = 'unsupported_event_transition';
  end if;

  perform set_config('app.sensitive_operation', 'allowed', true);
  update public.events
  set status = target_status,
      config_locked_at = case when target_status = 'scoring_open' then now() else config_locked_at end
  where id = target_event_id
  returning * into result;

  insert into public.audit_logs (
    event_id, actor_id, action, entity_type, entity_id, before_data, after_data
  ) values (
    target_event_id, (select auth.uid()), 'EVENT_STATUS_CHANGED', 'event', target_event_id::text,
    jsonb_build_object('status', event_record.status), jsonb_build_object('status', result.status)
  );
  return result;
end;
$$;

