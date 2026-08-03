-- Restrict staff/profile mutations to validated, audited RPC workflows.
-- This migration is additive and intentionally leaves authentication account
-- creation in Supabase Auth (no service-role credential is exposed to clients).

drop policy if exists profiles_admin_insert on public.profiles;
drop policy if exists profiles_admin_update on public.profiles;
drop policy if exists profiles_admin_delete on public.profiles;
drop policy if exists judge_assignments_admin_manage on public.judge_assignments;
drop policy if exists attraction_verifier_assignments_admin_manage on public.attraction_verifier_assignments;

create function public.manage_profile(
  target_user_id uuid,
  target_full_name text,
  target_role public.user_role,
  target_is_active boolean default true
)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_role public.user_role := public.current_user_role();
  existing public.profiles;
  saved public.profiles;
begin
  if (select auth.uid()) is null or actor_role is null or actor_role not in ('super_admin', 'admin') then
    raise exception using errcode = '42501', message = 'admin_required';
  end if;
  if target_user_id is null or length(btrim(coalesce(target_full_name, ''))) = 0 then
    raise exception using errcode = '22023', message = 'profile_fields_required';
  end if;

  select * into existing from public.profiles where id = target_user_id for update;

  if actor_role = 'admin' and (
    target_role in ('super_admin', 'admin')
    or existing.role in ('super_admin', 'admin')
  ) then
    raise exception using errcode = '42501', message = 'super_admin_required';
  end if;

  if target_user_id = (select auth.uid()) and not target_is_active then
    raise exception using errcode = '22023', message = 'cannot_deactivate_self';
  end if;

  if existing.role = 'super_admin'
     and (target_role <> 'super_admin' or not target_is_active)
     and not exists (
       select 1 from public.profiles
       where role = 'super_admin' and is_active and id <> target_user_id
     ) then
    raise exception using errcode = '22023', message = 'last_super_admin_required';
  end if;

  insert into public.profiles (id, full_name, role, is_active)
  values (target_user_id, btrim(target_full_name), target_role, target_is_active)
  on conflict (id) do update set
    full_name = excluded.full_name,
    role = excluded.role,
    is_active = excluded.is_active,
    updated_at = now()
  returning * into saved;

  return saved;
end;
$$;

create function public.assign_judge_to_location(
  target_judge_id uuid,
  target_location_id uuid
)
returns public.judge_assignments
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_event_id uuid;
  saved public.judge_assignments;
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'admin_required';
  end if;

  select event_id into target_event_id
  from public.judging_locations
  where id = target_location_id and is_active
  for update;
  if target_event_id is null then
    raise exception using errcode = 'P0002', message = 'location_not_found';
  end if;
  if not exists (
    select 1 from public.profiles
    where id = target_judge_id and role = 'judge' and is_active
  ) then
    raise exception using errcode = '22023', message = 'active_judge_required';
  end if;

  select * into saved
  from public.judge_assignments
  where event_id = target_event_id
    and judge_id = target_judge_id
    and location_id = target_location_id
    and revoked_at is null
  for update;
  if found then return saved; end if;

  update public.judge_assignments
  set revoked_at = clock_timestamp()
  where event_id = target_event_id
    and revoked_at is null
    and (judge_id = target_judge_id or location_id = target_location_id);

  insert into public.judge_assignments (
    event_id, judge_id, location_id, assigned_by
  ) values (
    target_event_id, target_judge_id, target_location_id, (select auth.uid())
  ) returning * into saved;
  return saved;
end;
$$;

create function public.revoke_judge_assignment(target_assignment_id uuid)
returns public.judge_assignments
language plpgsql
security definer
set search_path = ''
as $$
declare saved public.judge_assignments;
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'admin_required';
  end if;
  update public.judge_assignments
  set revoked_at = clock_timestamp()
  where id = target_assignment_id and revoked_at is null
  returning * into saved;
  if saved.id is null then
    raise exception using errcode = 'P0002', message = 'assignment_not_found';
  end if;
  return saved;
end;
$$;

create function public.assign_operator_to_attraction(
  target_operator_id uuid,
  target_point_id uuid
)
returns public.attraction_verifier_assignments
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_event_id uuid;
  saved public.attraction_verifier_assignments;
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'admin_required';
  end if;

  select event_id into target_event_id
  from public.attraction_points
  where id = target_point_id and is_active
  for update;
  if target_event_id is null then
    raise exception using errcode = 'P0002', message = 'attraction_point_not_found';
  end if;
  if not exists (
    select 1 from public.profiles
    where id = target_operator_id and role = 'operator' and is_active
  ) then
    raise exception using errcode = '22023', message = 'active_operator_required';
  end if;

  select * into saved
  from public.attraction_verifier_assignments
  where event_id = target_event_id
    and operator_id = target_operator_id
    and attraction_point_id = target_point_id
    and revoked_at is null
  for update;
  if found then return saved; end if;

  update public.attraction_verifier_assignments
  set revoked_at = clock_timestamp()
  where event_id = target_event_id
    and revoked_at is null
    and (operator_id = target_operator_id or attraction_point_id = target_point_id);

  insert into public.attraction_verifier_assignments (
    event_id, operator_id, attraction_point_id, assigned_by
  ) values (
    target_event_id, target_operator_id, target_point_id, (select auth.uid())
  ) returning * into saved;
  return saved;
end;
$$;

create function public.revoke_attraction_assignment(target_assignment_id uuid)
returns public.attraction_verifier_assignments
language plpgsql
security definer
set search_path = ''
as $$
declare saved public.attraction_verifier_assignments;
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'admin_required';
  end if;
  update public.attraction_verifier_assignments
  set revoked_at = clock_timestamp()
  where id = target_assignment_id and revoked_at is null
  returning * into saved;
  if saved.id is null then
    raise exception using errcode = 'P0002', message = 'assignment_not_found';
  end if;
  return saved;
end;
$$;

revoke all on function public.manage_profile(uuid, text, public.user_role, boolean) from public;
revoke all on function public.assign_judge_to_location(uuid, uuid) from public;
revoke all on function public.revoke_judge_assignment(uuid) from public;
revoke all on function public.assign_operator_to_attraction(uuid, uuid) from public;
revoke all on function public.revoke_attraction_assignment(uuid) from public;

grant execute on function public.manage_profile(uuid, text, public.user_role, boolean) to authenticated;
grant execute on function public.assign_judge_to_location(uuid, uuid) to authenticated;
grant execute on function public.revoke_judge_assignment(uuid) to authenticated;
grant execute on function public.assign_operator_to_attraction(uuid, uuid) to authenticated;
grant execute on function public.revoke_attraction_assignment(uuid) to authenticated;
