# Demo data and dashboard verification

This document covers the HR/Admin dashboard demo for the existing QA company. The data is
isolated, re-runnable, and removable without touching the original QA records or auth users.

## Credentials

Web app (HR/Admin): `http://localhost:5173` while the Vite dev server is running.

| Role | Email | Password |
| --- | --- | --- |
| Admin | `p5a-20261021a-a-admin@example.com` | `QaTest!2345` |
| HR | `p5a-20261021a-a-hr@example.com` | `QaTest!2345` |
| Employee (mobile only) | `p5a-20261021a-a-emp@example.com` | `QaTest!2345` |

The demo company is **QA Alpha p5a-20261021a** (`p5a-20261021a-alpha`), timezone
`Asia/Kolkata`. It is the existing QA company, not a production company.

The employee account is intentionally employee-only. It cannot load the HR/Admin dashboard:
the metrics RPC returns `FORBIDDEN` for the employee role and is not executable by `anon`.

## Files

| File | Purpose |
| --- | --- |
| `supabase/migrations/008a_dashboard_metrics.sql` | Read-only dashboard aggregate RPC (`get_dashboard_metrics`) and its role checks. |
| `supabase/migrations/009a_employee_ownership.sql` | Adds `employees.created_by`, backfills it from the audit trail, and enforces HR ownership on WFH, leave, and feedback reviews. |
| `supabase/migrations/010a_request_read_hardening.sql` | Scopes WFH/leave read RLS to the same ownership rule and guards WFH passcode generation. |
| `supabase/seed/demo_dashboard_data.sql` | Re-runnable demo seed. Adds 16 `DEMO-` employees and their attendance, WFH, leave, feedback, and QR display rows. Demo employees are assigned to the demo HR. |
| `supabase/seed/demo_dashboard_cleanup.sql` | Removes only the rows created by the demo seed. Leaves the original QA rows and auth users intact. |

The seed is idempotent: it deletes its previous `DEMO-` employees/QR displays and HR demo
requests before recreating them. No auth users or memberships are created by the seed.

## Apply the demo

### Supabase SQL Editor

Open the project SQL editor and run, in order:

1. `supabase/seed/demo_dashboard_cleanup.sql` (optional, if an older demo is present)
2. `supabase/seed/demo_dashboard_data.sql`

### Supabase CLI

From the repository root:

```powershell
npx supabase db query --linked -f supabase/seed/demo_dashboard_data.sql
```

Remove the demo:

```powershell
npx supabase db query --linked -f supabase/seed/demo_dashboard_cleanup.sql
```

Re-run the seed immediately before a walkthrough to reset relative dates and QR heartbeats.

## What the seed adds

Snapshot from the 23 Oct 2026 seed (run just after midnight IST):

- 16 active demo employees across Engineering (5), Design (3), Sales (4), Finance (2), and
  People Ops (2). They are roster-only; none have auth accounts.
- 1,333 attendance records over the last 180 days (weekdays only, starting at each employee's
  joining date). The extra history also gives the 90-day view a real preceding 90-day period.
- 13 WFH requests: approved today, awaiting today, pending employee requests, and reviewed
  history. Two HR requests are attached to the real HR QA account and are visible only to Admin.
- 7 leave requests: approved today, pending employee requests, and reviewed history.
- 10 submitted feedback reviews with five ratings each.
- 3 QR displays: one online, one stale, and one disabled at seed time.

Existing QA rows remain: 2 employee records created by earlier QA work, 2 WFH requests, 2 leave
requests, and 1 feedback review. That is why the dashboard counts are slightly larger than the
demo seed alone.

### Ownership and role filters

- All 16 `DEMO-` employees have `created_by` set to the demo HR. The HR's **Employees added by
  me**, **Team attendance → Employees added by me**, WFH, leave, and feedback views therefore
  include them.
- Two employee-role records created by Admin are **shared**. Every HR can view and review them.
  The same fallback applies to any employee with no active-HR creator, or whose creator HR is
  deactivated. (The Admin and HR roster rows themselves also have no creator, but they are not
  part of the employee review queues.)
