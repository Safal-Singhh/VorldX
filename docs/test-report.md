# Test Report

Critical security and business-rule checks for the VorldX Attendance System.

- Date: 2026-10-21 (Phase 5a baseline); 2026-10-23 (ownership/filter addendum, section 17);
  2026-10-24 (auto-absence addendum, section 18)
- Supabase project: `bcugjofjfdzahaleuzyt`
- Scope: Phase 5a baseline, Phase 5b ownership/filter QA, and shift-end auto-absence QA
- Environment: hosted Supabase project, real JWTs, real edge functions
- Production tenant `vorldx`: not touched

## 1. What was tested

Phase 5a covers the checks most likely to cause a security or payroll error:

- AC-01: company signup and first admin
- AC-02: role checks and inactive accounts
- AC-03: employee record exists before first login
- AC-05: QR lifetime, device binding, token storage
- AC-06: one check-in and one check-out per day
- AC-07: late boundary and grace period
- AC-08: WFH request cutoff
- AC-09: WFH approval hierarchy
- AC-10: passcode issue, use, reuse, and concurrency
- AC-11: office and WFH conflict
- AC-13: feedback fields and score limits
- AC-14: feedback access
- AC-15: row-level security and role escalation
- AC-16: audit entries

Not covered in this pass:

- AC-04 (mobile biometrics) because the employee app does not exist yet
- AC-12 (filter consistency) in the Phase 5a baseline because it is a visual/UI check; the new
  ownership/role filters are covered in section 17
- AC-17 full scripted demo
- AC-18 final evaluation report
- Clicking real email links (reset, invite, signup confirmation)

## 2. Result

All executed checks passed. Two things need attention:

1. A deployment blocker was found and fixed locally: the web app was using the retired legacy anon key. PostgREST and the Functions gateway reject it. The publishable key is now in `apps/web/.env` and `.env.example`, and `apps/web/dist` was rebuilt. The hosting environment still needs the new value and a redeploy.
2. Several small findings are listed in section 8. None of them allowed cross-company access, role escalation, duplicate attendance, or unauthorized approval.

Test fixtures:

- Company A: `p5a-20261021a-alpha`, id `b04d522c-5a32-4b28-a9c1-fc89afef48d1`
- Company B: `p5a-20261021a-beta`, id `d0b9b042-960b-4b77-987e-aa2786594731`
- Users: admin, HR, employee, and second employee in A; admin and employee in B
- All QA users use `@example.com` addresses and were confirmed with SQL so the tests could sign in. This is a test-only shortcut.

The tests used transaction-wrapped SQL and real API calls. Every destructive test was rolled back or cleaned up. Final check: 0 attendance rows, 0 WFH requests, 0 passcodes, 0 feedback rows, 0 QR displays, and 0 QR sessions left behind.

## 3. AC-15: RLS and role escalation

Method: impersonated each user with `set local role authenticated` and a signed JWT claim, then queried the tables directly. Write attempts were made inside rolled-back transactions.

### Read isolation

| Check | Expected | Actual | Result |
|---|---:|---:|---|
| Admin A sees own employees | 4 | 4 | Pass |
| Admin A sees Company B employees | 0 | 0 | Pass |
| Admin A sees Company B attendance | 0 | 0 | Pass |
| Admin A sees Company B WFH requests | 0 | 0 | Pass |
| Admin A sees Company B feedback | 0 | 0 | Pass |
| Admin A sees Company B company row | 0 | 0 | Pass |
| Admin A sees Company B audit logs | 0 | 0 | Pass |
| HR A sees own employees | 4 | 4 | Pass |
| HR A sees Company B employees | 0 | 0 | Pass |
| HR A sees audit logs | 0 | 0 | Pass |
| HR A sees memberships | 1 (own only) | 1 | Pass |
| Employee A sees employees | 1 (self only) | 1 | Pass |
| Employee A sees memberships | 1 (own only) | 1 | Pass |
| Employee A sees audit logs | 0 | 0 | Pass |
| Employee A sees Company B employees | 0 | 0 | Pass |
| Employee A sees WFH passcodes | 0 | 0 | Pass |
| Employee 2 A sees employees | 1 (self only) | 1 | Pass |
| Anon sees employees | 0 | 0 | Pass |
| Anon sees companies | 0 | 0 | Pass |

### Write and escalation attempts

