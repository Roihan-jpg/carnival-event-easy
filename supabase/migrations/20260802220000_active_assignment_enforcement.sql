-- Ensure a revoked/deactivated profile immediately loses mutation access even
-- while an older Auth session still exists in the browser.

create or replace function public.has_active_judge_assignment(
  assignment_event_id uuid,
  assignment_location_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.current_user_role() = 'judge', false)
    and exists (
      select 1
      from public.judge_assignments as assignment
      where assignment.event_id = assignment_event_id
        and assignment.location_id = assignment_location_id
        and assignment.judge_id = (select auth.uid())
        and assignment.revoked_at is null
    )
$$;

create or replace function public.has_active_attraction_assignment(
  assignment_event_id uuid,
  assignment_point_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.current_user_role() = 'operator', false)
    and exists (
      select 1
      from public.attraction_verifier_assignments as assignment
      where assignment.event_id = assignment_event_id
        and assignment.attraction_point_id = assignment_point_id
        and assignment.operator_id = (select auth.uid())
        and assignment.revoked_at is null
    )
$$;

-- Public snapshots contain only aggregate/public fields. Internal tie-break
-- components and the council minutes reference never leave the protected area.
create or replace function public.snapshot_event_results(target_event_id uuid)
returns public.result_snapshots
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_record public.events;
  calculated jsonb;
  public_results jsonb;
  next_version integer;
  result public.result_snapshots;
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
  if event_record.status <> 'scoring_closed' then
    raise exception using errcode = 'P0001', message = 'scoring_must_be_closed';
  end if;

  calculated := public.calculate_event_results(target_event_id);
  if exists (
    select 1 from jsonb_array_elements(calculated) as item
    where item ->> 'status' <> 'complete'
      or coalesce((item ->> 'tie_requires_council')::boolean, false)
  ) then
    raise exception using errcode = 'P0001', message = 'results_incomplete';
  end if;

  select coalesce(jsonb_agg(
    item
      - 'category_id'
      - 'category_sort_order'
      - 'complete'
      - 'concept_score'
      - 'visual_score'
      - 'cultural_score'
      - 'discipline_score'
      - 'council_priority'
      - 'minutes_reference'
  ), '[]'::jsonb)
  into public_results
  from jsonb_array_elements(calculated) as item;

  select coalesce(max(version), 0) + 1 into next_version
  from public.result_snapshots where event_id = target_event_id;

  insert into public.result_snapshots (
    event_id, version, calculation_config, results, created_by
  ) values (
    target_event_id,
    next_version,
    jsonb_build_object(
      'event', jsonb_build_object(
        'name', event_record.name,
        'year', event_record.year,
        'event_date', event_record.event_date,
        'route_description', event_record.route_description,
        'timezone', event_record.timezone
      ),
      'aggregation_method', event_record.aggregation_method,
      'rounding_scale', event_record.rounding_scale,
      'attraction_mode', event_record.attraction_mode,
      'attraction_point_value', event_record.attraction_point_value,
      'tie_break_config', event_record.tie_break_config
    ),
    public_results,
    (select auth.uid())
  ) returning * into result;

  insert into public.audit_logs (
    event_id, actor_id, action, entity_type, entity_id, after_data
  ) values (
    target_event_id, (select auth.uid()), 'RESULT_SNAPSHOT_CREATED',
    'result_snapshot', result.id::text, jsonb_build_object('version', result.version)
  );
  return result;
end;
$$;

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
      from public.judge_assignments where event_id = target_event_id and revoked_at is null;
    select count(*) into active_points
      from public.attraction_points where event_id = target_event_id and is_active;
    select count(*) into active_verifiers
      from public.attraction_verifier_assignments where event_id = target_event_id and revoked_at is null;

    if active_criteria <> 8 or criteria_total <> 100
       or active_locations <> 3 or active_judges <> 3
       or active_points <> 3 or active_verifiers <> 3
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
