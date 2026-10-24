-- VorldX 010a: request read scoping + WFH passcode ownership
-- HRs may read employee requests for employees they created or employees with
-- no active HR owner. HR-role requests remain Admin-only for queue visibility;
-- requesters can still read their own. Admin can read every request.
--
-- This mirrors the review guard in 009a_employee_ownership.sql so the rule is
-- enforced when rows are read, not only when they are reviewed.

create or replace function public.can_read_employee_request(
  p_company_id uuid,
  p_employee_id uuid
) returns boolean
language sql
stable
security definer
set search_path = public as $$
  select case
    when auth.uid() is null then false
    -- A user can always read their own request (including an HR's own request).
    when exists (
      select 1
      from public.employees e
      where e.id = p_employee_id
        and e.company_id = p_company_id
        and e.user_id = auth.uid()
    ) then true
    -- Admin override.
    when public.is_company_admin(p_company_id) then true
    -- HR queue: own employee-role requests plus unassigned employee-role requests.
    when public.is_company_hr(p_company_id) then exists (
      select 1
      from public.employees e
      left join public.company_memberships subject
        on subject.company_id = e.company_id
       and subject.user_id = e.user_id
       and subject.status = 'active'
      left join public.company_memberships owner
        on owner.company_id = e.company_id
       and owner.user_id = e.created_by
       and owner.role = 'hr'
       and owner.status = 'active'
      where e.id = p_employee_id
        and e.company_id = p_company_id
        -- Unlinked roster rows are treated as employees. Active HR/Admin
        -- requesters stay out of the HR queue and are handled by Admin.
        and (subject.role is null or subject.role = 'employee')
        and (e.created_by = auth.uid() or owner.user_id is null)
    )
    else false
  end;
$$;

revoke all on function public.can_read_employee_request(uuid, uuid) from public;
grant execute on function public.can_read_employee_request(uuid, uuid) to authenticated;

drop policy if exists wfh_select on public.wfh_requests;
create policy wfh_select on public.wfh_requests for select to authenticated using (
  public.can_read_employee_request(company_id, employee_id)
);

drop policy if exists leave_select on public.leave_requests;
create policy leave_select on public.leave_requests for select to authenticated using (
  public.can_read_employee_request(company_id, employee_id)
);

-- Passcode generation must follow the same ownership rule as review.
-- The legacy four-argument overload is removed so there is only one guarded path.
drop function if exists public.generate_wfh_passcode(uuid, uuid, text, timestamptz);

create or replace function public.generate_wfh_passcode(
  p_request_id uuid,
  p_generated_by uuid,
  p_passcode_hash text,
  p_expires_at timestamptz,
  p_passcode_display text default null
) returns uuid
language plpgsql
security definer
set search_path = public as $$
declare
  v_req record;
  v_req_emp record;
  v_req_role text;
  v_gen_role text;
  v_owner_role text;
  v_pid uuid;
begin
  if auth.uid() is not null and auth.uid() <> p_generated_by then
    raise exception 'ACTOR_MISMATCH';
  end if;
  if char_length(p_passcode_hash) < 16 then
    raise exception 'INVALID_PASSCODE_HASH';
  end if;

  select * into v_req from public.wfh_requests where id = p_request_id;
  if not found then raise exception 'REQUEST_NOT_FOUND'; end if;
  if v_req.status != 'approved' then raise exception 'NOT_APPROVED'; end if;
  if exists (select 1 from public.wfh_passcodes where wfh_request_id = p_request_id) then
    raise exception 'PASSCODE_EXISTS';
  end if;

  select role into v_gen_role
  from public.company_memberships
  where company_id = v_req.company_id
    and user_id = p_generated_by
    and status = 'active';
  if not found then raise exception 'GENERATOR_UNAUTHORIZED'; end if;
  if v_gen_role not in ('hr', 'admin') then raise exception 'GENERATOR_UNAUTHORIZED'; end if;

  select * into v_req_emp from public.employees where id = v_req.employee_id;
  select role into v_req_role
  from public.company_memberships
  where company_id = v_req.company_id
    and user_id = v_req_emp.user_id
    and status = 'active';
  if v_req_role is null then v_req_role := 'employee'; end if;

  -- Same hierarchy as review: employee requests -> HR/Admin; HR requests -> Admin.
  if v_req_role = 'hr' then
    if v_gen_role != 'admin' then raise exception 'HR_REQUEST_NEEDS_ADMIN'; end if;
  elsif v_req_role = 'employee' then
    if v_gen_role not in ('hr', 'admin') then raise exception 'EMP_REQUEST_NEEDS_HR'; end if;
  elsif v_req_role = 'admin' then
    raise exception 'ADMIN_REQUEST_UNSUPPORTED';
  end if;

  -- An HR may generate the passcode only for their own employee or a shared
  -- employee with no active-HR owner, matching the WFH review guard.
  if v_req_role = 'employee' and v_gen_role = 'hr' then
    select role into v_owner_role
    from public.company_memberships
    where company_id = v_req.company_id
      and user_id = v_req_emp.created_by
      and role = 'hr'
      and status = 'active';
    if v_req_emp.created_by is not null
       and v_req_emp.created_by <> p_generated_by
       and v_owner_role = 'hr' then
      raise exception 'EMPLOYEE_OWNED_BY_ANOTHER_HR';
    end if;
  end if;

  if exists (
    select 1
    from public.attendance_records a
    where a.company_id = v_req.company_id
      and a.employee_id = v_req.employee_id
      and a.work_date = v_req.request_date
  ) then
    raise exception 'ATTENDANCE_EXISTS';
  end if;

  insert into public.wfh_passcodes (
    company_id, wfh_request_id, employee_id, work_date,
    passcode_hash, expires_at, generated_by, use_count, passcode_display
  ) values (
    v_req.company_id, v_req.id, v_req.employee_id, v_req.request_date,
    p_passcode_hash, p_expires_at, p_generated_by, 0,
    nullif(trim(coalesce(p_passcode_display, '')), '')
  ) returning id into v_pid;

  insert into public.audit_logs (company_id, actor_user_id, action, entity_type, entity_id, new_values)
  values (
    v_req.company_id,
    p_generated_by,
    'wfh.passcode_generated',
    'wfh_passcode',
    v_pid::text,
    jsonb_build_object('request', p_request_id)
  );

  return v_pid;
end; $$;

revoke execute on function public.generate_wfh_passcode(uuid, uuid, text, timestamptz, text)
  from public, anon, authenticated;
