-- VorldX 006a: security hardening
-- 1) Actor guards: direct API/RPC callers can never claim to be someone else.
--    (Edge functions call with the service role -> auth.uid() is null -> guards skip;
--     PostgREST calls with a user JWT -> auth.uid() is set -> must match the claimed actor.)
-- 2) Employee self-binding: attendance/requests can only be made for the caller's own record.
-- 3) qr_displays readable by admins only; server-only functions revoked from anon/authenticated.

-- ---------- actor guards ----------
create or replace function public.remove_employee(p_employee_id uuid, p_actor_user_id uuid) returns void language plpgsql security definer set search_path = public as $$ declare v_emp record; v_actor_role text; v_target_role text; begin
  if auth.uid() is not null and auth.uid() <> p_actor_user_id then raise exception 'ACTOR_MISMATCH'; end if;
  select * into v_emp from public.employees where id = p_employee_id;
  if not found then raise exception 'EMPLOYEE_NOT_FOUND'; end if;
  select role into v_actor_role from public.company_memberships where company_id = v_emp.company_id and user_id = p_actor_user_id and status = 'active';
  if not found then raise exception 'ACTOR_UNAUTHORIZED'; end if;
  if v_emp.user_id = p_actor_user_id then raise exception 'SELF_REMOVAL'; end if;
  if v_emp.user_id is not null then
    select role into v_target_role from public.company_memberships where company_id = v_emp.company_id and user_id = v_emp.user_id and status = 'active';
  end if;
  if v_actor_role = 'hr' then
    if v_target_role in ('admin','hr') then raise exception 'PROTECTED_ACCOUNT'; end if;
  elsif v_actor_role != 'admin' then raise exception 'ACTOR_UNAUTHORIZED'; end if;
  delete from public.attendance_records where employee_id = v_emp.id;
  delete from public.wfh_requests where employee_id = v_emp.id;
  delete from public.leave_requests where employee_id = v_emp.id;
  delete from public.feedback_reviews where subject_employee_id = v_emp.id;
  delete from public.company_memberships where company_id = v_emp.company_id and user_id = v_emp.user_id;
  delete from public.employees where id = v_emp.id;
  if v_emp.user_id is not null then delete from public.profiles where id = v_emp.user_id; end if;
  insert into public.audit_logs (company_id, actor_user_id, action, entity_type, entity_id, new_values) values (v_emp.company_id, p_actor_user_id, 'employee.removed', 'employee', p_employee_id::text, jsonb_build_object('full_name', v_emp.full_name, 'email', v_emp.email, 'code', v_emp.employee_code));
end; $$;