- Admin can review any employee. An HR reviewing another active HR's employee is blocked by the
  database with `EMPLOYEE_OWNED_BY_ANOTHER_HR`; HR-to-HR reviews remain Admin-only.
- Admin WFH and Admin Leave list only HR requests. Admin Feedback lists only active HRs as
  subjects. The HR pages list only employee-role rows, scoped to the HR's own plus shared records.
- The web filters mirror these rules, but the review functions are the enforcement point. The HR
  directory's **All people** and team-attendance **Employees** filters intentionally list all
  employee-role records; only **Employees added by me** is ownership-scoped, and review actions
  remain ownership-protected.

## Expected values

These are the values produced by the seed on **Friday, 23 October 2026 shortly after midnight
IST**, before the 09:25 check-in window. Weekday distribution and month boundaries can move a
few counts if the seed is run on another date. All rates exclude today (a partial day); today
has live metrics.

### Headcount

| Metric | Value |
| --- | --- |
| Employees | 18 |
| HR / Admin | 1 / 1 |
| Total staff | 20 |
| Departments | 5 |
| New joiners this month | 4 |
| Unactivated employee records | 16 (expected; demo employees have no logins and this is not shown as a KPI) |

### Today

| Metric | Value |
| --- | --- |
| Expected | 18 |
| Checked in | 0 |
| On time / late | 0 / 0 |
| WFH checked in | 0 |
| Approved leave | 1 |
| No check-in | 17 |
| WFH approved but awaiting check-in | 3 |
| Still in (no checkout yet) | 0 |

The three "awaiting" rows are Diya Sharma, Ishaan Verma, and Priya Menon. Today's demo attendance
rows are only inserted after 09:25 company-local time; run the seed later in the day to see live
check-ins on the dashboard.

### Approval queues

| Metric | Value |
| --- | --- |
| Total pending | 10 |
| Employee pending | 8 (5 WFH, 3 leave) |
| HR pending | 2 (1 WFH, 1 leave) |
| Oldest employee request | 57.9 hours (~58h) |
| Oldest HR request | 43.9 hours (~44h) |

### Attendance ranges

| Metric | 7 days | 30 days | 90 days |
| --- | ---: | ---: | ---: |
| Expected | 67 | 316 | 827 |
| Checked in | 59 | 295 | 778 |
| On time | 55 | 280 | 733 |
| Late | 4 | 15 | 45 |
| Office / WFH check-ins | 49 / 10 | 249 / 46 | 665 / 113 |
| WFH share | 16.9% | 15.6% | 14.5% |
| Attendance rate | 88.1% | 93.4% | 94.1% |
| On-time rate | 93.2% | 94.9% | 94.2% |
| Median day | 8h 53m | 8h 55m | 8h 55m |
| No check-in | 8 | 21 | 49 |
| Missing checkouts | 0 | 1 | 17 |
| Previous attendance rate | 94.7% | 94.6% | 94.7% |
| Previous on-time rate | 95.8% | 93.9% | 94.6% |

The trend chart shows completed working days and is capped at the latest 30 calendar days, even
for the 90-day view. The 90-day KPI now shows 94.1% versus 94.7% for the previous period.

The 30-day attendance mix is 236 office on-time, 13 office late, 44 WFH on-time, and 2 WFH late.

### Current month

| Metric | Value |
| --- | --- |
| Approved leave | 4 / 54 employee-days |
| WFH check-ins | 37 |
| Feedback reviews | 11 |
| Feedback coverage | 61.1% (11 of 18 employees) |
| Average feedback score | 8.7 / 10 |

Range leave days are 0 on purpose. The schema rejects backdated leave (`leave_date >= today - 1`),
so historical leave could not be seeded; leave health uses the current month instead.

### Approvals and HR activity

| Metric | 7 days | 30 / 90 days |
| --- | ---: | ---: |
| Completed by HR | 4 | 14 |
| Completed total | 7 | 18 |
| Median response | 15h | 7h |
| Manual attendance corrections | 0 | 0 |

### Department footprint (30 days)

