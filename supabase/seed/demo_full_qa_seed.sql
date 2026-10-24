-- ===========================================================================
-- VorldX: Full Comprehensive QA Seed (Admin + HR + Employee + Kiosk Display)
-- Targets: QA Alpha (slug: p5a-20261021a-alpha)
-- Safe to re-run: Cleans up previous demo data, then recreates everything.
-- ===========================================================================

do $$
declare
  v_company uuid;
  v_tz text;
  v_shift uuid;
  v_hr_user uuid;
  v_admin_user uuid;
  v_emp_user uuid;
  v_hr_employee uuid;
  v_qa_employee uuid;
  v_today date;
  v_now_local timestamp;
  v_emp uuid;
  v_review uuid;
  v_req_date date;
  v_reviewed timestamptz;
  v_created timestamptz;
  v_today_wfh_id uuid;
  v_hq_lobby_id uuid;
  r record;
begin
  -- 1. Resolve company & timezone
  select id, timezone into v_company, v_tz
  from public.companies
  where slug = 'p5a-20261021a-alpha' and is_active;

  if v_company is null then
    raise exception 'DEMO_COMPANY_NOT_FOUND: expected slug p5a-20261021a-alpha';
  end if;

  v_today := (now() at time zone v_tz)::date;
  v_now_local := now() at time zone v_tz;

  -- 2. Resolve users & employees
  select user_id into v_admin_user
  from public.company_memberships
  where company_id = v_company and role = 'admin' and status = 'active'
  limit 1;

  select user_id into v_hr_user
  from public.company_memberships
  where company_id = v_company and role = 'hr' and status = 'active'
  limit 1;

  select user_id into v_emp_user
  from public.company_memberships
  where company_id = v_company and role = 'employee' and status = 'active'
  order by created_at
  limit 1;

  select id into v_shift
  from public.shifts
  where company_id = v_company and is_active
  order by created_at
  limit 1;

  if v_shift is null or v_hr_user is null or v_admin_user is null then
    raise exception 'DEMO_PREREQUISITES_MISSING: shift, HR user, or Admin user not found';
  end if;

  -- 3. Calibrate shift working_days to include today (even on weekends)
  update public.shifts
  set working_days = '{1,2,3,4,5,6,7}',
      start_time = '09:00:00',
      end_time = '18:00:00',
      grace_period_minutes = 10
  where id = v_shift;

  select id into v_hr_employee
  from public.employees
  where company_id = v_company and user_id = v_hr_user and is_active
  limit 1;

  select id into v_qa_employee
  from public.employees
  where company_id = v_company and user_id = v_emp_user and is_active
  limit 1;

  -- -----------------------------------------------------------------------
  -- 4. Cleanup previous demo entities
  -- -----------------------------------------------------------------------
  delete from public.qr_displays
  where company_id = v_company and display_name like 'DEMO - %';

  delete from public.employees
  where company_id = v_company and employee_code like 'DEMO-%';

  -- Clean HR demo requests
  if v_hr_employee is not null then
    delete from public.wfh_requests
    where company_id = v_company and employee_id = v_hr_employee;

    delete from public.leave_requests
    where company_id = v_company and employee_id = v_hr_employee;

    delete from public.feedback_reviews
    where company_id = v_company and subject_employee_id = v_hr_employee;
  end if;

  -- Clean QA Employee test requests and passcodes
  if v_qa_employee is not null then
    delete from public.wfh_passcodes
    where employee_id = v_qa_employee;

    delete from public.wfh_requests
    where employee_id = v_qa_employee;

    delete from public.leave_requests
    where employee_id = v_qa_employee;

    delete from public.feedback_reviews
    where company_id = v_company and subject_employee_id = v_qa_employee;

    delete from public.attendance_records
    where employee_id = v_qa_employee;
  end if;

  -- -----------------------------------------------------------------------
  -- 5. Seed 16 Demo Employees across 5 departments
  -- -----------------------------------------------------------------------
  insert into public.employees (
    company_id, user_id, employee_code, full_name, email, department,
    designation, joining_date, shift_id, work_type, is_active, created_by
  ) values
    (v_company, null, 'DEMO-001', 'Aarav Mehta',    'demo.aarav.mehta@example.com',    'Engineering', 'Senior Software Engineer', v_today - 420, v_shift, 'hybrid', true, v_hr_user),
    (v_company, null, 'DEMO-002', 'Diya Sharma',    'demo.diya.sharma@example.com',    'Engineering', 'Software Engineer',        v_today - 350, v_shift, 'office', true, v_hr_user),
    (v_company, null, 'DEMO-003', 'Kabir Nair',     'demo.kabir.nair@example.com',     'Engineering', 'QA Engineer',              v_today - 300, v_shift, 'office', true, v_hr_user),
    (v_company, null, 'DEMO-004', 'Ananya Rao',     'demo.ananya.rao@example.com',     'Engineering', 'Frontend Engineer',        v_today - 250, v_shift, 'hybrid', true, v_hr_user),
    (v_company, null, 'DEMO-005', 'Rohan Iyer',     'demo.rohan.iyer@example.com',     'Engineering', 'Backend Engineer',         v_today - 180, v_shift, 'office', true, v_hr_user),
    (v_company, null, 'DEMO-006', 'Meera Kapoor',   'demo.meera.kapoor@example.com',   'Design',      'Product Designer',         v_today - 150, v_shift, 'hybrid', true, v_hr_user),
    (v_company, null, 'DEMO-007', 'Ishaan Verma',   'demo.ishaan.verma@example.com',   'Design',      'UX Researcher',            v_today - 120, v_shift, 'office', true, v_hr_user),
    (v_company, null, 'DEMO-008', 'Sana Khan',      'demo.sana.khan@example.com',      'Design',      'Visual Designer',          v_today - 60,  v_shift, 'hybrid', true, v_hr_user),
    (v_company, null, 'DEMO-009', 'Aditya Bose',    'demo.aditya.bose@example.com',    'Sales',       'Account Executive',        v_today - 500, v_shift, 'office', true, v_hr_user),
    (v_company, null, 'DEMO-010', 'Nisha Patel',    'demo.nisha.patel@example.com',    'Sales',       'Sales Manager',            v_today - 380, v_shift, 'office', true, v_hr_user),
    (v_company, null, 'DEMO-011', 'Arjun Singh',    'demo.arjun.singh@example.com',    'Sales',       'Sales Development Rep',    v_today - 90,  v_shift, 'office', true, v_hr_user),
    (v_company, null, 'DEMO-012', 'Priya Menon',    'demo.priya.menon@example.com',    'Sales',       'Customer Success Manager', v_today - 45,  v_shift, 'hybrid', true, v_hr_user),
    (v_company, null, 'DEMO-013', 'Vikram Joshi',   'demo.vikram.joshi@example.com',   'Finance',     'Finance Manager',          v_today - 600, v_shift, 'office', true, v_hr_user),
    (v_company, null, 'DEMO-014', 'Tanvi Desai',    'demo.tanvi.desai@example.com',    'Finance',     'Financial Analyst',        v_today - 32,  v_shift, 'office', true, v_hr_user),
    (v_company, null, 'DEMO-015', 'Neha Kulkarni',  'demo.neha.kulkarni@example.com',  'People Ops',  'HR Partner',               v_today - 21,  v_shift, 'office', true, v_hr_user),
    (v_company, null, 'DEMO-016', 'Dev Malhotra',   'demo.dev.malhotra@example.com',   'People Ops',  'Talent Acquisition',       v_today - 3,   v_shift, 'hybrid', true, v_hr_user);

  drop table if exists _demo_emp;
  create temporary table _demo_emp on commit drop as
  select (regexp_replace(employee_code, '\D', '', 'g'))::int as idx,
         id, joining_date
  from public.employees
  where company_id = v_company and employee_code like 'DEMO-%';

  -- -----------------------------------------------------------------------
  -- 6. Historical Attendance: 180 days (weekdays)
  -- -----------------------------------------------------------------------
  insert into public.attendance_records (
    company_id, employee_id, work_date, attendance_type,
    check_in_at, check_out_at, status, source
  )
  with days as (
    select d.idx,
           d.id,
           g.dt::date as work_date,
           (v_today - g.dt::date) as off,
           (v_today - g.dt::date) * 7 + d.idx * 11 as no_show_mod,
           (v_today - g.dt::date) + d.idx * 3 as wfh_mod,
           (v_today - g.dt::date) * 2 + d.idx * 5 as late_mod,
           (v_today - g.dt::date) + d.idx as missing_mod
    from _demo_emp d
    cross join lateral generate_series(
      greatest(d.joining_date, v_today - 180),
      v_today - 1,
      interval '1 day'
    ) g(dt)
    where extract(isodow from g.dt) between 1 and 5
      and ((v_today - g.dt::date) * 7 + d.idx * 11) % 19 <> 0
  ),
  calc as (
    select *,
      (((work_date + case when late_mod % 17 = 0 then time '09:15' else time '08:55' end)::timestamp
        at time zone v_tz)
        + make_interval(mins => case
            when late_mod % 17 = 0 then (idx * 7 + off) % 25
            else (idx * 5 + off) % 8
          end)) as check_in,
      (wfh_mod % 7 = 0) as is_wfh,
      (late_mod % 17 = 0) as is_late,
      (missing_mod % 43 = 0) as missing_out,
      ((idx * 3 + off) % 31) as out_mod
    from days
  )
  select v_company,
         id,
         work_date,
         case when is_wfh then 'wfh' else 'office' end,
         check_in,
         case when missing_out then null
              else check_in + interval '8 hours 40 minutes' + make_interval(mins => out_mod)
         end,
         case when is_late then 'late' else 'present' end,
         case when is_wfh then 'passcode' else 'qr' end
  from calc
  on conflict (company_id, employee_id, work_date) do nothing;

  -- -----------------------------------------------------------------------
  -- 7. Seed Real QA Employee Attendance (Past 14 Days)
  -- -----------------------------------------------------------------------
  if v_qa_employee is not null then
    for r in select * from (values
      (1,  'office', time '08:52', time '18:05', 'present', 'qr'),
      (2,  'office', time '08:57', time '18:12', 'present', 'qr'),
      (3,  'wfh',    time '08:55', time '18:00', 'present', 'passcode'),
      (4,  'office', time '09:14', time '18:30', 'late',    'qr'),
      (5,  'office', time '08:50', time '18:00', 'present', 'qr'),
      (8,  'office', time '08:54', time '18:02', 'present', 'qr'),
      (9,  'wfh',    time '08:58', time '18:00', 'present', 'passcode'),
      (10, 'office', time '08:53', time '18:10', 'present', 'qr'),
      (11, 'office', time '09:16', time '18:25', 'late',    'qr'),
      (12, 'office', time '08:56', time '18:08', 'present', 'qr')
    ) v(off, att_type, cin_t, cout_t, st, src) loop
      insert into public.attendance_records (
        company_id, employee_id, work_date, attendance_type,
        check_in_at, check_out_at, status, source
      ) values (
        v_company, v_qa_employee, v_today - r.off, r.att_type,
        ((v_today - r.off + r.cin_t)::timestamp at time zone v_tz),
        ((v_today - r.off + r.cout_t)::timestamp at time zone v_tz),
        r.st, r.src
      ) on conflict (company_id, employee_id, work_date) do nothing;
    end loop;
  end if;

  -- -----------------------------------------------------------------------
  -- 8. Today's Live Attendance (12 Checked in: 10 on time, 2 late)
  -- -----------------------------------------------------------------------
  insert into public.attendance_records (
    company_id, employee_id, work_date, attendance_type,
    check_in_at, check_out_at, status, source
  )
  select v_company,
         d.id,
         v_today,
         case when d.idx in (2, 7) then 'wfh' else 'office' end,
         ((v_today + case
            when d.idx in (5, 11) then time '09:15' + make_interval(mins => (d.idx * 3) % 15)
            else time '08:54' + make_interval(mins => (d.idx * 2) % 9)
          end)::timestamp at time zone v_tz),
         null,
         case when d.idx in (5, 11) then 'late' else 'present' end,
         case when d.idx in (2, 7) then 'passcode' else 'qr' end
  from _demo_emp d
  where d.idx not in (4, 8, 12, 16)  -- 12 checked in (16 - 4)
  on conflict (company_id, employee_id, work_date) do nothing;

  -- Today's auto-absent employee: DEMO-004 (Ananya Rao)
  insert into public.attendance_records (
    company_id, employee_id, work_date, status, source,
    attendance_type, check_in_at, check_out_at
  )
  select v_company, d.id, v_today, 'absent', 'auto', null, null, null
  from _demo_emp d
  where d.idx = 4
  on conflict (company_id, employee_id, work_date) do update
  set status = 'absent', source = 'auto', attendance_type = null, check_in_at = null, check_out_at = null;

  -- Historical absences for working days without check-in or approved leave
  with missing_days as (
    select d.id as employee_id, g.dt::date as work_date
    from _demo_emp d
    cross join lateral generate_series(
      greatest(d.joining_date, v_today - 90),
      v_today - 1,
      interval '1 day'
    ) g(dt)
    where extract(isodow from g.dt) between 1 and 5
      and not exists (
        select 1 from public.attendance_records a
        where a.company_id = v_company
          and a.employee_id = d.id
          and a.work_date = g.dt::date
      )
      and not exists (
        select 1 from public.leave_requests l
        where l.company_id = v_company
          and l.employee_id = d.id
          and l.leave_date = g.dt::date
          and l.status = 'approved'
      )
  )
  insert into public.attendance_records (
    company_id, employee_id, work_date, status, source,
    attendance_type, check_in_at, check_out_at
  )
  select v_company, employee_id, work_date, 'absent', 'auto', null, null, null
  from missing_days
  on conflict (company_id, employee_id, work_date) do nothing;

  -- -----------------------------------------------------------------------
  -- 9. Today's Approved WFH (2 checked in + 2 awaiting) & Leave (1)
  -- -----------------------------------------------------------------------
  for r in select * from (values (2), (7), (12), (16)) v(idx) loop
    select id into v_emp from _demo_emp where idx = r.idx;
    insert into public.wfh_requests (
      company_id, employee_id, request_date, reason, status,
      reviewed_by, reviewed_at, review_notes, created_at
    ) values (
      v_company, v_emp, v_today,
      'Approved WFH for dashboard coverage.',
      'approved', v_hr_user, now() - interval '3 hours',
      'Approved by HR.', now() - interval '1 day 2 hours'
    );
  end loop;

  -- Leave approved for today (DEMO-008)
  select id into v_emp from _demo_emp where idx = 8;
  insert into public.leave_requests (
    company_id, employee_id, leave_date, reason, status,
    reviewed_by, reviewed_at, review_notes, created_at
  ) values (
    v_company, v_emp, v_today,
    'Personal leave for dashboard coverage.',
    'approved', v_hr_user, now() - interval '2 days',
    'Approved by HR.', now() - interval '2 days 6 hours'
  );

  -- -----------------------------------------------------------------------
  -- 10. QA Employee Active Approved WFH for TODAY with Passcode 482915
  -- -----------------------------------------------------------------------
  if v_qa_employee is not null then
    insert into public.wfh_requests (
      company_id, employee_id, request_date, reason, status,
      reviewed_by, reviewed_at, review_notes, created_at
    ) values (
      v_company, v_qa_employee, v_today,
      'Approved WFH day for mobile app testing.',
      'approved', v_hr_user, now() - interval '1 hour',
      'Approved by HR for testing.', now() - interval '1 day'
    ) returning id into v_today_wfh_id;

    insert into public.wfh_passcodes (
      company_id, wfh_request_id, employee_id, work_date,
      passcode_hash, passcode_display, expires_at, created_at
    ) values (
      v_company, v_today_wfh_id, v_qa_employee, v_today,
      '48290cf691c41cbc99b2396d2e5313ccfba91987b384e6d8f08b951fa5045e83', -- sha256 of 482915
      '482915',
      ((v_today || ' 23:59:59')::timestamp at time zone v_tz),
      now() - interval '1 hour'
    );

    -- Pending WFH request for tomorrow
    insert into public.wfh_requests (
      company_id, employee_id, request_date, reason, status, created_at
    ) values (
      v_company, v_qa_employee, v_today + 1,
      'Focus day on API integration and mobile documentation.',
      'pending', now() - interval '22 hours'
    );

    -- Pending Leave for upcoming date
    insert into public.leave_requests (
      company_id, employee_id, leave_date, reason, status, created_at
    ) values (
      v_company, v_qa_employee, v_today + 3,
      'Need a day off for a personal appointment.',
      'pending', now() - interval '22 hours'
    );

    -- Approved Leave for upcoming date
    insert into public.leave_requests (
      company_id, employee_id, leave_date, reason, status,
      reviewed_by, reviewed_at, review_notes, created_at
    ) values (
      v_company, v_qa_employee, v_today + 6,
      'Family function out of town.',
      'approved', v_hr_user, now() - interval '2 days',
      'Approved.', now() - interval '2 days'
    );

    -- Feedback review for QA Employee
    insert into public.feedback_reviews (
      company_id, subject_employee_id, reviewer_user_id,
      period_start, period_end, comments, status, created_at
    ) values (
      v_company, v_qa_employee, v_hr_user,
      date_trunc('month', v_today - interval '1 month')::date,
      (date_trunc('month', v_today) - interval '1 day')::date,
      'Steady month. Strong delivery on sprint goals. Keep flagging blockers early so cross-team handovers stay smooth.',
      'submitted', now() - interval '3 days'
    ) returning id into v_review;

    insert into public.feedback_ratings (review_id, criterion, score) values
      (v_review, 'punctuality', 9),
      (v_review, 'attendance_consistency', 8),
      (v_review, 'teamwork_collaboration', 9),
      (v_review, 'adaptability', 7),
      (v_review, 'accountability', 8);
  end if;

  -- -----------------------------------------------------------------------
  -- 11. Pending Employee Requests for HR Queue (8 waiting: 5 WFH + 3 leave)
  -- -----------------------------------------------------------------------
  -- WFH pending: Meera Kapoor, Kabir Nair, Ananya Rao, Rohan Iyer
  for r in select * from (values
    (6, 2, 'Design - 26 Oct', 44),  -- Meera Kapoor
    (3, 0, 'Engineering - today', 19), -- Kabir Nair
    (4, 3, 'Engineering - 27 Oct', 12), -- Ananya Rao
    (5, 4, 'Engineering - 28 Oct', 5)   -- Rohan Iyer
  ) v(idx, off, note, age_hours) loop
    select id into v_emp from _demo_emp where idx = r.idx;
    insert into public.wfh_requests (
      company_id, employee_id, request_date, reason, status, created_at
    ) values (
      v_company, v_emp, v_today + r.off,
      'Pending employee WFH request for approval-queue coverage.',
      'pending', now() - make_interval(hours => r.age_hours)
    );
  end loop;

  -- Leave pending: Diya Sharma, Ishaan Verma
  for r in select * from (values
    (2, 0, 26), -- Diya Sharma
    (7, 4, 8)   -- Ishaan Verma
  ) v(idx, off, age_hours) loop
    select id into v_emp from _demo_emp where idx = r.idx;
    insert into public.leave_requests (
      company_id, employee_id, leave_date, reason, status, created_at
    ) values (
      v_company, v_emp, v_today + r.off,
      'Pending employee leave request for approval-queue coverage.',
      'pending', now() - make_interval(hours => r.age_hours)
    );
  end loop;

  -- -----------------------------------------------------------------------
  -- 12. Pending HR Requests for Admin Queue (2 waiting: 1 WFH + 1 leave)
  -- -----------------------------------------------------------------------
  if v_hr_employee is not null then
    insert into public.wfh_requests (
      company_id, employee_id, request_date, reason, status, created_at
    ) values (
      v_company, v_hr_employee, v_today,
      'QA Alpha HR WFH request awaiting Admin review.',
      'pending', now() - interval '32 hours'
    );

    insert into public.leave_requests (
      company_id, employee_id, leave_date, reason, status, created_at
    ) values (
      v_company, v_hr_employee, v_today + 2,
      'QA Alpha HR Leave request awaiting Admin review.',
      'pending', now() - interval '6 hours'
    );

    -- Admin-reviewed HR requests
    insert into public.wfh_requests (
      company_id, employee_id, request_date, reason, status,
      reviewed_by, reviewed_at, review_notes, created_at
    ) values (
      v_company, v_hr_employee, v_today + 4,
      'HR WFH request previously approved by Admin.',
      'approved', v_admin_user, now() - interval '4 days', 'Approved by Admin.',
      now() - interval '5 days'
    );

    insert into public.leave_requests (
      company_id, employee_id, leave_date, reason, status,
      reviewed_by, reviewed_at, review_notes, created_at
    ) values (
      v_company, v_hr_employee, v_today + 5,
      'HR Leave request previously reviewed by Admin.',
      'rejected', v_admin_user, now() - interval '8 days', 'Rejected due to quarterly review.',
      now() - interval '9 days'
    );

    -- Feedback review for QA Alpha HR from Admin
    insert into public.feedback_reviews (
      company_id, subject_employee_id, reviewer_user_id,
      period_start, period_end, comments, status, created_at
    ) values (
      v_company, v_hr_employee, v_admin_user,
      date_trunc('month', v_today - interval '1 month')::date,
      (date_trunc('month', v_today) - interval '1 day')::date,
      'Exceptional performance managing people operations and maintaining smooth team onboarding.',
      'submitted', now() - interval '5 days'
    ) returning id into v_review;

    insert into public.feedback_ratings (review_id, criterion, score) values
      (v_review, 'punctuality', 9),
      (v_review, 'attendance_consistency', 9),
      (v_review, 'teamwork_collaboration', 10),
      (v_review, 'adaptability', 8),
      (v_review, 'accountability', 9);
  end if;

  -- -----------------------------------------------------------------------
  -- 13. Historical Reviewed Requests (14 by HR)
  -- -----------------------------------------------------------------------
  for r in select * from (values
    (1,  3, 'wfh',   'approved'),
    (10, 4, 'wfh',   'rejected'),
    (13, 5, 'wfh',   'approved'),
    (15, 6, 'wfh',   'rejected'),
    (11, 7, 'wfh',   'approved'),
    (14, 8, 'wfh',   'rejected'),
    (1,  3, 'leave', 'approved'),
    (9,  5, 'leave', 'approved'),
    (10, 6, 'leave', 'rejected'),
    (13, 7, 'leave', 'rejected'),
    (14, 8, 'leave', 'approved'),
    (15, 9, 'leave', 'approved'),
    (16, 10,'leave', 'rejected'),
    (11, 11,'leave', 'approved')
  ) v(idx, off, kind, decision) loop
    select id into v_emp from _demo_emp where idx = r.idx;
    v_req_date := v_today + r.off;
    v_reviewed := now() - make_interval(days => r.off * 2) - interval '3 hours';
    v_created := v_reviewed - make_interval(hours => 7);

    if r.kind = 'wfh' then
      insert into public.wfh_requests (
        company_id, employee_id, request_date, reason, status,
        reviewed_by, reviewed_at, review_notes, created_at
      ) values (
        v_company, v_emp, v_req_date,
        'Demo reviewed WFH request for response-time metrics.',
        r.decision, v_hr_user, v_reviewed, 'Reviewed by HR.', v_created
      );
    else
      insert into public.leave_requests (
        company_id, employee_id, leave_date, reason, status,
        reviewed_by, reviewed_at, review_notes, created_at
      ) values (
        v_company, v_emp, v_req_date,
        'Demo reviewed leave request for response-time metrics.',
        r.decision, v_hr_user, v_reviewed, 'Reviewed by HR.', v_created
      );
    end if;
  end loop;

  -- -----------------------------------------------------------------------
  -- 14. Feedback Reviews for Demo Employees (10 reviews)
  -- -----------------------------------------------------------------------
  for r in select * from (values
    (1,  'Consistent month; strong ownership of the release.'),
    (2,  'Reliable delivery and clear communication with QA.'),
    (3,  'Improved test coverage and raised issues early.'),
    (5,  'Good collaboration across the platform team.'),
    (6,  'Thoughtful design work and receptive to feedback.'),
    (8,  'Strong visual polish and dependable handoffs.'),
    (9,  'Built trust with accounts and documented handoffs well.'),
    (11, 'Good outbound energy; still building qualification depth.'),
    (13, 'Steady financial controls and helpful month-end support.'),
    (14, 'Clear analysis and quicker turnaround this month.')
  ) v(idx, comments) loop
    select id into v_emp from _demo_emp where idx = r.idx;
    insert into public.feedback_reviews (
      company_id, subject_employee_id, reviewer_user_id,
      period_start, period_end, comments, status, created_at
    ) values (
      v_company, v_emp, v_hr_user,
      date_trunc('month', v_today - interval '1 month')::date,
      (date_trunc('month', v_today) - interval '1 day')::date,
      r.comments, 'submitted',
      now() - make_interval(days => 2 + r.idx)
    ) returning id into v_review;

    insert into public.feedback_ratings (review_id, criterion, score) values
      (v_review, 'punctuality',              7 + (r.idx % 4)),
      (v_review, 'attendance_consistency',   7 + ((r.idx + 1) % 4)),
      (v_review, 'teamwork_collaboration',   8 + (r.idx % 3)),
      (v_review, 'adaptability',             7 + ((r.idx + 2) % 4)),
      (v_review, 'accountability',           8 + ((r.idx + 1) % 3));
  end loop;

  -- -----------------------------------------------------------------------
  -- 15. QR Displays (1 Online with device key, 1 Stale, 1 Disabled)
  -- -----------------------------------------------------------------------
  -- device_secret_hash for 'vorldx-demo-kiosk-secret-2026'
  -- sha256: 7d65c36f56e9c4058d867c4e57849e7b233e70d49911e3b5e408ecbbcf8bc31e
  insert into public.qr_displays (
    company_id, display_name, office_name, is_active, paired_at, last_seen_at, device_secret_hash
  ) values (
    v_company, 'DEMO - HQ Lobby', 'VorldX HQ', true,
    now() - interval '30 days', now() - interval '20 seconds',
    '7d65c36f56e9c4058d867c4e57849e7b233e70d49911e3b5e408ecbbcf8bc31e'
  ) returning id into v_hq_lobby_id;

  insert into public.qr_displays (
    company_id, display_name, office_name, is_active, paired_at, last_seen_at
  ) values
    (v_company, 'DEMO - Design Studio', 'VorldX HQ', true,  now() - interval '12 days', now() - interval '7 minutes'),
    (v_company, 'DEMO - Sales Floor',   'VorldX Annex', false, now() - interval '60 days', now() - interval '2 days');

  -- -----------------------------------------------------------------------
  -- 16. Audit Log Stream
  -- -----------------------------------------------------------------------
  insert into public.audit_logs (company_id, actor_user_id, action, entity_type, entity_id, created_at, new_values)
  values
    (v_company, v_admin_user, 'wfh.passcode_generated', 'wfh_passcode', v_qa_employee::text, now() - interval '1 hour', jsonb_build_object('code', '482915', 'recipient', 'QA Alpha Employee')),
    (v_company, v_admin_user, 'wfh.passcode_generated', 'wfh_passcode', v_qa_employee::text, now() - interval '2 days', jsonb_build_object('code', '482915')),
    (v_company, v_admin_user, 'employee.created', 'employee', v_qa_employee::text, now() - interval '3 days', jsonb_build_object('code', 'EMP-780562')),
    (v_company, v_admin_user, 'hr.created', 'employee', v_hr_employee::text, now() - interval '3 days', jsonb_build_object('code', 'HR-780668')),
    (v_company, v_admin_user, 'company.created', 'company', v_company::text, now() - interval '4 days', jsonb_build_object('slug', 'p5a-20261021a-alpha'));

  raise notice 'Full QA seed complete for company % (HQ Lobby ID: %)', v_company, v_hq_lobby_id;
