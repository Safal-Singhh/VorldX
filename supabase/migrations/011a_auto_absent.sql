-- VorldX 011a: shift-end auto-absence
-- Employees and HR are marked Absent when no attendance row exists at their
-- shift end on a working day. Admin accounts are never auto-marked.
--
-- Rules:
--   * Absent rows: status='absent', source='auto', no check-in/check-out/type.
--   * A check-in after shift end is rejected (SHIFT_ENDED). Once an absent row
--     exists it stays final until an HR/Admin correction (ABSENT_FINAL).
--   * Checkout after shift end is still allowed for an open present/late row.
--   * Missing checkout is not absence.
--   * Approved leave suppresses/clears an auto-absent row. Pending leave does not.
--   * auto_absent_started_at prevents backfill when the feature is enabled.
--   * No holiday calendar exists yet; working_days is the only day rule.
--
-- Dashboard scope:
--   * Admin -> active HR + employees with a login and active membership.
--   * HR    -> active employees with a login and active membership.
--   * Unactivated/roster-only (user_id is null) staff never count as absent.

-- ---------------------------------------------------------------------------
-- 1. Schema
-- ---------------------------------------------------------------------------

alter table public.attendance_records
  alter column attendance_type drop not null,
  alter column check_in_at drop not null;

alter table public.attendance_records
  drop constraint if exists attendance_records_attendance_type_check,
  drop constraint if exists attendance_records_status_check,
  drop constraint if exists attendance_records_source_check,
  drop constraint if exists attendance_records_check;

alter table public.attendance_records
  add constraint attendance_records_attendance_type_check
    check (attendance_type is null or attendance_type in ('office', 'wfh')),
  add constraint attendance_records_status_check
    check (status in ('present', 'late', 'absent')),
  add constraint attendance_records_source_check
    check (source in ('qr', 'passcode', 'manual', 'correction', 'import', 'auto')),
  add constraint attendance_records_checkout_after_checkin
    check (check_out_at is null or check_in_at is null or check_out_at > check_in_at),
  add constraint attendance_records_absent_shape
    check (
      (status = 'absent'
        and source = 'auto'
        and check_in_at is null
        and check_out_at is null
        and attendance_type is null)
      or
      (status in ('present', 'late')
        and source <> 'auto'
        and check_in_at is not null
        and attendance_type is not null)
    );

create index if not exists idx_att_company_status_date
  on public.attendance_records(company_id, status, work_date);

alter table public.attendance_policies
  add column if not exists auto_absent_enabled boolean not null default true,
  add column if not exists auto_absent_started_at timestamptz not null default now();

comment on column public.attendance_policies.auto_absent_enabled is
  'When true, the five-minute job marks active HR/employees absent after their shift end.';
comment on column public.attendance_policies.auto_absent_started_at is
  'No auto-absence is created for shift ends before this instant. Reset when re-enabled.';

-- Re-enabling never backfills the disabled period. The trigger is the single
-- source of truth even if a caller writes the policy table directly.
create or replace function public.sync_auto_absent_policy()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.auto_absent_started_at is null then
      new.auto_absent_started_at := now();
    end if;
  elsif new.auto_absent_enabled and not coalesce(old.auto_absent_enabled, false) then
    new.auto_absent_started_at := now();
  elsif new.auto_absent_started_at is null
     or new.auto_absent_started_at < old.auto_absent_started_at then
    new.auto_absent_started_at := old.auto_absent_started_at;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_policy_auto_absent on public.attendance_policies;
create trigger trg_policy_auto_absent
  before insert or update on public.attendance_policies
  for each row execute function public.sync_auto_absent_policy();

-- ---------------------------------------------------------------------------
-- 2. Shift helpers (overnight shifts end on the following local day)
-- ---------------------------------------------------------------------------

create or replace function public.shift_start_at(
  p_shift_id uuid,
  p_work_date date,
  p_timezone text
) returns timestamptz
language sql
stable
set search_path = public
as $$
  select ((p_work_date + s.start_time)::timestamp at time zone p_timezone)
  from public.shifts s
  where s.id = p_shift_id;
$$;

create or replace function public.shift_end_at(
  p_shift_id uuid,
  p_work_date date,
  p_timezone text
) returns timestamptz
language sql
stable
set search_path = public
as $$
  select ((p_work_date + s.end_time)::timestamp at time zone p_timezone)
    + case when s.end_time <= s.start_time then interval '1 day' else interval '0' end
  from public.shifts s
  where s.id = p_shift_id;
$$;

