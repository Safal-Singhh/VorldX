# Security finding & fix — office QR could be minted remotely

**Status:** fixed (2026-10-17) · migration `006b_qr_device_secret` · edge function `issue-office-qr` v3
**Severity:** high for the anti-fraud purpose of office attendance (insider threat, no outside account needed beyond any employee login)

## What was wrong

The office display mints a QR token every 18 s through the `issue-office-qr` edge function.
The function accepted only `{display_id}` and performed **no caller verification** — a display
id was enough to mint a fresh token with the service role, from anywhere.

A display id is not a secret. It appears in the kiosk URL (`/display/<uuid>`), in browser
history and screenshots, and in the admin UI. Anyone who captured it once could call the public
endpoint (the anon key ships in the frontend bundle) with their own employee login and register
office check-ins/check-outs from home — permanently. The 18-second rotation did not help,
because the attacker could mint a fresh token on demand; `verify_jwt: true` did not help
either, since the anon key is a valid JWT.

**Attack before the fix**

1. Copy the display UUID from the kiosk URL bar (or history / screenshot / admin link).
2. `POST /functions/v1/issue-office-qr {display_id}` with the public anon key → valid 18 s token.
3. Use it through `process-office-attendance` as yourself → the record says "office" while you
   are at home, any day, indefinitely.

## The fix — bind minting to the device

1. **Device key at pairing.** Each display gets a 256-bit random key. The raw key lives only on
   the office PC (localStorage, stripped from the URL after the first open); the server stores
   only its SHA-256 fingerprint in `qr_displays.device_secret_hash` — the same "hash only"
   principle already used for QR tokens.
2. **Verified minting.** `issue_qr_session(display_id, token_hash, device_secret_hash, expires_at)`
   fails closed: no key configured → `DEVICE_KEY_REQUIRED`; mismatch → `DEVICE_KEY_INVALID`.
   Token expiry and the 18 s rule stay server-enforced.
3. **Anti-spam.** One mint per display per 5 s (`RATE_LIMITED`); the kiosk rotates every 18 s.
4. **Revocation.** `Regenerate device key` disconnects the old screen; `Disable` revokes the
   display entirely (existing behaviour).

The display UUID is now harmless even if photographed and posted online.

## Evidence (live project, 2026-10-17)

| Request | Result |
|---|---|
| `{display_id}` only — the old attack | `400 DEVICE_KEY_REQUIRED` |
| `{display_id, device_secret: wrong}` | `400 DEVICE_KEY_INVALID` |
| `{display_id, device_secret: correct}` | `200 {token, expires_at}` |
| correct call repeated within 5 s | `400 RATE_LIMITED` |
| opening `/display/<uuid>` without the key | screen shows "Device key required" |

## Related scan (same day)

- All other privileged edge functions (`create-hr`, `create-employee`, `remove-employee`,
  `process-office-attendance`, WFH/leave/feedback flows) already resolve the caller from the
  JWT and are caller-bound — verified, no changes needed.
- `register-company` is public by design (signup precedes login); it must run before a session
  exists.
- `handle_updated_at` trigger: search_path pinned (migration `006c`) to clear the advisor warning.
- Advisors left: `qr_sessions` / `wfh_passcodes` have RLS enabled with **no policies** — that is
  intentional deny-all for app roles; only server-side functions touch them.

## Residual risk & next steps

- A device key is a bearer credential for that one display. If the office PC is compromised,
  regenerate the key from Admin → QR displays.
