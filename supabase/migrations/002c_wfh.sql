-- VorldX 002c: WFH workflow (cutoff 120min, hierarchy, single-use passcode)
-- PDF Sec.8: deadline = shift_start - 120min in company TZ, trusted server time.

create or replace function public.submit_wfh_request(
  p_employee_id uuid, p_request_date date, p_reason text
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_emp record; v_comp record; v_shift record; v_pol record;
declare v_deadline timestamptz; v_rid uuid;
begin
  if char_length(trim(p_reason)) < 5 then raise exception 'REASON_TOO_SHORT'; end if;
  select * into v_emp from public.employees where id = p_employee_id and is_active;
  if not found then raise exception 'EMPLOYEE_INACTIVE'; end if;
  if v_emp.user_id is null then raise exception 'NOT_ACTIVATED'; end if;
  select * into v_comp from public.companies where id = v_emp.company_id and is_active;
  if not found then raise exception 'COMPANY_INACTIVE'; end if;
  select * into v_pol from public.attendance_policies where company_id = v_emp.company_id;
  if found and not v_pol.wfh_enabled then raise exception 'WFH_DISABLED'; end if;
  if p_request_date < ((now() at time zone v_comp.timezone))::date - 1 then raise exception 'INVALID_DATE'; end if;
  -- no conflicting attendance
  if exists (select 1 from public.attendance_records a where a.company_id = v_emp.company_id and a.employee_id = v_emp.id and a.work_date = p_request_date) then
    raise exception 'ATTENDANCE_EXISTS'; end if;
  -- no duplicate pending/approved
  if exists (select 1 from public.wfh_requests r where r.employee_id = v_emp.id and r.request_date = p_request_date and r.status in ('pending','approved')) then
    raise exception 'DUPLICATE_REQUEST'; end if;
  select * into v_shift from public.shifts where id = v_emp.shift_id and is_active;
  if found then
    v_deadline := (((p_request_date || ' ' || v_shift.start_time)::timestamp at time zone v_comp.timezone)
      - (coalesce(v_pol.request_cutoff_minutes,120) || ' minutes')::interval);
    if now() > v_deadline then raise exception 'CUTOFF_PASSED'; end if;
  end if;
  insert into public.wfh_requests (company_id, employee_id, request_date, reason, status)
    values (v_emp.company_id, v_emp.id, p_request_date, trim(p_reason), 'pending') returning id into v_rid;
  insert into public.audit_logs (company_id, actor_user_id, action, entity_type, entity_id, new_values)
    values (v_emp.company_id, v_emp.user_id, 'wfh.requested', 'wfh_request', v_rid::text, jsonb_build_object('date', p_request_date));
  return v_rid;
end; $$;

-- hierarchy: employee->hr/admin, hr->admin only, never self-approve
create or replace function public.review_wfh_request(
  p_request_id uuid, p_reviewer_user_id uuid, p_decision text, p_notes text default null
) returns void language plpgsql security definer set search_path = public as $$
declare v_req record; v_req_emp record; v_req_role text; v_rev_role text; v_rev_company uuid;
begin
  if p_decision not in ('approved','rejected') then raise exception 'INVALID_DECISION'; end if;
  select * into v_req from public.wfh_requests where id = p_request_id for update;
  if not found then raise exception 'REQUEST_NOT_FOUND'; end if;
  if v_req.status != 'pending' then raise exception 'ALREADY_REVIEWED'; end if;
  select * into v_req_emp from public.employees where id = v_req.employee_id;
  -- reviewer membership in same company
  select company_id, role into v_rev_company, v_rev_role from public.company_memberships
    where company_id = v_req.company_id and user_id = p_reviewer_user_id and status = 'active';
  if not found then raise exception 'REVIEWER_UNAUTHORIZED'; end if;
  if v_req_emp.user_id = p_reviewer_user_id then raise exception 'SELF_APPROVAL'; end if;
  -- requester role from membership (may be null if never activated? then treat as employee)
  select role into v_req_role from public.company_memberships where company_id = v_req.company_id and user_id = v_req_emp.user_id and status = 'active';
  if v_req_role is null then v_req_role := 'employee'; end if;
  if v_req_role = 'hr' then
    if v_rev_role != 'admin' then raise exception 'HR_REQUEST_NEEDS_ADMIN'; end if;
  elsif v_req_role = 'employee' then
    if v_rev_role not in ('hr','admin') then raise exception 'EMP_REQUEST_NEEDS_HR'; end if;
  elsif v_req_role = 'admin' then
    raise exception 'ADMIN_REQUEST_UNSUPPORTED';
  end if;
  update public.wfh_requests set status = p_decision, reviewed_by = p_reviewer_user_id, reviewed_at = now(), review_notes = p_notes
    where id = p_request_id;
  insert into public.audit_logs (company_id, actor_user_id, action, entity_type, entity_id, new_values)
    values (v_req.company_id, p_reviewer_user_id, 'wfh.' || p_decision, 'wfh_request', p_request_id::text,
      jsonb_build_object('decision', p_decision, 'notes', p_notes));
end; $$;

create or replace function public.generate_wfh_passcode(
  p_request_id uuid, p_generated_by uuid, p_passcode_hash text, p_expires_at timestamptz
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_req record; v_pid uuid; v_gen_role text;
begin
  if char_length(p_passcode_hash) < 16 then raise exception 'INVALID_PASSCODE_HASH'; end if;
  select * into v_req from public.wfh_requests where id = p_request_id;
  if not found then raise exception 'REQUEST_NOT_FOUND'; end if;
  if v_req.status != 'approved' then raise exception 'NOT_APPROVED'; end if;
  if exists (select 1 from public.wfh_passcodes where wfh_request_id = p_request_id) then raise exception 'PASSCODE_EXISTS'; end if;
  select role into v_gen_role from public.company_memberships where company_id = v_req.company_id and user_id = p_generated_by and status = 'active';
  if not found then raise exception 'GENERATOR_UNAUTHORIZED'; end if;
  -- same hierarchy as review: generator must be eligible reviewer (hr for employee, admin for hr)
  -- enforced loosely: hr/admin only
  if v_gen_role not in ('hr','admin') then raise exception 'GENERATOR_UNAUTHORIZED'; end if;
  if exists (select 1 from public.attendance_records a where a.company_id = v_req.company_id and a.employee_id = v_req.employee_id and a.work_date = v_req.request_date) then
    raise exception 'ATTENDANCE_EXISTS'; end if;
  insert into public.wfh_passcodes (company_id, wfh_request_id, employee_id, work_date, passcode_hash, expires_at, generated_by)
    values (v_req.company_id, v_req.id, v_req.employee_id, v_req.request_date, p_passcode_hash, p_expires_at, p_generated_by)
    returning id into v_pid;
  insert into public.audit_logs (company_id, actor_user_id, action, entity_type, entity_id, new_values)
    values (v_req.company_id, p_generated_by, 'wfh.passcode_generated', 'wfh_passcode', v_pid::text, jsonb_build_object('request', p_request_id));
  return v_pid;
end; $$;

-- validate passcode + create WFH check-in (single-use). Checkout via checkout_attendance().
create or replace function public.mark_wfh_attendance(
  p_employee_id uuid, p_passcode_hash text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_emp record; v_comp record; v_shift record; v_pass record; v_now timestamptz := now();
declare v_wd date; v_local time; v_status text; v_rec record;
begin
  select * into v_pass from public.wfh_passcodes where passcode_hash = p_passcode_hash for update;
  if not found then raise exception 'PASSCODE_INVALID'; end if;
  if v_pass.used_at is not null then raise exception 'PASSCODE_USED'; end if;
  if v_pass.expires_at <= v_now then raise exception 'PASSCODE_EXPIRED'; end if;
  if v_pass.employee_id != p_employee_id then raise exception 'PASSCODE_WRONG_USER'; end if;
  select * into v_emp from public.employees where id = p_employee_id and is_active;
  if not found then raise exception 'EMPLOYEE_INACTIVE'; end if;
  select * into v_comp from public.companies where id = v_emp.company_id and is_active;
  if not found then raise exception 'COMPANY_INACTIVE'; end if;
  v_wd := ((v_now at time zone v_comp.timezone))::date;
  if v_pass.work_date != v_wd then raise exception 'PASSCODE_WRONG_DATE'; end if;
  if exists (select 1 from public.attendance_records a where a.company_id = v_emp.company_id and a.employee_id = v_emp.id and a.work_date = v_wd) then
    raise exception 'ATTENDANCE_EXISTS'; end if;
  v_local := ((v_now at time zone v_comp.timezone))::time;
  select * into v_shift from public.shifts where id = v_emp.shift_id and is_active;
  if found and v_local > (v_shift.start_time + (v_shift.grace_period_minutes || ' minutes')::interval) then v_status := 'late'; else v_status := 'present'; end if;
  insert into public.attendance_records (company_id, employee_id, work_date, attendance_type, check_in_at, status, source)
    values (v_emp.company_id, v_emp.id, v_wd, 'wfh', v_now, v_status, 'passcode') returning * into v_rec;
  update public.wfh_passcodes set used_at = v_now where id = v_pass.id;
  insert into public.audit_logs (company_id, actor_user_id, action, entity_type, entity_id, new_values)
    values (v_emp.company_id, v_emp.user_id, 'wfh.attendance_marked', 'attendance_record', v_rec.id::text,
      jsonb_build_object('work_date', v_wd, 'status', v_status));
  return jsonb_build_object('id', v_rec.id, 'work_date', v_rec.work_date, 'check_in_at', v_rec.check_in_at, 'status', v_rec.status);
end; $$;
