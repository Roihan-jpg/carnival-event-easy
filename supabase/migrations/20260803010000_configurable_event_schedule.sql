-- Jadwal pelaksanaan resmi yang dapat diatur Super Admin.
-- Tanggal lama dipertahankan untuk kompatibilitas dan disinkronkan oleh RPC.

alter table public.events
  add column if not exists starts_at timestamptz;

update public.events
set starts_at = (event_date + time '10:00') at time zone coalesce(timezone, 'Asia/Jakarta')
where starts_at is null;

comment on column public.events.starts_at is
  'Waktu resmi dimulainya pelaksanaan. Input nilai juri ditutup sebelum waktu ini.';

create or replace function public.protect_sensitive_state_changes()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  allowed boolean := current_setting('app.sensitive_operation', true) = 'allowed';
  schedule_allowed boolean := current_setting('app.event_schedule_change', true) = 'allowed';
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
    if tg_op = 'UPDATE' and (
      new.starts_at is distinct from old.starts_at
      or new.event_date is distinct from old.event_date
    ) and not schedule_allowed then
      raise exception using errcode = '42501', message = 'event_schedule_requires_super_admin';
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

create or replace function public.set_event_schedule(
  target_event_id uuid,
  target_starts_at timestamptz
)
returns public.events
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_record public.events;
  result public.events;
begin
  if (select auth.uid()) is null or not public.is_super_admin() then
    raise exception using errcode = '42501', message = 'super_admin_required';
  end if;
  if target_starts_at is null then
    raise exception using errcode = '22023', message = 'event_schedule_required';
  end if;

  select event_row.* into event_record
  from public.events as event_row
  where event_row.id = target_event_id
  for update;

  if event_record.id is null then
    raise exception using errcode = 'P0002', message = 'event_not_found';
  end if;
  if event_record.status not in ('draft', 'configured') then
    raise exception using errcode = 'P0001', message = 'event_schedule_locked';
  end if;

  perform set_config('app.event_schedule_change', 'allowed', true);
  update public.events
  set starts_at = target_starts_at,
      event_date = (target_starts_at at time zone coalesce(event_record.timezone, 'Asia/Jakarta'))::date
  where id = target_event_id
  returning * into result;

  insert into public.audit_logs (
    event_id, actor_id, action, entity_type, entity_id, before_data, after_data
  ) values (
    target_event_id, (select auth.uid()), 'EVENT_SCHEDULE_CHANGED', 'event', target_event_id::text,
    jsonb_build_object('starts_at', event_record.starts_at),
    jsonb_build_object('starts_at', result.starts_at)
  );

  return result;
end;
$$;

revoke all on function public.set_event_schedule(uuid, timestamptz) from public;
grant execute on function public.set_event_schedule(uuid, timestamptz) to authenticated;

create or replace function public.enforce_judge_scoring_schedule()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  target_event_id uuid;
  official_start timestamptz;
begin
  if public.current_user_role() <> 'judge' then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if tg_table_name = 'score_sheets' then
    target_event_id := case when tg_op = 'DELETE' then old.event_id else new.event_id end;
  else
    select sheet.event_id into target_event_id
    from public.score_sheets as sheet
    where sheet.id = case when tg_op = 'DELETE' then old.score_sheet_id else new.score_sheet_id end;
  end if;

  select event_row.starts_at into official_start
  from public.events as event_row
  where event_row.id = target_event_id;

  if official_start is null or statement_timestamp() < official_start then
    raise exception using errcode = '42501', message = 'scoring_not_started';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists score_sheets_enforce_schedule on public.score_sheets;
create trigger score_sheets_enforce_schedule
before insert or update on public.score_sheets
for each row execute function public.enforce_judge_scoring_schedule();

drop trigger if exists score_entries_enforce_schedule on public.score_entries;
create trigger score_entries_enforce_schedule
before insert or update or delete on public.score_entries
for each row execute function public.enforce_judge_scoring_schedule();
