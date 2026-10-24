-- VorldX demo dashboard cleanup
-- ---------------------------------------------------------------------------
-- Removes only data created by supabase/seed/demo_dashboard_data.sql:
--   * employees with employee_code like 'DEMO-%' (and their attendance, WFH,
--     leave, feedback, and passcode rows via cascade)
--   * QR displays whose display_name starts with 'DEMO - '
--   * the demo requests attached to the real HR QA account, identified by the
--     'HR demo' reason prefix
--
-- Existing QA company employees, attendance, requests, and auth users are left
-- untouched. Safe to run more than once.
--
-- Run in Supabase SQL Editor, or from the CLI:
--   npx supabase db query --linked -f supabase/seed/demo_dashboard_cleanup.sql

do $$
declare
  v_company uuid;
  v_hr_user uuid;
  v_employees int;
  v_displays int;
  v_hr_requests int := 0;
  v_count int;
begin
  select id into v_company
  from public.companies
  where slug = 'p5a-20261021a-alpha';

  if v_company is null then
    raise exception 'DEMO_COMPANY_NOT_FOUND: expected slug p5a-20261021a-alpha';
  end if;

  select user_id into v_hr_user
  from public.company_memberships
  where company_id = v_company and role = 'hr' and status = 'active'
  limit 1;

  delete from public.qr_displays
  where company_id = v_company and display_name like 'DEMO - %';
  get diagnostics v_displays = row_count;

  delete from public.employees
  where company_id = v_company and employee_code like 'DEMO-%';
  get diagnostics v_employees = row_count;

  if v_hr_user is not null then
    delete from public.wfh_requests
    where company_id = v_company
      and employee_id in (
        select id from public.employees
        where company_id = v_company and user_id = v_hr_user
      )
      and reason like 'HR demo%';
    get diagnostics v_count = row_count;
    v_hr_requests := v_count;

    delete from public.leave_requests
    where company_id = v_company
      and employee_id in (
        select id from public.employees
        where company_id = v_company and user_id = v_hr_user
      )
      and reason like 'HR demo%';
    get diagnostics v_count = row_count;
    v_hr_requests := v_hr_requests + v_count;
  end if;

  raise notice 'Removed % demo employees, % demo displays, % HR demo requests.',
    v_employees, v_displays, v_hr_requests;
end;
$$;

-- Verification snapshot -----------------------------------------------------
select jsonb_build_object(
  'demo_employees_remaining', (
    select count(*) from public.employees
    where company_id = (select id from public.companies where slug = 'p5a-20261021a-alpha')
      and employee_code like 'DEMO-%'
  ),
  'demo_displays_remaining', (
    select count(*) from public.qr_displays
    where company_id = (select id from public.companies where slug = 'p5a-20261021a-alpha')
      and display_name like 'DEMO - %'
  ),
  'existing_qa_employees', (
    select count(*) from public.employees
    where company_id = (select id from public.companies where slug = 'p5a-20261021a-alpha')
      and employee_code not like 'DEMO-%'
  ),
  'existing_qa_wfh_requests', (
    select count(*) from public.wfh_requests
    where company_id = (select id from public.companies where slug = 'p5a-20261021a-alpha')
      and reason not like 'HR demo%'
  ),
  'existing_qa_leave_requests', (
    select count(*) from public.leave_requests
    where company_id = (select id from public.companies where slug = 'p5a-20261021a-alpha')
      and reason not like 'HR demo%'
  )
) as demo_cleanup_counts;
