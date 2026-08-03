-- Fail closed when sensitive RPC targets do not exist. Without these guards a
-- missing UUID could otherwise return an empty composite instead of an error.

create or replace function public.unlock_score_sheet(target_sheet_id uuid, reason text)
returns public.score_sheets
language plpgsql
security definer
set search_path = ''
as $$
declare
  sheet public.score_sheets;
  result public.score_sheets;
begin
  if not public.is_super_admin() then
    raise exception using errcode = '42501', message = 'super_admin_required';
  end if;
  if length(btrim(coalesce(reason, ''))) = 0 then
    raise exception using errcode = '22023', message = 'unlock_reason_required';
  end if;
  select * into sheet from public.score_sheets where id = target_sheet_id for update;
  if sheet.id is null then
    raise exception using errcode = 'P0002', message = 'score_sheet_not_found';
  end if;
  if sheet.status <> 'submitted' then
    raise exception using errcode = 'P0001', message = 'submitted_sheet_required';
  end if;
  perform set_config('app.sensitive_operation', 'allowed', true);
  update public.score_sheets
  set status = 'unlocked', unlocked_at = now(), unlock_reason = btrim(reason), version = version + 1
  where id = target_sheet_id returning * into result;
  insert into public.audit_logs (event_id, actor_id, action, entity_type, entity_id, before_data, after_data, metadata)
  values (sheet.event_id, (select auth.uid()), 'SCORE_UNLOCKED', 'score_sheet', target_sheet_id::text,
    to_jsonb(sheet), to_jsonb(result), jsonb_build_object('reason', btrim(reason)));
  return result;
end;
$$;

create or replace function public.confirm_penalty(target_penalty_id uuid)
returns public.penalties
language plpgsql
security definer
set search_path = ''
as $$
declare
  penalty public.penalties;
  approval_required boolean;
  result public.penalties;
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'admin_required';
  end if;
  select item.* into penalty
  from public.penalties as item
  where item.id = target_penalty_id
  for update;
  if penalty.id is null then
    raise exception using errcode = 'P0002', message = 'penalty_not_found';
  end if;
  select penalty_type.requires_approval into approval_required
  from public.penalty_types as penalty_type
  where penalty_type.id = penalty.penalty_type_id;
  if penalty.status <> 'draft' then
    raise exception using errcode = 'P0001', message = 'draft_penalty_required';
  end if;
  if approval_required and not public.is_super_admin() then
    raise exception using errcode = '42501', message = 'heavy_penalty_requires_super_admin';
  end if;
  update public.penalties
  set status = 'confirmed', confirmed_by = (select auth.uid()), confirmed_at = now()
  where id = target_penalty_id returning * into result;
  insert into public.audit_logs (event_id, actor_id, action, entity_type, entity_id, before_data, after_data)
  values (penalty.event_id, (select auth.uid()), 'PENALTY_CONFIRMED', 'penalty', penalty.id::text,
    to_jsonb(penalty), to_jsonb(result));
  return result;
end;
$$;

create or replace function public.cancel_penalty(target_penalty_id uuid, reason text)
returns public.penalties
language plpgsql
security definer
set search_path = ''
as $$
declare
  penalty public.penalties;
  result public.penalties;
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'admin_required';
  end if;
  if length(btrim(coalesce(reason, ''))) = 0 then
    raise exception using errcode = '22023', message = 'cancellation_reason_required';
  end if;
  select * into penalty from public.penalties where id = target_penalty_id for update;
  if penalty.id is null then
    raise exception using errcode = 'P0002', message = 'penalty_not_found';
  end if;
  if penalty.status = 'cancelled' then return penalty; end if;
  update public.penalties
  set status = 'cancelled', cancelled_by = (select auth.uid()), cancelled_at = now()
  where id = target_penalty_id returning * into result;
  insert into public.audit_logs (event_id, actor_id, action, entity_type, entity_id, before_data, after_data, metadata)
  values (penalty.event_id, (select auth.uid()), 'PENALTY_CANCELLED', 'penalty', penalty.id::text,
    to_jsonb(penalty), to_jsonb(result), jsonb_build_object('reason', btrim(reason)));
  return result;
end;
$$;

