-- Public readers receive only the latest published, sanitized snapshot through
-- a dedicated RPC. Direct table reads remain available only to administrators.

drop policy if exists result_snapshots_public_select_published on public.result_snapshots;
drop policy if exists result_snapshots_internal_select on public.result_snapshots;

create policy result_snapshots_admin_select
on public.result_snapshots for select to authenticated
using ((select public.is_admin()));

create function public.get_published_results()
returns table (
  id uuid,
  event_id uuid,
  version integer,
  calculation_config jsonb,
  results jsonb,
  published_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    snapshot.id,
    snapshot.event_id,
    snapshot.version,
    snapshot.calculation_config || jsonb_build_object(
      'event', jsonb_build_object(
        'name', event.name,
        'year', event.year,
        'event_date', event.event_date,
        'route_description', event.route_description,
        'timezone', event.timezone
      )
    ),
    coalesce((
      select jsonb_agg(
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
      )
      from jsonb_array_elements(snapshot.results) as item
    ), '[]'::jsonb),
    snapshot.published_at
  from public.result_snapshots as snapshot
  join public.events as event on event.id = snapshot.event_id
  where snapshot.published_at is not null
  order by snapshot.published_at desc
  limit 1
$$;

revoke all on function public.get_published_results() from public;
grant execute on function public.get_published_results() to anon, authenticated;

