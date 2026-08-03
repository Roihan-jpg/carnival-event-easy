create type public.user_role as enum (
  'super_admin',
  'admin',
  'judge',
  'operator',
  'viewer'
);

create type public.event_status as enum (
  'draft',
  'configured',
  'scoring_open',
  'scoring_closed',
  'published',
  'archived'
);

create type public.participant_status as enum (
  'registered',
  'standby',
  'called',
  'performing',
  'departed',
  'arrived',
  'completed',
  'issue',
  'withdrawn'
);

create type public.aggregation_method as enum ('average', 'sum');
create type public.attraction_mode as enum ('compliance_only', 'fixed_points');
create type public.score_sheet_status as enum ('draft', 'submitted', 'unlocked', 'waived');
create type public.attraction_check_status as enum (
  'performed',
  'not_performed',
  'unable_to_verify'
);
create type public.penalty_status as enum ('draft', 'confirmed', 'cancelled');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null check (length(btrim(full_name)) > 0),
  role public.user_role not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) > 0),
  year integer not null check (year between 2000 and 2100),
  event_date date not null,
  route_description text not null check (length(btrim(route_description)) > 0),
  timezone text not null default 'Asia/Jakarta',
  status public.event_status not null default 'draft',
  normal_performance_minutes integer not null default 10
    check (normal_performance_minutes >= 0),
  finish_extra_minutes integer not null default 4
    check (finish_extra_minutes >= 0),
  aggregation_method public.aggregation_method not null default 'average',
  rounding_scale smallint not null default 2 check (rounding_scale between 0 and 6),
  attraction_mode public.attraction_mode not null default 'compliance_only',
  attraction_point_value numeric(7, 3),
  tie_break_config jsonb not null default '[]'::jsonb
    check (jsonb_typeof(tie_break_config) = 'array'),
  config_locked_at timestamptz,
  published_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint events_attraction_configuration_check check (
    (
      attraction_mode = 'fixed_points'
      and attraction_point_value is not null
      and attraction_point_value > 0
    )
    or (
      attraction_mode = 'compliance_only'
      and coalesce(attraction_point_value, 0) = 0
    )
  )
);

create table public.participant_categories (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  code text not null check (length(btrim(code)) > 0),
  name text not null check (length(btrim(name)) > 0),
  sort_order integer not null check (sort_order > 0),
  constraint participant_categories_event_code_key unique (event_id, code),
  constraint participant_categories_id_event_key unique (id, event_id)
);

create table public.participants (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  category_id uuid not null,
  sequence_number integer not null check (sequence_number > 0),
  name text not null check (length(btrim(name)) > 0),
  theme text,
  coordinator_name text,
  coordinator_phone text,
  member_count integer not null check (member_count > 0),
  scheduled_departure_at timestamptz,
  estimated_finish_at timestamptz,
  actual_departure_at timestamptz,
  actual_finish_at timestamptz,
  status public.participant_status not null default 'registered',
  exception_reason text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint participants_category_event_fk
    foreign key (category_id, event_id)
    references public.participant_categories (id, event_id),
  constraint participants_event_sequence_idx unique (event_id, sequence_number),
  constraint participants_id_event_key unique (id, event_id),
  constraint participants_minimum_members_check check (
    member_count >= 30
    or length(btrim(coalesce(exception_reason, ''))) > 0
  ),
  constraint participants_schedule_check check (
    estimated_finish_at is null
    or scheduled_departure_at is null
    or estimated_finish_at >= scheduled_departure_at
  ),
  constraint participants_actual_time_check check (
    actual_finish_at is null
    or actual_departure_at is null
    or actual_finish_at >= actual_departure_at
  )
);

create index participants_event_category_status_idx
  on public.participants (event_id, category_id, status);

create table public.judging_locations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  code text not null check (length(btrim(code)) > 0),
  name text not null check (length(btrim(name)) > 0),
  address_note text,
  sort_order integer not null check (sort_order > 0),
  is_active boolean not null default true,
  constraint judging_locations_event_code_key unique (event_id, code),
  constraint judging_locations_id_event_key unique (id, event_id)
);

create table public.judge_assignments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  judge_id uuid not null references public.profiles (id) on delete restrict,
  location_id uuid not null,
  assigned_at timestamptz not null default now(),
  revoked_at timestamptz,
  assigned_by uuid references public.profiles (id) on delete set null,
  constraint judge_assignments_location_event_fk
    foreign key (location_id, event_id)
    references public.judging_locations (id, event_id),
  constraint judge_assignments_revocation_check check (
    revoked_at is null or revoked_at >= assigned_at
  )
);

