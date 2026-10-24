# VorldX architecture (PDF Sec.2 + Sec.5)

Website: React + Vite + Tailwind, React Router, Recharts, RHF + Zod.
Mobile (Phase 6 last): React Native + Expo, expo-camera, expo-local-authentication.
Backend: Supabase Auth, Postgres + RLS, SQL SECURITY DEFINER functions, Edge Functions.

Data flow:
- Company signup -> Auth user -> `create_company_with_admin` (company, profile, admin membership, Day Shift 09:00-18:00 grace 10, policy cutoff 120, ADM-001, audit).
- HR activation: Admin creates employee row + membership invite -> HR signs up -> link user_id -> active.
- Employee activation: HR creates employee row -> employee selects company + email -> link -> dashboard.
- Office QR: Admin pairs `qr_displays` and issues a **device key** (raw kept only on the display PC; SHA256 fingerprint in `device_secret_hash`). Display calls `issue-office-qr` {display_id, device_secret} (Edge verifies the device key, generates 32B random token, SHA256 hash, expires now+18s, one mint per 5s) -> `issue_qr_session`. App scans -> `process-office-attendance` -> check-in/out + late via shift+grace in company TZ.
- WFH: `submit_wfh_request` checks cutoff shift_start-120m server time. `review_wfh_request` enforces employee->hr/admin, hr->admin, no self-approve. `generate_wfh_passcode` (Edge 6-digit, SHA256) stores hash only. `mark_wfh_attendance` single-use, wrong-user/expiry/date rejected, creates WFH record. Checkout via `checkout_attendance`.
- Feedback: `submit_feedback` validates hr->employee, admin->hr, scores 0-10, 5 criteria.
- Corrections: `admin_correct_attendance` with reason + audit old/new.
- Auto-absence: `vorldx-auto-absent` pg_cron job every 5 minutes marks active HR/employees (linked auth only) absent after their shift end on a working day when no check-in exists. Approved leave suppresses/clears the row. `auto_absent_started_at` prevents backfill; check-in after shift end is rejected and an absent row is correction-only.
- RLS: members read own scope, writes via privileged functions only for attendance/passcodes/sessions/audit. Service-role never in frontend.

Security: hash-only tokens/passcodes/device keys, device-bound QR minting, server expiry, per-display mint rate limit, no client role trust, audit append-only (threat model + evidence: security-notes.md).
