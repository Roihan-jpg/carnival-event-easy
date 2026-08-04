insert into public.participant_categories (event_id, code, name, sort_order)
select
  event.id,
  'VILLAGE_GOVERNMENT',
  'Pemdes',
  coalesce((
    select max(category.sort_order) + 1
    from public.participant_categories as category
    where category.event_id = event.id
  ), 1)
from public.events as event
on conflict (event_id, code) do update
set name = excluded.name;
