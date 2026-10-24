-- VorldX demo dashboard data
-- ---------------------------------------------------------------------------
-- Targets the existing QA company only (slug: p5a-20261021a-alpha).
-- Everything created here is removable:
--   * employees with employee_code like 'DEMO-%'
--   * their attendance / WFH / leave / feedback rows (cascade on employee delete)
--   * QR displays whose display_name starts with 'DEMO - '
-- No auth users, memberships, existing employees, or real records are touched.
--
-- Safe to re-run: previous DEMO rows are removed first, then recreated.
-- Dates are relative to the company's current date, so the dashboard stays current.
-- Today's attendance rows are inserted only after 09:25 company-local time and
-- only for demo employees. Existing QA employee records are left alone.

do $$
declare
  v_company uuid;
  v_tz text;
  v_shift uuid;
  v_hr_user uuid;
  v_admin_user uuid;
  v_today date;
  v_now_local timestamp;
  v_hr_employee uuid;
  v_emp uuid;
  v_review uuid;
  v_req_date date;
  v_leave_date date;
  v_reviewed timestamptz;
  v_created timestamptz;
  v_dow int;
  r record;
begin
  select id, timezone into v_company, v_tz
  from public.companies
  where slug = 'p5a-20261021a-alpha' and is_active;

  if v_company is null then
    raise exception 'DEMO_COMPANY_NOT_FOUND: expected slug p5a-20261021a-alpha';
  end if;

  select id into v_shift
  from public.shifts
  where company_id = v_company and is_active
  order by created_at
  limit 1;

  select user_id into v_hr_user
  from public.company_memberships
  where company_id = v_company and role = 'hr' and status = 'active'
  limit 1;

  select user_id into v_admin_user
  from public.company_memberships
  where company_id = v_company and role = 'admin' and status = 'active'
  limit 1;

  if v_shift is null or v_hr_user is null or v_admin_user is null then
    raise exception 'DEMO_PREREQUISITES_MISSING: shift, HR user, or Admin user not found';
  end if;

  v_today := (now() at time zone v_tz)::date;
  v_now_local := now() at time zone v_tz;

  -- -----------------------------------------------------------------------
  -- Remove a previous demo seed. Employee children cascade.
  -- -----------------------------------------------------------------------
  delete from public.qr_displays
  where company_id = v_company and display_name like 'DEMO - %';

  delete from public.employees
  where company_id = v_company and employee_code like 'DEMO-%';

  -- HR is a real QA account, so its demo requests are not removed by the
  -- employee cascade. Remove only rows created by this seed.
  delete from public.wfh_requests
  where company_id = v_company
    and employee_id in (
      select id from public.employees
      where company_id = v_company and user_id = v_hr_user
    )
    and reason like 'HR demo%';

  delete from public.leave_requests
  where company_id = v_company
    and employee_id in (
      select id from public.employees
      where company_id = v_company and user_id = v_hr_user
    )
    and reason like 'HR demo%';

  drop table if exists _demo_emp;
  create temporary table _demo_emp on commit drop as
  select (regexp_replace(employee_code, '\D', '', 'g'))::int as idx,
         id, joining_date
  from public.employees
  where company_id = v_company and employee_code like 'DEMO-%';

  -- -----------------------------------------------------------------------
  -- 16 demo employees. None have auth users; they are roster-only.
  -- -----------------------------------------------------------------------
  insert into public.employees (
    company_id, user_id, employee_code, full_name, email, department,
    designation, joining_date, shift_id, work_type, is_active
  ) values
    (v_company, null, 'DEMO-001', 'Aarav Mehta',    'demo.aarav.mehta@example.com',    'Engineering', 'Senior Software Engineer', v_today - 420, v_shift, 'hybrid', true),
    (v_company, null, 'DEMO-002', 'Diya Sharma',    'demo.diya.sharma@example.com',    'Engineering', 'Software Engineer',        v_today - 350, v_shift, 'office', true),
    (v_company, null, 'DEMO-003', 'Kabir Nair',     'demo.kabir.nair@example.com',     'Engineering', 'QA Engineer',              v_today - 300, v_shift, 'office', true),
    (v_company, null, 'DEMO-004', 'Ananya Rao',     'demo.ananya.rao@example.com',     'Engineering', 'Frontend Engineer',        v_today - 250, v_shift, 'hybrid', true),
    (v_company, null, 'DEMO-005', 'Rohan Iyer',     'demo.rohan.iyer@example.com',     'Engineering', 'Backend Engineer',         v_today - 180, v_shift, 'office', true),
    (v_company, null, 'DEMO-006', 'Meera Kapoor',   'demo.meera.kapoor@example.com',   'Design',      'Product Designer',         v_today - 150, v_shift, 'hybrid', true),
    (v_company, null, 'DEMO-007', 'Ishaan Verma',   'demo.ishaan.verma@example.com',   'Design',      'UX Researcher',            v_today - 120, v_shift, 'office', true),
    (v_company, null, 'DEMO-008', 'Sana Khan',      'demo.sana.khan@example.com',      'Design',      'Visual Designer',          v_today - 60,  v_shift, 'hybrid', true),
    (v_company, null, 'DEMO-009', 'Aditya Bose',    'demo.aditya.bose@example.com',    'Sales',       'Account Executive',        v_today - 500, v_shift, 'office', true),
    (v_company, null, 'DEMO-010', 'Nisha Patel',    'demo.nisha.patel@example.com',    'Sales',       'Sales Manager',            v_today - 380, v_shift, 'office', true),
    (v_company, null, 'DEMO-011', 'Arjun Singh',    'demo.arjun.singh@example.com',    'Sales',       'Sales Development Rep',    v_today - 90,  v_shift, 'office', true),
    (v_company, null, 'DEMO-012', 'Priya Menon',    'demo.priya.menon@example.com',    'Sales',       'Customer Success Manager', v_today - 45,  v_shift, 'hybrid', true),
    (v_company, null, 'DEMO-013', 'Vikram Joshi',   'demo.vikram.joshi@example.com',   'Finance',     'Finance Manager',          v_today - 600, v_shift, 'office', true),
    (v_company, null, 'DEMO-014', 'Tanvi Desai',    'demo.tanvi.desai@example.com',    'Finance',     'Financial Analyst',        v_today - 32,  v_shift, 'office', true),
    (v_company, null, 'DEMO-015', 'Neha Kulkarni',  'demo.neha.kulkarni@example.com',  'People Ops',  'HR Partner',               v_today - 21,  v_shift, 'office', true),
    (v_company, null, 'DEMO-016', 'Dev Malhotra',   'demo.dev.malhotra@example.com',   'People Ops',  'Talent Acquisition',       v_today - 3,   v_shift, 'hybrid', true);

  -- Demo employees are owned by the demo HR so the ownership filters have data.
  update public.employees
  set created_by = v_hr_user
  where company_id = v_company and employee_code like 'DEMO-%';

  create temporary table _demo_emp_new on commit drop as
  select (regexp_replace(employee_code, '\D', '', 'g'))::int as idx,
         id, joining_date
  from public.employees
  where company_id = v_company and employee_code like 'DEMO-%';

  delete from _demo_emp;
  insert into _demo_emp select * from _demo_emp_new;
  drop table _demo_emp_new;

  -- -----------------------------------------------------------------------
  -- Historical attendance: weekdays, last 180 days (or since joining).
  -- 180 days gives the 90-day dashboard a real preceding 90-day comparison.
  -- Deterministic patterns keep the demo reproducible.
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
  -- Today, live only. Fixed, believable check-in times. No check-outs yet.
  -- -----------------------------------------------------------------------
  if extract(isodow from v_today) between 1 and 5 and v_now_local::time >= time '09:25' then
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
    where d.idx not in (4, 8, 12, 16)  -- no-show x2, approved leave, WFH awaiting
      and ((v_today + case
              when d.idx in (5, 11) then time '09:15' + make_interval(mins => (d.idx * 3) % 15)
              else time '08:54' + make_interval(mins => (d.idx * 2) % 9)
            end)::timestamp at time zone v_tz) <= now() - interval '2 minutes'
    on conflict (company_id, employee_id, work_date) do nothing;
  end if;

  -- -----------------------------------------------------------------------
  -- Today's approved WFH (2 checked in, 1 still awaiting) and leave (1).
  -- -----------------------------------------------------------------------
  if extract(isodow from v_today) between 1 and 5 then
    for r in select * from (values (2), (7), (12)) v(idx) loop
      select id into v_emp from _demo_emp where idx = r.idx;
      insert into public.wfh_requests (
        company_id, employee_id, request_date, reason, status,
        reviewed_by, reviewed_at, review_notes, created_at
      ) values (
        v_company, v_emp, v_today,
        'Demo approved WFH day for dashboard coverage.',
        'approved', v_hr_user, now() - interval '3 hours',
        'Approved (demo data).', now() - interval '1 day 2 hours'
      );
    end loop;

    select id into v_emp from _demo_emp where idx = 8;
    insert into public.leave_requests (
      company_id, employee_id, leave_date, reason, status,
      reviewed_by, reviewed_at, review_notes, created_at
    ) values (
      v_company, v_emp, v_today,
      'Demo approved personal leave for dashboard coverage.',
      'approved', v_hr_user, now() - interval '2 days',
      'Approved (demo data).', now() - interval '2 days 6 hours'
    );
  end if;

  -- Note: the schema allows leave dates no earlier than yesterday, so demo
  -- leave is representative of the current month rather than backdated 90 days.

  -- -----------------------------------------------------------------------
  -- Pending employee requests: 4 WFH + 2 leave. These appear in the HR queue.
  -- -----------------------------------------------------------------------
  for r in select * from (values
    (1, 1, 'wfh',   5),
    (3, 2, 'wfh',  19),
    (6, 4, 'wfh',  44),
    (9, 5, 'wfh',   3),
    (2, 2, 'leave', 26),
    (7, 6, 'leave',  8)
  ) v(idx, off, kind, age_hours) loop
    select id into v_emp from _demo_emp where idx = r.idx;
    v_req_date := v_today + r.off;
    if r.kind = 'wfh' then
      insert into public.wfh_requests (
        company_id, employee_id, request_date, reason, status, created_at
      ) values (
        v_company, v_emp, v_req_date,
        'Demo pending WFH request for approval-queue coverage.',
        'pending', now() - make_interval(hours => r.age_hours)
      );
    else
      insert into public.leave_requests (
        company_id, employee_id, leave_date, reason, status, created_at
      ) values (
        v_company, v_emp, v_req_date,
        'Demo pending leave request for approval-queue coverage.',
        'pending', now() - make_interval(hours => r.age_hours)
      );
    end if;
  end loop;

  -- -----------------------------------------------------------------------
  -- Pending HR requests: these are visible only to Admin.
  -- -----------------------------------------------------------------------
  select id into v_hr_employee
  from public.employees
  where company_id = v_company and user_id = v_hr_user and is_active
  limit 1;

  if v_hr_employee is not null then
    insert into public.wfh_requests (
      company_id, employee_id, request_date, reason, status, created_at
    ) values (
      v_company, v_hr_employee, v_today + 2,
      'HR demo WFH request awaiting Admin review.',
      'pending', now() - interval '30 hours'
    );
    insert into public.leave_requests (
      company_id, employee_id, leave_date, reason, status, created_at
    ) values (
      v_company, v_hr_employee, v_today + 4,
      'HR demo leave request awaiting Admin review.',
      'pending', now() - interval '6 hours'
    );
  end if;

  -- -----------------------------------------------------------------------
  -- Reviewed history, so approval response-time and HR activity are real.
  -- 6 employee WFH + 4 employee leave reviewed by HR; 1 HR WFH + 1 HR leave
  -- reviewed by Admin.
  -- -----------------------------------------------------------------------
  for r in select * from (values
    (5, 3, 'wfh', 'approved'),
    (10, 4, 'wfh', 'rejected'),
    (13, 5, 'wfh', 'approved'),
    (15, 6, 'wfh', 'rejected'),
    (11, 7, 'wfh', 'approved'),
    (14, 8, 'wfh', 'rejected'),
    (1, 3, 'leave', 'approved'),
    (6, 5, 'leave', 'approved'),
    (9, 6, 'leave', 'rejected'),
    (3, 7, 'leave', 'rejected')
  ) v(idx, off, kind, decision) loop
    select id into v_emp from _demo_emp where idx = r.idx;
    v_req_date := v_today + r.off;
    v_reviewed := now() - make_interval(days => r.off * 2) - interval '3 hours';
    v_created := v_reviewed - make_interval(hours => 2 + r.off);

    if r.kind = 'wfh' then
      insert into public.wfh_requests (
        company_id, employee_id, request_date, reason, status,
        reviewed_by, reviewed_at, review_notes, created_at
      ) values (
        v_company, v_emp, v_req_date,
        'Demo reviewed WFH request for response-time metrics.',
        r.decision, v_hr_user, v_reviewed, 'Reviewed (demo data).', v_created
      );
    else
      insert into public.leave_requests (
        company_id, employee_id, leave_date, reason, status,
        reviewed_by, reviewed_at, review_notes, created_at
      ) values (
        v_company, v_emp, v_req_date,
        'Demo reviewed leave request for response-time metrics.',
        r.decision, v_hr_user, v_reviewed, 'Reviewed (demo data).', v_created
      );
    end if;
  end loop;

  if v_hr_employee is not null then
    v_reviewed := now() - interval '4 days 2 hours';
    insert into public.wfh_requests (
      company_id, employee_id, request_date, reason, status,
      reviewed_by, reviewed_at, review_notes, created_at
    ) values (
      v_company, v_hr_employee, v_today + 3,
      'HR demo WFH request reviewed by Admin.',
      'approved', v_admin_user, v_reviewed, 'Approved by Admin (demo).',
      v_reviewed - interval '7 hours'
    );

    v_reviewed := now() - interval '9 days 5 hours';
    insert into public.leave_requests (
      company_id, employee_id, leave_date, reason, status,
      reviewed_by, reviewed_at, review_notes, created_at
    ) values (
      v_company, v_hr_employee, v_today + 5,
      'HR demo leave request reviewed by Admin.',
      'rejected', v_admin_user, v_reviewed, 'Rejected by Admin (demo).',
      v_reviewed - interval '3 hours'
    );
  end if;

  -- -----------------------------------------------------------------------
  -- Feedback: 10 submitted reviews for demo employees, previous month.
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
  -- QR display health: 1 online, 1 stale, 1 disabled/offline.
  -- -----------------------------------------------------------------------
  insert into public.qr_displays (
    company_id, display_name, office_name, is_active, paired_at, last_seen_at
  ) values
    (v_company, 'DEMO - HQ Lobby',     'VorldX HQ',   true,  now() - interval '30 days', now() - interval '20 seconds'),
    (v_company, 'DEMO - Design Studio','VorldX HQ',   true,  now() - interval '12 days', now() - interval '7 minutes'),
    (v_company, 'DEMO - Sales Floor',  'VorldX Annex',false, now() - interval '60 days', now() - interval '2 days');

  raise notice 'Demo seed complete for % (% employees).',
    v_company,
    (select count(*) from _demo_emp);
end;
$$;

-- Verification snapshot -----------------------------------------------------
select jsonb_build_object(
  'demo_employees', (select count(*) from public.employees where employee_code like 'DEMO-%' and is_active),
  'demo_attendance', (select count(*) from public.attendance_records a join public.employees e on e.id = a.employee_id where e.employee_code like 'DEMO-%'),
  'demo_wfh_requests', (select count(*) from public.wfh_requests r join public.employees e on e.id = r.employee_id where e.employee_code like 'DEMO-%'),
  'demo_leave_requests', (select count(*) from public.leave_requests r join public.employees e on e.id = r.employee_id where e.employee_code like 'DEMO-%'),
  'demo_feedback_reviews', (select count(*) from public.feedback_reviews f join public.employees e on e.id = f.subject_employee_id where e.employee_code like 'DEMO-%'),
  'demo_qr_displays', (select count(*) from public.qr_displays where display_name like 'DEMO - %')
) as demo_seed_counts;
