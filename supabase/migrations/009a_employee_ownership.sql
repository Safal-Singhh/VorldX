-- VorldX 009a: employee ownership
-- Adds the creator of each employee row and enforces "HR reviews own employees"
-- for WFH, leave and feedback. Employees without an active-HR creator remain
-- shared/unassigned so existing records do not disappear from every HR queue.

alter table public.employees add column if not exists created_by uuid;

create index if not exists idx_employees_company_created_by
  on public.employees(company_id, created_by);

-- Backfill from the audit trail where it exists. Older/roster-only rows stay
-- null and are treated as shared by the application.
update public.employees e
set created_by = a.actor_user_id
from (
  select distinct on (entity_id)
         entity_id::uuid as employee_id,
         actor_user_id
  from public.audit_logs
  where entity_type = 'employee'
    and action = 'employee.created'
    and actor_user_id is not null
  order by entity_id, created_at asc
) a
where e.id = a.employee_id
  and e.created_by is null;

-- Keep the admin's bootstrap employee row attributed to the admin.
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
  insert into public.employees (company_id, user_id, employee_code, full_name, email, department, designation, shift_id, created_by) values (v_company_id, p_user_id, 'ADM-001', trim(p_admin_name), '', 'Administration', 'Admin', v_shift_id, p_user_id);
  insert into public.audit_logs (company_id, actor_user_id, action, entity_type, entity_id, new_values) values (v_company_id, p_user_id, 'company.created', 'company', v_company_id::text, jsonb_build_object('name', p_company_name, 'slug', p_slug));
  return v_company_id;
end; $$;

create or replace function public.review_wfh_request(p_request_id uuid, p_reviewer_user_id uuid, p_decision text, p_notes text DEFAULT NULL::text)
returns void language plpgsql security definer set search_path = public as $$
declare v_req record; v_req_emp record; v_req_role text; v_rev_role text; v_rev_company uuid; v_owner_role text; begin
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
  select role into v_owner_role from public.company_memberships where company_id = v_req.company_id and user_id = v_req_emp.created_by and role = 'hr' and status = 'active';
  if v_req_role = 'employee' and v_rev_role = 'hr' and v_req_emp.created_by is not null and v_req_emp.created_by <> p_reviewer_user_id and v_owner_role = 'hr' then
    raise exception 'EMPLOYEE_OWNED_BY_ANOTHER_HR';
  end if;
  update public.wfh_requests set status = p_decision, reviewed_by = p_reviewer_user_id, reviewed_at = now(), review_notes = p_notes where id = p_request_id;
  insert into public.audit_logs (company_id, actor_user_id, action, entity_type, entity_id, new_values) values (v_req.company_id, p_reviewer_user_id, 'wfh.' || p_decision, 'wfh_request', p_request_id::text, jsonb_build_object('decision', p_decision, 'notes', p_notes));
end; $$;

create or replace function public.review_leave_request(p_request_id uuid, p_reviewer_user_id uuid, p_decision text, p_notes text DEFAULT NULL::text)
returns void language plpgsql security definer set search_path = public as $$
declare v_req record; v_req_emp record; v_req_role text; v_rev_role text; v_owner_role text; begin
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
  select role into v_owner_role from public.company_memberships where company_id = v_req.company_id and user_id = v_req_emp.created_by and role = 'hr' and status = 'active';
  if v_req_role = 'employee' and v_rev_role = 'hr' and v_req_emp.created_by is not null and v_req_emp.created_by <> p_reviewer_user_id and v_owner_role = 'hr' then
    raise exception 'EMPLOYEE_OWNED_BY_ANOTHER_HR';
  end if;
  update public.leave_requests set status = p_decision, reviewed_by = p_reviewer_user_id, reviewed_at = now(), review_notes = p_notes where id = p_request_id;
  insert into public.audit_logs (company_id, actor_user_id, action, entity_type, entity_id, new_values) values (v_req.company_id, p_reviewer_user_id, 'leave.' || p_decision, 'leave_request', p_request_id::text, jsonb_build_object('decision', p_decision, 'notes', p_notes));
end; $$;

create or replace function public.submit_feedback(p_company_id uuid, p_subject_employee_id uuid, p_reviewer_user_id uuid, p_period_start date, p_period_end date, p_comments text, p_scores jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_sub record; v_rev_role text; v_sub_role text; v_sub_owner_role text; v_rid uuid; r record; v_allowed text[] := array['punctuality','attendance_consistency','teamwork_collaboration','adaptability','accountability']; k text; v int; begin
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
  if v_rev_role = 'hr' then
    select role into v_sub_owner_role from public.company_memberships where company_id = p_company_id and user_id = v_sub.created_by and role = 'hr' and status = 'active';
    if v_sub.created_by is not null and v_sub.created_by <> p_reviewer_user_id and v_sub_owner_role = 'hr' then
      raise exception 'EMPLOYEE_OWNED_BY_ANOTHER_HR';
    end if;
  end if;
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