create unique index judge_assignments_active_judge_idx
  on public.judge_assignments (event_id, judge_id)
  where revoked_at is null;

create unique index judge_assignments_active_location_idx
  on public.judge_assignments (event_id, location_id)
  where revoked_at is null;

create table public.score_criteria (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  code text not null check (length(btrim(code)) > 0),
  name text not null check (length(btrim(name)) > 0),
  description text not null default '',
  max_score numeric(7, 3) not null check (max_score > 0),
  sort_order integer not null check (sort_order > 0),
  is_active boolean not null default true,
  constraint score_criteria_event_code_key unique (event_id, code)
);

create table public.score_sheets (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  participant_id uuid not null,
  location_id uuid not null,
  judge_id uuid not null references public.profiles (id) on delete restrict,
  status public.score_sheet_status not null default 'draft',
  total_score numeric(7, 3) not null default 0 check (total_score between 0 and 100),
  general_note text,
  version integer not null default 1 check (version > 0),
  submitted_at timestamptz,
  unlocked_at timestamptz,
  unlock_reason text,
  updated_at timestamptz not null default now(),
  constraint score_sheets_participant_event_fk
    foreign key (participant_id, event_id)
    references public.participants (id, event_id),
  constraint score_sheets_location_event_fk
    foreign key (location_id, event_id)
    references public.judging_locations (id, event_id),
  constraint score_sheets_event_participant_location_idx
    unique (event_id, participant_id, location_id),
  constraint score_sheets_submission_check check (
    status not in ('submitted', 'waived') or submitted_at is not null
  ),
  constraint score_sheets_unlock_check check (
    status <> 'unlocked'
    or (
      unlocked_at is not null
      and length(btrim(coalesce(unlock_reason, ''))) > 0
    )
  )
);

create index score_sheets_event_status_idx
  on public.score_sheets (event_id, status);

create table public.score_entries (
  id uuid primary key default gen_random_uuid(),
  score_sheet_id uuid not null references public.score_sheets (id) on delete cascade,
  criterion_id uuid not null references public.score_criteria (id) on delete restrict,
  score numeric(7, 3) not null check (score >= 0 and score = trunc(score)),
  note text,
  updated_at timestamptz not null default now(),
  constraint score_entries_sheet_criterion_key unique (score_sheet_id, criterion_id)
);

create table public.attraction_points (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  code text not null check (length(btrim(code)) > 0),
  name text not null check (length(btrim(name)) > 0),
  address_note text not null default '',
  sort_order integer not null check (sort_order > 0),
  point_value numeric(7, 3) check (point_value is null or point_value >= 0),
  is_active boolean not null default true,
  constraint attraction_points_event_code_key unique (event_id, code),
  constraint attraction_points_id_event_key unique (id, event_id)
);

create table public.attraction_verifier_assignments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  operator_id uuid not null references public.profiles (id) on delete restrict,
  attraction_point_id uuid not null,
  assigned_at timestamptz not null default now(),
  revoked_at timestamptz,
  assigned_by uuid references public.profiles (id) on delete set null,
  constraint attraction_verifier_point_event_fk
    foreign key (attraction_point_id, event_id)
    references public.attraction_points (id, event_id),
  constraint attraction_verifier_revocation_check check (
    revoked_at is null or revoked_at >= assigned_at
  )
);

create unique index attraction_verifier_active_operator_idx
  on public.attraction_verifier_assignments (event_id, operator_id)
  where revoked_at is null;

create unique index attraction_verifier_active_point_idx
  on public.attraction_verifier_assignments (event_id, attraction_point_id)
  where revoked_at is null;

create table public.attraction_checks (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  participant_id uuid not null,
  attraction_point_id uuid not null,
  status public.attraction_check_status not null,
  verified_by uuid not null references public.profiles (id) on delete restrict,
  verified_at timestamptz not null default now(),
  note text,
  evidence_path text,
  constraint attraction_checks_participant_event_fk
    foreign key (participant_id, event_id)
    references public.participants (id, event_id),
  constraint attraction_checks_point_event_fk
    foreign key (attraction_point_id, event_id)
    references public.attraction_points (id, event_id),
  constraint attraction_checks_event_participant_idx
    unique (event_id, participant_id, attraction_point_id)
);

create table public.penalty_types (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  code text not null check (length(btrim(code)) > 0),
  name text not null check (length(btrim(name)) > 0),
  default_deduction numeric(7, 3) not null check (default_deduction > 0),
  requires_approval boolean not null default false,
  is_active boolean not null default true,
  constraint penalty_types_event_code_key unique (event_id, code)
);