| Attempt | Expected | Actual | Result |
|---|---|---|---|
| Employee changes own membership role to `admin` | 0 rows | 0 rows | Pass |
| Employee edits own employee row | 0 rows | 0 rows | Pass |
| HR changes own membership role to `admin` | 0 rows | 0 rows | Pass |
| Employee inserts an attendance row directly | RLS error | `new row violates row-level security policy` | Pass |
| Employee calls `company_role(A)` | Own role | `employee` | Pass |
| Employee calls `company_role_map(A)` | Own company's role map | 4 rows | Pass |
| Cross-company employee calls `company_role(A)` | No data | `null` | Pass |
| Cross-company employee calls `company_role_map(A)` | No data | `[]` | Pass |
| Anon calls `company_role(A)` | No data | `null` | Pass |
| Anon calls `company_role_map(A)` | No data | `[]` | Pass |
| Anon calls `my_wfh_passcode(...)` | No data | `UNAUTHORIZED` | Pass |
| Employee passes another employee's id to the scan API | Rejected | `403 EMPLOYEE_MISMATCH` | Pass |

The cross-company scan attempt created no attendance row for the targeted employee. The real scan created one row for the caller only.

## 4. AC-05: QR sessions

Method: called the real `issue-office-qr` edge function with a device-bound display, then inspected the stored session.

| Check | Actual | Result |
|---|---|---|
| Token length | 64 hex characters | Pass |
| Requested lifetime | `expires_at` = now + 18s | Pass |
| Stored value | SHA-256 hash only; raw token not stored | Pass |
| Hash matches the returned token | Yes | Pass |
| Second issue within 5s | `RATE_LIMITED` | Pass |
| Issue after 5.2s | New token | Pass |
| Wrong device secret | `DEVICE_KEY_INVALID` | Pass |
| Missing device secret | `DEVICE_KEY_INVALID` | Pass |
| Inactive display | `DISPLAY_DISABLED` | Pass |
| Expiry greater than 60s | `INVALID_EXPIRY` | Pass |
| Expiry in the past | `INVALID_EXPIRY` | Pass |
| Token hash shorter than 16 chars | `INVALID_TOKEN_HASH` | Pass |
| Scan with an expired session | `QR_EXPIRED` | Pass |
| Scan with an unknown token | `QR_INVALID` | Pass |
| Scan with a valid issued token | Check-in recorded | Pass |

## 5. AC-06 and AC-07: attendance rules

### One check-in and one check-out per day (AC-06)

The shift was set so the scan was late, then the three calls were made in separate transactions:

1. First scan created an office check-in. `check_out_at` was null.
2. Second scan set `check_out_at`. The gap was 1.85 seconds and the record stayed a single row.
3. Third scan failed with `ALREADY_CHECKED_OUT`.

Result: pass. The database has one attendance row per employee per day.

### Late boundary (AC-07)

The shift start was moved relative to the transaction time so the boundary could be tested exactly:

| Local time relative to start + grace | Status |
|---|---|
| Exactly at the boundary | `present` |
| 1 second after the boundary | `late` |

Result: pass. The comparison is inclusive at the boundary, as the rule requires.

## 6. AC-08, AC-10, AC-11: WFH

### Request cutoff (AC-08)

The shift was moved so the 120-minute cutoff fell 2 minutes before or after the request time.

| Case | Result |
|---|---|
| Request 2 minutes before the deadline | Accepted |
| Employee request 2 minutes after the deadline | `CUTOFF_PASSED` |
| HR request 2 minutes after the deadline | `CUTOFF_PASSED` |

Result: pass. The cutoff applies to both roles.

### Passcode errors (AC-10)

| Case | Result |
|---|---|
| Unknown passcode | `PASSCODE_INVALID` |
| Passcode issued to another employee | `PASSCODE_WRONG_USER` |
| Expired passcode | `PASSCODE_EXPIRED` |
| Passcode for another date | `PASSCODE_WRONG_DATE` |
| Passcode already used twice | `PASSCODE_USED` |

### Passcode happy path

Through the real `mark-wfh-attendance` API with an employee JWT:

1. First use: check-in, `uses_left = 1`.
2. Second use: check-out, `uses_left = 0`.
3. Third use: `400 PASSCODE_USED`.

The record was WFH, the passcode `use_count` was 2, and both audit rows were written.

### Passcode concurrency

Setup: one employee already checked in with the passcode. Two API calls were then sent at the same time with that passcode.

| Outcome | Count |
|---|---:|
| Successful check-out | 1 |
| `PASSCODE_USED` | 1 |
| Attendance rows | 1 |
| Final `use_count` | 2 |

Result: pass. The `for update` lock serializes the two calls, so only one can consume the second use.

Note: the passcode is valid for two uses by design (check-in and check-out). See finding 8.4.

### Office and WFH conflict (AC-11)