- Run the office screen in fullscreen/kiosk mode as extra hygiene (defence in depth, not the fix).
- "Buddy scanning" (a colleague's camera at the office door) is out of scope of the QR design:
  the display screen remains the trust anchor.

---

# Addendum — account lifecycle hardening (2026-10-18)

**Status:** implemented · edge functions `register-company` v4, `create-hr` v4, `create-employee` v2 · pages `ResetPassword`, `ChangePassword`

## Gaps found in the auth lifecycle review

1. The reset-password email linked to a page that never called `auth.updateUser` — the flow was
   a dead end for users who forgot their password.
2. No self-service password change for signed-in users.
3. All logins were created with `email_confirm: true` (pre-confirmed), so verification was
   impossible even though the flow looked normal.
4. `register-company` / `create-hr` could leave an **orphan auth user** behind if a later record
   step failed: the email was then permanently taken, but the account had no company.
5. Onboarding depended on admin-set passwords that were shared out-of-band.

## What changed

- **Reset & invite links** — `/reset-password` now handles both `type=recovery` and
  `type=invite` sessions (supabase-js reads the token fragment), lets the user set a password
  via `auth.updateUser`, then signs out to log in cleanly. Expired/used links get a clear state.
- **Change password** — Profile (Admin & HR) re-authenticates with the current password before
  `updateUser`, so a walked-away session cannot silently change the password.
- **Verification & invites** — account creation now uses `email_confirm: false` plus a
  confirmation email (`auth.resend`), and empty password → `admin.inviteUserByEmail` with a
  `redirect_to` back to `/reset-password` (the invitee chooses their own password).
  Enforcement is the project switch "Confirm email" in Supabase Auth.
- **Rollback on failure** — every failure path after login creation deletes the login (and any
  half-inserted employee row). No orphan auth users.
- **UX** — login shows a specific "email not confirmed" state with a resend action; signup tells
  the admin to confirm before logging in when confirmation is enforced.
- **Abandoned signup cleanup** — `cleanup_unconfirmed_signups()` deletes companies older than 48h
  that have **no confirmed member**, freeing the slug and the email address. A signup is permanent
  from the moment any member confirms their email; companies with attendance/WFH/leave/feedback
  activity and auth users shared with another company are never touched. It is `service_role`
  only, defaults to dry-run, and runs daily at 03:00 UTC via `pg_cron`
  (`vorldx-cleanup-unconfirmed-signups`).

## Why it matters (interview framing)

- The reset flow is now correct **end-to-end** (token → session → password update → sign-out).
- Orphan-account cleanup closes the "email permanently squatted" denial-of-service on signup —
  the same failure-safe principle already used by `create-employee`.
- Verification turns "we send emails" into "accounts are provably owned" — the usual baseline
  for any production auth.

## Mail delivery (Gmail SMTP)

- Supabase Auth's custom SMTP uses Gmail (`smtp.gmail.com:465`) with a Google **App Password**
  (never the account password). The sender address must equal the Gmail account — Gmail rejects
  other senders; no custom domain needed.
- Reset/invite links are single-use and a new request replaces the previous token, so only the
  newest email works — the UI tells users to request once and use the newest email.
- Supabase Auth → "Confirm email" ON, Site URL + redirect allowlist include `/reset-password`
  and `/login` for the deployed origin.
- No mail secrets live in this repository.

---

# Addendum — HR employee ownership enforcement (2026-10-23)

**Status:** implemented · migrations `009a_employee_ownership.sql`,
`010a_request_read_hardening.sql` · edge functions `create-employee`, `create-hr` ·
server-side WFH/leave/feedback guards

## What changed

- **Ownership column.** `employees.created_by` records the user who created the employee row.
  `create-employee` and `create-hr` populate it from the authenticated caller. The bootstrap
  admin row in `create_company_with_admin` is attributed to that admin.
- **Backfill.** Existing rows were filled from the earliest `employee.created` audit event. Rows
  with no usable audit trail stay `null` and are treated as shared.
- **Shared/unassigned fallback.** An employee is shared when `created_by` is `null`, points to an
  Admin, or points to a user who is no longer an active HR. This prevents employees from
  disappearing when the HR who added them is deactivated.
- **Server-side review guard.** `review_wfh_request`, `review_leave_request`, and
  `submit_feedback` reject an active-HR reviewer when the employee was created by a different
  active HR: `EMPLOYEE_OWNED_BY_ANOTHER_HR`. Admin bypasses the ownership check. HR-to-HR
  reviews remain Admin-only (`HR_REQUEST_NEEDS_ADMIN`).
- **UI filters.** The web app mirrors the rule on the HR Employees, Team attendance, WFH, Leave,
  and Feedback screens, and limits Admin WFH/Leave/Feedback to HRs. The filters are convenience
  and reporting controls; RLS policies and database functions are the enforcement point.
- **Read scoping.** Migration `010a_request_read_hardening.sql` replaces the broad HR read
  policies on WFH and leave. `can_read_employee_request` allows Admin all, employee self, and HR
  own-created plus unassigned employee-role requests. HR-role requests remain Admin-only apart
  from the requester's own self-read. The broad **All people** and **Employees** directory filters
  remain intentionally ownership-agnostic; the narrower rule applies to request queues.
- **Passcode ownership.** `generate_wfh_passcode` now mirrors the review hierarchy: HR can generate
  only for their own or unassigned employee requests; HR-role requests require Admin. The legacy
  four-argument RPC overload was removed.

Verification of the `010a` read policies and passcode guard is pending; the user will run it
separately.

## Evidence (temporary second HR, 23 Oct 2026)

| Attempt | Result |
| --- | --- |
| HR1 reviews HR2's employee WFH request | `400 EMPLOYEE_OWNED_BY_ANOTHER_HR` |
| HR2 reviews HR1's employee WFH request | `400 EMPLOYEE_OWNED_BY_ANOTHER_HR` |
| HR1 reviews HR2's employee leave request | `400 EMPLOYEE_OWNED_BY_ANOTHER_HR` |
| HR2 reviews HR1's employee leave request | `400 EMPLOYEE_OWNED_BY_ANOTHER_HR` |
| HR1 reviews own employee WFH/leave | `200` |
| HR1 reviews shared/Admin-created employee WFH/leave | `200` |
| Admin reviews HR2's employee WFH | `200` |
| HR reviews an HR request | `400 HR_REQUEST_NEEDS_ADMIN` |

The blocked calls left the target requests pending. The temporary second HR, its auth user, and
all ownership fixtures were deleted after the run. In the final demo, 16 of the 18 employee-role
records are owned by the active HR and 2 are Admin-created shared records; no employee-role row
is currently unassigned. Browser QA confirmed the requested Admin and HR filter counts at
1440x1000 and 390x844 with no console errors or document overflow; see
`docs/test-report.md` section 17.

## Residual risk

- There is no Admin reassignment UI for employees orphaned by a departing HR. They fall back to
  shared, so any HR can review them. Reassigning ownership currently requires SQL.
- Ownership follows the creator's **current** membership. Deactivating an HR makes their
  employees shared; reactivating the HR restores the original ownership because the guards check
  active-HR status at read and review time.
- The known passcode findings remain unchanged: `wfh_passcodes.passcode_display` stores the
  six-digit code in plaintext for re-display, and expiry uses UTC end-of-day rather than company
  local end-of-day (sections 12.2 and 12.5 above).