create table public.penalties (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  participant_id uuid not null,
  penalty_type_id uuid not null references public.penalty_types (id) on delete restrict,
  deduction numeric(7, 3) not null check (deduction > 0),
  reason text not null check (length(btrim(reason)) > 0),
  occurred_at timestamptz not null,
  status public.penalty_status not null default 'draft',
  recorded_by uuid not null references public.profiles (id) on delete restrict,
  confirmed_by uuid references public.profiles (id) on delete restrict,
  confirmed_at timestamptz,
  cancelled_by uuid references public.profiles (id) on delete restrict,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  constraint penalties_participant_event_fk
    foreign key (participant_id, event_id)
    references public.participants (id, event_id),
  constraint penalties_confirmation_check check (
    status <> 'confirmed'
    or (confirmed_by is not null and confirmed_at is not null)
  ),
  constraint penalties_cancellation_check check (
    status <> 'cancelled'
    or (cancelled_by is not null and cancelled_at is not null)
  )
);

create index penalties_event_participant_status_idx
  on public.penalties (event_id, participant_id, status);

create table public.participant_status_logs (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  participant_id uuid not null,
  from_status public.participant_status,
  to_status public.participant_status not null,
  note text,
  recorded_by uuid not null references public.profiles (id) on delete restrict,
  recorded_at timestamptz not null default now(),
  constraint participant_status_logs_participant_event_fk
    foreign key (participant_id, event_id)
    references public.participants (id, event_id)
);

create table public.result_snapshots (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  version integer not null check (version > 0),
  calculation_config jsonb not null check (jsonb_typeof(calculation_config) = 'object'),
  results jsonb not null check (jsonb_typeof(results) = 'array'),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  published_at timestamptz,
  constraint result_snapshots_event_version_key unique (event_id, version)
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  event_id uuid references public.events (id) on delete set null,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null check (length(btrim(action)) > 0),
  entity_type text not null check (length(btrim(entity_type)) > 0),
  entity_id text,
  before_data jsonb,
  after_data jsonb,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index audit_logs_event_created_at_idx
  on public.audit_logs (event_id, created_at desc);

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger events_set_updated_at
before update on public.events
for each row execute function public.set_updated_at();

create trigger participants_set_updated_at
before update on public.participants
for each row execute function public.set_updated_at();

create trigger score_sheets_set_updated_at
before update on public.score_sheets
for each row execute function public.set_updated_at();

create trigger score_entries_set_updated_at
before update on public.score_entries
for each row execute function public.set_updated_at();

create function public.prevent_audit_log_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception using
    errcode = '42501',
    message = 'audit_logs is append-only';
end;
$$;

create trigger audit_logs_prevent_update
before update on public.audit_logs
for each row execute function public.prevent_audit_log_mutation();

create trigger audit_logs_prevent_delete
before delete on public.audit_logs
for each row execute function public.prevent_audit_log_mutation();

create function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
  select profile.role
  from public.profiles as profile
  where profile.id = (select auth.uid())
    and profile.is_active
$$;

create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    public.current_user_role() in ('super_admin', 'admin'),
    false
  )
$$;

create function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.current_user_role() = 'super_admin', false)
$$;

create function public.has_active_judge_assignment(
  assignment_event_id uuid,
  assignment_location_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.judge_assignments as assignment
    where assignment.event_id = assignment_event_id
      and assignment.location_id = assignment_location_id
      and assignment.judge_id = (select auth.uid())
      and assignment.revoked_at is null
  )
$$;

create function public.has_active_attraction_assignment(
  assignment_event_id uuid,
  assignment_point_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.attraction_verifier_assignments as assignment
    where assignment.event_id = assignment_event_id
      and assignment.attraction_point_id = assignment_point_id
      and assignment.operator_id = (select auth.uid())
      and assignment.revoked_at is null
  )
$$;

revoke all on function public.current_user_role() from public;
revoke all on function public.is_admin() from public;
revoke all on function public.is_super_admin() from public;
revoke all on function public.has_active_judge_assignment(uuid, uuid) from public;
revoke all on function public.has_active_attraction_assignment(uuid, uuid) from public;

grant execute on function public.current_user_role() to authenticated, service_role;
grant execute on function public.is_admin() to authenticated, service_role;
grant execute on function public.is_super_admin() to authenticated, service_role;
grant execute on function public.has_active_judge_assignment(uuid, uuid)
  to authenticated, service_role;
grant execute on function public.has_active_attraction_assignment(uuid, uuid)
  to authenticated, service_role;

