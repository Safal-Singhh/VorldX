-- VorldX 008a: dashboard metrics
-- One read-only, company-scoped payload for the HR and Admin dashboards.
-- Definitions:
--   * "employees" = active employees whose active membership role is 'employee'
--     (HR/Admin also have employee rows, but are excluded from team attendance metrics)
--   * expected = active employee, joined by that date, and their shift includes that weekday
--   * on time = attendance.status 'present'; late = attendance.status 'late'
--   * no check-in = expected - checked in - approved leave (never call this "absent")
--   * rates exclude today (partial day) and use completed days only
--   * all dates are calculated in the company's timezone

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
           e.joining_date, e.shift_id
    from public.employees e
    left join public.company_memberships m
      on m.company_id = e.company_id
     and m.user_id = e.user_id
     and m.status = 'active'
    where e.company_id = p_company_id
      and e.is_active
      and coalesce(m.role, 'employee') = 'employee'
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
      greatest(coalesce(ed.expected, 0) - coalesce(ad.checked_in, 0) - coalesce(ld.on_leave, 0), 0) as no_check_in,
      case
        when coalesce(ed.expected, 0) - coalesce(ld.on_leave, 0) > 0
          then round(100.0 * coalesce(ad.checked_in, 0) / (coalesce(ed.expected, 0) - coalesce(ld.on_leave, 0)), 1)
        else null
      end as rate
    from (select distinct d from dates) cal
    left join expected_daily ed on ed.d = cal.d
    left join att_daily ad on ad.d = cal.d
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
    where r.company_id = p_company_id and r.status = 'pending'
    union all
    select 'leave'::text, r.id, r.employee_id, s.full_name,
           s.employee_code, s.department, r.leave_date, r.created_at,
           s.role,
           round(extract(epoch from (now() - r.created_at)) / 3600.0, 1)
    from public.leave_requests r
    join staff_scope s on s.id = r.employee_id
    where r.company_id = p_company_id and r.status = 'pending'
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
      coalesce(sum(checked_in), 0)::int as checked_in
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
      'employees', (select count(*) from emp_scope),
      'hr', (select count(*) from public.company_memberships m where m.company_id = p_company_id and m.status = 'active' and m.role = 'hr'),
      'admins', (select count(*) from public.company_memberships m where m.company_id = p_company_id and m.status = 'active' and m.role = 'admin'),
      'total_staff', (select count(*) from staff_scope),
      'unactivated', (select count(*) from emp_scope where user_id is null),
      'new_joiners', (select count(*) from emp_scope where joining_date >= v_month_start),
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
          'checked_in', p.checked_in
        ) from previous p
      ),
      'trend', coalesce((
        select jsonb_agg(to_jsonb(x) order by x.date)
        from (
          select d as date, expected, checked_in, on_time, late, office, wfh,
                 office_on_time, office_late, wfh_on_time, wfh_late,
                 on_leave, no_check_in, rate
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
                 case when coalesce(ep.expected, 0) - coalesce(dl.on_leave, 0) > 0
                   then round(100.0 * coalesce(a.checked_in, 0) / (coalesce(ep.expected, 0) - coalesce(dl.on_leave, 0)), 1)
                   else null end as attendance_rate
          from dept_headcount h
          left join dept_expected ep on ep.department = h.department
          left join dept_att a on a.department = h.department
          left join dept_leave dl on dl.department = h.department
        ) x
      ), '[]'::jsonb)
    ),
    'month', jsonb_build_object(
      'leave_days', (select leave_days from month_leave),
      'leave_allowance', (select count(*) * 3 from emp_scope),
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
  'Read-only company dashboard payload for active HR/Admin callers (see 008a for metric definitions).';