revoke all on function public.shift_start_at(uuid, date, text) from public, anon, authenticated;
revoke all on function public.shift_end_at(uuid, date, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Absence job
-- ---------------------------------------------------------------------------

create or replace function public.apply_auto_absence(p_company_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_inserted int := 0;
  v_companies int := 0;
begin
  -- One job at a time. pg_cron can overlap when a run is slow.
  if not pg_try_advisory_xact_lock(hashtext('vorldx:auto-absent')::bigint) then
    return jsonb_build_object('skipped', true, 'reason', 'locked', 'inserted', 0, 'companies', 0);
  end if;

  with policy as (
    select c.id as company_id, c.timezone, p.auto_absent_started_at
    from public.companies c
    join public.attendance_policies p on p.company_id = c.id
    where c.is_active
      and p.auto_absent_enabled
      and (p_company_id is null or c.id = p_company_id)
  ),
  scope as (
    select e.id as employee_id,
           e.company_id,
           e.joining_date,
           coalesce(es.id, ds.id) as shift_id,
           p.timezone,
           p.auto_absent_started_at
    from policy p
    join public.employees e
      on e.company_id = p.company_id
     and e.is_active
     and e.user_id is not null
    join public.company_memberships m
      on m.company_id = e.company_id
     and m.user_id = e.user_id
     and m.status = 'active'
     and m.role in ('hr', 'employee')
    left join lateral (
      select s.id
      from public.shifts s
      where s.id = e.shift_id and s.is_active
    ) es on true
    left join lateral (
      select s.id
      from public.shifts s
      where s.company_id = e.company_id and s.is_active
      order by s.created_at
      limit 1
    ) ds on true
    where coalesce(es.id, ds.id) is not null
  ),
  dates as (
    select p.company_id,
           (now() at time zone p.timezone)::date - gap as work_date
    from policy p
    cross join generate_series(0, 7) as gap
  ),
  candidates as (
    select sc.company_id,
           sc.employee_id,
           d.work_date,
           sc.shift_id,
           sc.auto_absent_started_at,
           public.shift_end_at(sc.shift_id, d.work_date, sc.timezone) as end_at
    from scope sc
    join dates d on d.company_id = sc.company_id
    join public.shifts s on s.id = sc.shift_id
    where sc.joining_date <= d.work_date
      and extract(isodow from d.work_date)::int = any(s.working_days)
  ),
  eligible as (
    select c.company_id, c.employee_id, c.work_date
    from candidates c
    where c.end_at <= now()
      and c.end_at >= c.auto_absent_started_at
      and not exists (
        select 1
        from public.attendance_records a
        where a.company_id = c.company_id
          and a.employee_id = c.employee_id
          and a.work_date = c.work_date
      )
      and not exists (
        select 1
        from public.leave_requests l
        where l.company_id = c.company_id
          and l.employee_id = c.employee_id
          and l.leave_date = c.work_date
          and l.status = 'approved'
      )
  ),
  inserted as (
    insert into public.attendance_records
      (company_id, employee_id, work_date, attendance_type, check_in_at, check_out_at, status, source)
    select company_id, employee_id, work_date, null, null, null, 'absent', 'auto'
    from eligible
    order by company_id, work_date, employee_id
    on conflict (company_id, employee_id, work_date) do nothing
    returning company_id
  )
  select count(distinct company_id), count(*)
    into v_companies, v_inserted
  from inserted;

  return jsonb_build_object(
    'skipped', false,
    'companies', coalesce(v_companies, 0),
    'inserted', coalesce(v_inserted, 0)
  );
end;
$$;

revoke all on function public.apply_auto_absence(uuid) from public, anon, authenticated;

do $$
declare
  v_job_id bigint;
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    select jobid into v_job_id from cron.job where jobname = 'vorldx-auto-absent';
    if v_job_id is not null then
      perform cron.unschedule(v_job_id);
    end if;
    perform cron.schedule(
      'vorldx-auto-absent',
      '*/5 * * * *',
      'select public.apply_auto_absence();'
    );
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Office QR: reject new check-ins after shift end; absent rows are final
-- ---------------------------------------------------------------------------

create or replace function public.process_office_attendance(p_token_hash text, p_employee_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_sess record;
  v_emp record;
  v_comp record;
  v_shift record;
  v_now timestamptz := now();
  v_local_date date;
  v_local_time time;
  v_work_date date;
  v_shift_start timestamptz;
  v_shift_end timestamptz;
  v_status text;
  v_rec record;
begin
  select s.*, d.is_active as display_active
    into v_sess
  from public.qr_sessions s
  join public.qr_displays d on d.id = s.display_id
  where s.token_hash = p_token_hash and s.revoked_at is null
  limit 1;
  if not found then raise exception 'QR_INVALID'; end if;
  if v_sess.expires_at <= v_now then raise exception 'QR_EXPIRED'; end if;
  if not v_sess.display_active then raise exception 'DISPLAY_DISABLED'; end if;

  select * into v_emp from public.employees where id = p_employee_id and is_active;
  if not found then raise exception 'EMPLOYEE_INACTIVE'; end if;
  if auth.uid() is not null and v_emp.user_id is distinct from auth.uid() then raise exception 'EMPLOYEE_MISMATCH'; end if;
  if v_emp.user_id is null then raise exception 'NOT_ACTIVATED'; end if;
  if v_emp.company_id != v_sess.company_id then raise exception 'COMPANY_MISMATCH'; end if;

  select * into v_comp from public.companies where id = v_emp.company_id and is_active;
  if not found then raise exception 'COMPANY_INACTIVE'; end if;
  if not exists (
    select 1 from public.company_memberships m
    where m.company_id = v_emp.company_id
      and m.user_id = v_emp.user_id
      and m.status = 'active'
  ) then raise exception 'MEMBERSHIP_INACTIVE'; end if;

  v_local_date := ((v_now at time zone v_comp.timezone))::date;
  v_local_time := ((v_now at time zone v_comp.timezone))::time;
  v_work_date := v_local_date;

  select * into v_shift from public.shifts where id = v_emp.shift_id and is_active;
  if found then
    -- A night shift that started yesterday is still the active work date.
    if v_shift.end_time <= v_shift.start_time and v_local_time <= v_shift.end_time then
      v_work_date := v_local_date - 1;
    end if;
    v_shift_start := public.shift_start_at(v_shift.id, v_work_date, v_comp.timezone);
    v_shift_end := public.shift_end_at(v_shift.id, v_work_date, v_comp.timezone);
    if v_now <= v_shift_start + (v_shift.grace_period_minutes || ' minutes')::interval then
      v_status := 'present';
    else
      v_status := 'late';
    end if;
  else
    v_status := 'present';
  end if;

  select * into v_rec
  from public.attendance_records
  where company_id = v_emp.company_id
    and employee_id = v_emp.id
    and work_date = v_work_date
  for update;

  if found then
    if v_rec.status = 'absent' then raise exception 'ABSENT_FINAL'; end if;
    if v_rec.check_out_at is null then
      if v_rec.attendance_type != 'office' then raise exception 'TYPE_CONFLICT'; end if;
      update public.attendance_records
        set check_out_at = v_now, updated_at = v_now
      where id = v_rec.id
      returning * into v_rec;
      insert into public.audit_logs (company_id, actor_user_id, action, entity_type, entity_id, new_values)
      values (v_emp.company_id, v_emp.user_id, 'attendance.checkout', 'attendance_record', v_rec.id::text,
        jsonb_build_object('check_out_at', v_now));
    else
      raise exception 'ALREADY_CHECKED_OUT';
    end if;
  else
    if v_shift_end is not null and v_now > v_shift_end then raise exception 'SHIFT_ENDED'; end if;
    insert into public.attendance_records
      (company_id, employee_id, work_date, attendance_type, check_in_at, status, source)
    values (v_emp.company_id, v_emp.id, v_work_date, 'office', v_now, v_status, 'qr')
    returning * into v_rec;
    insert into public.audit_logs (company_id, actor_user_id, action, entity_type, entity_id, new_values)
    values (v_emp.company_id, v_emp.user_id, 'attendance.checkin', 'attendance_record', v_rec.id::text,
      jsonb_build_object('type','office','work_date',v_work_date,'status',v_status));
  end if;

  return jsonb_build_object(
    'id', v_rec.id,
    'work_date', v_rec.work_date,
    'type', v_rec.attendance_type,
    'check_in_at', v_rec.check_in_at,
    'check_out_at', v_rec.check_out_at,
    'status', v_rec.status
  );
end; $$;

revoke execute on function public.process_office_attendance(text, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. WFH passcode: same shift-end and absent guards
-- ---------------------------------------------------------------------------

create or replace function public.mark_wfh_attendance(p_employee_id uuid, p_passcode_hash text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_emp record;
  v_comp record;
  v_shift record;
  v_pass record;
  v_now timestamptz := now();
  v_local_date date;
  v_local_time time;
  v_work_date date;
  v_shift_start timestamptz;
  v_shift_end timestamptz;
  v_status text;
  v_rec record;
  v_action text;
begin
  select * into v_pass from public.wfh_passcodes where passcode_hash = p_passcode_hash for update;
  if not found then raise exception 'PASSCODE_INVALID'; end if;
  if v_pass.use_count >= 2 then raise exception 'PASSCODE_USED'; end if;
  if v_pass.expires_at <= v_now then raise exception 'PASSCODE_EXPIRED'; end if;
  if v_pass.employee_id != p_employee_id then raise exception 'PASSCODE_WRONG_USER'; end if;

  select * into v_emp from public.employees where id = p_employee_id and is_active;
  if not found then raise exception 'EMPLOYEE_INACTIVE'; end if;
  if auth.uid() is not null and v_emp.user_id is distinct from auth.uid() then raise exception 'EMPLOYEE_MISMATCH'; end if;

  select * into v_comp from public.companies where id = v_emp.company_id and is_active;
  if not found then raise exception 'COMPANY_INACTIVE'; end if;

  v_local_date := ((v_now at time zone v_comp.timezone))::date;
  v_local_time := ((v_now at time zone v_comp.timezone))::time;
  v_work_date := v_local_date;

  select * into v_shift from public.shifts where id = v_emp.shift_id and is_active;
  if not found then
    select * into v_shift
    from public.shifts
    where company_id = v_emp.company_id and is_active
    order by created_at
    limit 1;
  end if;
  if found then
    if v_shift.end_time <= v_shift.start_time and v_local_time <= v_shift.end_time then
      v_work_date := v_local_date - 1;
    end if;
    v_shift_start := public.shift_start_at(v_shift.id, v_work_date, v_comp.timezone);
    v_shift_end := public.shift_end_at(v_shift.id, v_work_date, v_comp.timezone);
    if v_now <= v_shift_start + (v_shift.grace_period_minutes || ' minutes')::interval then
      v_status := 'present';
    else
      v_status := 'late';
    end if;
  else
    v_status := 'present';
  end if;

  if v_pass.work_date != v_work_date then raise exception 'PASSCODE_WRONG_DATE'; end if;

  if v_pass.use_count = 0 then
    select * into v_rec
    from public.attendance_records
    where company_id = v_emp.company_id
      and employee_id = v_emp.id
      and work_date = v_work_date
    for update;
    if found then
      if v_rec.status = 'absent' then raise exception 'ABSENT_FINAL'; end if;
      raise exception 'ATTENDANCE_EXISTS';
    end if;
    if v_shift_end is not null and v_now > v_shift_end then raise exception 'SHIFT_ENDED'; end if;
    insert into public.attendance_records
      (company_id, employee_id, work_date, attendance_type, check_in_at, status, source)
    values (v_emp.company_id, v_emp.id, v_work_date, 'wfh', v_now, v_status, 'passcode')
    returning * into v_rec;
    update public.wfh_passcodes set use_count = 1, used_at = v_now where id = v_pass.id;
    v_action := 'checkin';
    insert into public.audit_logs (company_id, actor_user_id, action, entity_type, entity_id, new_values)
    values (v_emp.company_id, v_emp.user_id, 'wfh.attendance_marked', 'attendance_record', v_rec.id::text,
      jsonb_build_object('work_date', v_work_date, 'status', v_status, 'action', v_action));
  else
    select * into v_rec
    from public.attendance_records
    where company_id = v_emp.company_id
      and employee_id = v_emp.id
      and work_date = v_work_date
    for update;
    if not found then raise exception 'NO_CHECKIN'; end if;
    if v_rec.status = 'absent' then raise exception 'ABSENT_FINAL'; end if;
    if v_rec.attendance_type != 'wfh' then raise exception 'TYPE_CONFLICT'; end if;
    if v_rec.check_out_at is not null then raise exception 'ALREADY_CHECKED_OUT'; end if;
    update public.attendance_records set check_out_at = v_now where id = v_rec.id returning * into v_rec;
    update public.wfh_passcodes set use_count = 2 where id = v_pass.id;
    v_action := 'checkout';
    insert into public.audit_logs (company_id, actor_user_id, action, entity_type, entity_id, new_values)
    values (v_emp.company_id, v_emp.user_id, 'wfh.attendance_checkout', 'attendance_record', v_rec.id::text,
      jsonb_build_object('check_out_at', v_now, 'action', v_action));
  end if;

  return jsonb_build_object(
    'id', v_rec.id,
    'work_date', v_rec.work_date,
    'check_in_at', v_rec.check_in_at,
    'check_out_at', v_rec.check_out_at,
    'status', v_rec.status,
    'action', v_action,
    'uses_left', 2 - (v_pass.use_count + 1)
  );
end; $$;

revoke execute on function public.mark_wfh_attendance(uuid, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. Direct checkout (night-shift aware; absent rows stay final)
-- ---------------------------------------------------------------------------

create or replace function public.checkout_attendance(p_employee_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_emp record;
  v_comp record;
  v_shift record;
  v_now timestamptz := now();
  v_local_date date;
  v_local_time time;
  v_work_date date;
  v_rec record;
begin
  select * into v_emp from public.employees where id = p_employee_id and is_active;
  if not found then raise exception 'EMPLOYEE_INACTIVE'; end if;
  if auth.uid() is not null and v_emp.user_id is distinct from auth.uid() then raise exception 'EMPLOYEE_MISMATCH'; end if;

  select * into v_comp from public.companies where id = v_emp.company_id;
  v_local_date := ((v_now at time zone coalesce(v_comp.timezone,'Asia/Kolkata')))::date;
  v_local_time := ((v_now at time zone coalesce(v_comp.timezone,'Asia/Kolkata')))::time;
  v_work_date := v_local_date;

  select * into v_shift from public.shifts where id = v_emp.shift_id and is_active;
  if not found then
    select * into v_shift
    from public.shifts
    where company_id = v_emp.company_id and is_active
    order by created_at
    limit 1;
  end if;
  if found and v_shift.end_time <= v_shift.start_time and v_local_time <= v_shift.end_time then
    v_work_date := v_local_date - 1;
  end if;

  select * into v_rec
  from public.attendance_records
  where company_id = v_emp.company_id
    and employee_id = v_emp.id
    and work_date = v_work_date
  for update;
  if not found then raise exception 'NO_CHECKIN'; end if;
  if v_rec.status = 'absent' then raise exception 'ABSENT_FINAL'; end if;
  if v_rec.check_out_at is not null then raise exception 'ALREADY_CHECKED_OUT'; end if;
  update public.attendance_records set check_out_at = v_now where id = v_rec.id returning * into v_rec;
  insert into public.audit_logs (company_id, actor_user_id, action, entity_type, entity_id, new_values)
  values (v_emp.company_id, v_emp.user_id, 'attendance.checkout', 'attendance_record', v_rec.id::text,
    jsonb_build_object('check_out_at', v_now, 'source', v_rec.source));
  return jsonb_build_object('id', v_rec.id, 'check_out_at', v_rec.check_out_at);
end; $$;

revoke execute on function public.checkout_attendance(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 7. Leave: allow a request over an auto-absent row; approval clears it
-- ---------------------------------------------------------------------------

create or replace function public.submit_leave_request(p_employee_id uuid, p_leave_date date, p_reason text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_emp record; v_comp record; v_rid uuid; v_used int; v_limit int := 3; begin
  if char_length(trim(p_reason)) < 5 then raise exception 'REASON_TOO_SHORT'; end if;
  select * into v_emp from public.employees where id = p_employee_id and is_active;
  if not found then raise exception 'EMPLOYEE_INACTIVE'; end if;
  if auth.uid() is not null and v_emp.user_id is distinct from auth.uid() then raise exception 'EMPLOYEE_MISMATCH'; end if;
  if v_emp.user_id is null then raise exception 'NOT_ACTIVATED'; end if;
  select * into v_comp from public.companies where id = v_emp.company_id and is_active;
  if not found then raise exception 'COMPANY_INACTIVE'; end if;
  if p_leave_date < ((now() at time zone v_comp.timezone))::date - 1 then raise exception 'INVALID_DATE'; end if;
  -- An auto-absent row does not block leave: approved leave replaces it.
  if exists (
    select 1 from public.attendance_records a
    where a.company_id = v_emp.company_id
      and a.employee_id = v_emp.id
      and a.work_date = p_leave_date
      and a.status in ('present','late')
  ) then raise exception 'ATTENDANCE_EXISTS'; end if;
  if exists (
    select 1 from public.leave_requests r
    where r.employee_id = v_emp.id
      and r.leave_date = p_leave_date
      and r.status in ('pending','approved')
  ) then raise exception 'DUPLICATE_REQUEST'; end if;
  select count(*) into v_used
  from public.leave_requests r
  where r.employee_id = v_emp.id
    and date_trunc('month', r.leave_date) = date_trunc('month', p_leave_date::timestamp)
    and r.status in ('pending','approved');
  if v_used >= v_limit then raise exception 'MONTHLY_LIMIT'; end if;
  insert into public.leave_requests (company_id, employee_id, leave_date, reason, status)
    values (v_emp.company_id, v_emp.id, p_leave_date, trim(p_reason), 'pending') returning id into v_rid;
  insert into public.audit_logs (company_id, actor_user_id, action, entity_type, entity_id, new_values)
    values (v_emp.company_id, v_emp.user_id, 'leave.requested', 'leave_request', v_rid::text,
      jsonb_build_object('date', p_leave_date));
  return v_rid;
end; $$;

revoke execute on function public.submit_leave_request(uuid, date, text) from public, anon, authenticated;

create or replace function public.review_leave_request(p_request_id uuid, p_reviewer_user_id uuid, p_decision text, p_notes text DEFAULT NULL::text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_req record;
  v_req_emp record;
  v_req_role text;
  v_rev_role text;
  v_owner_role text;
  v_absent_cleared int := 0;
begin
  if auth.uid() is not null and auth.uid() <> p_reviewer_user_id then raise exception 'ACTOR_MISMATCH'; end if;
  if p_decision not in ('approved','rejected') then raise exception 'INVALID_DECISION'; end if;
  select * into v_req from public.leave_requests where id = p_request_id for update;
  if not found then raise exception 'REQUEST_NOT_FOUND'; end if;
  if v_req.status != 'pending' then raise exception 'ALREADY_REVIEWED'; end if;
  select * into v_req_emp from public.employees where id = v_req.employee_id;
  select role into v_rev_role from public.company_memberships where company_id = v_req.company_id and user_id = p_reviewer_user_id and status = 'active';
  if not found then raise exception 'REVIEWER_UNAUTHORIZED'; end if;
  if v_req_emp.user_id = p_reviewer_user_id then raise exception 'SELF_APPROVAL'; end if;
  select role into v_req_role from public.company_memberships where company_id = v_req.company_id and user_id = v_req_emp.user_id and status = 'active';
  if v_req_role is null then v_req_role := 'employee'; end if;
  if v_req_role = 'hr' then
    if v_rev_role != 'admin' then raise exception 'HR_REQUEST_NEEDS_ADMIN'; end if;
  elsif v_req_role = 'employee' then
    if v_rev_role not in ('hr','admin') then raise exception 'EMP_REQUEST_NEEDS_HR'; end if;
  elsif v_req_role = 'admin' then raise exception 'ADMIN_REQUEST_UNSUPPORTED'; end if;
  select role into v_owner_role from public.company_memberships
    where company_id = v_req.company_id and user_id = v_req_emp.created_by and role = 'hr' and status = 'active';
  if v_req_role = 'employee' and v_rev_role = 'hr'
     and v_req_emp.created_by is not null
     and v_req_emp.created_by <> p_reviewer_user_id
     and v_owner_role = 'hr' then
    raise exception 'EMPLOYEE_OWNED_BY_ANOTHER_HR';
  end if;

  update public.leave_requests
    set status = p_decision, reviewed_by = p_reviewer_user_id, reviewed_at = now(), review_notes = p_notes
  where id = p_request_id;

  if p_decision = 'approved' then
    delete from public.attendance_records a
    where a.company_id = v_req.company_id
      and a.employee_id = v_req.employee_id
      and a.work_date = v_req.leave_date
      and a.status = 'absent'
      and a.source = 'auto';
    get diagnostics v_absent_cleared = row_count;
  end if;

  insert into public.audit_logs (company_id, actor_user_id, action, entity_type, entity_id, new_values)
  values (v_req.company_id, p_reviewer_user_id, 'leave.' || p_decision, 'leave_request', p_request_id::text,
    jsonb_build_object('decision', p_decision, 'notes', p_notes, 'auto_absent_cleared', v_absent_cleared));
end; $$;

revoke execute on function public.review_leave_request(uuid, uuid, text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 8. Admin correction: an absent row becomes office present/late
-- ---------------------------------------------------------------------------

create or replace function public.admin_correct_attendance(
  p_record_id uuid,
  p_actor_user_id uuid,
  p_check_in timestamp with time zone,
  p_check_out timestamp with time zone,
  p_reason text
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_rec record;
  v_role text;
  v_shift record;
  v_tz text;
  v_status text;
  v_type text;
  v_shift_start timestamptz;
begin
  if auth.uid() is not null and auth.uid() <> p_actor_user_id then raise exception 'ACTOR_MISMATCH'; end if;
  if char_length(trim(coalesce(p_reason,''))) < 5 then raise exception 'REASON_REQUIRED'; end if;
  if p_check_in is null then raise exception 'CHECK_IN_REQUIRED'; end if;
  if p_check_out is not null and p_check_out <= p_check_in then raise exception 'INVALID_TIMES'; end if;

  select * into v_rec from public.attendance_records where id = p_record_id for update;
  if not found then raise exception 'RECORD_NOT_FOUND'; end if;
  select role into v_role from public.company_memberships
    where company_id = v_rec.company_id and user_id = p_actor_user_id and status = 'active';
  if not found or v_role not in ('admin','hr') then raise exception 'CORRECTION_UNAUTHORIZED'; end if;

  if v_rec.status = 'absent' then
    select c.timezone into v_tz from public.companies c where c.id = v_rec.company_id;
    select s.* into v_shift
    from public.shifts s
    where s.is_active
      and s.id = (select e.shift_id from public.employees e where e.id = v_rec.employee_id);
    if not found then
      select s.* into v_shift
      from public.shifts s
      where s.company_id = v_rec.company_id and s.is_active
      order by s.created_at
      limit 1;
    end if;
    v_type := 'office';
    if found then
      v_shift_start := public.shift_start_at(v_shift.id, v_rec.work_date, v_tz);
      if p_check_in > v_shift_start + (v_shift.grace_period_minutes || ' minutes')::interval then
        v_status := 'late';
      else
        v_status := 'present';
      end if;
    else
      v_status := 'present';
    end if;
    update public.attendance_records
      set attendance_type = v_type,
          check_in_at = p_check_in,
          check_out_at = p_check_out,
          status = v_status,
          source = 'correction'
    where id = p_record_id;
  else
    update public.attendance_records
      set check_in_at = p_check_in,
          check_out_at = p_check_out,
          source = 'correction'
    where id = p_record_id;
  end if;

  insert into public.audit_logs (company_id, actor_user_id, action, entity_type, entity_id, old_values, new_values)
  values (v_rec.company_id, p_actor_user_id, 'attendance.corrected', 'attendance_record', p_record_id::text,
    jsonb_build_object(
      'attendance_type', v_rec.attendance_type,
      'check_in_at', v_rec.check_in_at,
      'check_out_at', v_rec.check_out_at,
      'status', v_rec.status
    ),
    jsonb_build_object(
      'attendance_type', case when v_rec.status = 'absent' then 'office' else v_rec.attendance_type end,
      'check_in_at', p_check_in,
      'check_out_at', p_check_out,
      'status', case when v_rec.status = 'absent' then v_status else v_rec.status end,
      'reason', p_reason
    ));
end; $$;

revoke execute on function public.admin_correct_attendance(uuid, uuid, timestamptz, timestamptz, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 9. Dashboard metrics: role scope + absent in every attendance metric
-- ---------------------------------------------------------------------------

create or replace function public.get_dashboard_metrics(
  p_company_id uuid,
  p_days int default 30
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_role text;
  v_tz text;
  v_today date;
  v_range_days int;
  v_start date;
  v_prev_start date;
  v_prev_end date;
  v_trend_start date;
  v_month_start date;
  v_shift_start time;
  v_shift_end time;
  v_grace int;
  v_scope_roles text[];
  v_result jsonb;
begin
  if p_company_id is null then
    raise exception 'COMPANY_REQUIRED';
  end if;

  select m.role into v_role
  from public.company_memberships m
  where m.company_id = p_company_id
    and m.user_id = auth.uid()
    and m.status = 'active'
  limit 1;

  if v_role not in ('admin', 'hr') then
    raise exception 'FORBIDDEN';
  end if;

  select c.timezone into v_tz
  from public.companies c
  where c.id = p_company_id and c.is_active;

  if v_tz is null then
    raise exception 'COMPANY_NOT_FOUND';
  end if;

  v_scope_roles := case when v_role = 'admin' then array['hr','employee'] else array['employee'] end;
  v_range_days := case when p_days in (7, 30, 90) then p_days else 30 end;
  v_today := (now() at time zone v_tz)::date;
  v_start := v_today - (v_range_days - 1);
  v_prev_start := v_start - v_range_days;
  v_prev_end := v_start - 1;
  v_trend_start := greatest(v_start, v_today - 29);
  v_month_start := date_trunc('month', v_today)::date;

  select s.start_time, s.end_time, s.grace_period_minutes
    into v_shift_start, v_shift_end, v_grace
  from public.shifts s
  where s.company_id = p_company_id and s.is_active
  order by s.created_at
  limit 1;

  with
  emp_scope as (
    select e.id, e.user_id, e.employee_code, e.full_name, e.department,
           e.joining_date, e.shift_id, m.role
    from public.employees e
    join public.company_memberships m
      on m.company_id = e.company_id
     and m.user_id = e.user_id
     and m.status = 'active'
    where e.company_id = p_company_id
      and e.is_active
      and e.user_id is not null
      and m.role = any(v_scope_roles)
  ),
  staff_scope as (
    select e.id, e.user_id, e.employee_code, e.full_name, e.department,
           coalesce(m.role, 'employee') as role
    from public.employees e
    left join public.company_memberships m
      on m.company_id = e.company_id
     and m.user_id = e.user_id
     and m.status = 'active'
    where e.company_id = p_company_id
      and e.is_active
  ),
  dates as (
    select generate_series(v_prev_start, v_today, interval '1 day')::date as d
  ),
  expected as (
    select d.d, e.id as employee_id, e.department,
           e.full_name, e.employee_code
    from dates d
    join emp_scope e on e.joining_date <= d.d
    left join public.shifts s on s.id = e.shift_id and s.is_active
    where case
      when s.id is null then extract(isodow from d.d)::int between 1 and 5
      else extract(isodow from d.d)::int = any(s.working_days)
    end
  ),
  expected_daily as (
    select d, count(*) as expected
    from expected
    group by d
  ),
  att as (
    select a.work_date as d, a.employee_id, a.attendance_type, a.status,
           a.check_in_at, a.check_out_at, a.source
    from public.attendance_records a
    join emp_scope e on e.id = a.employee_id
    join expected ex on ex.d = a.work_date and ex.employee_id = a.employee_id
    where a.company_id = p_company_id
      and a.work_date between v_prev_start and v_today
      and a.status in ('present', 'late')
  ),
  absent_all as (
    select a.work_date as d, a.employee_id
    from public.attendance_records a
    join emp_scope e on e.id = a.employee_id
    join expected ex on ex.d = a.work_date and ex.employee_id = a.employee_id
    where a.company_id = p_company_id
      and a.work_date between v_prev_start and v_today
      and a.status = 'absent'
      and not exists (
        select 1 from public.leave_requests l
        where l.company_id = p_company_id
          and l.employee_id = a.employee_id
          and l.leave_date = a.work_date
          and l.status = 'approved'
      )
  ),
  att_daily as (
    select d,
      count(*) as checked_in,
      count(*) filter (where status = 'present') as on_time,
      count(*) filter (where status = 'late') as late,
      count(*) filter (where attendance_type = 'office') as office,
      count(*) filter (where attendance_type = 'wfh') as wfh,
      count(*) filter (where attendance_type = 'office' and status = 'present') as office_on_time,
      count(*) filter (where attendance_type = 'office' and status = 'late') as office_late,
      count(*) filter (where attendance_type = 'wfh' and status = 'present') as wfh_on_time,
      count(*) filter (where attendance_type = 'wfh' and status = 'late') as wfh_late,
      count(*) filter (where check_out_at is null) as still_in
    from att
    group by d
  ),
  absent_daily as (
    select d, count(distinct employee_id) as absent
    from absent_all
    group by d
  ),
  leave_all as (
    select l.leave_date as d, l.employee_id
    from public.leave_requests l
    join emp_scope e on e.id = l.employee_id
    where l.company_id = p_company_id
      and l.status = 'approved'
      and l.leave_date between v_prev_start and v_today
  ),
  leave_daily as (
    select l.d, count(distinct l.employee_id) as on_leave
    from leave_all l
    where not exists (
      select 1 from att a where a.d = l.d and a.employee_id = l.employee_id
    )
    group by l.d
  ),
  daily as (
    select cal.d,
      coalesce(ed.expected, 0) as expected,
      coalesce(ad.checked_in, 0) as checked_in,
      coalesce(ad.on_time, 0) as on_time,
      coalesce(ad.late, 0) as late,
      coalesce(ad.office, 0) as office,
      coalesce(ad.wfh, 0) as wfh,
      coalesce(ad.office_on_time, 0) as office_on_time,
      coalesce(ad.office_late, 0) as office_late,
      coalesce(ad.wfh_on_time, 0) as wfh_on_time,
      coalesce(ad.wfh_late, 0) as wfh_late,
      coalesce(ad.still_in, 0) as still_in,
      coalesce(ld.on_leave, 0) as on_leave,
      coalesce(abd.absent, 0) as absent,
      greatest(
        coalesce(ed.expected, 0)
        - coalesce(ad.checked_in, 0)
        - coalesce(ld.on_leave, 0)
        - coalesce(abd.absent, 0),
        0
      ) as no_check_in,
      case
        when coalesce(ed.expected, 0) - coalesce(ld.on_leave, 0) > 0
          then round(100.0 * coalesce(ad.checked_in, 0) / (coalesce(ed.expected, 0) - coalesce(ld.on_leave, 0)), 1)
        else null
      end as rate
    from (select distinct d from dates) cal
    left join expected_daily ed on ed.d = cal.d
    left join att_daily ad on ad.d = cal.d
    left join absent_daily abd on abd.d = cal.d
    left join leave_daily ld on ld.d = cal.d
  ),
  hours as (
    select extract(epoch from (a.check_out_at - a.check_in_at)) / 3600.0 as h
    from att a
    where a.check_out_at is not null
      and a.d between v_start and v_today - 1
      and a.check_out_at > a.check_in_at
      and a.check_out_at <= a.check_in_at + interval '24 hours'
  ),
  hours_stats as (
    select count(*) as completed_records,
      percentile_cont(0.5) within group (order by h) as median_hours
    from hours
  ),
  pending_all as (
    select 'wfh'::text as kind, r.id, r.employee_id, s.full_name as name,
           s.employee_code as code, s.department, r.request_date, r.created_at,
           s.role as requester_role,
           round(extract(epoch from (now() - r.created_at)) / 3600.0, 1) as age_hours
    from public.wfh_requests r
    join staff_scope s on s.id = r.employee_id
    where r.company_id = p_company_id
      and r.status = 'pending'
      and (v_role = 'admin' or s.role = 'employee')
    union all
    select 'leave'::text, r.id, r.employee_id, s.full_name,
           s.employee_code, s.department, r.leave_date, r.created_at,
           s.role,
           round(extract(epoch from (now() - r.created_at)) / 3600.0, 1)
    from public.leave_requests r
    join staff_scope s on s.id = r.employee_id
    where r.company_id = p_company_id
      and r.status = 'pending'
      and (v_role = 'admin' or s.role = 'employee')
  ),
  wfh_waiting as (
    select r.employee_id
    from public.wfh_requests r
    join emp_scope e on e.id = r.employee_id
    where r.company_id = p_company_id
      and r.status = 'approved'
      and r.request_date = v_today
      and not exists (
        select 1 from public.attendance_records a
        where a.company_id = p_company_id
          and a.employee_id = r.employee_id
          and a.work_date = v_today
      )
  ),
  reviewed as (
    select 'wfh'::text as kind, r.created_at, r.reviewed_at, r.reviewed_by
    from public.wfh_requests r
    where r.company_id = p_company_id
      and r.status in ('approved', 'rejected')
      and r.reviewed_at is not null
      and (r.reviewed_at at time zone v_tz)::date between v_start and v_today
    union all
    select 'leave'::text, r.created_at, r.reviewed_at, r.reviewed_by
    from public.leave_requests r
    where r.company_id = p_company_id
      and r.status in ('approved', 'rejected')
      and r.reviewed_at is not null
      and (r.reviewed_at at time zone v_tz)::date between v_start and v_today
  ),
  reviewed_scoped as (
    select r.*, m.role as reviewer_role
    from reviewed r
    left join public.company_memberships m
      on m.company_id = p_company_id
     and m.user_id = r.reviewed_by
     and m.status = 'active'
  ),
  dept_headcount as (
    select department, count(*) as headcount
    from emp_scope
    group by department
  ),
  dept_expected as (
    select e.department, count(*) as expected
    from expected e
    where e.d between v_start and v_today - 1
    group by e.department
  ),
  dept_att as (
    select e.department,
      count(*) as checked_in,
      count(*) filter (where a.status = 'late') as late,
      count(*) filter (where a.attendance_type = 'wfh') as wfh
    from att a
    join emp_scope e on e.id = a.employee_id
    where a.d between v_start and v_today - 1
    group by e.department
  ),
  dept_leave as (
    select e.department, count(*) as on_leave
    from leave_all l
    join emp_scope e on e.id = l.employee_id
    where l.d between v_start and v_today - 1
      and not exists (
        select 1 from att a where a.d = l.d and a.employee_id = l.employee_id
      )
    group by e.department
  ),
  dept_absent as (
    select e.department, count(*) as absent
    from absent_all a
    join emp_scope e on e.id = a.employee_id
    where a.d between v_start and v_today - 1
    group by e.department
  ),
  today_team as (
    select e.employee_id as id, e.full_name as name, e.employee_code as code, e.department,
           a.attendance_type, a.status, a.check_in_at, a.check_out_at,
           (l.employee_id is not null) as on_leave
    from expected e
    left join public.attendance_records a
      on a.company_id = p_company_id
     and a.employee_id = e.employee_id
     and a.work_date = v_today
    left join leave_all l on l.d = v_today and l.employee_id = e.employee_id
    where e.d = v_today
    order by case when a.check_in_at is null then 1 else 0 end,
             a.check_in_at nulls last,
             e.full_name
  ),
  month_leave as (
    select count(*) as leave_days
    from public.leave_requests l
    join emp_scope e on e.id = l.employee_id
    where l.company_id = p_company_id
      and l.status = 'approved'
      and l.leave_date between v_month_start
        and (v_month_start + interval '1 month - 1 day')::date
  ),
  month_absent as (
    select count(*) as absent_days
    from public.attendance_records a
    join emp_scope e on e.id = a.employee_id
    where a.company_id = p_company_id
      and a.status = 'absent'
      and a.work_date between v_month_start and v_today
  ),
  month_wfh as (
    select count(*) as wfh_days
    from public.attendance_records a
    join emp_scope e on e.id = a.employee_id
    where a.company_id = p_company_id
      and a.attendance_type = 'wfh'
      and a.work_date between v_month_start and v_today
  ),
  month_feedback as (
    select count(distinct f.subject_employee_id) as subjects,
           count(*) as reviews
    from public.feedback_reviews f
    join emp_scope e on e.id = f.subject_employee_id
    where f.company_id = p_company_id
      and f.status = 'submitted'
      and (f.created_at at time zone v_tz)::date between v_month_start and v_today
  ),
  month_scores as (
    select avg(r.score)::numeric(4,1) as avg_score
    from public.feedback_ratings r
    join public.feedback_reviews f on f.id = r.review_id
    join emp_scope e on e.id = f.subject_employee_id
    where f.company_id = p_company_id
      and f.status = 'submitted'
      and (f.created_at at time zone v_tz)::date between v_month_start and v_today
  ),
  display_stats as (
    select
      count(*) as total,
      count(*) filter (where is_active) as active,
      count(*) filter (where is_active and last_seen_at >= now() - interval '2 minutes') as online,
      count(*) filter (where is_active and last_seen_at < now() - interval '2 minutes' and last_seen_at >= now() - interval '10 minutes') as stale
    from public.qr_displays
    where company_id = p_company_id
  ),
  display_list as (
    select id, display_name as name, office_name as office, is_active, last_seen_at
    from public.qr_displays
    where company_id = p_company_id
    order by last_seen_at desc nulls last
    limit 6
  ),
  totals as (
    select
      coalesce(sum(expected), 0)::int as expected,
      coalesce(sum(checked_in), 0)::int as checked_in,
      coalesce(sum(on_time), 0)::int as on_time,
      coalesce(sum(late), 0)::int as late,
      coalesce(sum(office), 0)::int as office,
      coalesce(sum(wfh), 0)::int as wfh,
      coalesce(sum(office_on_time), 0)::int as office_on_time,
      coalesce(sum(office_late), 0)::int as office_late,
      coalesce(sum(wfh_on_time), 0)::int as wfh_on_time,
      coalesce(sum(wfh_late), 0)::int as wfh_late,
      coalesce(sum(on_leave), 0)::int as leave_days,
      coalesce(sum(absent), 0)::int as absent_days,
      coalesce(sum(no_check_in), 0)::int as no_check_in,
      case when sum(expected) - sum(on_leave) > 0
        then round(100.0 * sum(checked_in) / (sum(expected) - sum(on_leave)), 1) end as attendance_rate,
      case when sum(checked_in) > 0
        then round(100.0 * sum(on_time) / sum(checked_in), 1) end as on_time_rate,
      case when sum(checked_in) > 0
        then round(100.0 * sum(wfh) / sum(checked_in), 1) end as wfh_share
    from daily
    where d between v_start and v_today - 1
  ),
  previous as (
    select
      case when sum(expected) - sum(on_leave) > 0
        then round(100.0 * sum(checked_in) / (sum(expected) - sum(on_leave)), 1) end as attendance_rate,
      case when sum(checked_in) > 0
        then round(100.0 * sum(on_time) / sum(checked_in), 1) end as on_time_rate,
      coalesce(sum(expected), 0)::int as expected,
      coalesce(sum(checked_in), 0)::int as checked_in,
      coalesce(sum(absent), 0)::int as absent_days
    from daily
    where d between v_prev_start and v_prev_end
  )
  select jsonb_build_object(
    'generated_at', now(),
    'timezone', v_tz,
    'local_date', v_today,
    'range_days', v_range_days,
    'viewer_role', v_role,
    'is_working_day', exists (select 1 from expected where d = v_today),
    'shift', jsonb_build_object(
      'start', case when v_shift_start is null then null else to_char(v_shift_start, 'HH24:MI') end,
      'end', case when v_shift_end is null then null else to_char(v_shift_end, 'HH24:MI') end,
      'grace_minutes', v_grace,
      'started', (v_shift_start is null or (now() at time zone v_tz)::time >= v_shift_start)
    ),
    'headcount', jsonb_build_object(
      'employees', (select count(*) from emp_scope where role = 'employee'),
      'hr', (select count(*) from public.company_memberships m where m.company_id = p_company_id and m.status = 'active' and m.role = 'hr'),
      'admins', (select count(*) from public.company_memberships m where m.company_id = p_company_id and m.status = 'active' and m.role = 'admin'),
      'total_staff', (select count(*) from staff_scope),
      'unactivated', (select count(*) from public.employees e where e.company_id = p_company_id and e.is_active and e.user_id is null),
      'new_joiners', (select count(*) from emp_scope where role = 'employee' and joining_date >= v_month_start),
      'departments', (select count(distinct department) from emp_scope)
    ),
    'today', jsonb_build_object(
      'expected', (select expected from daily where d = v_today),
      'checked_in', (select checked_in from daily where d = v_today),
      'on_time', (select on_time from daily where d = v_today),
      'late', (select late from daily where d = v_today),
      'office', (select office from daily where d = v_today),
      'wfh', (select wfh from daily where d = v_today),
      'on_leave', (select on_leave from daily where d = v_today),
      'absent', (select absent from daily where d = v_today),
      'no_check_in', (select no_check_in from daily where d = v_today),
      'wfh_awaiting', (select count(*) from wfh_waiting),
      'still_in', (select still_in from daily where d = v_today)
    ),
    'pending', jsonb_build_object(
      'employee_total', (select count(*) from pending_all where requester_role = 'employee'),
      'hr_total', (select count(*) from pending_all where requester_role = 'hr'),
      'total', (select count(*) from pending_all),
      'wfh_employee', (select count(*) from pending_all where requester_role = 'employee' and kind = 'wfh'),
      'leave_employee', (select count(*) from pending_all where requester_role = 'employee' and kind = 'leave'),
      'wfh_hr', (select count(*) from pending_all where requester_role = 'hr' and kind = 'wfh'),
      'leave_hr', (select count(*) from pending_all where requester_role = 'hr' and kind = 'leave'),
      'oldest_employee_hours', (select max(age_hours) from pending_all where requester_role = 'employee'),
      'oldest_hr_hours', (select max(age_hours) from pending_all where requester_role = 'hr'),
      'oldest_hours', (select max(age_hours) from pending_all)
    ),
    'range', jsonb_build_object(
      'start_date', v_start,
      'end_date', v_today,
      'trend_start_date', v_trend_start,
      'totals', (
        select jsonb_build_object(
          'expected', t.expected,
          'checked_in', t.checked_in,
          'on_time', t.on_time,
          'late', t.late,
          'office', t.office,
          'wfh', t.wfh,
          'office_on_time', t.office_on_time,
          'office_late', t.office_late,
          'wfh_on_time', t.wfh_on_time,
          'wfh_late', t.wfh_late,
          'leave_days', t.leave_days,
          'absent_days', t.absent_days,
          'no_check_in', t.no_check_in,
          'attendance_rate', t.attendance_rate,
          'on_time_rate', t.on_time_rate,
          'wfh_share', t.wfh_share,
          'median_hours', (select round(median_hours::numeric, 2) from hours_stats),
          'completed_records', (select completed_records from hours_stats),
          'missing_checkouts', (
            select count(*) from att a
            where a.d between v_start and v_today - 1 and a.check_out_at is null
          )
        )
        from totals t
      ),
      'previous', (
        select jsonb_build_object(
          'attendance_rate', p.attendance_rate,
          'on_time_rate', p.on_time_rate,
          'expected', p.expected,
          'checked_in', p.checked_in,
          'absent_days', p.absent_days
        ) from previous p
      ),
      'trend', coalesce((
        select jsonb_agg(to_jsonb(x) order by x.date)
        from (
          select d as date, expected, checked_in, on_time, late, office, wfh,
                 office_on_time, office_late, wfh_on_time, wfh_late,
                 on_leave, absent, no_check_in, rate
          from daily
          where d between v_trend_start and v_today and expected > 0
        ) x
      ), '[]'::jsonb),
      'departments', coalesce((
        select jsonb_agg(to_jsonb(x) order by x.headcount desc, x.department)
        from (
          select h.department, h.headcount,
                 coalesce(a.checked_in, 0) as checked_in,
                 coalesce(a.late, 0) as late,
                 coalesce(a.wfh, 0) as wfh,
                 coalesce(ab.absent, 0) as absent,
                 case when coalesce(ep.expected, 0) - coalesce(dl.on_leave, 0) > 0
                   then round(100.0 * coalesce(a.checked_in, 0) / (coalesce(ep.expected, 0) - coalesce(dl.on_leave, 0)), 1)
                   else null end as attendance_rate
          from dept_headcount h
          left join dept_expected ep on ep.department = h.department
          left join dept_att a on a.department = h.department
          left join dept_leave dl on dl.department = h.department
          left join dept_absent ab on ab.department = h.department
        ) x
      ), '[]'::jsonb)
    ),
    'month', jsonb_build_object(
      'leave_days', (select leave_days from month_leave),
      'leave_allowance', (select count(*) * 3 from emp_scope),
      'absent_days', (select absent_days from month_absent),
      'wfh_days', (select wfh_days from month_wfh),
      'feedback_reviews', (select reviews from month_feedback),
      'feedback_coverage', case
        when (select count(*) from emp_scope) > 0
          then round(100.0 * (select subjects from month_feedback) / (select count(*) from emp_scope), 1)
        else null end,
      'avg_score', (select avg_score from month_scores)
    ),
    'approvals', jsonb_build_object(
      'completed_by_hr', (select count(*) from reviewed_scoped where reviewer_role = 'hr'),
      'completed_total', (select count(*) from reviewed_scoped),
      'median_response_hours', (
        select round(percentile_cont(0.5) within group (
          order by extract(epoch from (reviewed_at - created_at)) / 3600.0
        )::numeric, 1)
        from reviewed_scoped
        where reviewed_at >= created_at
      ),
      'manual_corrections', (
        select count(*) from att a
        where a.d between v_start and v_today - 1
          and a.source in ('manual', 'correction')
      )
    ),
    'displays', jsonb_build_object(
      'total', (select total from display_stats),
      'active', (select active from display_stats),
      'online', (select online from display_stats),
      'stale', (select stale from display_stats),
      'offline', (select total - online - stale from display_stats),
      'list', coalesce((select jsonb_agg(to_jsonb(d)) from display_list d), '[]'::jsonb)
    ),
    'queues', jsonb_build_object(
      'employee', coalesce((
        select jsonb_agg(to_jsonb(q))
        from (
          select kind, id, name, code, department, request_date, created_at, age_hours
          from pending_all
          where requester_role = 'employee'
          order by created_at
          limit 6
        ) q
      ), '[]'::jsonb),
      'hr', coalesce((
        select jsonb_agg(to_jsonb(q))
        from (
          select kind, id, name, code, department, request_date, created_at, age_hours
          from pending_all
          where requester_role = 'hr'
          order by created_at
          limit 6
        ) q
      ), '[]'::jsonb)
    ),
    'today_team', coalesce((
      select jsonb_agg(to_jsonb(t))
      from today_team t
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.get_dashboard_metrics(uuid, int) from public, anon;
grant execute on function public.get_dashboard_metrics(uuid, int) to authenticated;

comment on function public.get_dashboard_metrics(uuid, int) is
  'Read-only role-scoped dashboard payload: Admin sees HR + employees, HR sees employees. Absent rows are excluded from check-ins and counted separately.';