alter table public.profiles enable row level security;
alter table public.events enable row level security;
alter table public.participant_categories enable row level security;
alter table public.participants enable row level security;
alter table public.judging_locations enable row level security;
alter table public.judge_assignments enable row level security;
alter table public.score_criteria enable row level security;
alter table public.score_sheets enable row level security;
alter table public.score_entries enable row level security;
alter table public.attraction_points enable row level security;
alter table public.attraction_verifier_assignments enable row level security;
alter table public.attraction_checks enable row level security;
alter table public.penalty_types enable row level security;
alter table public.penalties enable row level security;
alter table public.participant_status_logs enable row level security;
alter table public.result_snapshots enable row level security;
alter table public.audit_logs enable row level security;

revoke all privileges on all tables in schema public from anon, authenticated;
revoke all privileges on all sequences in schema public from anon, authenticated;

grant usage on schema public to anon, authenticated, service_role;
grant select on public.result_snapshots to anon;

grant select on
  public.profiles,
  public.events,
  public.participant_categories,
  public.participants,
  public.judging_locations,
  public.judge_assignments,
  public.score_criteria,
  public.score_sheets,
  public.score_entries,
  public.attraction_points,
  public.attraction_verifier_assignments,
  public.attraction_checks,
  public.penalty_types,
  public.penalties,
  public.participant_status_logs,
  public.result_snapshots,
  public.audit_logs
to authenticated;

grant insert, update, delete on
  public.profiles,
  public.events,
  public.participant_categories,
  public.judging_locations,
  public.judge_assignments,
  public.score_criteria,
  public.attraction_points,
  public.attraction_verifier_assignments,
  public.penalty_types
to authenticated;

grant insert, update on
  public.participants,
  public.score_sheets,
  public.score_entries,
  public.attraction_checks,
  public.penalties
to authenticated;

grant insert on public.participant_status_logs to authenticated;
grant insert, update on public.result_snapshots to authenticated;

grant all privileges on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;

create policy profiles_select_self_or_admin
on public.profiles for select to authenticated
using (id = (select auth.uid()) or (select public.is_admin()));

create policy profiles_admin_insert
on public.profiles for insert to authenticated
with check ((select public.is_admin()));

create policy profiles_admin_update
on public.profiles for update to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy profiles_admin_delete
on public.profiles for delete to authenticated
using ((select public.is_admin()));

create policy events_authenticated_select
on public.events for select to authenticated
using (true);

create policy events_admin_insert
on public.events for insert to authenticated
with check ((select public.is_admin()));

create policy events_admin_update
on public.events for update to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy events_admin_delete
on public.events for delete to authenticated
using ((select public.is_admin()));

create policy participant_categories_authenticated_select
on public.participant_categories for select to authenticated
using (true);

create policy participant_categories_admin_manage
on public.participant_categories for all to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy participants_authenticated_select
on public.participants for select to authenticated
using (true);

create policy participants_admin_operator_insert
on public.participants for insert to authenticated
with check (
  (select public.is_admin())
  or public.current_user_role() = 'operator'
);

create policy participants_admin_operator_update
on public.participants for update to authenticated
using (
  (select public.is_admin())
  or public.current_user_role() = 'operator'
)
with check (
  (select public.is_admin())
  or public.current_user_role() = 'operator'
);

create policy judging_locations_authenticated_select
on public.judging_locations for select to authenticated
using (true);

create policy judging_locations_admin_manage
on public.judging_locations for all to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy judge_assignments_select_admin_or_self
on public.judge_assignments for select to authenticated
using (
  (select public.is_admin())
  or judge_id = (select auth.uid())
);

create policy judge_assignments_admin_manage
on public.judge_assignments for all to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy score_criteria_authenticated_select
on public.score_criteria for select to authenticated
using (true);

create policy score_criteria_admin_manage
on public.score_criteria for all to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy score_sheets_select_admin_or_assigned_judge
on public.score_sheets for select to authenticated
using (
  (select public.is_admin())
  or (
    judge_id = (select auth.uid())
    and public.has_active_judge_assignment(event_id, location_id)
  )
);

create policy score_sheets_insert_admin_or_assigned_judge
on public.score_sheets for insert to authenticated
with check (
  (select public.is_admin())
  or (
    judge_id = (select auth.uid())
    and public.has_active_judge_assignment(event_id, location_id)
  )
);