create or replace function public.admin_correct_attendance(p_record_id uuid, p_actor_user_id uuid, p_check_in timestamp with time zone, p_check_out timestamp with time zone, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare v_rec record; v_role text; begin
  if auth.uid() is not null and auth.uid() <> p_actor_user_id then raise exception 'ACTOR_MISMATCH'; end if;
  if char_length(trim(coalesce(p_reason,''))) < 5 then raise exception 'REASON_REQUIRED'; end if;
  if p_check_out is not null and p_check_out <= p_check_in then raise exception 'INVALID_TIMES'; end if;
  select * into v_rec from public.attendance_records where id = p_record_id for update;
  if not found then raise exception 'RECORD_NOT_FOUND'; end if;
  select role into v_role from public.company_memberships where company_id = v_rec.company_id and user_id = p_actor_user_id and status='active';
  if not found or v_role not in ('admin','hr') then raise exception 'CORRECTION_UNAUTHORIZED'; end if;
  update public.attendance_records set check_in_at = p_check_in, check_out_at = p_check_out, source = 'correction' where id = p_record_id;
  insert into public.audit_logs (company_id, actor_user_id, action, entity_type, entity_id, old_values, new_values) values (v_rec.company_id, p_actor_user_id, 'attendance.corrected', 'attendance_record', p_record_id::text, jsonb_build_object('check_in_at', v_rec.check_in_at, 'check_out_at', v_rec.check_out_at), jsonb_build_object('check_in_at', p_check_in, 'check_out_at', p_check_out, 'reason', p_reason));
end; $$;

create or replace function public.review_wfh_request(p_request_id uuid, p_reviewer_user_id uuid, p_decision text, p_notes text DEFAULT NULL::text)
returns void language plpgsql security definer set search_path = public as $$
declare v_req record; v_req_emp record; v_req_role text; v_rev_role text; v_rev_company uuid; begin
  if auth.uid() is not null and auth.uid() <> p_reviewer_user_id then raise exception 'ACTOR_MISMATCH'; end if;
  if p_decision not in ('approved','rejected') then raise exception 'INVALID_DECISION'; end if;
  select * into v_req from public.wfh_requests where id = p_request_id for update;
  if not found then raise exception 'REQUEST_NOT_FOUND'; end if;
  if v_req.status != 'pending' then raise exception 'ALREADY_REVIEWED'; end if;
  select * into v_req_emp from public.employees where id = v_req.employee_id;
  select company_id, role into v_rev_company, v_rev_role from public.company_memberships where company_id = v_req.company_id and user_id = p_reviewer_user_id and status = 'active';
  if not found then raise exception 'REVIEWER_UNAUTHORIZED'; end if;
  if v_req_emp.user_id = p_reviewer_user_id then raise exception 'SELF_APPROVAL'; end if;
  select role into v_req_role from public.company_memberships where company_id = v_req.company_id and user_id = v_req_emp.user_id and status = 'active';
  if v_req_role is null then v_req_role := 'employee'; end if;
  if v_req_role = 'hr' then
    if v_rev_role != 'admin' then raise exception 'HR_REQUEST_NEEDS_ADMIN'; end if;
  elsif v_req_role = 'employee' then
    if v_rev_role not in ('hr','admin') then raise exception 'EMP_REQUEST_NEEDS_HR'; end if;
  elsif v_req_role = 'admin' then raise exception 'ADMIN_REQUEST_UNSUPPORTED'; end if;
  update public.wfh_requests set status = p_decision, reviewed_by = p_reviewer_user_id, reviewed_at = now(), review_notes = p_notes where id = p_request_id;
  insert into public.audit_logs (company_id, actor_user_id, action, entity_type, entity_id, new_values) values (v_req.company_id, p_reviewer_user_id, 'wfh.' || p_decision, 'wfh_request', p_request_id::text, jsonb_build_object('decision', p_decision, 'notes', p_notes));
end; $$;

create or replace function public.review_leave_request(p_request_id uuid, p_reviewer_user_id uuid, p_decision text, p_notes text DEFAULT NULL::text)
returns void language plpgsql security definer set search_path = public as $$
declare v_req record; v_req_emp record; v_req_role text; v_rev_role text; begin
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
  update public.leave_requests set status = p_decision, reviewed_by = p_reviewer_user_id, reviewed_at = now(), review_notes = p_notes where id = p_request_id;
  insert into public.audit_logs (company_id, actor_user_id, action, entity_type, entity_id, new_values) values (v_req.company_id, p_reviewer_user_id, 'leave.' || p_decision, 'leave_request', p_request_id::text, jsonb_build_object('decision', p_decision, 'notes', p_notes));
end; $$;

create or replace function public.generate_wfh_passcode(p_request_id uuid, p_generated_by uuid, p_passcode_hash text, p_expires_at timestamp with time zone)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_req record; v_pid uuid; v_gen_role text; begin
  if auth.uid() is not null and auth.uid() <> p_generated_by then raise exception 'ACTOR_MISMATCH'; end if;
  if char_length(p_passcode_hash) < 16 then raise exception 'INVALID_PASSCODE_HASH'; end if;
  select * into v_req from public.wfh_requests where id = p_request_id;
  if not found then raise exception 'REQUEST_NOT_FOUND'; end if;
  if v_req.status != 'approved' then raise exception 'NOT_APPROVED'; end if;
  if exists (select 1 from public.wfh_passcodes where wfh_request_id = p_request_id) then raise exception 'PASSCODE_EXISTS'; end if;
  select role into v_gen_role from public.company_memberships where company_id = v_req.company_id and user_id = p_generated_by and status = 'active';
  if not found then raise exception 'GENERATOR_UNAUTHORIZED'; end if;
  if v_gen_role not in ('hr','admin') then raise exception 'GENERATOR_UNAUTHORIZED'; end if;
  if exists (select 1 from public.attendance_records a where a.company_id = v_req.company_id and a.employee_id = v_req.employee_id and a.work_date = v_req.request_date) then raise exception 'ATTENDANCE_EXISTS'; end if;
  insert into public.wfh_passcodes (company_id, wfh_request_id, employee_id, work_date, passcode_hash, expires_at, generated_by) values (v_req.company_id, v_req.id, v_req.employee_id, v_req.request_date, p_passcode_hash, p_expires_at, p_generated_by) returning id into v_pid;
  insert into public.audit_logs (company_id, actor_user_id, action, entity_type, entity_id, new_values) values (v_req.company_id, p_generated_by, 'wfh.passcode_generated', 'wfh_passcode', v_pid::text, jsonb_build_object('request', p_request_id));
  return v_pid;
end; $$;

create or replace function public.generate_wfh_passcode(p_request_id uuid, p_generated_by uuid, p_passcode_hash text, p_expires_at timestamp with time zone, p_passcode_display text DEFAULT NULL::text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_req record; v_pid uuid; v_gen_role text; begin
  if auth.uid() is not null and auth.uid() <> p_generated_by then raise exception 'ACTOR_MISMATCH'; end if;
  if char_length(p_passcode_hash) < 16 then raise exception 'INVALID_PASSCODE_HASH'; end if;
  select * into v_req from public.wfh_requests where id = p_request_id;
  if not found then raise exception 'REQUEST_NOT_FOUND'; end if;
  if v_req.status != 'approved' then raise exception 'NOT_APPROVED'; end if;
  if exists (select 1 from public.wfh_passcodes where wfh_request_id = p_request_id) then raise exception 'PASSCODE_EXISTS'; end if;
  select role into v_gen_role from public.company_memberships where company_id = v_req.company_id and user_id = p_generated_by and status = 'active';
  if not found then raise exception 'GENERATOR_UNAUTHORIZED'; end if;
  if v_gen_role not in ('hr','admin') then raise exception 'GENERATOR_UNAUTHORIZED'; end if;
  if exists (select 1 from public.attendance_records a where a.company_id = v_req.company_id and a.employee_id = v_req.employee_id and a.work_date = v_req.request_date) then raise exception 'ATTENDANCE_EXISTS'; end if;
  insert into public.wfh_passcodes (company_id, wfh_request_id, employee_id, work_date, passcode_hash, expires_at, generated_by, use_count, passcode_display) values (v_req.company_id, v_req.id, v_req.employee_id, v_req.request_date, p_passcode_hash, p_expires_at, p_generated_by, 0, nullif(trim(coalesce(p_passcode_display,'')),'')) returning id into v_pid;
  insert into public.audit_logs (company_id, actor_user_id, action, entity_type, entity_id, new_values) values (v_req.company_id, p_generated_by, 'wfh.passcode_generated', 'wfh_passcode', v_pid::text, jsonb_build_object('request', p_request_id));
  return v_pid;
end; $$;

create or replace function public.submit_feedback(p_company_id uuid, p_subject_employee_id uuid, p_reviewer_user_id uuid, p_period_start date, p_period_end date, p_comments text, p_scores jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_sub record; v_rev_role text; v_sub_role text; v_rid uuid; r record; v_allowed text[] := array['punctuality','attendance_consistency','teamwork_collaboration','adaptability','accountability']; k text; v int; begin
  if auth.uid() is not null and auth.uid() <> p_reviewer_user_id then raise exception 'ACTOR_MISMATCH'; end if;
  if p_period_end < p_period_start then raise exception 'INVALID_PERIOD'; end if;
  select * into v_sub from public.employees where id = p_subject_employee_id and company_id = p_company_id and is_active;
  if not found then raise exception 'SUBJECT_INVALID'; end if;
  select role into v_rev_role from public.company_memberships where company_id = p_company_id and user_id = p_reviewer_user_id and status='active';
  if not found then raise exception 'REVIEWER_UNAUTHORIZED'; end if;
  select role into v_sub_role from public.company_memberships where company_id = p_company_id and user_id = v_sub.user_id and status='active';
  if v_sub_role is null then v_sub_role := 'employee'; end if;
  if v_rev_role = 'hr' and v_sub_role != 'employee' then raise exception 'HR_CAN_REVIEW_EMPLOYEE_ONLY'; end if;
  if v_rev_role = 'admin' and v_sub_role not in ('hr') then if v_sub_role not in ('hr') then raise exception 'ADMIN_CAN_REVIEW_HR_ONLY'; end if; end if;
  if v_rev_role = 'employee' then raise exception 'REVIEWER_UNAUTHORIZED'; end if;
  if v_sub.user_id = p_reviewer_user_id then raise exception 'SELF_REVIEW'; end if;
  if jsonb_typeof(p_scores) != 'object' then raise exception 'INVALID_SCORES'; end if;
  insert into public.feedback_reviews (company_id, subject_employee_id, reviewer_user_id, period_start, period_end, comments, status) values (p_company_id, p_subject_employee_id, p_reviewer_user_id, p_period_start, p_period_end, coalesce(p_comments,''), 'submitted') returning id into v_rid;
  for r in select * from jsonb_each(p_scores) loop
    k := r.key; v := (r.value)::int;
    if not (k = any(v_allowed)) then raise exception 'INVALID_CRITERION %', k; end if;
    if v < 0 or v > 10 then raise exception 'SCORE_OUT_OF_RANGE'; end if;
    insert into public.feedback_ratings (review_id, criterion, score) values (v_rid, k, v);
  end loop;
  if (select count(*) from public.feedback_ratings where review_id = v_rid) = 0 then raise exception 'NO_SCORES'; end if;
  insert into public.audit_logs (company_id, actor_user_id, action, entity_type, entity_id, new_values) values (p_company_id, p_reviewer_user_id, 'feedback.submitted', 'feedback_review', v_rid::text, jsonb_build_object('subject', p_subject_employee_id));
  return v_rid;
end; $$;

create or replace function public.create_company_with_admin(p_user_id uuid, p_company_name text, p_slug text, p_timezone text, p_admin_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_company_id uuid; v_shift_id uuid; begin
  if auth.uid() is not null and auth.uid() <> p_user_id then raise exception 'ACTOR_MISMATCH'; end if;
  if char_length(trim(p_company_name)) < 2 then raise exception 'INVALID_COMPANY_NAME'; end if;
  if p_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then raise exception 'INVALID_SLUG'; end if;
  insert into public.companies (name, slug, timezone) values (trim(p_company_name), lower(trim(p_slug)), coalesce(nullif(trim(p_timezone),''),'Asia/Kolkata')) returning id into v_company_id;
  insert into public.profiles (id, full_name) values (p_user_id, trim(p_admin_name)) on conflict (id) do update set full_name = excluded.full_name, updated_at = now();
  insert into public.company_memberships (company_id, user_id, role, status) values (v_company_id, p_user_id, 'admin', 'active');
  insert into public.shifts (company_id, name, start_time, end_time, grace_period_minutes, working_days) values (v_company_id, 'Day Shift', '09:00', '18:00', 10, '{1,2,3,4,5}') returning id into v_shift_id;
  insert into public.attendance_policies (company_id, wfh_enabled, request_cutoff_minutes, updated_by) values (v_company_id, true, 120, p_user_id);
  insert into public.employees (company_id, user_id, employee_code, full_name, email, department, designation, shift_id) values (v_company_id, p_user_id, 'ADM-001', trim(p_admin_name), '', 'Administration', 'Admin', v_shift_id);
  insert into public.audit_logs (company_id, actor_user_id, action, entity_type, entity_id, new_values) values (v_company_id, p_user_id, 'company.created', 'company', v_company_id::text, jsonb_build_object('name', p_company_name, 'slug', p_slug));
  return v_company_id;
end; $$;

-- ---------- employee self-binding guards ----------
create or replace function public.process_office_attendance(p_token_hash text, p_employee_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_sess record; v_emp record; v_comp record; v_shift record; v_now timestamptz := now(); v_work_date date; v_local_time time; v_status text; v_rec record; begin
  select s.*, d.is_active as display_active into v_sess from public.qr_sessions s join public.qr_displays d on d.id = s.display_id where s.token_hash = p_token_hash and s.revoked_at is null limit 1;
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
  if not exists (select 1 from public.company_memberships m where m.company_id = v_emp.company_id and m.user_id = v_emp.user_id and m.status = 'active') then raise exception 'MEMBERSHIP_INACTIVE'; end if;
  v_work_date := ((v_now at time zone v_comp.timezone))::date;
  v_local_time := ((v_now at time zone v_comp.timezone))::time;
  select * into v_shift from public.shifts where id = v_emp.shift_id and is_active;
  if found then
    if v_local_time <= (v_shift.start_time + (v_shift.grace_period_minutes || ' minutes')::interval) then v_status := 'present'; else v_status := 'late'; end if;
  else v_status := 'present'; end if;
  select * into v_rec from public.attendance_records where company_id = v_emp.company_id and employee_id = v_emp.id and work_date = v_work_date for update;
  if not found then
    insert into public.attendance_records (company_id, employee_id, work_date, attendance_type, check_in_at, status, source) values (v_emp.company_id, v_emp.id, v_work_date, 'office', v_now, v_status, 'qr') returning * into v_rec;
    insert into public.audit_logs (company_id, actor_user_id, action, entity_type, entity_id, new_values) values (v_emp.company_id, v_emp.user_id, 'attendance.checkin', 'attendance_record', v_rec.id::text, jsonb_build_object('type','office','work_date',v_work_date,'status',v_status));
  elsif v_rec.check_out_at is null then
    if v_rec.attendance_type != 'office' then raise exception 'TYPE_CONFLICT'; end if;
    update public.attendance_records set check_out_at = v_now, updated_at = v_now where id = v_rec.id returning * into v_rec;
    insert into public.audit_logs (company_id, actor_user_id, action, entity_type, entity_id, new_values) values (v_emp.company_id, v_emp.user_id, 'attendance.checkout', 'attendance_record', v_rec.id::text, jsonb_build_object('check_out_at', v_now));
  else
    raise exception 'ALREADY_CHECKED_OUT';
  end if;
  return jsonb_build_object('id', v_rec.id, 'work_date', v_rec.work_date, 'type', v_rec.attendance_type, 'check_in_at', v_rec.check_in_at, 'check_out_at', v_rec.check_out_at, 'status', v_rec.status);
end; $$;

create or replace function public.checkout_attendance(p_employee_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_emp record; v_comp record; v_now timestamptz := now(); v_wd date; v_rec record; begin
  select * into v_emp from public.employees where id = p_employee_id and is_active;
  if not found then raise exception 'EMPLOYEE_INACTIVE'; end if;
  if auth.uid() is not null and v_emp.user_id is distinct from auth.uid() then raise exception 'EMPLOYEE_MISMATCH'; end if;
  select * into v_comp from public.companies where id = v_emp.company_id;
  v_wd := ((v_now at time zone coalesce(v_comp.timezone,'Asia/Kolkata')))::date;
  select * into v_rec from public.attendance_records where company_id = v_emp.company_id and employee_id = v_emp.id and work_date = v_wd for update;
  if not found then raise exception 'NO_CHECKIN'; end if;
  if v_rec.check_out_at is not null then raise exception 'ALREADY_CHECKED_OUT'; end if;
  update public.attendance_records set check_out_at = v_now where id = v_rec.id returning * into v_rec;
  insert into public.audit_logs (company_id, actor_user_id, action, entity_type, entity_id, new_values) values (v_emp.company_id, v_emp.user_id, 'attendance.checkout', 'attendance_record', v_rec.id::text, jsonb_build_object('check_out_at', v_now, 'source', v_rec.source));
  return jsonb_build_object('id', v_rec.id, 'check_out_at', v_rec.check_out_at);
end; $$;

create or replace function public.mark_wfh_attendance(p_employee_id uuid, p_passcode_hash text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_emp record; v_comp record; v_shift record; v_pass record; v_now timestamptz := now(); v_wd date; v_local time; v_status text; v_rec record; v_action text; begin
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
  v_wd := ((v_now at time zone v_comp.timezone))::date;
  if v_pass.work_date != v_wd then raise exception 'PASSCODE_WRONG_DATE'; end if;
  v_local := ((v_now at time zone v_comp.timezone))::time;
  select * into v_shift from public.shifts where id = v_emp.shift_id and is_active;
  if found and v_local > (v_shift.start_time + (v_shift.grace_period_minutes || ' minutes')::interval) then v_status := 'late'; else v_status := 'present'; end if;
  if v_pass.use_count = 0 then
    if exists (select 1 from public.attendance_records a where a.company_id = v_emp.company_id and a.employee_id = v_emp.id and a.work_date = v_wd) then raise exception 'ATTENDANCE_EXISTS'; end if;
    insert into public.attendance_records (company_id, employee_id, work_date, attendance_type, check_in_at, status, source) values (v_emp.company_id, v_emp.id, v_wd, 'wfh', v_now, v_status, 'passcode') returning * into v_rec;
    update public.wfh_passcodes set use_count = 1, used_at = v_now where id = v_pass.id;
    v_action := 'checkin';
    insert into public.audit_logs (company_id, actor_user_id, action, entity_type, entity_id, new_values) values (v_emp.company_id, v_emp.user_id, 'wfh.attendance_marked', 'attendance_record', v_rec.id::text, jsonb_build_object('work_date', v_wd, 'status', v_status, 'action', v_action));
  else
    select * into v_rec from public.attendance_records where company_id = v_emp.company_id and employee_id = v_emp.id and work_date = v_wd for update;
    if not found then raise exception 'NO_CHECKIN'; end if;
    if v_rec.attendance_type != 'wfh' then raise exception 'TYPE_CONFLICT'; end if;
    if v_rec.check_out_at is not null then raise exception 'ALREADY_CHECKED_OUT'; end if;
    update public.attendance_records set check_out_at = v_now where id = v_rec.id returning * into v_rec;
    update public.wfh_passcodes set use_count = 2 where id = v_pass.id;
    v_action := 'checkout';
    insert into public.audit_logs (company_id, actor_user_id, action, entity_type, entity_id, new_values) values (v_emp.company_id, v_emp.user_id, 'wfh.attendance_checkout', 'attendance_record', v_rec.id::text, jsonb_build_object('check_out_at', v_now, 'action', v_action));
  end if;
  return jsonb_build_object('id', v_rec.id, 'work_date', v_rec.work_date, 'check_in_at', v_rec.check_in_at, 'check_out_at', v_rec.check_out_at, 'status', v_rec.status, 'action', v_action, 'uses_left', 2 - (v_pass.use_count + 1));
end; $$;

create or replace function public.submit_wfh_request(p_employee_id uuid, p_request_date date, p_reason text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_emp record; v_comp record; v_shift record; v_pol record; v_deadline timestamptz; v_rid uuid; begin
  if char_length(trim(p_reason)) < 5 then raise exception 'REASON_TOO_SHORT'; end if;
  select * into v_emp from public.employees where id = p_employee_id and is_active;
  if not found then raise exception 'EMPLOYEE_INACTIVE'; end if;
  if auth.uid() is not null and v_emp.user_id is distinct from auth.uid() then raise exception 'EMPLOYEE_MISMATCH'; end if;
  if v_emp.user_id is null then raise exception 'NOT_ACTIVATED'; end if;
  select * into v_comp from public.companies where id = v_emp.company_id and is_active;
  if not found then raise exception 'COMPANY_INACTIVE'; end if;
  select * into v_pol from public.attendance_policies where company_id = v_emp.company_id;
  if found and not v_pol.wfh_enabled then raise exception 'WFH_DISABLED'; end if;
  if p_request_date < ((now() at time zone v_comp.timezone))::date - 1 then raise exception 'INVALID_DATE'; end if;
  if exists (select 1 from public.attendance_records a where a.company_id = v_emp.company_id and a.employee_id = v_emp.id and a.work_date = p_request_date) then raise exception 'ATTENDANCE_EXISTS'; end if;
  if exists (select 1 from public.wfh_requests r where r.employee_id = v_emp.id and r.request_date = p_request_date and r.status in ('pending','approved')) then raise exception 'DUPLICATE_REQUEST'; end if;
  select * into v_shift from public.shifts where id = v_emp.shift_id and is_active;
  if found then
    v_deadline := (((p_request_date || ' ' || v_shift.start_time)::timestamp at time zone v_comp.timezone) - (coalesce(v_pol.request_cutoff_minutes,120) || ' minutes')::interval);
    if now() > v_deadline then raise exception 'CUTOFF_PASSED'; end if;
  end if;
  insert into public.wfh_requests (company_id, employee_id, request_date, reason, status) values (v_emp.company_id, v_emp.id, p_request_date, trim(p_reason), 'pending') returning id into v_rid;
  insert into public.audit_logs (company_id, actor_user_id, action, entity_type, entity_id, new_values) values (v_emp.company_id, v_emp.user_id, 'wfh.requested', 'wfh_request', v_rid::text, jsonb_build_object('date', p_request_date));
  return v_rid;
end; $$;

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
  if exists (select 1 from public.attendance_records a where a.company_id = v_emp.company_id and a.employee_id = v_emp.id and a.work_date = p_leave_date) then raise exception 'ATTENDANCE_EXISTS'; end if;
  if exists (select 1 from public.leave_requests r where r.employee_id = v_emp.id and r.leave_date = p_leave_date and r.status in ('pending','approved')) then raise exception 'DUPLICATE_REQUEST'; end if;
  select count(*) into v_used from public.leave_requests r where r.employee_id = v_emp.id and date_trunc('month', r.leave_date) = date_trunc('month', p_leave_date::timestamp) and r.status in ('pending','approved');
  if v_used >= v_limit then raise exception 'MONTHLY_LIMIT'; end if;
  insert into public.leave_requests (company_id, employee_id, leave_date, reason, status) values (v_emp.company_id, v_emp.id, p_leave_date, trim(p_reason), 'pending') returning id into v_rid;
  insert into public.audit_logs (company_id, actor_user_id, action, entity_type, entity_id, new_values) values (v_emp.company_id, v_emp.user_id, 'leave.requested', 'leave_request', v_rid::text, jsonb_build_object('date', p_leave_date));
  return v_rid;
end; $$;

-- ---------- QR displays: admin-only visibility ----------
drop policy if exists displays_select on public.qr_displays;
create policy displays_select_admin on public.qr_displays for select using (is_company_admin(company_id));

-- ---------- server-only functions: no direct anon/authenticated calls ----------
revoke execute on function public.process_office_attendance(text, uuid) from public, anon, authenticated;
revoke execute on function public.checkout_attendance(uuid) from public, anon, authenticated;
revoke execute on function public.mark_wfh_attendance(uuid, text) from public, anon, authenticated;
revoke execute on function public.submit_wfh_request(uuid, date, text) from public, anon, authenticated;
revoke execute on function public.submit_leave_request(uuid, date, text) from public, anon, authenticated;
revoke execute on function public.submit_feedback(uuid, uuid, uuid, date, date, text, jsonb) from public, anon, authenticated;
revoke execute on function public.review_wfh_request(uuid, uuid, text, text) from public, anon, authenticated;
revoke execute on function public.review_leave_request(uuid, uuid, text, text) from public, anon, authenticated;
revoke execute on function public.generate_wfh_passcode(uuid, uuid, text, timestamptz) from public, anon, authenticated;
revoke execute on function public.generate_wfh_passcode(uuid, uuid, text, timestamptz, text) from public, anon, authenticated;
revoke execute on function public.admin_correct_attendance(uuid, uuid, timestamptz, timestamptz, text) from public, anon, authenticated;
revoke execute on function public.remove_employee(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.create_company_with_admin(uuid, text, text, text, text) from public, anon, authenticated;
revoke execute on function public.issue_qr_session(uuid, text, timestamptz) from public, anon, authenticated;
revoke execute on function public.next_employee_code(uuid, text) from public, anon, authenticated;

-- ---------- housekeeping: non-RLS-gated table privileges ----------
revoke truncate, references, trigger on all tables in schema public from anon, authenticated;
