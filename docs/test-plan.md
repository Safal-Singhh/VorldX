# VorldX test plan (PDF Sec.14 AC-01..AC-18)

Unit (Vitest): deadline cutoff, late boundary (09:00+10m -> 09:10 present, 09:11 late), status transitions, feedback 0-10 validation, passcode expiry.
DB: UNIQUE(company,employee,date), single-use race (two concurrent mark_wfh same hash -> one PASSCODE_USED), RLS cross-company blocked, self-approval blocked.
API: expired QR rejected, duplicate scan idempotent (check-in then checkout then ALREADY_CHECKED_OUT), unauthorized role rejected, late WFH rejected, wrong/used passcode rejected.
E2E: signup -> add HR -> add employee -> activate -> pair display -> QR check-in/out -> dashboard refresh. WFH: request before cutoff -> approve -> passcode -> mark -> history/chart.
Manual demo must show rejections: expired QR, unauthorized signup, late WFH, wrong passcode, role escalation.
Security: QR minting is device-bound — display id only -> DEVICE_KEY_REQUIRED, wrong key -> DEVICE_KEY_INVALID, bursts within 5s -> RATE_LIMITED, /display/<uuid> without key shows "Device key required" (evidence in security-notes.md).
Auth lifecycle: reset link is single-use and a new request cancels older emails (use the newest email) -> /reset-password -> set password -> login with new password; invite (empty password) -> email -> set own password -> login; change password rejects wrong current password; wrong signup slug leaves no orphan auth user (email reusable); unconfirmed login shows resend action; confirmed login flows unchanged. Zombie cleanup: dry-run lists nothing when all members are confirmed; an unconfirmed signup older than 48h is listed by dry-run, removed by a real run (company + unconfirmed user), the slug is reusable, a confirmed signup is never removed, and a second run is a no-op.