create policy score_sheets_update_admin_or_assigned_judge
on public.score_sheets for update to authenticated
using (
  (select public.is_admin())
  or (
    judge_id = (select auth.uid())
    and public.has_active_judge_assignment(event_id, location_id)
  )
)
with check (
  (select public.is_admin())
  or (
    judge_id = (select auth.uid())
    and public.has_active_judge_assignment(event_id, location_id)
  )
);

create policy score_entries_select_admin_or_sheet_judge
on public.score_entries for select to authenticated
using (
  (select public.is_admin())
  or exists (
    select 1
    from public.score_sheets as sheet
    where sheet.id = score_sheet_id
      and sheet.judge_id = (select auth.uid())
      and public.has_active_judge_assignment(sheet.event_id, sheet.location_id)
  )
);

create policy score_entries_insert_admin_or_sheet_judge
on public.score_entries for insert to authenticated
with check (
  (select public.is_admin())
  or exists (
    select 1
    from public.score_sheets as sheet
    where sheet.id = score_sheet_id
      and sheet.judge_id = (select auth.uid())
      and public.has_active_judge_assignment(sheet.event_id, sheet.location_id)
  )
);

create policy score_entries_update_admin_or_sheet_judge
on public.score_entries for update to authenticated
using (
  (select public.is_admin())
  or exists (
    select 1
    from public.score_sheets as sheet
    where sheet.id = score_sheet_id
      and sheet.judge_id = (select auth.uid())
      and public.has_active_judge_assignment(sheet.event_id, sheet.location_id)
  )
)
with check (
  (select public.is_admin())
  or exists (
    select 1
    from public.score_sheets as sheet
    where sheet.id = score_sheet_id
      and sheet.judge_id = (select auth.uid())
      and public.has_active_judge_assignment(sheet.event_id, sheet.location_id)
  )
);

create policy attraction_points_authenticated_select
on public.attraction_points for select to authenticated
using (true);

create policy attraction_points_admin_manage
on public.attraction_points for all to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy attraction_verifier_assignments_select_admin_or_self
on public.attraction_verifier_assignments for select to authenticated
using (
  (select public.is_admin())
  or operator_id = (select auth.uid())
);

create policy attraction_verifier_assignments_admin_manage
on public.attraction_verifier_assignments for all to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy attraction_checks_authenticated_select
on public.attraction_checks for select to authenticated
using (true);

create policy attraction_checks_admin_or_assigned_verifier_insert
on public.attraction_checks for insert to authenticated
with check (
  (select public.is_admin())
  or (
    verified_by = (select auth.uid())
    and public.has_active_attraction_assignment(event_id, attraction_point_id)
  )
);

create policy attraction_checks_admin_or_assigned_verifier_update
on public.attraction_checks for update to authenticated
using (
  (select public.is_admin())
  or (
    verified_by = (select auth.uid())
    and public.has_active_attraction_assignment(event_id, attraction_point_id)
  )
)
with check (
  (select public.is_admin())
  or (
    verified_by = (select auth.uid())
    and public.has_active_attraction_assignment(event_id, attraction_point_id)
  )
);

create policy penalty_types_admin_operator_select
on public.penalty_types for select to authenticated
using (
  (select public.is_admin())
  or public.current_user_role() = 'operator'
);

create policy penalty_types_admin_manage
on public.penalty_types for all to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy penalties_admin_operator_select
on public.penalties for select to authenticated
using (
  (select public.is_admin())
  or public.current_user_role() = 'operator'
);

create policy penalties_admin_operator_insert
on public.penalties for insert to authenticated
with check (
  (select public.is_admin())
  or (
    public.current_user_role() = 'operator'
    and recorded_by = (select auth.uid())
    and status = 'draft'
  )
);

create policy penalties_admin_update
on public.penalties for update to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy participant_status_logs_admin_operator_select
on public.participant_status_logs for select to authenticated
using (
  (select public.is_admin())
  or public.current_user_role() = 'operator'
);

create policy participant_status_logs_admin_operator_insert
on public.participant_status_logs for insert to authenticated
with check (
  (select public.is_admin())
  or (
    public.current_user_role() = 'operator'
    and recorded_by = (select auth.uid())
  )
);

create policy result_snapshots_public_select_published
on public.result_snapshots for select to anon
using (published_at is not null);

create policy result_snapshots_internal_select
on public.result_snapshots for select to authenticated
using ((select public.is_admin()) or published_at is not null);

create policy result_snapshots_admin_insert
on public.result_snapshots for insert to authenticated
with check ((select public.is_admin()));

create policy result_snapshots_admin_update
on public.result_snapshots for update to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy audit_logs_admin_select
on public.audit_logs for select to authenticated
using ((select public.is_admin()));
