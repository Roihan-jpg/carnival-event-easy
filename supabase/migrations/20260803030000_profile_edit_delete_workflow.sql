-- Workflow aman untuk mengubah dan menghapus profil pengguna.
create or replace function public.delete_profile(target_user_id uuid)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_role public.user_role := public.current_user_role();
  existing public.profiles;
begin
  if (select auth.uid()) is null or actor_role is null or actor_role not in ('super_admin', 'admin') then
    raise exception using errcode = '42501', message = 'admin_required';
  end if;
  if target_user_id = (select auth.uid()) then
    raise exception using errcode = '22023', message = 'cannot_delete_self';
  end if;

  select * into existing from public.profiles where id = target_user_id for update;
  if existing.id is null then
    raise exception using errcode = 'P0002', message = 'profile_not_found';
  end if;
  if actor_role = 'admin' and existing.role in ('super_admin', 'admin') then
    raise exception using errcode = '42501', message = 'super_admin_required';
  end if;
  if existing.role = 'super_admin' and not exists (
    select 1 from public.profiles where role = 'super_admin' and is_active and id <> target_user_id
  ) then
    raise exception using errcode = '22023', message = 'last_super_admin_required';
  end if;
  if exists (select 1 from public.judge_assignments where judge_id = target_user_id and revoked_at is null)
     or exists (select 1 from public.score_sheets where judge_id = target_user_id)
     or exists (select 1 from public.attraction_verifier_assignments where operator_id = target_user_id and revoked_at is null)
     or exists (select 1 from public.attraction_checks where verified_by = target_user_id)
     or exists (select 1 from public.incidents where recorded_by = target_user_id)
     or exists (select 1 from public.penalties where confirmed_by = target_user_id or cancelled_by = target_user_id) then
    raise exception using errcode = '23503', message = 'profile_has_related_records';
  end if;

  delete from public.profiles where id = target_user_id;
  return existing;
end;
$$;

revoke all on function public.delete_profile(uuid) from public;
grant execute on function public.delete_profile(uuid) to authenticated;

