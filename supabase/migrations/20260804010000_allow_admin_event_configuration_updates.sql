-- Admin tetap dapat memperbarui konfigurasi event ketika penjurian sudah dibuka.
-- Perubahan status event dan status lembar nilai tetap wajib melalui RPC terkait.

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
  end if;
  return new;
end;
$$;