| Order | Result |
|---|---|
| Office check-in first, then WFH passcode | `ATTENDANCE_EXISTS` |
| WFH check-in first, then office scan | `TYPE_CONFLICT` |

Result: pass in both directions.

## 7. AC-09: approval hierarchy

| Case | Result |
|---|---|
| HR reviews own request | `SELF_APPROVAL` |
| Employee reviews an HR request | `HR_REQUEST_NEEDS_ADMIN` |
| Second employee reviews an HR request | `HR_REQUEST_NEEDS_ADMIN` |
| Admin approves an HR request | Approved, reviewer set, audit row written |
| HR approves an employee request | Approved, reviewer set, audit row written |
| Admin approves an employee request | Approved |
| Second employee reviews an employee request | `EMP_REQUEST_NEEDS_HR` |
| Admin request is reviewed | `ADMIN_REQUEST_UNSUPPORTED` |
| Cross-company employee reviews | `REVIEWER_UNAUTHORIZED` |
| Cross-company admin reviews | `REVIEWER_UNAUTHORIZED` |
| Re-review an approved request | `ALREADY_REVIEWED` |
| Invalid decision value | `INVALID_DECISION` |
| Unknown request id | `REQUEST_NOT_FOUND` |
| Rejection path | Status `rejected`, audit row written |

Result: pass. The hierarchy is enforced in SQL, not only in the UI.

## 8. AC-02: roles and active accounts

### API authorization

| Call | Caller | Result |
|---|---|---|
| `create-employee` | No token | `401 UNAUTHENTICATED` |
| `create-employee` | Employee | `403 HR_OR_ADMIN_ONLY` |
| `create-hr` | HR | `403 ADMIN_ONLY` |
| `create-employee` | Admin of another company | `403 HR_OR_ADMIN_ONLY` |
| `review-wfh-request` | Employee | `400 HR_REQUEST_NEEDS_ADMIN` |
| `generate-wfh-passcode` | Employee | `400 GENERATOR_UNAUTHORIZED` |
| `admin-correct-attendance` | Employee | `400 CORRECTION_UNAUTHORIZED` |
| `mark-wfh-attendance` | No token | `401 UNAUTHENTICATED` |

After the blocked calls: 0 fake users, the pending request was still pending, 0 passcodes were created, and the attendance record was unchanged.

### Inactive accounts

| Case | Result |
|---|---|
| Inactive employee scans office QR | `EMPLOYEE_INACTIVE` |
| Inactive employee marks WFH | `EMPLOYEE_INACTIVE` |
| Inactive employee submits WFH request | `EMPLOYEE_INACTIVE` |
| Inactive company scans office QR | `COMPANY_INACTIVE` |
| Inactive company marks WFH | `COMPANY_INACTIVE` |
| Inactive company submits WFH request | `COMPANY_INACTIVE` |
| Unconfirmed email signs in | `Email not confirmed` |

`remove-employee` deletes the membership, employee row, and auth login. The code path was reviewed; it was not run against a fixture because it is destructive and already covered by the deletion order.

## 9. AC-13 and AC-14: feedback

### Validation (AC-13)

| Case | Result |
|---|---|
| Scores 0 to 10 | Accepted; 5 ratings stored |
| Score -1 | `SCORE_OUT_OF_RANGE` |
| Score 11 | `SCORE_OUT_OF_RANGE` |
| Empty score object | `NO_SCORES` |
| Unknown criterion | `INVALID_CRITERION` |
| Period end before start | `INVALID_PERIOD` |
| Admin reviews an employee | `ADMIN_CAN_REVIEW_HR_ONLY` |
| HR reviews HR | `HR_CAN_REVIEW_EMPLOYEE_ONLY` |
| Employee reviews | `REVIEWER_UNAUTHORIZED` |
| Cross-company reviewer | `REVIEWER_UNAUTHORIZED` |
| Admin reviews HR | Accepted; 5 ratings and audit row |

Comments, period dates, and five criteria are stored. Scores are constrained by both the function and a database check.

### Access (AC-14)

| Viewer | Reviews visible | Ratings visible |
|---|---:|---:|
| Subject employee | 1 | 5 |
| Colleague in same company | 0 | 0 |
| Reviewer HR | 1 | 5 |
| Admin | 1 | 5 |
| Cross-company employee | 0 | 0 |
| Anon | 0 | 0 |

Result: pass. Only the subject, the reviewer, and HR/admin can read the review.

## 10. AC-16: audit entries

Observed actions:

- `company.created`
- `hr.created`
- `employee.created`
- `attendance.checkin`
- `attendance.checkout`
- `attendance.corrected` with old check-in/check-out, new values, and reason
- `wfh.attendance_marked`
- `wfh.attendance_checkout`
- `wfh.approved`
- `wfh.rejected`
- `wfh.passcode_generated`
- `feedback.submitted`

Correction validation also works:

- Short reason: `REASON_REQUIRED`
- Check-out before check-in: `INVALID_TIMES`

Result: pass. Admin A can read the company audit log; HR and employees see 0 rows under the current admin-only policy.

## 11. AC-01 and AC-03: onboarding

Both QA companies were created through the real `register-company` function:

| Company | Shifts | Policies | Employees | Members | Admin role |
|---|---:|---:|---:|---:|---|
| Alpha | 1 | 1 | 4 | 4 | `admin` |
| Beta | 1 | 1 | 2 | 2 | `admin` |

- Default shift: 09:00 to 18:00, 10-minute grace, Monday to Friday.
- Default WFH policy: enabled, 120-minute cutoff.
- Employee codes are generated at creation (`ADM-001`, `EMP-780562`, `HR-780668`, and others) before the first login.
- Duplicate slug: rejected with `companies_slug_key`; the half-created auth user was deleted (0 orphans).
- Duplicate email: rejected before company creation (0 orphan companies).
- Wrong password: `Invalid login credentials`.
- Password change: accepted, old password stopped working, new password worked, then changed back.
- Reset request: unknown and known emails both return 200 (no account enumeration), and a recovery token was issued for the known account.

## 12. Findings

### 12.1 P1, fixed locally, deployment action required: legacy anon key

The web app used the legacy JWT anon key. It is now rejected:

- PostgREST returned `401 Invalid API key`.
- The Functions gateway returned `401 UNAUTHORIZED_LEGACY_JWT`.
- The same requests work with the project publishable key.

This means any deployed build with the old key cannot read or write data. Local fix:

- `apps/web/.env` now uses `sb_publishable_orlLZxMG1G8iERFil3cjzQ_iCJzWTVA`.
- `apps/web/.env.example` has the same value.
- `apps/web/dist` was rebuilt and contains the publishable key, not the legacy key.

Still required: update `VITE_SUPABASE_ANON_KEY` in the hosting provider and redeploy.

### 12.2 P2, decision required: plaintext passcode stored

`wfh_passcodes.passcode_display` stores the six-digit passcode in plaintext. `my_wfh_passcode` returns it to the owner, HR, and admin so the code can be shown again after approval.

Access is correctly scoped:

- Owner, HR, and admin can read it.
- A colleague, a cross-company employee, and anon get `UNAUTHORIZED`.

If the requirement is strictly "hash only", the re-display feature must be removed and the column dropped. If re-display is intended, the current behavior is consistent, but the data is not hash-only.

### 12.3 P2, reliability: employee creation waits for SMTP

`create-employee` awaits the confirmation email inside the request. One test call timed out in the test harness while waiting for the response. The employee and audit row were created, but the HTTP response was lost. A browser may show an error and the user may retry, creating a duplicate.

Recommendation: send the confirmation email with `EdgeRuntime.waitUntil` or after the response, and make the create call idempotent by email.

### 12.4 P3, requirements mismatch: "single-use" passcode

The passcode is valid twice: once for check-in and once for check-out. The third use returns `PASSCODE_USED`. The UI says "Valid twice", while the written rule says "single-use".

If one use is required, check-out needs a different mechanism. If two uses are intended, update the wording in the spec and test plan.

### 12.5 P3: passcode expiry uses UTC end of day

`generate-wfh-passcode` sets expiry to `request_dateT23:59:59Z`. For Asia/Kolkata this is 05:29 the next local day. The `work_date` check prevents use on the next day, so this is a display/consistency issue, not an attendance hole.

### 12.6 P3: duplicate `generate_wfh_passcode` overloads

There are 4-argument and 5-argument versions, and the 5-argument one has a default. A 4-argument call fails with `function is not unique`. The edge function uses 5 arguments, so production was unaffected.

**Resolved:** `010a_request_read_hardening.sql` drops the unused 4-argument overload and keeps the guarded 5-argument function.

### 12.7 P3: helper functions executable by anon

`company_role`, `company_role_map`, `my_wfh_passcode`, and the RLS helpers are executable by anon. Every one was tested as anon and from another company and returned no data, so there is no leak. If nothing calls them before login, revoke anon execute for hygiene. The web app only calls `company_role_map` and `my_wfh_passcode` from authenticated pages.

### 12.8 P3: HR cannot read audit logs

The audit policy is admin-only. HR sees 0 audit rows. If HR is expected to review attendance corrections, the policy needs a separate HR read rule. Confirmed behavior, not a defect.