| Department | Headcount | Attendance rate |
| --- | ---: | ---: |
| Engineering | 7 | 90.8% |
| Sales | 4 | 96.4% |
| Design | 3 | 95.2% |
| Finance | 2 | 92.9% |
| People Ops | 2 | 88.9% |

## How the metrics are defined

- `checked_in`: attendance records on expected working days.
- `on_time`: attendance with `status = 'present'`.
- `late`: attendance with `status = 'late'`.
- `no_check_in = expected - checked_in - approved_leave`. The UI never calls this "absent".
- Expected days come from the active shift's `working_days` and each employee's joining date.
  Attendance before joining or outside expected days is excluded.
- Dates use the company timezone. Rates exclude today so a partial day cannot lower the rate.
- Attendance covers active `employee` members only. HR and Admin are counted in headcount but not
  in attendance rates.
- The RPC is `security definer`, requires an active HR/Admin membership, and is granted only to
  `authenticated`.

## Verification

Run this to confirm the demo isolation and row counts:

```sql
select jsonb_build_object(
  'demo_employees', (
    select count(*) from public.employees
    where employee_code like 'DEMO-%' and is_active
  ),
  'demo_attendance', (
    select count(*) from public.attendance_records a
    join public.employees e on e.id = a.employee_id
    where e.employee_code like 'DEMO-%'
  ),
  'demo_wfh_requests', (
    select count(*) from public.wfh_requests r
    join public.employees e on e.id = r.employee_id
    where e.employee_code like 'DEMO-%'
  ),
  'demo_leave_requests', (
    select count(*) from public.leave_requests r
    join public.employees e on e.id = r.employee_id
    where e.employee_code like 'DEMO-%'
  ),
  'demo_feedback_reviews', (
    select count(*) from public.feedback_reviews f
    join public.employees e on e.id = f.subject_employee_id
    where e.employee_code like 'DEMO-%'
  ),
  'demo_qr_displays', (
    select count(*) from public.qr_displays
    where display_name like 'DEMO - %'
  ),
  'demo_owned_by_active_hr', (
    select count(*) from public.employees e
    join public.company_memberships m
      on m.company_id = e.company_id
     and m.user_id = e.created_by
     and m.role = 'hr'
     and m.status = 'active'
    where e.employee_code like 'DEMO-%' and e.is_active
  )
) as demo_counts;
```

Expected after a seed: 16 employees, 1,333 attendance rows, 13 demo WFH requests, 7 demo leave
requests, 10 demo feedback reviews, 3 demo QR displays, and all 16 demo employees owned by an
active HR. After cleanup: 0 demo employees, 0 demo QR displays, and the original QA rows remain.

With the demo seed plus the existing QA rows, the final directory has 20 staff records: 1 Admin,
1 HR, and 18 employees. HR's **Employees added by me** filter shows 16; the two Admin-created
employee-role records are shared. The HR sees 18 employee-role records in **All people**
and **Employees**, 15 WFH requests, 9 leave requests, and 18 feedback candidates. Admin sees 2 HR
WFH requests total (1 pending, 1 approved), 2 HR leave requests total (1 pending, 1 rejected), and
1 HR feedback subject.

Sign in as HR or Admin and use the 7d / 30d / 90d toggle to compare the dashboard values above.
The Admin page shows the company roll-up plus HR approval oversight and audit activity; the HR
page shows the same employee data and the HR approval queue.

## Time-dependent caveats

- **QR online status decays.** The seed sets one display to "online", one to "stale", and one to
  disabled. After a couple of minutes the online display becomes stale, then offline. Re-run the
  seed immediately before a demo to reset it.
- **Today's attendance is time-gated.** Before 09:25 IST there are no demo check-ins for today,
  so the live KPI will show 0 checked in even though expected is 18.
- **Rates are historical.** The 7/30/90-day rates exclude today. The today cards are the live
  snapshot and will differ from the range rates.
- **Seed relative dates.** Re-seeding on a weekend or near a month boundary changes the working
  day count and may shift totals by a few rows. The structure and definitions stay the same.
