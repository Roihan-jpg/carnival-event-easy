-- Penjurian tidak lagi memiliki state tertutup. Event tetap scoring_open
-- sampai hasil diterbitkan atau diarsipkan.

create or replace function public.prevent_scoring_closed_status()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'scoring_closed' then
    raise exception using errcode = 'P0001', message = 'scoring_always_open';
  end if;
  return new;
end;
$$;

drop trigger if exists events_prevent_scoring_closed on public.events;
create trigger events_prevent_scoring_closed
before insert or update on public.events
for each row execute function public.prevent_scoring_closed_status();

select set_config('app.sensitive_operation', 'allowed', true);
update public.events
set status = 'scoring_open', config_locked_at = coalesce(config_locked_at, now())
where status = 'scoring_closed';

create or replace function public.snapshot_event_results(target_event_id uuid)
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
  if event.status <> 'scoring_open' then raise exception using errcode = 'P0001', message = 'scoring_must_be_open'; end if;
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

revoke all on function public.prevent_scoring_closed_status() from public;
grant execute on function public.prevent_scoring_closed_status() to authenticated;