end;
$$;

-- Verification Snapshot
select jsonb_build_object(
  'total_employees', (select count(*) from public.employees where company_id = (select id from public.companies where slug = 'p5a-20261021a-alpha') and is_active),
  'demo_employees', (select count(*) from public.employees where company_id = (select id from public.companies where slug = 'p5a-20261021a-alpha') and employee_code like 'DEMO-%'),
  'attendance_records', (select count(*) from public.attendance_records where company_id = (select id from public.companies where slug = 'p5a-20261021a-alpha')),
  'today_checked_in', (select count(*) from public.attendance_records where company_id = (select id from public.companies where slug = 'p5a-20261021a-alpha') and work_date = (now() at time zone 'Asia/Kolkata')::date),
  'wfh_requests_pending', (select count(*) from public.wfh_requests where company_id = (select id from public.companies where slug = 'p5a-20261021a-alpha') and status = 'pending'),
  'leave_requests_pending', (select count(*) from public.leave_requests where company_id = (select id from public.companies where slug = 'p5a-20261021a-alpha') and status = 'pending'),
  'feedback_reviews', (select count(*) from public.feedback_reviews where company_id = (select id from public.companies where slug = 'p5a-20261021a-alpha')),
  'qr_displays', (select count(*) from public.qr_displays where company_id = (select id from public.companies where slug = 'p5a-20261021a-alpha')),
  'active_wfh_passcode_today', (
    select count(*) from public.wfh_passcodes p
    join public.employees e on e.id = p.employee_id
    where e.employee_code = 'EMP-780562'
      and p.work_date = (now() at time zone 'Asia/Kolkata')::date
      and p.used_at is null
  )
) as full_seed_summary;
