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
    and event_record.status = 'scoring_open'
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

  update public.score_sheets as target
  set general_note = nullif(btrim($4), ''), version = target.version + 1
  where target.id = target_sheet_id
  returning target.* into result;
  return result;
end;
$$;

create or replace function public.calculate_event_results(target_event_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  event_record public.events;
  result jsonb;
begin
  if not public.is_admin() then raise exception using errcode = '42501', message = 'admin_required'; end if;
  select event_row.* into event_record from public.events as event_row where event_row.id = target_event_id;
  if event_record.id is null or event_record.aggregation_method is null or event_record.rounding_scale is null
     or jsonb_array_length(event_record.tie_break_config) < 6 then
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
    select count(*) as total
    from public.attraction_points
    where event_id = target_event_id and is_active
  ), attraction_summary as (
    select participant.id as participant_id,
      count(check_item.id) filter (where check_item.status in ('performed', 'not_performed')) as resolved_count,
      count(check_item.id) filter (where check_item.status = 'unable_to_verify') as unable_count,
      coalesce(sum(case when check_item.status = 'performed'
        then coalesce(point.point_value, event_config.attraction_point_value, 0) else 0 end), 0) as attraction_total
    from public.participants as participant
    cross join public.events as event_config
    left join public.attraction_checks as check_item on check_item.participant_id = participant.id
    left join public.attraction_points as point on point.id = check_item.attraction_point_id and point.is_active
    where participant.event_id = target_event_id
      and event_config.id = target_event_id
      and participant.is_active
    group by participant.id, event_config.attraction_point_value
  ), penalty_summary as (
    select participant_id, coalesce(sum(deduction), 0) as penalty_total
    from public.penalties
    where event_id = target_event_id and status = 'confirmed'
    group by participant_id
  ), raw as (
    select participant.id as participant_id, participant.category_id, category.code as category_code,
      category.name as category_name, category.sort_order as category_sort_order,
      participant.sequence_number, participant.name as participant_name, participant.theme,
      coalesce(sheet.submitted_count, 0) as submitted_judges,
      coalesce(sheet.waived_count, 0) > 0 as waived,
      case when event_config.aggregation_method = 'average' then coalesce(sheet.average_total, 0)
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
    cross join public.events as event_config
    cross join point_total
    left join sheet_summary as sheet on sheet.participant_id = participant.id
    left join criterion_summary as criteria on criteria.participant_id = participant.id
    left join attraction_summary as attraction on attraction.participant_id = participant.id
    left join penalty_summary as penalty on penalty.participant_id = participant.id
    left join public.jury_council_decisions as decision on decision.participant_id = participant.id
    where participant.event_id = target_event_id
      and participant.is_active
      and event_config.id = target_event_id
  ), calculated as (
    select raw.*,
      round(greatest(0, judge_score + attraction_points - penalty_total), event_config.rounding_scale) as final_score,
      case when complete then 'complete' else 'incomplete' end as status,
      case
        when submitted_judges < 2 then 'Nilai juri belum memenuhi minimum.'
        when submitted_judges < 3 and not waived then 'Nilai tiga juri belum lengkap dan belum ada waiver.'
        when not complete then 'Verifikasi atraksi wajib belum lengkap.'
        else ''
      end as incomplete_reason
    from raw
    cross join public.events as event_config
    where event_config.id = target_event_id
  ), tied as (
    select calculated.*,
      count(*) over (partition by category_id, final_score, concept_score, visual_score,
        cultural_score, discipline_score, penalty_total) > 1
        and council_priority is null as tie_requires_council
    from calculated
  ), ranked as (
    select tied.*,
      case when complete then row_number() over (
        partition by category_id
        order by complete desc, final_score desc, concept_score desc,
          visual_score desc, cultural_score desc, discipline_score desc,
          penalty_total asc, council_priority asc nulls last, sequence_number asc
      ) end as rank
    from tied
  )
  select coalesce(
    jsonb_agg(to_jsonb(ranked) order by category_sort_order, rank nulls last, sequence_number),
    '[]'::jsonb
  ) into result
  from ranked;
  return result;
end;
$$;