### 12.9 P3: correction checks record existence before role

`admin_correct_attendance` returns `RECORD_NOT_FOUND` before checking the actor's role. An authenticated user can probe whether a record id exists. The ids are unguessable UUIDs, so the risk is low. Checking the role first would remove the oracle.

## 13. Manual checks still needed

1. Click a real signup confirmation link, an invite link, and a reset-password link from a real inbox. The request, token, and single-use logic are in place, but the click-through needs mail access.
2. Redeploy the web app with the publishable key and set the Supabase Site URL and redirect allowlist to the deployed origin.
3. Re-pair QR displays after the deploy. The old displays were paired against the previous origin.
4. AC-12 filter consistency was covered by the section 17 pass. Re-run it after any future
   pagination, sorting, or filter changes.
5. AC-04 and the employee leg of AC-17 after the mobile app exists.
6. iOS testing is not possible on this Windows machine; Android only.

## 14. Fixture cleanup

The two QA companies and six QA users are still in the database so Phase 5b can reuse them. They are isolated from `vorldx`, but they use the known test password `QaTest!2345`. Remove them before the final submission if Phase 5b is complete, or if you do not want test logins in the project.

The Phase 5b mobile pass seeded a small demo set for the QA employee in Company A so the app screens have
content: attendance for 14-20 October, an approved WFH request for 22 October with passcode `482915`, one
approved and one pending leave request, and one feedback review. The exact list is in
`docs/mobile-test-plan.md`. Deleting the company removes all of it.

To remove them when finished:

```sql
delete from public.companies where slug like 'p5a-20261021a-%';

delete from auth.identities
where user_id in (
  select id from auth.users where email like 'p5a-20261021a-%@example.com'
);

delete from auth.users
where email like 'p5a-20261021a-%@example.com';
```

Company deletion cascades attendance, WFH, feedback, QR, and audit rows. Delete the auth users after the companies so the memberships are already gone.

## 15. Reproduce

The checks were run through the Supabase MCP with transaction-wrapped SQL and direct HTTP calls to the hosted project. The key patterns:

```sql
-- Impersonate a user for RLS checks
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"<user-uuid>","role":"authenticated"}';
select count(*) from public.employees where company_id = '<other-company>';
rollback;
```

```sql
-- Exercise a business function, then roll back
begin;
insert into public.qr_displays (company_id, display_name, device_secret_hash)
values ('<company>', 'QA Display', 'qa-device-hash');
insert into public.qr_sessions (company_id, display_id, token_hash, expires_at)
select '<company>', id, 'qa-token-000000000001', now() + interval '30 seconds'
from public.qr_displays where display_name = 'QA Display';
select public.process_office_attendance('qa-token-000000000001', '<employee>');
rollback;
```

API calls used the publishable key in `apikey` and a real user JWT in `Authorization: Bearer ...`.

## 16. HR/Admin dashboard metrics QA (22 Oct 2026)

The dashboards were replaced with live aggregate data from
`public.get_dashboard_metrics(p_company_id, p_days)` in
`supabase/migrations/008a_dashboard_metrics.sql`. The RPC is `security definer`, verifies an
active HR/Admin membership, and is granted only to `authenticated`.

### 16.1 Permission checks

| Caller | Result |
| --- | --- |
| Admin JWT, QA company, 30 days | HTTP 200 with metrics |
| HR JWT, QA company, 30 days | HTTP 200 with the same company metrics |
| Employee JWT, QA company | HTTP 400, `FORBIDDEN` |
| No JWT / anon key | HTTP 401, `permission denied for function` |

### 16.2 Seed and cleanup cycle

- `supabase/seed/demo_dashboard_data.sql` executed successfully twice and is idempotent.
- `supabase/seed/demo_dashboard_cleanup.sql` removed all demo employees/displays and reset the
  HR demo requests. It preserved the four existing QA employee records (2 employees, 1 HR,
  1 Admin) and the existing 2 WFH and 2 leave requests.
- Tested state after the 22 Oct seed: 16 demo employees, 1,337 demo attendance rows, 13 demo WFH
  requests, 7 demo leave requests, 10 demo feedback reviews, 3 demo QR displays. The 23 Oct
  re-seed produced 1,333 attendance rows; see section 17.
- Full credentials, metric definitions, and expected values: `docs/demo-data.md`.

### 16.3 Browser QA

Playwright (Chromium) checked HR and Admin dashboards at 1440x1000 and 390x844:

