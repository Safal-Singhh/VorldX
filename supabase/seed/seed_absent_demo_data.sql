-- ===========================================================================
-- Seed Comprehensive Absent Demo Data for QA Alpha Company
-- ===========================================================================
-- Inserts valid auto-absent records complying with migration 011a_auto_absent:
-- 1. status = 'absent'
-- 2. source = 'auto'
-- 3. check_in_at is null, check_out_at is null, attendance_type is null
-- 4. Historical absences across the past 90 weekdays for demo employees
-- 5. Today's live absence for DEMO-004 (Ananya Rao)

do $$
declare
  v_company uuid;
  v_tz text;
  v_today date;
  v_demo4 uuid;
begin
  select id, timezone into v_company, v_tz
  from public.companies
  where slug = 'p5a-20261021a-alpha' and is_active;

  if v_company is null then
    raise exception 'QA Alpha company not found';
  end if;

  v_today := (now() at time zone v_tz)::date;

  -- 1. Historical absences for missing working days (past 90 days)
  with emp as (
    select id, joining_date
    from public.employees
    where company_id = v_company
      and is_active
      and employee_code like 'DEMO-%'
  ),
  dates as (
    select generate_series(v_today - 90, v_today - 1, interval '1 day')::date as d
  ),
  missing as (
    select e.id as employee_id, d.d as work_date
    from emp e
    cross join dates d
    where d.d >= e.joining_date
      and extract(isodow from d.d) between 1 and 5
      and not exists (
        select 1 from public.attendance_records a
        where a.company_id = v_company
          and a.employee_id = e.id
          and a.work_date = d.d
      )
      and not exists (
        select 1 from public.leave_requests l
        where l.company_id = v_company
          and l.employee_id = e.id
          and l.leave_date = d.d
          and l.status = 'approved'
      )
  )
  insert into public.attendance_records (
    company_id, employee_id, work_date, status, source,
    attendance_type, check_in_at, check_out_at
  )
  select v_company, employee_id, work_date, 'absent', 'auto',
         null, null, null
  from missing
  on conflict (company_id, employee_id, work_date) do update
  set status = 'absent',
      source = 'auto',
      attendance_type = null,
      check_in_at = null,
      check_out_at = null;

  -- 2. Today's absent record: DEMO-004 (Ananya Rao - Engineering)
  select id into v_demo4
  from public.employees
  where company_id = v_company and employee_code = 'DEMO-004';

  if v_demo4 is not null then
    insert into public.attendance_records (
      company_id, employee_id, work_date, status, source,
      attendance_type, check_in_at, check_out_at
    ) values (
      v_company, v_demo4, v_today, 'absent', 'auto',
      null, null, null
    )
    on conflict (company_id, employee_id, work_date) do update
    set status = 'absent',
        source = 'auto',
        attendance_type = null,
        check_in_at = null,
        check_out_at = null;
  end if;

end $$;
