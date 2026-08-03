-- Membatalkan pengaturan waktu pelaksanaan dan membuka penilaian
-- berdasarkan status event saja.

drop trigger if exists score_sheets_enforce_schedule on public.score_sheets;
drop trigger if exists score_entries_enforce_schedule on public.score_entries;
drop function if exists public.enforce_judge_scoring_schedule();
drop function if exists public.set_event_schedule(uuid, timestamptz);

create or replace function public.protect_sensitive_state_changes()
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

alter table public.events drop column if exists starts_at;