- No console errors or page errors.
- No horizontal page overflow.
- 7d / 30d / 90d range switches complete without errors.
- Buttons and links use the pointer cursor; disabled controls use `not-allowed`.
- Attendance trend renders deterministically with Recharts animation disabled.
- Donut, department breakdown, queues, today's team, workforce health, QR health, HR activity,
  and admin audit sections all render from the RPC payload.

Screenshots are in
`C:\Users\safal\AppData\Local\Temp\opencode\pw-qa\` (`hr-30d.png`, `hr-7d.png`, `hr-mobile.png`,
`admin-30d.png`, `admin-90d.png`, `admin-mobile.png`).

The QR online count is a live heartbeat. The seed creates 1 online / 1 stale / 1 disabled display,
but the online display decays to stale after 2 minutes and offline after 10 minutes. Re-run the
seed immediately before a walkthrough to reset it.

### 16.4 Known data caveats

- Backdated leave cannot be seeded because the schema enforces `leave_date >= current_date - 1`.
  The 7/30/90-day `leave_days` totals are therefore 0; leave health uses the current month.
- The 90-day trend chart is capped at the latest 30 calendar days, matching the design decision.
- Demo employees are roster-only and have no auth accounts, so `unactivated` is 16 and is not
  surfaced as a dashboard KPI.

## 17. HR/Admin ownership and role-filter QA (23 Oct 2026)

### 17.1 Scope and implementation

`supabase/migrations/009a_employee_ownership.sql` adds `employees.created_by`, an ownership
index, an audit-log backfill, and server-side ownership guards in `review_wfh_request`,
`review_leave_request`, and `submit_feedback`. `create-employee` and `create-hr` now store the
creating user on every new employee row.

The visibility rule is:

- An active HR can review an employee they created.
- An employee with `created_by = null`, or whose creator is no longer an active HR, is
  **shared/unassigned** and can be reviewed by any HR.
- Admin can review any employee.
- HR-to-HR reviews remain Admin-only (`HR_REQUEST_NEEDS_ADMIN`).
- A cross-HR review is rejected with `EMPLOYEE_OWNED_BY_ANOTHER_HR`.

The web filters mirror this rule, but RLS and the database functions remain the enforcement
point. The HR directory **All people** and team-attendance **Employees** filters are intentionally
broad; only **Employees added by me** is ownership-scoped. Follow-up migration
`010a_request_read_hardening.sql` now scopes WFH/leave reads to the same ownership rule and
guards WFH passcode generation; verification of that follow-up is pending.

### 17.2 Fixtures and cleanup

A temporary second HR was created through the real `create-hr` function for isolation testing.
Three employee fixtures were added: one owned by the first HR, one owned by the second HR, and
one owned by Admin (shared). WFH and leave requests were created for each. Two HR attendance
rows and three fixture attendance rows were inserted to exercise the role filters.

All fixtures were removed after the run:

- Temporary second HR auth user, profile, membership, employee row, and HR requests deleted.
- Three fixture employees and their WFH/leave/attendance rows deleted.
- Two HR attendance test rows deleted.
- Test audit rows for the deleted requests and temp HR deleted.

A follow-up query confirmed 0 fixture employees, 0 temp auth users, and 0 fixture WFH, leave, or
attendance rows.

Final state: 20 employees (1 Admin, 1 HR, 18 employees), 1,338 attendance rows, 17 WFH
requests, 11 leave requests, 11 feedback reviews, and 3 QR displays. Of the 18 employee-role
records, 16 are owned by the active HR and 2 are Admin-created shared records. The Admin and HR
roster rows themselves have no creator, but they are not employee-role review subjects. All 18
employee-role records are visible to the HR.

### 17.3 Database enforcement

| Attempt | Result |
| --- | --- |
| HR1 reviews HR2's employee WFH request | `400 EMPLOYEE_OWNED_BY_ANOTHER_HR` |
| HR2 reviews HR1's employee WFH request | `400 EMPLOYEE_OWNED_BY_ANOTHER_HR` |
| HR1 reviews HR2's employee leave request | `400 EMPLOYEE_OWNED_BY_ANOTHER_HR` |
| HR2 reviews HR1's employee leave request | `400 EMPLOYEE_OWNED_BY_ANOTHER_HR` |
| HR1 reviews own employee WFH/leave | `200`, approved |
| HR1 reviews shared/Admin-created employee WFH/leave | `200`, approved |
| Admin reviews HR2's employee WFH | `200`, approved |
| HR reviews another HR's HR request | `400 HR_REQUEST_NEEDS_ADMIN` |

The blocked calls left the target requests pending. No cross-HR approval or duplicate review was
possible through the tested APIs. The feedback ownership guard is present in `submit_feedback`;
the browser candidate lists were verified, but a direct cross-HR feedback submission was not part
of this fixture run.

### 17.4 Browser QA

Playwright (Chromium) checked the changed Admin and HR screens at 1440x1000 and 390x844. The
fixture-era counts below include the temporary second HR; the final no-fixture counts follow.

| Screen | Fixture-era result |
| --- | --- |
| Admin Attendance default range | `2026-10-01` to `2026-10-23` in company timezone |
| Admin Attendance current month | 239 rows; no cap warning |
| Admin Attendance wide range | 1,000 rows with `Showing the latest 1000 records` |
| Admin Attendance reversed range | `Start date must be on or before end date.`; 0 rows |
| Admin WFH | Pending 2, approved 1; HR names only; no employee names |
| Admin Leave | Pending 2, approved 0, rejected 1; HR names only |
| Admin Feedback | Subject options exactly `QA Alpha HR` and `QA Second HR` |
| HR Employees filters | 24 all / 1 Admin / 2 HRs / 21 Employees / 17 added by me |
| HR Team attendance filters | 239 all / 2 HRs / 237 Employees / 230 added by me |
| HR WFH | Pending 5, approved 9; own and shared included, other HR's employee absent |
| HR Leave | Pending 3, approved 6; own and shared included, other HR's employee absent |
| HR Feedback | 20 candidates; own and shared included, other HR's employee absent |
| Second HR Employees | **Employees added by me** = 1; first HR's and demo employees absent |
| Second HR Team attendance | **Employees added by me** = 1 |
| Second HR WFH / Leave | Approved 3 / 3; own and shared included, demo employees absent |
| Second HR Feedback | 4 candidates |

The team-attendance **Employees** filter deliberately included the other HR's employee, while
**Employees added by me** excluded them. That verifies the requested broad role filter and the
ownership filter are not conflated.

No console errors, page errors, or document-level horizontal overflow were found on the checked
desktop or mobile screens. Screenshots are in
`C:\Users\safal\AppData\Local\Temp\opencode\pw-qa\` (`admin-attendance-desktop.png`,
`admin-wfh-desktop.png`, `admin-leave-desktop.png`, `admin-feedback-desktop.png`,
`hr-employees-mine-desktop.png`, `hr-attendance-employees-desktop.png`,
`hr-wfh-approved-desktop.png`, `hr-leave-approved-desktop.png`, `hr-feedback-desktop.png`, the
matching `-mobile` files, and the `hr2-*` isolation screenshots).

A final browser pass after cleanup confirmed these no-fixture counts:

- HR Employees: 20 all / 1 Admin / 1 HR / 18 Employees / 16 added by me.
- HR Team attendance, current month: 234 employee rows; 229 added by me; no HR attendance rows.
- HR WFH: 15 visible employee requests (5 pending, 7 approved, 3 rejected); HR Leave: 9
  visible employee requests (3 pending, 4 approved, 2 rejected).
- HR Feedback: 18 candidates.
- Admin WFH: 1 pending + 1 approved; Admin Leave: 1 pending + 1 rejected; Admin Feedback: 1 HR
  subject.

### 17.5 Findings and residual notes

No blocking finding was found in the ownership/filter work. All targeted database and browser
checks passed after cleanup.

- Cosmetic: the attendance cap warning renders `1000` rather than `1,000`.
- The second-HR isolation test required a temporary account; it was removed, so the checked-in
  demo now has one HR and lower filter counts than the fixture run.
- There is still no Admin UI to reassign an employee orphaned by a departing HR. Those records
  fall back to shared/unassigned, which preserves access but means any HR can review them.
- Cross-HR WFH passcode generation was not ownership-restricted during this QA run. It is now
  addressed by `supabase/migrations/010a_request_read_hardening.sql`; verification of that
  follow-up is pending.
- The metrics snapshot was taken before 09:25 IST, so today's checked-in count is 0. Re-run the
  seed later in the day for live attendance values.

## 18. Shift-end auto-absence QA (24 Oct 2026)

### 18.1 Scope and behavior

`supabase/migrations/011a_auto_absent.sql` was applied to `bcugjofjfdzahaleuzyt`, and the
`vorldx-auto-absent` cron job is active at `*/5 * * * *`.

The implemented rule is:

- Active HR and employees with a linked auth user are marked Absent at their shift end on a
  working day when no attendance row exists. Admin, inactive employees, and roster-only accounts
  without a login are excluded.
- Absent rows have `status = 'absent'`, `source = 'auto'`, and null attendance type, check-in, and
  check-out. Missing check-out is **not** absence; a checked-in day stays present/late.
- Approved leave suppresses and clears an auto-absent row. Pending leave does not block the job.
- Check-in after shift end is rejected immediately (`SHIFT_ENDED`). Once an absent row exists, the
  app cannot change it; checkout returns `ABSENT_FINAL` until an Admin correction.
- No backfill is performed. `auto_absent_started_at` bounds the job's eight-day lookback, and
  re-enabling the policy resets that timestamp to `now()`.
- Admin corrections can convert an absent row to present/late and infer office type and
  present/late status from the shift.
- Metrics are role-scoped: Admin includes active HR plus employees; HR includes active employees
  only and receives no HR queue. Attendance-rate denominator remains `expected - leave`, so
  absences lower the rate. `no_check_in = expected - checked_in - leave - absent`.
- Admin can enable/disable auto-absence; HR sees it read-only.

### 18.2 Database QA

Controlled SQL QA ran on QA company `p5a-20261021a-alpha`. Only three non-admin staff are
activated: one HR and two employees. Sixteen DEMO employee rows are roster-only.

| Check | Expected | Actual | Result |
| --- | ---: | ---: | --- |
| Job creates rows for activated HR and employees | 3 | 3 | Pass |
| Admin and unactivated DEMO rows excluded | 0 | 0 | Pass |
| Absent shape (null type/check-in/check-out) | 3 valid | 3 valid | Pass |
| Rerun of the job | 0 new rows | 0 new rows | Pass |
| Rows before `auto_absent_started_at` | 0 | 0 | Pass |
| Admin metrics today | expected 3, absent 3 | expected 3, absent 3 | Pass |
| HR metrics today | expected 2, absent 2, no HR queue | expected 2, absent 2, no HR queue | Pass |
| Approved leave clears absent row and suppresses recreation | 0 rows | 0 rows | Pass |
| Pending leave does not block absence | 1 row | 1 row | Pass |
| Absent-to-present Admin correction | present, office, correction | present, office, correction | Pass |
| Checkout against an absent row | `ABSENT_FINAL` | `ABSENT_FINAL` | Pass |
| WFH check-in after shift end | `SHIFT_ENDED` | `SHIFT_ENDED` | Pass |
| Re-enable policy resets tracking date | new timestamp, no backfill | new timestamp, no backfill | Pass |

### 18.3 Browser smoke QA

Playwright (Chromium) signed in as the QA Admin and HR at 1440x1000. Temporary absent fixtures
were inserted for 23 and 24 October to exercise the visual states, then deleted.

| Screen | Result |
| --- | --- |
| Admin dashboard | `Absent today` and `Absences in range` KPIs render; range shows 3 |
| HR dashboard | Same KPIs render; range shows 2, confirming employee-only scope |
| Admin attendance, status=Absent | 6 fixture rows; blank type/check-in/check-out render `—` |
| HR attendance, status=Absent | 3 fixture rows for today; blank times render `—` |
| Admin policies | `Shift-end auto-absence` checkbox present and checked |
| HR policies | Auto-absence shown read-only; no checkbox |
| HR My attendance | `Absent` tile and absent row render correctly |
| Console/page errors | None on any checked screen |
| Horizontal overflow | None on any checked screen |

Screenshots are in `C:\Users\safal\AppData\Local\Temp\opencode\pw-qa\`:
`absent-fixture-admin-dashboard.png`, `absent-fixture-hr-dashboard.png`,
`absent-fixture-admin-attendance.png`, `absent-fixture-hr-attendance.png`,
`absent-fixture-hr-my-attendance.png`, plus the `auto-absent-*-policies.png` smoke captures.

After cleanup, the QA company reports 0 absent rows and 0 attendance rows on the fixture dates.
The shift remains `Day Shift` 09:00-18:00 with a 10-minute grace period and Monday-Friday working
days. Auto-absence is enabled and the cron job is active.

### 18.4 Build and lint

| Command | Result |
| --- | --- |
| Web `npm run build` (TypeScript + Vite 8.3.4) | Pass; 3,132 modules; chunk-size warning only |
| Web `npm run lint` (oxlint) | Pass; warnings only, no errors |
| Mobile `npx tsc --noEmit` | Pass |
| Mobile `npx expo lint` | Pass |

### 18.5 Residual notes

- Mobile changes were verified by typecheck, lint, and code review only; no Android device or iOS
  simulator run was performed for this change.
- The live web deployment was not updated; the production `dist` build was regenerated locally.
- Check-in guards were exercised through SQL and RPC calls, not by a live camera scan.
- Holidays still count as working days until a holiday calendar is added, as agreed.
- QA for `010a_request_read_hardening.sql` remains pending.
