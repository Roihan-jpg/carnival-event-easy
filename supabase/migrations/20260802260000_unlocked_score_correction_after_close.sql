-- A Super Admin unlock is an explicit exception: it permits the assigned judge
-- to correct and re-submit that sheet after scoring_closed, without reopening
-- new score sheets or the event configuration.

create or replace function public.submit_score_sheet(target_sheet_id uuid, expected_version integer)
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
  join public.events as event_record on event_record.id = current_sheet.event_id
  where current_sheet.id = target_sheet_id
    and current_sheet.judge_id = (select auth.uid())
    and (
      event_record.status = 'scoring_open'
      or (event_record.status = 'scoring_closed' and current_sheet.status = 'unlocked')
    )
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

  insert into public.audit_logs (
    event_id, actor_id, action, entity_type, entity_id, before_data, after_data
  ) values (
    sheet.event_id, (select auth.uid()), 'SCORE_SUBMITTED', 'score_sheet', target_sheet_id::text,
    jsonb_build_object('status', sheet.status, 'version', sheet.version),
    jsonb_build_object('status', result.status, 'version', result.version, 'total_score', result.total_score)
  );
  return result;
end;
$$;

