-- Treat each autosave payload as the complete draft. Clearing a score in the UI
-- must also remove the previously persisted entry instead of restoring stale data.

create or replace function public.save_score_draft(
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
  if sheet.status not in ('draft', 'unlocked') then
    raise exception using errcode = 'P0001', message = 'score_sheet_locked';
  end if;
  if sheet.version <> expected_version then
    raise exception using errcode = 'P0001', message = 'version_conflict';
  end if;

  perform set_config('app.sensitive_operation', 'allowed', true);

  delete from public.score_entries as existing
  where existing.score_sheet_id = target_sheet_id
    and not exists (
      select 1
      from jsonb_array_elements(entries) as submitted(item)
      where (submitted.item ->> 'criterion_id')::uuid = existing.criterion_id
    );

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

  update public.score_sheets as target
  set general_note = nullif(btrim($4), ''), version = target.version + 1
  where target.id = target_sheet_id
  returning target.* into result;
  return result;
end;
$$;
