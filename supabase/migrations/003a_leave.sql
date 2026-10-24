-- VorldX 003a: leave requests (3 per month) + submit/review functions + RLS
-- Single-day leaves. Cap counts pending+approved in the leave's calendar month.

create table if not exists public.leave_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  leave_date date not null check (leave_date >= current_date - interval '1 day'),
  reason text not null check (char_length(trim(reason)) between 5 and 2000),
  status text not null default 'pending' check (status in ('pending','approved','rejected','cancelled')),
  reviewed_by uuid,
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- one active request per employee per day
create unique index if not exists uq_leave_employee_date_active
  on public.leave_requests(employee_id, leave_date) where (status in ('pending','approved'));
create index if not exists idx_leave_company_status_date on public.leave_requests(company_id, status, leave_date);
create index if not exists idx_leave_employee on public.leave_requests(employee_id, leave_date);
drop trigger if exists trg_leave_updated on public.leave_requests;
create trigger trg_leave_updated before update on public.leave_requests
  for each row execute function public.handle_updated_at();

create or replace function public.submit_leave_request(
  p_employee_id uuid, p_leave_date date, p_reason text
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_emp record; v_comp record; v_rid uuid; v_used int; v_limit int := 3;
begin
  if char_length(trim(p_reason)) < 5 then raise exception 'REASON_TOO_SHORT'; end if;
  select * into v_emp from public.employees where id = p_employee_id and is_active;
  if not found then raise exception 'EMPLOYEE_INACTIVE'; end if;
  if v_emp.user_id is null then raise exception 'NOT_ACTIVATED'; end if;
  select * into v_comp from public.companies where id = v_emp.company_id and is_active;
  if not found then raise exception 'COMPANY_INACTIVE'; end if;
  if p_leave_date < ((now() at time zone v_comp.timezone))::date - 1 then raise exception 'INVALID_DATE'; end if;
  if exists (select 1 from public.attendance_records a where a.company_id = v_emp.company_id and a.employee_id = v_emp.id and a.work_date = p_leave_date) then
    raise exception 'ATTENDANCE_EXISTS'; end if;
  if exists (select 1 from public.leave_requests r where r.employee_id = v_emp.id and r.leave_date = p_leave_date and r.status in ('pending','approved')) then
    raise exception 'DUPLICATE_REQUEST'; end if;
  select count(*) into v_used from public.leave_requests r
    where r.employee_id = v_emp.id
      and date_trunc('month', r.leave_date) = date_trunc('month', p_leave_date::timestamp)
      and r.status in ('pending','approved');
  if v_used >= v_limit then raise exception 'MONTHLY_LIMIT'; end if;
  insert into public.leave_requests (company_id, employee_id, leave_date, reason, status)
    values (v_emp.company_id, v_emp.id, p_leave_date, trim(p_reason), 'pending') returning id into v_rid;
  insert into public.audit_logs (company_id, actor_user_id, action, entity_type, entity_id, new_values)
    values (v_emp.company_id, v_emp.user_id, 'leave.requested', 'leave_request', v_rid::text, jsonb_build_object('date', p_leave_date));
  return v_rid;
end; $$;

-- hierarchy mirrors WFH: employee->hr/admin, hr->admin, never self
create or replace function public.review_leave_request(
  p_request_id uuid, p_reviewer_user_id uuid, p_decision text, p_notes text default null
) returns void language plpgsql security definer set search_path = public as $$
declare v_req record; v_req_emp record; v_req_role text; v_rev_role text;
begin
  if p_decision not in ('approved','rejected') then raise exception 'INVALID_DECISION'; end if;
  select * into v_req from public.leave_requests where id = p_request_id for update;
  if not found then raise exception 'REQUEST_NOT_FOUND'; end if;
  if v_req.status != 'pending' then raise exception 'ALREADY_REVIEWED'; end if;
  select * into v_req_emp from public.employees where id = v_req.employee_id;
  select role into v_rev_role from public.company_memberships
    where company_id = v_req.company_id and user_id = p_reviewer_user_id and status = 'active';
  if not found then raise exception 'REVIEWER_UNAUTHORIZED'; end if;
  if v_req_emp.user_id = p_reviewer_user_id then raise exception 'SELF_APPROVAL'; end if;
  select role into v_req_role from public.company_memberships where company_id = v_req.company_id and user_id = v_req_emp.user_id and status = 'active';
  if v_req_role is null then v_req_role := 'employee'; end if;
  if v_req_role = 'hr' then
    if v_rev_role != 'admin' then raise exception 'HR_REQUEST_NEEDS_ADMIN'; end if;
  elsif v_req_role = 'employee' then
    if v_rev_role not in ('hr','admin') then raise exception 'EMP_REQUEST_NEEDS_HR'; end if;
  elsif v_req_role = 'admin' then
    raise exception 'ADMIN_REQUEST_UNSUPPORTED';
  end if;
  update public.leave_requests set status = p_decision, reviewed_by = p_reviewer_user_id, reviewed_at = now(), review_notes = p_notes
    where id = p_request_id;
  insert into public.audit_logs (company_id, actor_user_id, action, entity_type, entity_id, new_values)
    values (v_req.company_id, p_reviewer_user_id, 'leave.' || p_decision, 'leave_request', p_request_id::text,
      jsonb_build_object('decision', p_decision, 'notes', p_notes));
end; $$;

alter table public.leave_requests enable row level security;
drop policy if exists leave_select on public.leave_requests;
create policy leave_select on public.leave_requests for select using (
  public.is_company_hr(company_id)
  or exists (select 1 from public.employees e where e.id = leave_requests.employee_id and e.user_id = auth.uid())
);
drop policy if exists leave_insert_own on public.leave_requests;
create policy leave_insert_own on public.leave_requests for insert with check (
  status = 'pending' and public.is_company_member(company_id)
  and exists (select 1 from public.employees e where e.id = employee_id and e.user_id = auth.uid() and e.company_id = leave_requests.company_id and e.is_active)
);
